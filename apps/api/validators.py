from urllib.parse import urlparse, unquote
from typing import List, Optional
from fastapi import HTTPException
from supabase_config import SUPABASE_URL

_parsed_supabase = urlparse(SUPABASE_URL)
EXPECTED_NETLOC = _parsed_supabase.netloc.lower()
EXPECTED_SCHEME = _parsed_supabase.scheme.lower()
UPLOADS_PREFIX_PATH = "/storage/v1/object/public/uploads/"
PREFIX = f"{SUPABASE_URL.rstrip('/')}{UPLOADS_PREFIX_PATH}"

def _validate_supabase_storage_url(
    url_str: str,
    field_name: str = "photo",
    caller_uid: Optional[str] = None
) -> str:
    if not url_str or not isinstance(url_str, str):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL. {field_name.capitalize()} URL must be a non-empty string."
        )

    clean_url = url_str.strip()
    # Check for path traversal or escape vectors
    if ".." in clean_url or "\\" in clean_url:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL. Path traversal sequences are strictly forbidden."
        )

    decoded = unquote(clean_url)
    if ".." in decoded or "\\" in decoded or "\n" in decoded or "\r" in decoded:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL. Encoded traversal sequences are strictly forbidden."
        )

    try:
        parsed = urlparse(clean_url)
    except Exception:
        raise HTTPException(
            status_code=422,
            detail=f"Malformed {field_name} URL."
        )

    # Require https unless local development localhost/127.0.0.1
    is_local = parsed.hostname in ("localhost", "127.0.0.1")
    if not is_local and parsed.scheme.lower() != "https":
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL scheme. Storage URLs must use HTTPS."
        )

    if parsed.netloc.lower() != EXPECTED_NETLOC:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL host. Must originate from official AniResQ storage host '{EXPECTED_NETLOC}'."
        )

    if not parsed.path.startswith(UPLOADS_PREFIX_PATH):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL path. Must be stored in the public 'uploads' bucket."
        )

    # Check caller-scoped directory for user avatars if caller_uid is specified
    if caller_uid:
        user_prefix = f"{UPLOADS_PREFIX_PATH}{caller_uid}/"
        if not parsed.path.startswith(user_prefix):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid avatar URL. Avatars must be stored under your personal directory '{caller_uid}/'."
            )

    return clean_url

def validate_photo_url(u: str, field_name: str = "photo") -> str:
    return _validate_supabase_storage_url(u, field_name=field_name)

def validate_photo_urls(urls: Optional[List[str]]) -> List[str]:
    if not urls:
        return []
    valid = []
    for u in urls:
        if not u or not isinstance(u, str):
            continue
        valid.append(_validate_supabase_storage_url(u, field_name="photo"))
    return valid

def validate_avatar_url(url: Optional[str], caller_uid: Optional[str] = None) -> Optional[str]:
    if not url:
        return url
    u = url.strip()
    if not u:
        return u
    return _validate_supabase_storage_url(u, field_name="avatar", caller_uid=caller_uid)
