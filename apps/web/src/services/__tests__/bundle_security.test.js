import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Source & Build Output Credential Scrubbing', () => {
  const srcDir = path.resolve(__dirname, '../..');
  const distDir = path.resolve(__dirname, '../../../dist');

  function scanDirForPattern(dir, pattern) {
    if (!fs.existsSync(dir)) return [];
    const matches = [];
    const files = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
    for (const f of files) {
      if (f.isFile() && !f.name.endsWith('.test.js') && !f.name.endsWith('.test.jsx')) {
        const fullPath = path.join(f.parentPath || dir, f.name);
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          if (pattern.test(content)) {
            matches.push(fullPath);
          }
        } catch {
          // ignore binary read errors
        }
      }
    }
    return matches;
  }

  it('ensures no hardcoded passwords exist in apps/web/src', () => {
    const leakedPasswordFiles = scanDirForPattern(srcDir, /Password123!/);
    expect(leakedPasswordFiles).toEqual([]);
  });

  it('ensures no hardcoded admin test emails exist in apps/web/src', () => {
    const leakedAdminFiles = scanDirForPattern(srcDir, /admin@aniresq\.com/);
    expect(leakedAdminFiles).toEqual([]);
  });

  it('ensures production dist bundle (if built) contains no sensitive strings or credentials', () => {
    if (fs.existsSync(distDir)) {
      const forbiddenStrings = ['Password123', 'admin@aniresq.com', 'service_role', 'eyJhbGciOi'];
      for (const str of forbiddenStrings) {
        const pattern = new RegExp(str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
        const matches = scanDirForPattern(distDir, pattern);
        expect(matches, `Expected no occurrences of forbidden string "${str}" in dist bundle, found in: ${matches.join(', ')}`).toEqual([]);
      }
    }
  });
});
