import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('API Boundary Security Check', () => {
  const restrictedTables = [
    'rescues',
    'rescue_timeline',
    'animals',
    'adoption_applications',
    'lost_and_found',
    'lost_and_found_replies',
    'notifications',
    'users',
    'audit_logs',
    'system_settings',
  ];

  function getAllSourceFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        if (file !== 'node_modules' && file !== '__tests__' && file !== 'dist') {
          getAllSourceFiles(filePath, fileList);
        }
      } else if (/\.(js|jsx|ts|tsx)$/.test(file)) {
        fileList.push(filePath);
      }
    }
    return fileList;
  }

  it('ensures frontend never calls supabase.from() directly on restricted tables', () => {
    const srcDir = path.resolve(__dirname, '../../');
    const sourceFiles = getAllSourceFiles(srcDir);
    const violations = [];

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      for (const table of restrictedTables) {
        // Match supabase.from('table') or supabase.from("table") or supabase.from(`table`)
        const regex = new RegExp(`supabase\\s*\\.\\s*from\\s*\\(\\s*['"\`]${table}['"\`]\\s*\\)`, 'g');
        if (regex.test(content)) {
          violations.push({
            file: path.relative(srcDir, file),
            table,
          });
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
