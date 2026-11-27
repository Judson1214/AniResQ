import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');

// Helper to load .env if process.env.VITE_SUPABASE_URL is not set
function getSupabaseUrl() {
  if (process.env.VITE_SUPABASE_URL) {
    return process.env.VITE_SUPABASE_URL.trim();
  }
  const envPath = path.join(webRoot, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed.startsWith('VITE_SUPABASE_URL=')) {
        let val = trimmed.slice('VITE_SUPABASE_URL='.length).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        return val.trim();
      }
    }
  }
  return null;
}

const rawSupabaseUrl = getSupabaseUrl();
if (!rawSupabaseUrl) {
  console.error('GENERATE-HEADERS ERROR: Missing required environment variable VITE_SUPABASE_URL.');
  process.exit(1);
}

if (rawSupabaseUrl.includes('*')) {
  console.error('GENERATE-HEADERS ERROR: VITE_SUPABASE_URL must not contain wildcards.');
  process.exit(1);
}

let parsed;
try {
  parsed = new URL(rawSupabaseUrl);
} catch (e) {
  console.error(`GENERATE-HEADERS ERROR: Invalid URL provided for VITE_SUPABASE_URL: ${rawSupabaseUrl}`);
  process.exit(1);
}

const supabaseHost = parsed.origin;
const supabaseWss = `wss://${parsed.host}`;

// Construct strict CSP with exact hosts
const cspDirectives = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "style-src-elem 'self'",
  "style-src-attr 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseHost} https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org https://images.unsplash.com`,
  `connect-src 'self' ${supabaseHost} ${supabaseWss} https://nominatim.openstreetmap.org`,
  "font-src 'self' data:",
  "object-src 'none'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests"
];

const cspString = cspDirectives.join('; ') + ';';

// 1. Update netlify.toml between # CSP_START and # CSP_END
const netlifyPath = path.join(webRoot, 'netlify.toml');
if (fs.existsSync(netlifyPath)) {
  let netlifyContent = fs.readFileSync(netlifyPath, 'utf8');
  const marker = /# CSP_START[\s\S]*?# CSP_END/;
  const replacement = `# CSP_START\n    Content-Security-Policy = "${cspString}"\n    # CSP_END`;
  
  if (marker.test(netlifyContent)) {
    netlifyContent = netlifyContent.replace(marker, replacement);
  } else {
    // If marker not present yet, replace Content-Security-Policy line with marker block
    netlifyContent = netlifyContent.replace(
      /Content-Security-Policy = "[^"]*"/,
      replacement
    );
  }
  
  // Ensure COOP and CORP headers are present
  if (!netlifyContent.includes('Cross-Origin-Opener-Policy')) {
    netlifyContent = netlifyContent.replace(
      'Permissions-Policy = "geolocation=(self), camera=(), microphone=(), payment=()"',
      'Permissions-Policy = "geolocation=(self), camera=(), microphone=(), payment=()"\n    Cross-Origin-Opener-Policy = "same-origin"\n    Cross-Origin-Resource-Policy = "same-site"'
    );
  }

  fs.writeFileSync(netlifyPath, netlifyContent, 'utf8');
  console.log(`Updated Content-Security-Policy in netlify.toml (Host: ${supabaseHost})`);
}

// 2. Update vercel.json between // CSP_START and // CSP_END
const vercelPath = path.join(webRoot, 'vercel.json');
if (fs.existsSync(vercelPath)) {
  let vercelContent = fs.readFileSync(vercelPath, 'utf8');
  const vercelMarker = /\/\/\s*CSP_START[\s\S]*?\/\/\s*CSP_END/;
  const vercelReplacement = `// CSP_START\n        {\n          "key": "Content-Security-Policy",\n          "value": "${cspString}"\n        },\n        // CSP_END`;

  if (vercelMarker.test(vercelContent)) {
    vercelContent = vercelContent.replace(vercelMarker, vercelReplacement);
  } else {
    // Wrap Content-Security-Policy header in marker
    const cspHeaderRegex = /\{\s*"key":\s*"Content-Security-Policy",\s*"value":\s*"[^"]*"\s*\}(,?)/;
    vercelContent = vercelContent.replace(cspHeaderRegex, (match, comma) => {
      return `// CSP_START\n        {\n          "key": "Content-Security-Policy",\n          "value": "${cspString}"\n        }${comma}\n        // CSP_END`;
    });
  }

  // Ensure COOP and CORP headers are present in vercel.json
  if (!vercelContent.includes('"Cross-Origin-Opener-Policy"')) {
    const coopCorpHeaders = `,\n        {\n          "key": "Cross-Origin-Opener-Policy",\n          "value": "same-origin"\n        },\n        {\n          "key": "Cross-Origin-Resource-Policy",\n          "value": "same-site"\n        }`;
    vercelContent = vercelContent.replace(
      /\{\s*"key":\s*"Permissions-Policy"[^}]*\}/,
      (match) => match + coopCorpHeaders
    );
  }

  fs.writeFileSync(vercelPath, vercelContent, 'utf8');
  console.log(`Updated Content-Security-Policy in vercel.json (Host: ${supabaseHost})`);
}
