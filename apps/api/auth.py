from fastapi import Request, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase_config import supabase

security = HTTPBearer()

def get_current_user(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    token = credentials.credentials
    try:
        # Verify the JWT token using Supabase's auth service
        # This securely validates the token and retrieves the user details
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise Exception("Invalid token")
            
        user = user_response.user
        return {
            "uid": user.id,
            "email": user.email,
            "name": user.user_metadata.get("display_name", "Unknown")
        }
    except Exception as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )
