#!/usr/bin/env node
/**
 * scripts/gen-expected-migrations.mjs
 * 
 * Generates and validates the list of expected migrations for supabase/ops/live_audit.sql.
 * Usage:
 *   node scripts/gen-expected-migrations.mjs           # Prints expected SQL VALUES list
 *   node scripts/gen-expected-migrations.mjs --check   # Verifies live_audit.sql matches migrations dir
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(REPO_ROOT, 'supabase', 'migrations');
const LIVE_AUDIT_FILE = path.join(REPO_ROOT, 'supabase', 'ops', 'live_audit.sql');

export function getExpectedMigrations() {
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  return files.map(file => {
    const version = file.split('_')[0];
    return { version, filename: file };
  });
}

export function generateSqlValues(migrations) {
  return migrations
    .map(m => `    ('${m.version}', '${m.filename}')`)
    .join(',\n');
}

export function checkLiveAuditUpToDate() {
  if (!fs.existsSync(LIVE_AUDIT_FILE)) {
    return {
      ok: false,
      error: `Audit file not found: ${LIVE_AUDIT_FILE}`
    };
  }

  const liveAuditSql = fs.readFileSync(LIVE_AUDIT_FILE, 'utf8');
  const migrations = getExpectedMigrations();

  const missing = [];
  for (const m of migrations) {
    if (!liveAuditSql.includes(m.filename)) {
      missing.push(m.filename);
    }
  }

  return {
    ok: missing.length === 0,
    totalMigrations: migrations.length,
    missing
  };
}

if (process.argv[1] === __filename) {
  const args = process.argv.slice(2);
  const migrations = getExpectedMigrations();

  if (args.includes('--check')) {
    const result = checkLiveAuditUpToDate();
    if (!result.ok) {
      console.error('FAIL: live_audit.sql is out of date with supabase/migrations/!');
      console.error('Missing migration files in live_audit.sql:', result.missing);
      process.exit(1);
    }
    console.log(`PASS: live_audit.sql contains all ${result.totalMigrations} repository migrations.`);
    process.exit(0);
  }

  console.log('-- Expected migration VALUES list for live_audit.sql:');
  console.log(generateSqlValues(migrations));
}
