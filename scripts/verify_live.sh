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
#   TEST_USER_TOKEN   (Optional: valid user JWT to test 422 schema sanitization)
#   API_ONLY          (Optional: set to 1 to run only local API tests)
# ==============================================================================

set -euo pipefail
set +x # Ensure secrets and tokens are never echoed in logs or terminal traces

PASSED_CHECKS=0
FAILED_CHECKS=0
SKIPPED_CHECKS=0

pass() {
  PASSED_CHECKS=$((PASSED_CHECKS + 1))
  echo "PASS: $1"
}

fail() {
  FAILED_CHECKS=$((FAILED_CHECKS + 1))
  echo "FAIL: $1 - $2"
}

skip() {
  SKIPPED_CHECKS=$((SKIPPED_CHECKS + 1))
  echo "SKIP: $1"
}

info() {
  echo "==> $1"
}

API_URL="${API_URL:-}"
WEB_URL="${WEB_URL:-}"
SUPABASE_URL="${SUPABASE_URL:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"
TEST_USER_TOKEN="${TEST_USER_TOKEN:-}"
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
  skip "Supabase PostgREST checks (SUPABASE_URL / SUPABASE_ANON_KEY not set or API_ONLY=1)"
else
  info "Verifying Supabase PostgREST root accessibility and table-level access blocks..."
  
  # First verify root PostgREST endpoint is live with valid anon key
  ROOT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    "$SUPABASE_URL/rest/v1/")

  if [ "$ROOT_STATUS" -eq 200 ]; then
    pass "PostgREST root reachable with anon key (HTTP 200)"
  else
    fail "PostgREST root connection" "GET $SUPABASE_URL/rest/v1/ returned $ROOT_STATUS (expected 200 with anon key; verify SUPABASE_URL and SUPABASE_ANON_KEY)"
  fi

  TABLES=("lost_and_found" "users" "audit_logs" "system_settings" "rescues")

  for tbl in "${TABLES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "apikey: $SUPABASE_ANON_KEY" \
      -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
      "$SUPABASE_URL/rest/v1/$tbl?select=*")
    # Must strictly be 401 or 403; 404 is NOT accepted
    if [ "$STATUS" -eq 401 ] || [ "$STATUS" -eq 403 ]; then
      pass "PostgREST direct SELECT blocked on $tbl (HTTP $STATUS)"
    else
      fail "PostgREST direct SELECT on $tbl" "Expected 401 or 403, got $STATUS (Data leak risk!)"
    fi
  done

  # Test direct mutations on users table (must reject with 401, 403, or 405)
  PATCH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X PATCH \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"role":"ADMIN"}' \
    "$SUPABASE_URL/rest/v1/users?id=eq.fake-id")
  if [ "$PATCH_STATUS" -eq 401 ] || [ "$PATCH_STATUS" -eq 403 ] || [ "$PATCH_STATUS" -eq 405 ]; then
    pass "PostgREST direct PATCH on users rejected (HTTP $PATCH_STATUS)"
  else
    fail "PostgREST direct PATCH on users" "Expected 401/403/405, got $PATCH_STATUS"
  fi

  POST_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    -H "apikey: $SUPABASE_ANON_KEY" \
    -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
    -H "Content-Type: application/json" \
    -d '{"email":"attacker@test.com"}' \
    "$SUPABASE_URL/rest/v1/users")
  if [ "$POST_STATUS" -eq 401 ] || [ "$POST_STATUS" -eq 403 ] || [ "$POST_STATUS" -eq 405 ]; then
    pass "PostgREST direct POST on users rejected (HTTP $POST_STATUS)"
  else
    fail "PostgREST direct POST on users" "Expected 401/403/405, got $POST_STATUS"
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
  skip "Frontend web headers checks (WEB_URL not set or API_ONLY=1)"
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
# 7. API Security Headers, Cache-Control, and Validation Error Sanitization
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

# A. Unauthenticated mutation rejection check
UNAUTH_RESCUE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{}' "$API_URL/api/rescues/")
if [ "$UNAUTH_RESCUE_STATUS" -eq 401 ]; then
  pass "POST /api/rescues/ without token rejected with HTTP 401 Unauthorized"
else
  fail "POST /api/rescues/ unauthenticated" "Expected HTTP 401, got $UNAUTH_RESCUE_STATUS"
fi

# B. Authenticated validation error sanitization check (requires TEST_USER_TOKEN)
if [ -n "$TEST_USER_TOKEN" ]; then
  VAL_RESP=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TEST_USER_TOKEN" \
    -d '{}' "$API_URL/api/rescues/")
  VAL_CODE=$(echo "$VAL_RESP" | tail -n 1)
  VAL_BODY=$(echo "$VAL_RESP" | sed '$d')

  if [ "$VAL_CODE" -eq 422 ]; then
    if echo "$VAL_BODY" | grep -q '"input"' || echo "$VAL_BODY" | grep -q '"ctx"'; then
      fail "API 422 validation sanitization" "Response body leaked raw 'input' or 'ctx' field"
    else
      pass "API validation error returns HTTP 422 and sanitizes raw input/ctx fields"
    fi
  else
    fail "API 422 validation check" "Expected HTTP 422 with valid token, got $VAL_CODE"
  fi
else
  skip "API 422 validation error sanitization (TEST_USER_TOKEN not provided)"
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
TOTAL_EVALUATED=$((PASSED_CHECKS + FAILED_CHECKS))
echo "=============================================================================="
echo "RESULT: $PASSED_CHECKS/$TOTAL_EVALUATED passed, $SKIPPED_CHECKS skipped"
echo "=============================================================================="

if [ "$FAILED_CHECKS" -gt 0 ]; then
  echo "VERIFICATION STATUS: FAIL ($FAILED_CHECKS check(s) failed)"
  exit 1
fi

echo "VERIFICATION STATUS: PASS (All evaluated checks passed successfully)"
exit 0
