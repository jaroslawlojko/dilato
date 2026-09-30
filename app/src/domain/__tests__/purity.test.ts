import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const domainDir = join(__dirname, '..');
const sources = readdirSync(domainDir).filter((f) => f.endsWith('.ts'));

describe('domain purity', () => {
  it('has an index that re-exports every module', () => {
    const index = readFileSync(join(domainDir, 'index.ts'), 'utf8');
    for (const f of sources.filter((s) => s !== 'index.ts')) {
      expect(index).toContain(`'./${f.replace(/\.ts$/, '')}'`);
    }
  });

  it.each(sources)('%s imports no React, React Native, Expo or I/O', (file) => {
    const code = readFileSync(join(domainDir, file), 'utf8');
    expect(code).not.toMatch(/from ['"](react|react-native|expo[^'"]*|fs|path)['"]/);
  });

  it.each(sources)('%s never reads the clock', (file) => {
    const code = readFileSync(join(domainDir, file), 'utf8');
    expect(code).not.toMatch(/Date\.now\(|new Date\(\)/);
  });
});
