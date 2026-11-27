import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildCsp, applyToVercelJson, applyToNetlifyToml } from '../lib/csp.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '../..');

describe('CSP Generation and Header Application Library', () => {
  const sampleSupabase = 'https://cspnzitnvzdwwyxpnluw.supabase.co';

  describe('buildCsp', () => {
    it('generates valid CSP with default directives and no API origin when apiUrl is omitted, empty, or relative', () => {
      const cspNoApi = buildCsp({ supabaseUrl: sampleSupabase });
      const cspEmptyApi = buildCsp({ supabaseUrl: sampleSupabase, apiUrl: '' });
      const cspRelativeApi = buildCsp({ supabaseUrl: sampleSupabase, apiUrl: '/api' });
      const cspRelativeSplat = buildCsp({ supabaseUrl: sampleSupabase, apiUrl: '/api/v1' });

      expect(cspNoApi).toContain("default-src 'self'");
      expect(cspNoApi).toContain(`connect-src 'self' ${sampleSupabase} wss://cspnzitnvzdwwyxpnluw.supabase.co https://nominatim.openstreetmap.org`);

      // All same-origin / empty variants must produce the exact same CSP string
      expect(cspEmptyApi).toBe(cspNoApi);
      expect(cspRelativeApi).toBe(cspNoApi);
      expect(cspRelativeSplat).toBe(cspNoApi);
    });

    it('includes API origin in connect-src when apiUrl is an absolute https URL', () => {
      const cspWithApi = buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'https://api.aniresq.com'
      });

      expect(cspWithApi).toContain(
        `connect-src 'self' ${sampleSupabase} wss://cspnzitnvzdwwyxpnluw.supabase.co https://api.aniresq.com https://nominatim.openstreetmap.org`
      );
    });

    it('appends only the origin and strips subpaths when apiUrl has a path', () => {
      const cspWithPath = buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'https://api.aniresq.com/api/v1/'
      });

      expect(cspWithPath).toContain('https://api.aniresq.com');
      expect(cspWithPath).not.toContain('https://api.aniresq.com/api');
    });

    it('does not duplicate origin if apiUrl matches supabaseUrl origin', () => {
      const cspDuplicate = buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: `${sampleSupabase}/api`
      });

      const connectSrc = cspDuplicate.split('; ').find(d => d.startsWith('connect-src'));
      const occurrences = connectSrc.split(' ').filter(token => token === sampleSupabase);
      expect(occurrences.length).toBe(1);
    });

    it('allows http only for localhost and 127.0.0.1 in development', () => {
      const cspLocalhost = buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'http://localhost:8000'
      });
      expect(cspLocalhost).toContain('http://localhost:8000');

      const cspLocalIp = buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'http://127.0.0.1:8000'
      });
      expect(cspLocalIp).toContain('http://127.0.0.1:8000');
    });

    it('rejects insecure non-localhost http apiUrl', () => {
      expect(() => buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'http://api.evil.com'
      })).toThrow(/must use https:/);
    });

    it('rejects wildcards in apiUrl and supabaseUrl', () => {
      expect(() => buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'https://*.aniresq.com'
      })).toThrow(/must not contain wildcards/);

      expect(() => buildCsp({
        supabaseUrl: 'https://*.supabase.co',
        apiUrl: 'https://api.aniresq.com'
      })).toThrow(/must not contain wildcards/);
    });

    it('rejects URLs containing embedded user credentials', () => {
      expect(() => buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'https://user:pass@api.aniresq.com'
      })).toThrow(/must not contain user credentials/);
    });

    it('rejects malformed or invalid URLs', () => {
      expect(() => buildCsp({
        supabaseUrl: 'not-a-url',
        apiUrl: 'https://api.aniresq.com'
      })).toThrow(/Invalid URL/);

      expect(() => buildCsp({
        supabaseUrl: sampleSupabase,
        apiUrl: 'htt p://broken url'
      })).toThrow(/Invalid URL/);
    });
  });

  describe('applyToVercelJson', () => {
    const sampleCsp = "default-src 'self'; script-src 'self';";
    const initialConfig = JSON.stringify({
      cleanUrls: true,
      rewrites: [{ source: '/api/(.*)', destination: 'https://YOUR-API-HOST/api/$1' }],
      headers: [
        {
          source: '/(.*)',
          headers: [
            { key: 'Content-Security-Policy', value: 'old-csp' },
            { key: 'X-Frame-Options', value: 'DENY' }
          ]
        }
      ]
    }, null, 2);

    it('produces valid JSON and replaces existing CSP without adding duplicates', () => {
      const output = applyToVercelJson(initialConfig, sampleCsp);
      expect(() => JSON.parse(output)).not.toThrow();

      const parsed = JSON.parse(output);
      const rootHeaders = parsed.headers.find(h => h.source === '/(.*)').headers;
      const cspHeaders = rootHeaders.filter(h => h.key === 'Content-Security-Policy');

      expect(cspHeaders.length).toBe(1);
      expect(cspHeaders[0].value).toBe(sampleCsp);
      expect(rootHeaders.some(h => h.key === 'X-Frame-Options')).toBe(true);
      expect(parsed.rewrites.length).toBe(1);
    });

    it('ensures COOP and CORP headers are present', () => {
      const output = applyToVercelJson(initialConfig, sampleCsp);
      const parsed = JSON.parse(output);
      const rootHeaders = parsed.headers.find(h => h.source === '/(.*)').headers;

      expect(rootHeaders.find(h => h.key === 'Cross-Origin-Opener-Policy')?.value).toBe('same-origin');
      expect(rootHeaders.find(h => h.key === 'Cross-Origin-Resource-Policy')?.value).toBe('same-site');
    });

    it('is completely idempotent when applied multiple times', () => {
      const once = applyToVercelJson(initialConfig, sampleCsp);
      const twice = applyToVercelJson(once, sampleCsp);
      expect(twice).toBe(once);
    });
  });

  describe('applyToNetlifyToml', () => {
    const sampleCsp = "default-src 'self'; script-src 'self';";
    const initialToml = `
[[headers]]
  for = "/*"
  [headers.values]
    # CSP_START
    Content-Security-Policy = "old-csp"
    # CSP_END
    X-Frame-Options = "DENY"
`;

    it('keeps marker comments and contains exactly one Content-Security-Policy line', () => {
      const output = applyToNetlifyToml(initialToml, sampleCsp);
      expect(output).toContain('# CSP_START');
      expect(output).toContain('# CSP_END');
      expect(output).toContain(`Content-Security-Policy = "${sampleCsp}"`);

      const cspMatches = output.match(/Content-Security-Policy\s*=/g) || [];
      expect(cspMatches.length).toBe(1);
    });
  });

  describe('Committed Configurations Integrity', () => {
    it('committed vercel.json and netlify.toml have identical CSP strings', () => {
      const vercelRaw = fs.readFileSync(path.join(webRoot, 'vercel.json'), 'utf8');
      const vercelJson = JSON.parse(vercelRaw);
      const vercelCsp = vercelJson.headers
        .find(h => h.source === '/(.*)')
        .headers.find(h => h.key === 'Content-Security-Policy').value;

      const netlifyRaw = fs.readFileSync(path.join(webRoot, 'netlify.toml'), 'utf8');
      const netlifyMatch = netlifyRaw.match(/Content-Security-Policy\s*=\s*"([^"]*)"/);
      expect(netlifyMatch).not.toBeNull();
      const netlifyCsp = netlifyMatch[1];

      expect(vercelCsp).toBe(netlifyCsp);
    });
  });
});
