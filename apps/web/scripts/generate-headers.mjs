import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCsp, applyToVercelJson, applyToNetlifyToml } from './lib/csp.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

// Helper to parse key-value pairs from .env
function getEnvVar(key) {
  if (process.env[key]) {
    return process.env[key].trim();
  }
  const envPath = path.join(webRoot, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith(`${key}=`)) {
        let val = trimmed.slice(`${key}=`.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val.trim();
      }
    }
  }
  return null;
}

const isCheckMode = process.argv.includes('--check');

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL');
const apiUrl = getEnvVar('VITE_API_URL');

if (!supabaseUrl) {
  console.error('GENERATE-HEADERS ERROR: Missing required environment variable VITE_SUPABASE_URL.');
  process.exit(1);
}

let csp;
try {
  csp = buildCsp({ supabaseUrl, apiUrl });
} catch (err) {
  console.error(`GENERATE-HEADERS ERROR: ${err.message}`);
  process.exit(1);
}

const vercelPath = path.join(webRoot, 'vercel.json');
const netlifyPath = path.join(webRoot, 'netlify.toml');

let hasDiscrepancy = false;

// 1. Process vercel.json
let expectedVercelText = null;
if (fs.existsSync(vercelPath)) {
  const currentVercelText = fs.readFileSync(vercelPath, 'utf8');
  try {
    expectedVercelText = applyToVercelJson(currentVercelText, csp);
  } catch (err) {
    console.error(`GENERATE-HEADERS ERROR parsing vercel.json: ${err.message}`);
    process.exit(1);
  }

  if (isCheckMode) {
    if (currentVercelText !== expectedVercelText) {
      console.error('GENERATE-HEADERS CHECK FAILED: vercel.json headers do not match expected CSP configuration.');
      hasDiscrepancy = true;
    }
  } else {
    fs.writeFileSync(vercelPath, expectedVercelText, 'utf8');
    console.log('Updated Content-Security-Policy in vercel.json');
  }
}

// 2. Process netlify.toml
let expectedNetlifyText = null;
if (fs.existsSync(netlifyPath)) {
  const currentNetlifyText = fs.readFileSync(netlifyPath, 'utf8');
  expectedNetlifyText = applyToNetlifyToml(currentNetlifyText, csp);

  if (isCheckMode) {
    if (currentNetlifyText !== expectedNetlifyText) {
      console.error('GENERATE-HEADERS CHECK FAILED: netlify.toml headers do not match expected CSP configuration.');
      hasDiscrepancy = true;
    }
  } else {
    fs.writeFileSync(netlifyPath, expectedNetlifyText, 'utf8');
    console.log('Updated Content-Security-Policy in netlify.toml');
  }
}

if (isCheckMode) {
  if (hasDiscrepancy) {
    console.error('Run "pnpm --filter @aniresq/web generate:headers" to update configuration files.');
    process.exit(1);
  }
  console.log('GENERATE-HEADERS CHECK PASSED: vercel.json and netlify.toml match expected security headers.');
  process.exit(0);
}
