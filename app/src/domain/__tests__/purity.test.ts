import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const domainDir = join(__dirname, '..');

/** Every production .ts file under src/domain (tests excluded), relative to it, with forward slashes. */
function productionSources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' ? [] : productionSources(full);
    return name.endsWith('.ts') ? [relative(domainDir, full).replace(/\\/g, '/')] : [];
  });
}

const sources = productionSources(domainDir);
const modules = sources.filter((f) => !f.includes('/') && f !== 'index.ts');

const FORBIDDEN_MODULE =
  /(?:from|import|require\()\s*\(?\s*['"](?:node:[^'"]*|react(?:[-/][^'"]*)?|expo(?:[-/][^'"]*)?|@expo\/[^'"]*|@react-native[^'"]*|fs(?:\/[^'"]*)?|path|os|child_process|http|https|net|crypto)['"]/;
const CLOCK_READ = /Date\s*\.\s*now\s*\(|new\s+Date\s*\(\s*\)|performance\s*\.\s*now\s*\(/;

describe('domain purity', () => {
  it('has an index that re-exports every module', () => {
    const index = readFileSync(join(domainDir, 'index.ts'), 'utf8');
    for (const f of modules) {
      expect(index).toContain(`export * from './${f.replace(/\.ts$/, '')}';`);
    }
  });

  it.each(sources)('%s imports no React, React Native, Expo or I/O', (file) => {
    const code = readFileSync(join(domainDir, file), 'utf8');
    expect(code).not.toMatch(FORBIDDEN_MODULE);
  });

  it.each(sources)('%s never reads the clock', (file) => {
    const code = readFileSync(join(domainDir, file), 'utf8');
    expect(code).not.toMatch(CLOCK_READ);
  });

  it('recognises the violations it guards against', () => {
    for (const bad of [
      `import React from 'react';`,
      `import 'react-native';`,
      `import { x } from 'react/jsx-runtime';`,
      `import * as SQLite from 'expo-sqlite';`,
      `import { readFileSync } from 'node:fs';`,
      `import { readFile } from 'fs/promises';`,
      `const fs = require('fs');`,
      `const m = await import('expo-crypto');`,
    ]) {
      expect(bad).toMatch(FORBIDDEN_MODULE);
    }
    for (const bad of ['Date.now()', 'Date.now ()', 'new Date()', 'new Date( )', 'performance.now()']) {
      expect(bad).toMatch(CLOCK_READ);
    }
    for (const ok of [`import { addDays } from './time';`, 'new Date(at.getTime())', 'new Date(y, m - 1, d)']) {
      expect(ok).not.toMatch(FORBIDDEN_MODULE);
      expect(ok).not.toMatch(CLOCK_READ);
    }
  });
});
