# Security Policy

## Supported Versions

AniResQ actively maintains and provides security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

The AniResQ team takes all security vulnerabilities seriously. If you believe you have discovered a security vulnerability in AniResQ, please **do not report it through public GitHub issues**.

Instead, please report security vulnerabilities via encrypted email or GitHub Security Advisories:
- **Email**: `security@aniresq.org`
- **PGP Fingerprint**: (Available upon request)

Please include the following information in your report:
1. Description of the vulnerability and its potential impact.
2. Step-by-step reproduction instructions or proof-of-concept payload.
3. Affected components (`apps/api`, `apps/web`, `supabase`, `packages/shared-types`).
4. Any proposed remediations.

We will acknowledge receipt within 24 hours and provide an estimated timeline for remediation.

## Security Architecture Guarantees

1. **Defense in Depth**:
   - PostgREST direct client access is strictly constrained by Row Level Security (RLS) and explicit SQL `REVOKE` privileges on all mutation operations (`INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `REFERENCES`, `TRIGGER`).
   - All state mutations are processed through the authenticated FastAPI service layer with fine-grained authorization, owner checks, and immutable audit logging.
2. **Rate Limiting**:
   - Shared atomic rate limiting prevents denial-of-service, abuse of emergency intake channels, and brute-force attacks.
3. **Audit Trails**:
   - Administrative role changes and clearances are tracked via PostgreSQL transaction-level triggers writing append-only audit entries.
