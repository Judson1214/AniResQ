from typing import List, Optional
from fastapi import HTTPException
from supabase_config import SUPABASE_URL

PREFIX = f"{SUPABASE_URL.rstrip('/')}/storage/v1/object/public/uploads/"


def validate_photo_url(u: str, field_name: str = "photo") -> str:
    if not u or not isinstance(u, str):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL. {field_name.capitalize()} URL must be a non-empty string."
        )
    u = u.strip()
    if not u.startswith(PREFIX):
        raise HTTPException(
            status_code=422,
            detail=f"Invalid {field_name} URL '{u}'. {field_name.capitalize()}s must be uploaded to the official AniResQ uploads storage bucket."
        )
    return u


def validate_photo_urls(urls: Optional[List[str]]) -> List[str]:
    if not urls:
        return []
    valid = []
    for u in urls:
        if not u or not isinstance(u, str):
            continue
        u = u.strip()
        if not u.startswith(PREFIX):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid photo URL '{u}'. Photos must be uploaded to the official AniResQ uploads storage bucket."
            )
        valid.append(u)
    return valid


def validate_avatar_url(url: Optional[str]) -> Optional[str]:
    if not url:
        return url
    u = url.strip()
    if not u:
        return u
    if not u.startswith(PREFIX):
        raise HTTPException(
            status_code=422,
            detail="Invalid avatar URL. Avatars must be uploaded to the official AniResQ uploads storage bucket."
        )
    return u
