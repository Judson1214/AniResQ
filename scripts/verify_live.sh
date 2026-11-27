#!/usr/bin/env bash
# ==============================================================================
# AniResQ Live Smoke-Test Script (Read-Only HTTP)
# ==============================================================================
# Verifies live deployment endpoints, API security controls, Supabase RLS / PostgREST
# revocations, security headers, rate limiting, and PII protection.
#
# Configured STRICTLY via environment variables:
#   API_URL           (e.g., https://api.aniresq.com)
#   WEB_URL           (e.g., https://app.aniresq.com)
#   SUPABASE_URL      (e.g., https://<YOUR-PROJECT-REF>.supabase.co)
#   SUPABASE_ANON_KEY (Public anonymous client key)
#   API_ONLY          (Optional: set to 1 to run only local API tests)
# ==============================================================================

set -euo pipefail
set +x # Ensure secrets are never echoed in logs or terminal traces

FAILED_CHECKS=0
TOTAL_CHECKS=0

pass() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  echo "PASS: $1"
}

fail() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  echo "FAIL: $1 - $2"
}

info() {
  echo "==> $1"
}

API_URL="${API_URL:-}"
WEB_URL="${WEB_URL:-}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
API_ONLY="${API_ONLY:-0}"

if [ -z "$API_URL" ]; then
  echo "ERROR: API_URL environment variable is required."
  exit 1
fi

info "Starting AniResQ Smoke Tests against API: $API_URL"

# ------------------------------------------------------------------------------
# 1. API Health & Readiness Probes
# ------------------------------------------------------------------------------
info "Checking API health and readiness..."
HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health")
if [ "$HEALTH_STATUS" -eq 200 ]; then
  pass "GET /health returns HTTP 200"
else
  fail "GET /health" "Expected 200, got $HEALTH_STATUS"
fi

READY_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/ready")
if [ "$READY_STATUS" -eq 200 ]; then
  pass "GET /ready returns HTTP 200"
else
  fail "GET /ready" "Expected 200, got $READY_STATUS"
fi

# ------------------------------------------------------------------------------
# 2 & 3. Supabase PostgREST Direct Access Revocation Checks
# ------------------------------------------------------------------------------
if [ "$API_ONLY" -eq 1 ] || [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
  echo "NOTICE: Skipping Supabase PostgREST checks (SUPABASE_URL / SUPABASE_ANON_KEY not set or API_ONLY=1)"
else
  info "Checking Supabase PostgREST direct access blocks with anon key..."
  TABLES=("lost_and_found" "users" "audit_logs" "system_settings" "rescues")

  for tbl in "${TABLES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      "$SUPABASE_URL/rest/v1/$tbl?select=*")
    if [ "$STATUS" -eq 401 ] || [ "$STATUS" -eq 403 ] || [ "$STATUS" -eq 404 ]; then
      pass "PostgREST direct SELECT blocked on $tbl (HTTP $STATUS)"
    else
      fail "PostgREST direct SELECT on $tbl" "Expected 401/403/404, got $STATUS (Data leak risk!)"
    fi
  done

  # Test direct mutations on users table
  PATCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"role":"ADMIN"}' \
    "$SUPABASE_URL/rest/v1/users?id=eq.fake-id")
  if [ "$PATCH_STATUS" -eq 401 ] || [ "$PATCH_STATUS" -eq 403 ] || [ "$PATCH_STATUS" -eq 404 ] || [ "$PATCH_STATUS" -eq 405 ]; then
    pass "PostgREST direct PATCH on users rejected (HTTP $PATCH_STATUS)"
  else
    fail "PostgREST direct PATCH on users" "Expected 401/403/404/405, got $PATCH_STATUS"
  fi

  POST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"attacker@test.com"}' \
    "$SUPABASE_URL/rest/v1/users")
  if [ "$POST_STATUS" -eq 401 ] || [ "$POST_STATUS" -eq 403 ] || [ "$POST_STATUS" -eq 404 ] || [ "$POST_STATUS" -eq 405 ]; then
    pass "PostgREST direct POST on users rejected (HTTP $POST_STATUS)"
  else
    fail "PostgREST direct POST on users" "Expected 401/403/404/405, got $POST_STATUS"
  fi
fi

# ------------------------------------------------------------------------------
# 4. Anonymous Lost & Found Contact Redaction Check
# ------------------------------------------------------------------------------
info "Checking anonymous PII redaction on /api/lostfound..."
LF_RESPONSE=$(curl -s -w "\n%{http_code}" "$API_URL/api/lostfound")
LF_HTTP_CODE=$(echo "$LF_RESPONSE" | tail -n 1)
LF_BODY=$(echo "$LF_RESPONSE" | sed '$d')

if [ "$LF_HTTP_CODE" -eq 200 ]; then
  # Verify contactPhone and contactEmail contain no exposed characters
  # Regex looks for "contactPhone":"[^\"]+" with non-empty contents
  LEAKED_PHONE=$(echo "$LF_BODY" | grep -oE '"contactPhone":"[^"]+"' || true)
  LEAKED_EMAIL=$(echo "$LF_BODY" | grep -oE '"contactEmail":"[^"]+"' || true)

  if [ -z "$LEAKED_PHONE" ] && [ -z "$LEAKED_EMAIL" ]; then
    pass "GET /api/lostfound without token returns 200 and redacts contact phone/email to empty strings"
  else
    fail "GET /api/lostfound PII redaction" "Found non-empty contact info: $LEAKED_PHONE $LEAKED_EMAIL"
  fi
