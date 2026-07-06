#!/usr/bin/env node
import { glob } from 'glob';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

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

  const nodeArgs = ['--import', 'tsx'];
  if (coverage) {
    nodeArgs.push('--experimental-test-coverage');
  }
  nodeArgs.push('--test', ...testFiles);

  const command = `node ${nodeArgs.join(' ')}`;
  console.log(`Running: ${command}`);

  try {
    execSync(command, { cwd: root, stdio: 'inherit' });
  } catch {
    process.exit(1);
  }
}

main();
