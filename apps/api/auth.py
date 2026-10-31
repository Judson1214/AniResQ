import logging
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_config import supabase

security = HTTPBearer()
logger = logging.getLogger("auth")

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise ValueError("User not found from token")
            
        user = user_response.user
        
        # Fetch verified role from public.users table using service client
        role = "CITIZEN"
        display_name = user.user_metadata.get("display_name", "Unknown User")
        try:
            profile_res = supabase.table("users").select("role, display_name").eq("id", user.id).execute()
            if profile_res.data:
                role = profile_res.data[0].get("role", "CITIZEN")
                display_name = profile_res.data[0].get("display_name") or display_name
        except Exception as db_err:
            logger.warning(f"Failed to fetch profile role for {user.id}: {db_err}")
            
        return {
            "uid": user.id,
            "id": user.id,
            "email": user.email,
            "name": display_name,
            "role": role,
        }
    except Exception as e:
        logger.warning(f"Authentication failed: {e}")
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

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
