import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { createNodeTestArgs, findTestFiles, runTestFile, type SpawnChild } from './run-tests';

test('discovers colocated and centralized tests without running browser journeys', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'camms-test-discovery-'));
  const expected = [
    'components/ui/crop.test.tsx',
    'components/ui/layout.test.ts',
    'features/items/schema.test.ts',
    'features/items/form.test.tsx',
    'tests/unit/utils.test.ts',
    'tests/component/button.test.tsx',
    'tests/integration/items.test.ts',
    'lib/date.test.ts',
    'scripts/runner.test.ts',
  ];
  try {
    for (const file of [...expected, 'tests/e2e/journey.test.ts', 'scratch/draft.test.ts']) {
      const target = join(projectRoot, file);
      await mkdir(join(target, '..'), { recursive: true });
      await writeFile(target, '');
    }
    const discovered = await findTestFiles(projectRoot);
    assert.deepEqual(
      discovered.map((file) => relative(projectRoot, file).replaceAll('\\', '/')).sort(),
      [...expected].sort(),
    );
  } finally {
    await rm(projectRoot, { recursive: true, force: true });
  }
});

type Listener = (...args: never[]) => void;

function createFakeChild() {
  const listeners = new Map<string, Listener>();
  const signals: string[] = [];
  return {
    once(event: string, listener: Listener) {
      listeners.set(event, listener);
      return this;
    },
    kill(signal?: NodeJS.Signals) {
      if (signal) signals.push(signal);
      return true;
    },
    exit(code: number | null, signal: NodeJS.Signals | null = null) {
      listeners.get('exit')?.(code as never, signal as never);
    },
    get signals() {
      return signals;
    },
  };
}

test('builds one-file Node test invocations', () => {
  assert.deepEqual(createNodeTestArgs('scripts/example.test.ts', false), [
    '--import', 'tsx', '--test', 'scripts/example.test.ts',
  ]);
  assert.deepEqual(createNodeTestArgs('scripts/example.test.ts', true), [
    '--import', 'tsx', '--experimental-test-coverage', '--test', 'scripts/example.test.ts',
  ]);
});

test('resolves when a test file exits successfully', async () => {
  const child = createFakeChild();
  const result = runTestFile('C:/repo/scripts/example.test.ts', {
    root: 'C:/repo', coverage: false, timeoutMs: 100, spawnChild: (() => child) as SpawnChild,
  });
  child.exit(0);
  await result;
});

test('reports a failed test file', async () => {
  const child = createFakeChild();
  const result = runTestFile('C:/repo/scripts/example.test.ts', {
    root: 'C:/repo', coverage: false, timeoutMs: 100, spawnChild: (() => child) as SpawnChild,
  });
  child.exit(1);
  await assert.rejects(result, /scripts\/example\.test\.ts.*exit code 1/);
});

test('terminates and reports a timed-out test file', async () => {
  const child = createFakeChild();
  const result = runTestFile('C:/repo/scripts/example.test.ts', {
    root: 'C:/repo', coverage: false, timeoutMs: 25, spawnChild: (() => child) as SpawnChild,
  });
  await assert.rejects(result, /scripts\/example\.test\.ts.*25ms/);
  assert.deepEqual(child.signals, ['SIGTERM']);
});
