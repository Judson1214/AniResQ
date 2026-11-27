# Runbook 08: Monitoring, Alerting, and Observability Guide

This guide details external synthetic monitoring, uptime health checks, metric collection, and actionable alerting thresholds for AniResQ operations.

---

## 1. External Synthetic Uptime Checks

Configure an external monitoring service (e.g. BetterStack, Pingdom, UptimeRobot, Datadog Synthetics) to probe AniResQ API endpoints **every 1 minute** from multiple geographic regions:

| Endpoint | Frequency | Expected Status | Purpose |
| :--- | :--- | :--- | :--- |
| `GET https://api.aniresq.com/health` | **1 minute** | **HTTP 200** | Liveness probe: confirms the process and web server event loop are active and serving traffic. |
| `GET https://api.aniresq.com/ready` | **1 minute** | **HTTP 200** | Readiness probe: executes an active test query against the Supabase database. Fails (HTTP 503) if database is unreachable. |
| `GET https://app.aniresq.com` | **1 minute** | **HTTP 200** | Web availability probe: verifies edge CDN and static assets are accessible. |

---

## 2. Alert Thresholds & Runbook Action Items

| Alert Name | Condition & Window | Severity | What It Means | Immediate Operator Action |
| :--- | :--- | :--- | :--- | :--- |
| **API High Error Rate** | $> 1\%$ HTTP 5xx responses over 5 minutes | **P1 - Critical** | Unhandled server exceptions or upstream database query failures affecting multiple users. | Check application logs for unhandled exceptions (`error` level). Inspect database pool connections. Follow [`docs/ops/06-incident-response.md`](file:///d:/AniResQ/docs/ops/06-incident-response.md). |
| **High Latency (p95)** | $p95 > 500\text{ms}$ over 5 minutes | **P2 - Warning** | Database query degradation, unindexed table scanning, or Redis network latency. | Inspect slow query logs in Supabase Dashboard. Review database CPU/RAM utilization. Verify Redis response times. |
| **Elevated 429 Rate** | $> 10$ HTTP 429 responses / min across cluster | **P3 - Notice** | Active denial-of-service attempt, aggressive automated scraper, or user hitting intake limit. | Inspect `/ready` and `/api/lostfound` client IPs. Check if single IP is cycling. Block abusive IP at Cloudflare/CDN level if necessary. |
| **Spike in Auth Failures** | $> 20$ HTTP 401/403 responses / min | **P2 - Warning** | Credential stuffing attack or expired client JWT secrets following rotation. | Check user accounts under attack in Supabase Auth logs. Verify client token headers. Consider enabling CAPTCHA on signup. |
| **Database Disconnected** | `GET /ready` returns HTTP 503 for 2 consecutive checks | **P1 - Critical** | Database connection pool exhausted, Supabase incident, or network partition. | Check Supabase system status (`status.supabase.com`). Restart backend container if connection pool became orphaned. |

---

## 3. Operational Metrics Endpoint (`/metrics`)

AniResQ provides an internal metrics endpoint exposing Prometheus format and structured JSON:

- **Path**: `GET /metrics`
- **Authentication**: Protected by a secret token (`METRICS_TOKEN`).
- **Security & Timing Protection**: Compared in constant time using `hmac.compare_digest` over fixed-length SHA-256 hashes to eliminate timing and string-length side-channels.
- **Access**:
  ```bash
  curl -H "Authorization: Bearer <YOUR-METRICS-TOKEN>" https://api.aniresq.com/metrics
  ```
  *(Or with header `X-Metrics-Token: <YOUR-METRICS-TOKEN>`)*

### Metrics Cardinality & Route Template Policy

To prevent denial-of-service memory exhaustion via unbounded label cardinality from random or parameterized URLs:
1. **Route Templates**: Endpoints record the parameterized route template (e.g. `/api/animals/{id}`) extracted from `request.scope.get("route").path` after request execution, rather than raw paths or query strings.
2. **Unmatched Paths**: Requests that do not match any defined application route are categorized under the static label `__unmatched__`.
3. **Strict Cardinality Cap**: Distinct metric keys are strictly capped at **1,000**. When the cap is reached, any additional keys are aggregated into the `__overflow__` label without unbounded memory growth.

### Sample Prometheus Output:
```text
# HELP aniresq_http_requests_total Total number of HTTP requests processed.
# TYPE aniresq_http_requests_total counter
aniresq_http_requests_total{method="GET",route="/health",status="200"} 1240
aniresq_http_requests_total{method="GET",route="/api/lostfound",status="200"} 850
aniresq_http_requests_total{method="GET",route="/api/animals/{id}",status="200"} 110
aniresq_http_requests_total{method="GET",route="__unmatched__",status="404"} 15
aniresq_http_requests_total{method="POST",route="/api/rescues/",status="201"} 32

# HELP aniresq_http_request_duration_seconds_avg Average request duration in seconds.
# TYPE aniresq_http_request_duration_seconds_avg gauge
aniresq_http_request_duration_seconds_avg{method="GET",route="/health",status="200"} 0.0012
aniresq_http_request_duration_seconds_avg{method="GET",route="/api/lostfound",status="200"} 0.0450
```

---

## 4. Log Scrubbing & Privacy Guarantees

All log lines generated by `apps/api` pass through `LogScrubbingFilter` before emission. The filter automatically detects and replaces:
- Bearer tokens -> `Bearer [REDACTED_TOKEN]`
- Raw JWT tokens -> `[REDACTED_JWT]`
- Database connection credentials -> `postgres://user:***@host`
- Redis connection credentials -> `redis://:***@host`
- Passwords -> `password=[REDACTED]`
- ID card and citizen phone numbers -> `[REDACTED_PHONE]`, `[REDACTED_ID]`
