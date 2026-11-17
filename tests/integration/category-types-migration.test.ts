import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { Client } from 'pg'

// Opt-in: runs only in a new schema, rolls the entire schema back, never writes public data.
test('category migration preserves shared, exclusive, unused and archived references and enforces types', {
  skip: !process.env.CATEGORY_MIGRATION_TEST_URL,
}, async () => {
  const client = new Client({ connectionString: process.env.CATEGORY_MIGRATION_TEST_URL, connectionTimeoutMillis: 3000 })
  const schema = 'category_test_' + randomUUID().replaceAll('-', '')
  await client.connect()
  try {
    await client.query('BEGIN')
    await client.query(`CREATE SCHEMA ${schema}`)
    await client.query(`
      CREATE TABLE ${schema}.categories (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
        description text, color text DEFAULT '#64748B', icon text DEFAULT 'Tag', is_active boolean DEFAULT true,
        created_at timestamptz DEFAULT '2020-01-01', updated_at timestamptz DEFAULT '2020-02-01',
        CONSTRAINT categories_name_unique UNIQUE(name));
      CREATE TABLE ${schema}.items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_type text DEFAULT 'asset', category_id uuid REFERENCES ${schema}.categories(id), deleted_at timestamptz);
      CREATE TABLE ${schema}.materials (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_type text DEFAULT 'material', category_id uuid REFERENCES ${schema}.categories(id), deleted_at timestamptz, updated_at timestamptz DEFAULT '2020-02-01', metadata_version bigint DEFAULT 1);
      CREATE FUNCTION ${schema}.stamp() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
      CREATE FUNCTION ${schema}.version() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.metadata_version = OLD.metadata_version+1; RETURN NEW; END $$;
      CREATE TRIGGER categories_stamp BEFORE UPDATE ON ${schema}.categories FOR EACH ROW EXECUTE FUNCTION ${schema}.stamp();
      CREATE TRIGGER materials_stamp BEFORE UPDATE ON ${schema}.materials FOR EACH ROW EXECUTE FUNCTION ${schema}.stamp();
      CREATE TRIGGER version_material_changes BEFORE UPDATE ON ${schema}.materials FOR EACH ROW EXECUTE FUNCTION ${schema}.version();
      INSERT INTO ${schema}.categories (name,description,icon,is_active) VALUES ('shared','original','Laptop',false),('material-only',null,'Tag',true),('asset-only',null,'Tag',true),('unused',null,'Tag',true);
      INSERT INTO ${schema}.items (category_id) SELECT id FROM ${schema}.categories WHERE name IN ('shared','asset-only');
      INSERT INTO ${schema}.materials (category_id,deleted_at) SELECT id,now() FROM ${schema}.categories WHERE name IN ('shared','material-only');
    `)
    const original = (await client.query(`SELECT id FROM ${schema}.categories WHERE name='shared'`)).rows[0].id
    const materialOnly = (await client.query(`SELECT id FROM ${schema}.categories WHERE name='material-only'`)).rows[0].id
    const migration = readFileSync('db/postgres/migrations/0013_category_types.sql','utf8').replaceAll('public.', schema + '.')
    await client.query(migration)
    const categories = (await client.query(`SELECT id,name,item_type,description,icon,is_active,updated_at FROM ${schema}.categories ORDER BY name,item_type`)).rows
    assert.equal(categories.length, 5)
    assert.equal(categories.find(c => c.name === 'shared' && c.item_type === 'asset').id, original)
    const materialShared = categories.find(c => c.name === 'shared' && c.item_type === 'material')
    assert.notEqual(materialShared.id, original)
    assert.equal(materialShared.description, 'original')
    assert.equal(materialShared.icon, 'Laptop')
    assert.equal(materialShared.is_active, false)
    assert.equal(categories.find(c => c.id === materialOnly).item_type, 'material')
    assert.equal(categories.find(c => c.name === 'unused').item_type, 'asset')
    assert.ok(categories.every(c => c.updated_at.toISOString() === '2020-02-01T00:00:00.000Z'))
    const materials = (await client.query(`SELECT category_id,updated_at,metadata_version,deleted_at FROM ${schema}.materials`)).rows
    assert.ok(materials.some(m => m.category_id === materialShared.id))
    assert.ok(materials.some(m => m.category_id === materialOnly))
    assert.ok(materials.every(m => m.deleted_at && Number(m.metadata_version) === 1 && m.updated_at.toISOString() === '2020-02-01T00:00:00.000Z'))
    for (const query of [
      `INSERT INTO ${schema}.items (category_id) VALUES ('${materialShared.id}')`,
      `INSERT INTO ${schema}.materials (category_id) VALUES ('${original}')`,
      `UPDATE ${schema}.categories SET item_type='asset' WHERE id='${materialOnly}'`,
      `INSERT INTO ${schema}.categories(name,item_type) VALUES ('shared','material')`,
    ]) {
      await client.query('SAVEPOINT invalid_category')
      await assert.rejects(client.query(query), (error: { code?: string }) => ['23503','23505'].includes(error.code ?? ''))
      await client.query('ROLLBACK TO SAVEPOINT invalid_category')
    }
    await client.query(`INSERT INTO ${schema}.categories(name,item_type) VALUES ('unused','material')`)
  } finally {
    await client.query('ROLLBACK')
    await client.end()
  }
})
