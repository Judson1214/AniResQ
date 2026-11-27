/**
 * Pure functions for building Content-Security-Policy and applying it to
 * deployment configurations (vercel.json, netlify.toml).
 */

export function buildCsp({ supabaseUrl, apiUrl }) {
  if (!supabaseUrl || typeof supabaseUrl !== 'string' || !supabaseUrl.trim()) {
    throw new Error('buildCsp: Missing required supabaseUrl');
  }

  const trimmedSupabase = supabaseUrl.trim();
  if (trimmedSupabase.includes('*')) {
    throw new Error('buildCsp: supabaseUrl must not contain wildcards');
  }

  let parsedSupabase;
  try {
    parsedSupabase = new URL(trimmedSupabase);
  } catch {
    throw new Error(`buildCsp: Invalid URL provided for supabaseUrl: ${trimmedSupabase}`);
  }

  if (parsedSupabase.protocol !== 'https:' && parsedSupabase.hostname !== 'localhost' && parsedSupabase.hostname !== '127.0.0.1') {
    throw new Error(`buildCsp: supabaseUrl must use https: protocol (got ${parsedSupabase.protocol})`);
  }

  const supabaseHost = parsedSupabase.origin;
  const supabaseWss = `wss://${parsedSupabase.host}`;

  // Process optional apiUrl
  let apiOrigin = null;
  if (apiUrl && typeof apiUrl === 'string' && apiUrl.trim()) {
    const trimmedApi = apiUrl.trim();
    // Relative paths (e.g. '/api', '/api/v1') are same-origin -> add nothing
    if (!trimmedApi.startsWith('/')) {
      if (trimmedApi.includes('*')) {
        throw new Error(`buildCsp: apiUrl must not contain wildcards: ${trimmedApi}`);
      }

      let parsedApi;
      try {
        parsedApi = new URL(trimmedApi);
      } catch {
        throw new Error(`buildCsp: Invalid URL provided for apiUrl: ${trimmedApi}`);
      }

      // Check for credentials
      if (parsedApi.username || parsedApi.password) {
        throw new Error('buildCsp: apiUrl must not contain user credentials');
      }

      // Require https: (allow http: only for localhost / 127.0.0.1)
      const isLocalhost = parsedApi.hostname === 'localhost' || parsedApi.hostname === '127.0.0.1';
      if (parsedApi.protocol !== 'https:' && !isLocalhost) {
        throw new Error(`buildCsp: apiUrl must use https: protocol in production (got ${parsedApi.protocol})`);
      }

      apiOrigin = parsedApi.origin;
    }
  }

  // Construct connect-src list
  const connectSources = ["'self'", supabaseHost, supabaseWss];
  if (apiOrigin && apiOrigin !== supabaseHost && !connectSources.includes(apiOrigin)) {
    connectSources.push(apiOrigin);
  }
  connectSources.push('https://nominatim.openstreetmap.org');

  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-elem 'self'",
    "style-src-attr 'unsafe-inline'",
    `img-src 'self' data: blob: ${supabaseHost} https://tile.openstreetmap.org https://a.tile.openstreetmap.org https://b.tile.openstreetmap.org https://c.tile.openstreetmap.org https://images.unsplash.com`,
    `connect-src ${connectSources.join(' ')}`,
    "font-src 'self' data:",
    "object-src 'none'",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ];

  return cspDirectives.join('; ') + ';';
}

export function applyToVercelJson(jsonText, csp) {
  // Strip any legacy single-line comment markers before parsing
  const cleanJson = jsonText.replace(/^\s*\/\/.*$/gm, '');
  const config = JSON.parse(cleanJson);

  if (!Array.isArray(config.headers)) {
    config.headers = [];
  }

  let routeEntry = config.headers.find(h => h.source === '/(.*)');
  if (!routeEntry) {
    routeEntry = { source: '/(.*)', headers: [] };
    config.headers.push(routeEntry);
  }

  if (!Array.isArray(routeEntry.headers)) {
    routeEntry.headers = [];
  }

  // Update or set Content-Security-Policy
  const cspHeader = routeEntry.headers.find(h => h.key === 'Content-Security-Policy');
  if (cspHeader) {
    cspHeader.value = csp;
  } else {
    routeEntry.headers.unshift({
      key: 'Content-Security-Policy',
      value: csp
    });
  }

  // Ensure Cross-Origin-Opener-Policy is present
  if (!routeEntry.headers.some(h => h.key === 'Cross-Origin-Opener-Policy')) {
    routeEntry.headers.push({
      key: 'Cross-Origin-Opener-Policy',
      value: 'same-origin'
    });
  }

  // Ensure Cross-Origin-Resource-Policy is present
  if (!routeEntry.headers.some(h => h.key === 'Cross-Origin-Resource-Policy')) {
    routeEntry.headers.push({
      key: 'Cross-Origin-Resource-Policy',
      value: 'same-site'
    });
  }

  return JSON.stringify(config, null, 2) + '\n';
}

export function applyToNetlifyToml(tomlText, csp) {
  const markerRegex = /#\s*CSP_START[\s\S]*?#\s*CSP_END/;
  const replacement = `# CSP_START\n    Content-Security-Policy = "${csp}"\n    # CSP_END`;

  let updated = tomlText;
  if (markerRegex.test(tomlText)) {
    updated = tomlText.replace(markerRegex, replacement);
  } else {
    // Replace standalone Content-Security-Policy line
    updated = tomlText.replace(
      /Content-Security-Policy\s*=\s*"[^"]*"/,
      replacement
    );
  }

  // Ensure Cross-Origin-Opener-Policy is present
  if (!updated.includes('Cross-Origin-Opener-Policy')) {
    updated = updated.replace(
      'Permissions-Policy = "geolocation=(self), camera=(), microphone=(), payment=()"',
      'Permissions-Policy = "geolocation=(self), camera=(), microphone=(), payment=()"\n    Cross-Origin-Opener-Policy = "same-origin"\n    Cross-Origin-Resource-Policy = "same-site"'
    );
  }

  return updated;
}
