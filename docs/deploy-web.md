# Frontend Deployment Guide (AniResQ Web)

This document provides instructions for deploying the AniResQ frontend application to production hosting platforms (Vercel or Netlify).

## 1. Hosting Platforms: Vercel vs Netlify

AniResQ includes configuration files for both Vercel (`apps/web/vercel.json`) and Netlify (`apps/web/netlify.toml`).

> [!IMPORTANT]
> If you deploy using only one hosting provider:
> - **Deploying to Vercel**: Retain `apps/web/vercel.json` and delete `apps/web/netlify.toml`.
> - **Deploying to Netlify**: Retain `apps/web/netlify.toml` and delete `apps/web/vercel.json`.

---

## 2. Configuring Production Backend API Target

Both hosting configurations include rewrite rules to route `/api/*` requests to your FastAPI backend server without CORS preflight overhead.

Before deploying to production, replace the placeholder `YOUR-API-HOST` with your production API domain (e.g. `api.aniresq.com`):

### In `apps/web/vercel.json`:
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
