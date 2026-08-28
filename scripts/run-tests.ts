#!/usr/bin/env node
import { glob } from 'glob';
import { spawn, spawnSync, type SpawnOptions } from 'child_process';
import { dirname, join, relative, sep } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const TEST_TIMEOUT_MS = 60_000;

type TestChild = {
  pid?: number;
  once(event: 'error', listener: (error: Error) => void): TestChild;
  once(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): TestChild;
  kill(signal?: NodeJS.Signals): boolean;
};

export type SpawnChild = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => TestChild;

export type RunTestFileOptions = {
  root: string;
  coverage: boolean;
  timeoutMs: number;
  spawnChild: SpawnChild;
};

export function createNodeTestArgs(testFile: string, coverage: boolean): string[] {
  const nodeArgs = ['--import', 'tsx'];
  if (coverage) nodeArgs.push('--experimental-test-coverage');
  nodeArgs.push('--test', testFile);
  return nodeArgs;
}

function relativeTestPath(testFile: string, projectRoot: string) {
  return relative(projectRoot, testFile).split(sep).join('/');
}

function stopChild(child: TestChild) {
  child.kill('SIGTERM');
  if (process.platform === 'win32' && child.pid) {
    spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], {
      stdio: 'ignore',
      timeout: 5_000,
    });
  }
}

export function runTestFile(testFile: string, options: RunTestFileOptions): Promise<void> {
  const displayPath = relativeTestPath(testFile, options.root);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };

    const child = options.spawnChild('node', createNodeTestArgs(testFile, options.coverage), {
      cwd: options.root,
      stdio: 'inherit',
    });

    const timeout = setTimeout(() => {
      stopChild(child);
      finish(new Error(`Test timed out: ${displayPath} exceeded ${options.timeoutMs}ms`));
    }, options.timeoutMs);
    child.once('error', (error) => finish(new Error(`Test runner failed for ${displayPath}: ${error.message}`)));
    child.once('exit', (code, signal) => {
      if (code === 0) finish();
      else finish(new Error(`Test failed: ${displayPath}${signal ? ` (terminated by ${signal})` : ` (exit code ${code ?? 'unknown'})`}`));
    });
  });
}

async function findTestFiles() {
  const patterns = [
    'features/**/*.test.ts',
    'features/**/*.test.tsx',
    'tests/unit/**/*.test.ts',
    'tests/component/**/*.test.tsx',
    'tests/integration/**/*.test.ts',
    'lib/**/*.test.ts',
    'scripts/**/*.test.ts',
  ];

  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: root, absolute: true });
    files.push(...matches);
  }

  return files;
}

async function main() {
  const args = process.argv.slice(2);
  const coverage = args.includes('--coverage');

  const testFiles = await findTestFiles();

  if (testFiles.length === 0) {
    console.error('No test files found');
    process.exit(1);
  }

  console.log(`Found ${testFiles.length} test files`);

  try {
    for (const testFile of testFiles) {
      console.log(`Running ${relativeTestPath(testFile, root)}`);
      await runTestFile(testFile, {
        root,
        coverage,
        timeoutMs: TEST_TIMEOUT_MS,
        spawnChild: spawn as SpawnChild,
      });
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main();
}
