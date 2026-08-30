import assert from 'node:assert/strict';
import test from 'node:test';
import { createNodeTestArgs, runTestFile, type SpawnChild } from './run-tests';

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
