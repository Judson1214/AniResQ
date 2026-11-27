import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Production Deployment Security Headers', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('vercel.json defines all mandatory security headers for all routes', () => {
    const vercelConfigPath = path.join(rootDir, 'vercel.json');
    expect(fs.existsSync(vercelConfigPath)).toBe(true);

    const content = fs.readFileSync(vercelConfigPath, 'utf-8');
    const config = JSON.parse(content);

    expect(config.headers).toBeDefined();
    expect(config.headers.length).toBeGreaterThan(0);

    const rootRoute = config.headers.find(h => h.source === '/(.*)');
    expect(rootRoute).toBeDefined();

    const headersMap = {};
    for (const h of rootRoute.headers) {
      headersMap[h.key] = h.value;
    }

    // 1. Content-Security-Policy
    expect(headersMap['Content-Security-Policy']).toBeDefined();
    expect(headersMap['Content-Security-Policy']).toContain("default-src 'self'");
    expect(headersMap['Content-Security-Policy']).toContain("frame-ancestors 'none'");

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
  });

  it('netlify.toml defines all mandatory security headers', () => {
    const netlifyPath = path.join(rootDir, 'netlify.toml');
    expect(fs.existsSync(netlifyPath)).toBe(true);

    const content = fs.readFileSync(netlifyPath, 'utf-8');

    expect(content).toContain('Content-Security-Policy =');
    expect(content).toContain("default-src 'self'");
    expect(content).toContain('Strict-Transport-Security = "max-age=31536000; includeSubDomains"');
    expect(content).toContain('X-Content-Type-Options = "nosniff"');
    expect(content).toContain('X-Frame-Options = "DENY"');
    expect(content).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(content).toContain('Permissions-Policy =');
    expect(content).toContain('geolocation=(self)');
  });
});
