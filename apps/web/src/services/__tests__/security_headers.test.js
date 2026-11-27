import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Production Deployment Security Headers & CSP', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('vercel.json defines all mandatory security headers and strict CSP for all routes', () => {
    const vercelConfigPath = path.join(rootDir, 'vercel.json');
    expect(fs.existsSync(vercelConfigPath)).toBe(true);

    const rawContent = fs.readFileSync(vercelConfigPath, 'utf-8');
    // Strip comments starting with // on their own line without modifying URLs in strings
    const cleanContent = rawContent.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const config = JSON.parse(cleanContent);

    expect(config.headers).toBeDefined();
    expect(config.headers.length).toBeGreaterThan(0);

    const rootRoute = config.headers.find(h => h.source === '/(.*)');
    expect(rootRoute).toBeDefined();

    const headersMap = {};
    for (const h of rootRoute.headers) {
      headersMap[h.key] = h.value;
    }

    // 1. Content-Security-Policy directives
    const csp = headersMap['Content-Security-Policy'];
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("style-src-elem 'self'");
    expect(csp).toContain("style-src-attr 'unsafe-inline'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("upgrade-insecure-requests");
    expect(csp).toContain("worker-src 'self' blob:");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("font-src 'self' data:");

    // Map tiles explicit subdomains (no wildcard openstreetmap)
    expect(csp).toContain("https://tile.openstreetmap.org");
    expect(csp).toContain("https://a.tile.openstreetmap.org");
    expect(csp).toContain("https://b.tile.openstreetmap.org");
    expect(csp).toContain("https://c.tile.openstreetmap.org");
    expect(csp).not.toContain("https://*.tile.openstreetmap.org");

    // Connect & geocoding
    expect(csp).toContain("https://nominatim.openstreetmap.org");

    // Strictly NO wildcard Supabase domains
    expect(csp).not.toContain("https://*.supabase.co");
    expect(csp).not.toContain("wss://*.supabase.co");
    expect(csp).toMatch(/https:\/\/[a-z0-9-]+\.supabase\.co/);
    expect(csp).toMatch(/wss:\/\/[a-z0-9-]+\.supabase\.co/);

    // 2. Strict-Transport-Security
    expect(headersMap['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains');

    // 3. X-Content-Type-Options
    expect(headersMap['X-Content-Type-Options']).toBe('nosniff');

    // 4. X-Frame-Options
    expect(headersMap['X-Frame-Options']).toBe('DENY');

    // 5. Referrer-Policy
    expect(headersMap['Referrer-Policy']).toBe('strict-origin-when-cross-origin');

    // 6. Permissions-Policy
    expect(headersMap['Permissions-Policy']).toBeDefined();
    expect(headersMap['Permissions-Policy']).toContain('geolocation=(self)');
    expect(headersMap['Permissions-Policy']).toContain('camera=()');
    expect(headersMap['Permissions-Policy']).toContain('microphone=()');
    expect(headersMap['Permissions-Policy']).toContain('payment=()');

    // 7. Cross-Origin Policies (COOP & CORP present, COEP omitted to preserve tile rendering)
    expect(headersMap['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(headersMap['Cross-Origin-Resource-Policy']).toBe('same-site');
    expect(headersMap['Cross-Origin-Embedder-Policy']).toBeUndefined();
  });

  it('netlify.toml defines all mandatory security headers and matches vercel.json policy', () => {
    const netlifyPath = path.join(rootDir, 'netlify.toml');
    expect(fs.existsSync(netlifyPath)).toBe(true);

    const content = fs.readFileSync(netlifyPath, 'utf-8');

    // CSP presence and directives
    expect(content).toContain('Content-Security-Policy =');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain("script-src 'self'");
    expect(content).toContain("style-src 'self'");
    expect(content).toContain("style-src-elem 'self'");
    expect(content).toContain("style-src-attr 'unsafe-inline'");
    expect(content).toContain("object-src 'none'");
    expect(content).toContain("upgrade-insecure-requests");
    expect(content).toContain("worker-src 'self' blob:");
    expect(content).toContain("frame-ancestors 'none'");

    // Map tiles explicit subdomains (no wildcard openstreetmap)
    expect(content).toContain("https://tile.openstreetmap.org");
    expect(content).toContain("https://a.tile.openstreetmap.org");
    expect(content).toContain("https://b.tile.openstreetmap.org");
    expect(content).toContain("https://c.tile.openstreetmap.org");
    expect(content).not.toContain("https://*.tile.openstreetmap.org");

    // Strictly NO wildcard Supabase domains
    expect(content).not.toContain("https://*.supabase.co");
    expect(content).not.toContain("wss://*.supabase.co");
    expect(content).toMatch(/https:\/\/[a-z0-9-]+\.supabase\.co/);
    expect(content).toMatch(/wss:\/\/[a-z0-9-]+\.supabase\.co/);

    // Standard headers
    expect(content).toContain('Strict-Transport-Security = "max-age=31536000; includeSubDomains"');
    expect(content).toContain('X-Content-Type-Options = "nosniff"');
    expect(content).toContain('X-Frame-Options = "DENY"');
    expect(content).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(content).toContain('Permissions-Policy =');
    expect(content).toContain('geolocation=(self)');

    // COOP and CORP
    expect(content).toContain('Cross-Origin-Opener-Policy = "same-origin"');
    expect(content).toContain('Cross-Origin-Resource-Policy = "same-site"');
    expect(content).not.toContain('Cross-Origin-Embedder-Policy');
  });
});
