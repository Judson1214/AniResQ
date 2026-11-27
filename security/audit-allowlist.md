# Security Audit Allowlist

This document records package vulnerability audit exemptions configured in `package.json` (`pnpm.auditConfig.ignoreCves`).

## CVE-2023-54404 / GHSA-mrhx-c7xc-m3w5

- **Package**: `zod` (<4.6.6)
- **Severity**: High (Uncontrolled Resource Consumption / DoS)
- **Description**: In Zod array parsing, validating arbitrarily large arrays without length constraints can accumulate excessive validation error objects, potentially leading to high memory usage.
- **Context & Applicability**:
  - In AniResQ, Zod is utilized in `@aniresq/validation` and `apps/web` for client-side form schema validation and request payloads.
  - Server endpoints are protected by FastAPI backend validation (Pydantic v2), input size limits, and rate limiting.
  - The patched release (`>=4.6.6`) introduces Zod v4, which contains breaking API changes across the ecosystem.
- **Mitigation & Follow-up**:
  - Retain Zod 3.x with bounded frontend input fields while Zod v4 migration is scheduled.
  - Exemption tracked under `CVE-2023-54404` and `GHSA-mrhx-c7xc-m3w5`.