else
  fail "GET /api/lostfound" "Expected 200, got $LF_HTTP_CODE"
fi

# ------------------------------------------------------------------------------
# 5. Protected Endpoints Authorization Checks
# ------------------------------------------------------------------------------
info "Checking auth requirement on /api/settings and /api/audit..."
SETTINGS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/settings")
if [ "$SETTINGS_STATUS" -eq 401 ]; then
  pass "GET /api/settings without token returns HTTP 401"
else
  fail "GET /api/settings auth check" "Expected 401, got $SETTINGS_STATUS"
fi

AUDIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/audit")
if [ "$AUDIT_STATUS" -eq 401 ]; then
  pass "GET /api/audit without token returns HTTP 401"
else
  fail "GET /api/audit auth check" "Expected 401, got $AUDIT_STATUS"
fi

# ------------------------------------------------------------------------------
# 6. Web Application Security Headers & CSP
# ------------------------------------------------------------------------------
if [ "$API_ONLY" -eq 1 ] || [ -z "$WEB_URL" ]; then
  echo "NOTICE: Skipping frontend web headers checks (WEB_URL not set or API_ONLY=1)"
else
  info "Checking Web security headers on $WEB_URL..."
  HEADERS=$(curl -s -I "$WEB_URL")

  REQUIRED_HEADERS=(
    "Content-Security-Policy"
    "Strict-Transport-Security"
    "X-Content-Type-Options"
    "X-Frame-Options"
    "Referrer-Policy"
    "Permissions-Policy"
  )

  for hdr in "${REQUIRED_HEADERS[@]}"; do
    if echo "$HEADERS" | grep -qi "^$hdr:"; then
      pass "Web header $hdr is present"
    else
      fail "Web header $hdr" "Header is missing from response"
    fi
  done

  # Validate CSP strictness
  CSP_HEADER=$(echo "$HEADERS" | grep -i "^Content-Security-Policy:" || true)
  if echo "$CSP_HEADER" | grep -q '\*\.supabase\.co'; then
    fail "CSP wildcard leak" "Content-Security-Policy contains forbidden wildcard *.supabase.co"
  else
    pass "CSP does not contain *.supabase.co wildcard"
  fi

  if echo "$CSP_HEADER" | grep -q '127\.0\.0\.1'; then
    fail "CSP localhost leak" "Content-Security-Policy contains local IP 127.0.0.1"
  else
    pass "CSP does not contain 127.0.0.1 development address"
  fi
fi

# ------------------------------------------------------------------------------
# 7. API Security Headers, Cache-Control, and Sanitized Validation Errors
# ------------------------------------------------------------------------------
info "Checking API response headers and validation error sanitization..."
API_HEADERS=$(curl -s -D - "$API_URL/api/lostfound" -o /dev/null)

if echo "$API_HEADERS" | grep -qi "^X-Content-Type-Options:\s*nosniff"; then
  pass "API response includes X-Content-Type-Options: nosniff"
else
  fail "API X-Content-Type-Options" "Missing or invalid"
fi

if echo "$API_HEADERS" | grep -qi "^Cache-Control:.*no-store"; then
  pass "API response includes Cache-Control: no-store on /api paths"
else
  fail "API Cache-Control" "Cache-Control does not specify no-store"
fi

# Trigger validation error via POST with empty body
VAL_RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{}' "$API_URL/api/rescues/")
if echo "$VAL_RESP" | grep -q '"input"'; then
  fail "API validation error sanitization" "Response body leaked raw 'input' field: $VAL_RESP"
else
  pass "API validation error JSON does not leak raw input field"
fi

# ------------------------------------------------------------------------------
# 8. Rate Limiting Enforcement
# ------------------------------------------------------------------------------
info "Sending rapid requests to test rate limiter on $API_URL/ready..."
RATE_LIMIT_HIT=0
RETRY_AFTER_FOUND=0

for _ in $(seq 1 70); do
  RESP_HDR=$(curl -s -D - "$API_URL/ready" -o /dev/null)
  if echo "$RESP_HDR" | grep -q "429"; then
    RATE_LIMIT_HIT=1
    if echo "$RESP_HDR" | grep -qi "Retry-After:"; then
      RETRY_AFTER_FOUND=1
    fi
    break
  fi
done

if [ "$RATE_LIMIT_HIT" -eq 1 ] && [ "$RETRY_AFTER_FOUND" -eq 1 ]; then
  pass "Rate limiting triggered 429 with valid Retry-After header within 70 rapid requests"
elif [ "$RATE_LIMIT_HIT" -eq 1 ]; then
  fail "Rate limiter headers" "HTTP 429 returned but missing Retry-After header"
else
  fail "Rate limiter enforcement" "Did not trigger HTTP 429 after 70 rapid requests"
fi

# ------------------------------------------------------------------------------
# Final Verification Summary
# ------------------------------------------------------------------------------
echo "=============================================================================="
echo "Verification Complete: $TOTAL_CHECKS checks executed. ($FAILED_CHECKS failed)"
echo "=============================================================================="

if [ "$FAILED_CHECKS" -gt 0 ]; then
  echo "VERIFICATION STATUS: FAIL ($FAILED_CHECKS check(s) failed)"
  exit 1
fi

echo "VERIFICATION STATUS: PASS (All checks passed successfully)"
exit 0
