# Frontend Deployment Guide (AniResQ Web)

This document provides instructions for deploying the AniResQ frontend application to production hosting platforms (Vercel or Netlify).

## 1. Hosting Platforms: Vercel vs Netlify

AniResQ includes configuration files for both Vercel (`apps/web/vercel.json`) and Netlify (`apps/web/netlify.toml`).

> [!IMPORTANT]
> If you deploy using only one hosting provider:
> - **Deploying to Vercel**: Retain `apps/web/vercel.json` and delete `apps/web/netlify.toml`.
> - **Deploying to Netlify**: Retain `apps/web/netlify.toml` and delete `apps/web/vercel.json`.

---

## 2. Configuring Production Backend API Target & Origin Strategy

You can configure the frontend-to-API communication using one of two strategies:

### Option A: Unified Domain with `/api` Rewrite (Simpler & Recommended)
When using the built-in rewrites in `vercel.json` or `netlify.toml`, frontend and API appear on the same origin to the browser:
- Leave `VITE_API_URL` (and CI `API_URL`) **unset** or blank; the web app defaults to relative `/api`.
- No cross-origin preflight requests (OPTIONS) occur.
- Replace `YOUR-API-HOST` with your production API domain (e.g. `api.aniresq.com`).

### Option B: Separate Origins (Cross-Origin API)
When the API is hosted on a separate domain (e.g., frontend on `https://app.aniresq.com` and API directly accessed at `https://api.aniresq.com` without proxying):
1. **Set `API_URL` environment variable** in deployment environments (e.g., `VITE_API_URL=https://api.aniresq.com` for web build and `API_URL=https://api.aniresq.com` in CI).
2. **Configure backend API `CORS_ORIGINS`** to your exact production web origin (`https://app.aniresq.com`). Wildcards (`*`) are strictly forbidden.
3. **Regenerate and commit CSP deployment headers**:
   ```bash
   VITE_SUPABASE_URL="https://<YOUR-PROJECT-REF>.supabase.co" \
   VITE_API_URL="https://api.aniresq.com" \
   pnpm --filter @aniresq/web run generate:headers
   ```
   Commit the resulting changes in `apps/web/vercel.json` and `apps/web/netlify.toml` so the API origin is whitelisted in `connect-src`.
4. **Security Notice**: `VITE_API_URL` is baked into client bundles at build time. It **must never contain secrets, tokens, or credentials**.

### Host Rewrite Templates:

#### In `apps/web/vercel.json`:
```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://api.yourdomain.com/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### In `apps/web/netlify.toml`:
```toml
[[redirects]]
  from = "/api/*"
  to = "https://api.yourdomain.com/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

---

## 3. Build-Time Deployment Check

A deployment verification script is provided at `apps/web/scripts/check-deploy-config.mjs` and runnable via:

```bash
pnpm --filter @aniresq/web run check:deploy
```

When run with `NODE_ENV=production` and `CHECK_DEPLOY=1`, the check fails if `127.0.0.1`, `localhost`, or `YOUR-API-HOST` are detected in either deployment config file. In local development or default CI checks, this script exits successfully to prevent blocking dev workflows.

---

## 4. Content Security Policy (CSP) & Header Architecture

The Content Security Policy is strictly generated from `apps/web/scripts/generate-headers.mjs` and injected between marker comments in `vercel.json` and `netlify.toml`.

### Directives Rationale:
- **`default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`**: Restrict executable code and framing to first-party origins.
- **`style-src 'self'`, `style-src-elem 'self'`, `style-src-attr 'unsafe-inline'`**:
  - All Tailwind stylesheets are compiled into hashed external `.css` files loaded via `<link>` elements (`style-src-elem 'self'`).
  - `'unsafe-inline'` is restricted strictly to inline element style attributes (`style-src-attr 'unsafe-inline'`). This is required for Leaflet map canvas dimension calculations (`minHeight`, `transform: translate3d`) and dynamic SVG background gradients in `HomePage.jsx` and `RescueMap.jsx`. No inline `<style>` tags are permitted.
- **`img-src` & `connect-src`**:
  - Strictly pinned to the exact project Supabase host read from `VITE_SUPABASE_URL` (wildcards such as `https://*.supabase.co` are blocked).
  - Explicit OpenStreetMap tile subdomains (`https://tile.openstreetmap.org`, `https://a.tile.openstreetmap.org`, `https://b.tile.openstreetmap.org`, `https://c.tile.openstreetmap.org`) matching Leaflet `{s}` resolution.
- **`Cross-Origin-Opener-Policy: same-origin` & `Cross-Origin-Resource-Policy: same-site`**:
  - Isolates browsing context against Spectre and side-channel cross-origin data leaks.
  - `Cross-Origin-Embedder-Policy` (COEP) is deliberately **omitted**, as enabling `require-corp` blocks third-party tile rendering from OpenStreetMap.
