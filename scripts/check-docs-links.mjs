#!/usr/bin/env node
/**
 * scripts/check-docs-links.mjs
 * 
 * Validates that all file references, relative links, and internal document paths
 * inside docs/ops/ resolve to valid files in the repository.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const OPS_DOCS_DIR = path.join(REPO_ROOT, 'docs', 'ops');

const docFiles = fs.readdirSync(OPS_DOCS_DIR).filter(f => f.endsWith('.md')).sort();

let totalLinksChecked = 0;
let errors = 0;

console.log(`Checking link and path integrity across ${docFiles.length} runbooks in docs/ops/...`);

for (const docFile of docFiles) {
  const filePath = path.join(OPS_DOCS_DIR, docFile);
  const content = fs.readFileSync(filePath, 'utf8');

  // Match markdown links: [text](target)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let match;

  while ((match = linkRegex.exec(content)) !== null) {
    const rawTarget = match[2].trim();
    // Ignore external web links, mailto links, anchor links
    if (rawTarget.startsWith('http://') || rawTarget.startsWith('https://') || rawTarget.startsWith('mailto:') || rawTarget.startsWith('#')) {
      continue;
    }

    let targetPath;
    if (rawTarget.startsWith('file:///')) {
      // Handle file:/// URL scheme: e.g. file:///d:/AniResQ/path/to/file
      const filePathWithoutScheme = rawTarget.replace(/^file:\/\/\//, '');
      targetPath = path.resolve(filePathWithoutScheme);
    } else {
      // Relative path from the doc file's directory
      targetPath = path.resolve(OPS_DOCS_DIR, rawTarget.split('#')[0]);
    }

    totalLinksChecked++;
    if (!fs.existsSync(targetPath)) {
      console.error(`FAIL: Broken link in ${docFile}: ${rawTarget} -> ${targetPath} does not exist`);
      errors++;
    } else {
      console.log(`PASS: [${docFile}] -> ${path.relative(REPO_ROOT, targetPath)}`);
    }
  }
}

console.log('------------------------------------------------------------------------------');
if (errors > 0) {
  console.error(`CHECK FAILED: ${errors} broken link(s) found out of ${totalLinksChecked} links checked.`);
  process.exit(1);
}

console.log(`CHECK PASSED: All ${totalLinksChecked} local markdown links and paths exist.`);
process.exit(0);
