import os
import time
import logging
from typing import Optional, Dict, Tuple
import jwt
from jwt import PyJWKClient, ExpiredSignatureError, InvalidTokenError
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_config import supabase, SUPABASE_URL

security = HTTPBearer()
optional_security = HTTPBearer(auto_error=False)
logger = logging.getLogger("auth")

# In-process TTL cache for user profiles: user_id -> (profile_dict, expiry_timestamp)
_USER_CACHE: Dict[str, Tuple[dict, float]] = {}
CACHE_TTL_SECONDS = int(os.getenv("AUTH_CACHE_TTL_SECONDS", "60"))

# JWKS client cache for asymmetric tokens (RS256/ES256)
_JWKS_CLIENT: Optional[PyJWKClient] = None
_JWKS_URL = f"{SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"

def invalidate_user_cache(user_id: str) -> None:
    """Evicts a user profile from the authentication cache upon role mutations or clearance updates."""
    _USER_CACHE.pop(user_id, None)

def _get_jwks_client() -> PyJWKClient:
    global _JWKS_CLIENT
    if _JWKS_CLIENT is None:
        _JWKS_CLIENT = PyJWKClient(_JWKS_URL, cache_keys=True, max_cached_keys=16)
    return _JWKS_CLIENT

def verify_token_locally(token: str) -> dict:
    """
    Validates a Supabase JWT locally without an external network round-trip.
    Validates signature, expiration, issuer, audience, and access token claims with 10s leeway.
    Falls back to Supabase Auth API if local verification cannot determine keys.
    """
    try:
        header = jwt.get_unverified_header(token)
        alg = header.get("alg", "HS256")
    except Exception:
        raise HTTPException(
            status_code=401,
            detail="Invalid authentication token format",
            headers={"WWW-Authenticate": "Bearer"},
        )

    expected_iss = f"{SUPABASE_URL.rstrip('/')}/auth/v1"
    leeway = 10  # 10 second clock-skew allowance

    payload = None

    if alg == "HS256":
        # Supabase HMAC-SHA256 signature verification
        secret = os.getenv("SUPABASE_JWT_SECRET") or os.getenv("JWT_SECRET")
        if not secret:
            # Fall back to SUPABASE_SERVICE_ROLE_KEY if secret not explicitly provided
            service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
            if service_key and not service_key.startswith("eyJ"):
                secret = service_key

        if secret:
            try:
                payload = jwt.decode(
                    token,
                    secret,
                    algorithms=["HS256"],
                    audience="authenticated",
                    issuer=expected_iss,
                    leeway=leeway,
                )
            except ExpiredSignatureError:
                raise HTTPException(
                    status_code=401,
                    detail="Authentication token has expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            except InvalidTokenError as ite:
                raise HTTPException(
                    status_code=401,
                    detail=f"Invalid authentication token: {ite}",
                    headers={"WWW-Authenticate": "Bearer"},
                )

    elif alg in ("RS256", "ES256"):
        # Asymmetric signature verification via Supabase JWKS
        try:
            jwks_client = _get_jwks_client()
            signing_key = jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
                issuer=expected_iss,
                leeway=leeway,
            )
        except ExpiredSignatureError:
            raise HTTPException(
                status_code=401,
                detail="Authentication token has expired",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except InvalidTokenError as ite:
            raise HTTPException(
                status_code=401,
                detail=f"Invalid authentication token: {ite}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as jwks_err:
            logger.warning(f"JWKS verification failed, falling back to Supabase Auth API: {jwks_err}")

    # Fallback to Supabase Auth API if local verification could not proceed
    if payload is None:
        try:
            user_response = supabase.auth.get_user(token)
            if not user_response or not user_response.user:
                raise ValueError("User not found from token")
            user = user_response.user
            return {
                "sub": user.id,
                "email": user.email,
                "user_metadata": user.user_metadata or {},
            }
        except Exception as api_err:
            logger.warning(f"Supabase auth.get_user fallback failed: {api_err}")
            raise HTTPException(
                status_code=401,
                detail="Invalid or expired authentication credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )

    sub = payload.get("sub")
    if not sub:
        raise HTTPException(
            status_code=401,
            detail="Token missing subject claim",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return payload

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    payload = verify_token_locally(token)
    user_id = payload.get("sub")
    email = payload.get("email") or payload.get("user_metadata", {}).get("email", "")
    metadata = payload.get("user_metadata", {})

    now = time.time()
    # Check profile cache
    cached = _USER_CACHE.get(user_id)
    if cached and cached[1] > now:
        profile_data = cached[0]
    else:
        # Fetch verified role, disabled status, and display name from public.users table
        try:
            profile_res = (
                supabase.table("users")
                .select("role, display_name, is_disabled")
                .eq("id", user_id)
                .execute()
            )
            if profile_res.data:
                profile_row = profile_res.data[0]
                profile_data = {
                    "role": profile_row.get("role", "CITIZEN"),
                    "display_name": profile_row.get("display_name") or metadata.get("display_name", "Unknown User"),
                    "is_disabled": bool(profile_row.get("is_disabled", False)),
                }
            else:
                profile_data = {
                    "role": "CITIZEN",
                    "display_name": metadata.get("display_name", "Unknown User"),
                    "is_disabled": False,
                }
            _USER_CACHE[user_id] = (profile_data, now + CACHE_TTL_SECONDS)
        except Exception as db_err:
            logger.error(f"Database error loading user profile for {user_id}: {db_err}")
            # Fail closed with 503 for protected routes instead of silently assuming CITIZEN
            raise HTTPException(
                status_code=503,
                detail="User authentication service temporarily unavailable"
            )

    # Reject disabled/banned accounts with 403 Forbidden
    if profile_data.get("is_disabled") is True:
        logger.warning(f"Rejected authenticated access for disabled account: {user_id}")
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Account is disabled"
        )

    return {
        "uid": user_id,
        "id": user_id,
        "email": email,
        "name": profile_data["display_name"],
        "role": profile_data["role"],
    }

def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Security(optional_security)) -> Optional[dict]:
    if not credentials:
        return None
    try:
        return get_current_user(credentials)
    except Exception:
        # Anonymous-optional routes treat bad/missing/disabled tokens as anonymous
        return None

def require_roles(allowed_roles: list[str]):
    def role_dependency(user: dict = Depends(get_current_user)) -> dict:
        user_role = user.get("role")
        # ADMIN always has access
        if user_role == "ADMIN" or user_role in allowed_roles:
            return user
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You do not have permission to perform this action"
        )
    return role_dependency
