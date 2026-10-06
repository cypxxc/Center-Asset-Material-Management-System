import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function getGlobalsCss(): string {
  const cssPath = path.resolve(process.cwd(), 'app/globals.css');
  return fs.readFileSync(cssPath, 'utf-8');
}

function extractBlock(css: string, selectorRegex: RegExp): string {
  const match = css.match(selectorRegex);
  if (!match) {
    return '';
  }
  return match[0];
}

test('globals.css defines light theme design tokens in :root', () => {
  const css = getGlobalsCss();
  const rootBlockMatch = css.match(/:root\s*\{([^}]+)\}/);
  assert.ok(rootBlockMatch, ':root block should exist in globals.css');
  const rootBlock = rootBlockMatch[1];

  const expectedRootTokens: Record<string, string> = {
    '--background': '#f8fafc',
    '--foreground': '#0f172a',
    '--card': '#ffffff',
    '--card-foreground': '#0f172a',
    '--popover': '#ffffff',
    '--popover-foreground': '#0f172a',
    '--primary': '#2563eb',
    '--primary-foreground': '#ffffff',
    '--secondary': '#f1f5f9',
    '--secondary-foreground': '#1e293b',
    '--muted': '#f1f5f9',
    '--muted-foreground': '#64748b',
    '--accent': '#eff6ff',
    '--accent-foreground': '#1d4ed8',
    '--border': '#e2e8f0',
    '--input': '#cbd5e1',
    '--ring': '#2563eb',
    '--sidebar': '#ffffff',
    '--sidebar-foreground': '#334155',
    '--sidebar-primary': '#2563eb',
    '--sidebar-primary-foreground': '#ffffff',
    '--sidebar-accent': '#eff6ff',
    '--sidebar-accent-foreground': '#1d4ed8',
    '--sidebar-border': '#e2e8f0',
    '--sidebar-ring': '#93c5fd',
  };

  for (const [property, expectedValue] of Object.entries(expectedRootTokens)) {
    const regex = new RegExp(`${property}:\\s*${expectedValue}\\b`, 'i');
    assert.match(
      rootBlock,
      regex,
      `:root must define ${property}: ${expectedValue};`
    );
  }
});

test('globals.css defines dark theme design tokens with dual selector .dark, [data-theme="dark"]', () => {
  const css = getGlobalsCss();
  // Check for dual selector: .dark and [data-theme="dark"]
  const darkBlockMatch = css.match(/(?:\.dark\s*,\s*\[data-theme=["']?dark["']?\]|\[data-theme=["']?dark["']?\]\s*,\s*\.dark)\s*\{([^}]+)\}/);
  assert.ok(
    darkBlockMatch,
    'Dark theme block must exist with dual selector .dark, [data-theme="dark"]'
  );
  const darkBlock = darkBlockMatch[1];

  const expectedDarkTokens: Record<string, string> = {
    '--background': '#0f172a',
    '--foreground': '#f8fafc',
    '--card': '#1e293b',
    '--card-foreground': '#f8fafc',
    '--popover': '#1e293b',
    '--popover-foreground': '#f8fafc',
    '--primary': '#3b82f6',
    '--primary-foreground': '#ffffff',
    '--secondary': '#334155',
    '--secondary-foreground': '#f8fafc',
    '--muted': '#1e293b',
    '--muted-foreground': '#94a3b8',
    '--accent': '#1e293b',
    '--accent-foreground': '#60a5fa',
    '--border': '#334155',
    '--input': '#334155',
    '--ring': '#3b82f6',
    '--sidebar': '#0f172a',
    '--sidebar-foreground': '#f8fafc',
    '--sidebar-primary': '#3b82f6',
    '--sidebar-primary-foreground': '#ffffff',
    '--sidebar-accent': '#1e293b',
    '--sidebar-accent-foreground': '#60a5fa',
    '--sidebar-border': '#334155',
    '--sidebar-ring': '#3b82f6',
  };

  for (const [property, expectedValue] of Object.entries(expectedDarkTokens)) {
    const regex = new RegExp(`${property}:\\s*${expectedValue}\\b`, 'i');
    assert.match(
      darkBlock,
      regex,
      `Dark theme must define ${property}: ${expectedValue};`
    );
  }

  // Ensure dark background is slate-900 (#0f172a), never pitch black (#000000)
  assert.doesNotMatch(
    darkBlock,
    /--background:\s*#000000\b/i,
    'Dark background must never be #000000'
  );
});
