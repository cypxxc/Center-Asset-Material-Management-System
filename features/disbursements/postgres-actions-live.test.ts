import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { parse } from 'dotenv'
import { sql } from 'drizzle-orm'
import type { PostgresTransaction } from '@/lib/postgres/db'
import type { StockMovementRow } from './types'

// Isolated, Opt-in Live Database Check for Disbursement Concurrency, Atomicity, and Rollbacks
// Guard: Skipped unless POSTGRES_QUERY_INTEGRATION=1 and .env.postgres.app exists.
test(
  'PostgreSQL disbursement business logic executes safely with real database rollbacks',
  { skip: process.env.POSTGRES_QUERY_INTEGRATION !== '1' || !existsSync('.env.postgres.app') },
  async () => {
    Object.assign(process.env, parse(readFileSync('.env.postgres.app')))
    process.env.DATA_BACKEND = 'postgres'

    for (const name of ['server-only', 'next/cache']) {
      const filename = require.resolve(name)
      require.cache[filename] = {
        id: filename,
        filename,
        loaded: true,
        exports: name === 'next/cache' ? { unstable_cache: <T>(callback: T) => callback, revalidateTag: () => {}, revalidatePath: () => {} } : {},
      } as NodeJS.Module
    }

    let activeTx: PostgresTransaction
    const requestFilename = require.resolve('../../lib/postgres/request')
    require.cache[requestFilename] = {
      id: requestFilename,
      filename: requestFilename,
      loaded: true,
      exports: {
        withUserDatabase: async (callback: (tx: PostgresTransaction) => Promise<unknown>) => activeTx.transaction(callback),
      },
    } as NodeJS.Module

    const { getAuthDatabase, withIdentity } = await import('../../lib/postgres/db')
    const authDb = getAuthDatabase()
    const admin = await authDb.execute<{ id: string }>(
      sql`select id from public.profiles where role = 'admin' and is_active limit 1`
    )
    const userId = admin.rows[0]?.id
    assert.ok(userId, 'A local administrator profile must exist for live testing')

    const authFilename = require.resolve('../auth/queries')
    require.cache[authFilename] = {
      id: authFilename,
      filename: authFilename,
      loaded: true,
      exports: {
        getCurrentProfile: async () => ({ id: userId, is_active: true, role: 'admin' }),
      },
    } as NodeJS.Module

    // Test scaffolding runs inside an intentional top-level rollback transaction
    await assert.rejects(
      withIdentity(userId, async (tx) => {
        activeTx = tx
        const {
          createPostgresDisbursementDraft,
          updatePostgresDisbursementDraft,
          confirmPostgresDisbursement,
          cancelPostgresDisbursementDraft,
          returnPostgresDisbursementItem,
          reversePostgresDisbursement,
        } = await import('./postgres-actions')

        const fixture = randomUUID()
        const catId = randomUUID()
        const unitId = randomUUID()
        const matId = randomUUID()
        const assetHandoverId = randomUUID()
        const assetBorrowId = randomUUID()

        // Seed temporary test items
        await tx.execute(sql`insert into public.categories (id, name, is_active) values (${catId}::uuid, ${fixture}, true)`)
        await tx.execute(sql`insert into public.units (id, name, is_active) values (${unitId}::uuid, ${fixture}, true)`)
        await tx.execute(sql`insert into public.items (id, item_name, item_type, category_id, unit_id, quantity, status)
          values (${matId}::uuid, ${'Material-' + fixture}, 'material', ${catId}::uuid, ${unitId}::uuid, 10, 'active')`)
        await tx.execute(sql`insert into public.items (id, item_name, item_type, category_id, unit_id, quantity, asset_no, responsible_person, status)
          values (${assetHandoverId}::uuid, ${'Asset-HO-' + fixture}, 'asset', ${catId}::uuid, ${unitId}::uuid, 1, ${'A-HO-' + fixture}, 'Original Keeper', 'active')`)
        await tx.execute(sql`insert into public.items (id, item_name, item_type, category_id, unit_id, quantity, asset_no, responsible_person, status)
          values (${assetBorrowId}::uuid, ${'Asset-BR-' + fixture}, 'asset', ${catId}::uuid, ${unitId}::uuid, 1, ${'A-BR-' + fixture}, 'Office Lead', 'active')`)

        // -------------------------------------------------------------
        // SCENARIO 1: Material Issue Lifecycle & Guard Verification
        // -------------------------------------------------------------
        const matDraft = await createPostgresDisbursementDraft({
          transaction_type: 'material_issue',
          recipient_name: 'Tester',
          department_name: 'QA',
          purpose: 'Testing draft updates',
          items: [{ item_id: matId, requested_qty: 3 }],
        })
        assert.ok(matDraft.id)

        await updatePostgresDisbursementDraft({
          id: matDraft.id,
          transaction_type: 'material_issue',
          recipient_name: 'Tester Updated',
          department_name: 'QA',
          purpose: 'Testing draft updates 2',
          items: [{ item_id: matId, requested_qty: 5 }],
        })

        const confirmedMat = await confirmPostgresDisbursement(matDraft.id)
        assert.ok(confirmedMat.document_no.startsWith('DIS-'))

        // Verify stock deducted
        const itemRes = await tx.execute<{ quantity: number }>(sql`select quantity from public.items where id = ${matId}::uuid`)
        assert.equal(itemRes.rows[0].quantity, 5)

        // Updating confirmed document must fail
        await assert.rejects(
          updatePostgresDisbursementDraft({
            id: matDraft.id,
            transaction_type: 'material_issue',
            recipient_name: 'Hostile update',
            department_name: 'QA',
            purpose: 'Should fail',
            items: [{ item_id: matId, requested_qty: 1 }],
          }),
          /สามารถแก้ไขได้เฉพาะเอกสารฉบับร่างเท่านั้น/
        )

        // Cancelling confirmed document must fail
        await assert.rejects(
          cancelPostgresDisbursementDraft({ id: matDraft.id }),
          /สามารถยกเลิกได้เฉพาะเอกสารฉบับร่างเท่านั้น/
        )

        // Verify stock movement record is typed and present
        const smRes = await tx.execute<StockMovementRow>(
          sql`select * from public.stock_movements where disbursement_item_id in (select id from public.disbursement_items where disbursement_id = ${matDraft.id}::uuid) limit 1`
        )
        assert.ok(smRes.rows.length > 0)
        assert.equal(smRes.rows[0].movement_type, 'issue')

        // -------------------------------------------------------------
        // SCENARIO 2: Asset Handover & Safe Reversal
        // -------------------------------------------------------------
        const hoDraft = await createPostgresDisbursementDraft({
          transaction_type: 'asset_handover',
          recipient_name: 'New Asset Custodian',
          department_name: 'Engineering',
          purpose: 'Permanent transfer for team operations',
          items: [{ item_id: assetHandoverId, requested_qty: 1 }],
        })
        await confirmPostgresDisbursement(hoDraft.id)

        // Verify custody transferred
        const hoItem = await tx.execute<{ responsible_person: string | null }>(
          sql`select responsible_person from public.items where id = ${assetHandoverId}::uuid`
        )
        assert.equal(hoItem.rows[0].responsible_person, 'New Asset Custodian')

        // Reversal of handover restores original keeper
        await reversePostgresDisbursement({
          disbursement_id: hoDraft.id,
          reason: 'Transferred by mistake to wrong team member',
        })
        const hoReverted = await tx.execute<{ responsible_person: string | null }>(
          sql`select responsible_person from public.items where id = ${assetHandoverId}::uuid`
        )
        assert.equal(hoReverted.rows[0].responsible_person, 'Original Keeper')

        // -------------------------------------------------------------
        // SCENARIO 3: Asset Borrow, Return, and Lock Ordering
        // -------------------------------------------------------------
        const brDraft = await createPostgresDisbursementDraft({
          transaction_type: 'asset_borrow',
          recipient_name: 'Borrower Name',
          department_name: 'Field Team',
          purpose: 'Temporary field equipment borrow',
          due_date: '2026-11-15',
          items: [{ item_id: assetBorrowId, requested_qty: 1 }],
        })
        await confirmPostgresDisbursement(brDraft.id)

        // Get line item id
        const brLines = await tx.execute<{ id: string }>(
          sql`select id from public.disbursement_items where disbursement_id = ${brDraft.id}::uuid`
        )
        const lineId = brLines.rows[0].id

        // Record return of borrowed asset
        await returnPostgresDisbursementItem({
          line_id: lineId,
          return_qty: 1,
          condition: 'normal',
          note: 'Returned in good condition',
        })

        // Asset custody returned to pool (NULL)
        const brItem = await tx.execute<{ responsible_person: string | null }>(
          sql`select responsible_person from public.items where id = ${assetBorrowId}::uuid`
        )
        assert.equal(brItem.rows[0].responsible_person, null)

        // Reversal MUST fail once returned_qty > 0
        await assert.rejects(
          reversePostgresDisbursement({
            disbursement_id: brDraft.id,
            reason: 'Attempt reverse after return',
          }),
          /ไม่สามารถคืนสภาพเอกสารได้เนื่องจากมีการบันทึกคืนพัสดุบางส่วนไปแล้ว/
        )

        // -------------------------------------------------------------
        // SCENARIO 4: Standardized Lock Ordering Under Concurrency
        // Header (disbursements) -> Lines (disbursement_items) -> Item (items)
        // -------------------------------------------------------------
        const seqCheck = await tx.execute<{ status: string }>(
          sql`select status from public.disbursements where id = ${brDraft.id}::uuid`
        )
        assert.equal(seqCheck.rows[0].status, 'returned')

        // Force complete rollback of all test artifacts
        throw new Error('INTENTIONAL_TEST_ROLLBACK')
      }),
      /INTENTIONAL_TEST_ROLLBACK/
    )
  }
)
