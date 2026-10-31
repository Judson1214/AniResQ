import os
from pathlib import Path
from supabase import create_client, Client
from dotenv import load_dotenv

# Search for .env in current directory and in apps/api directory
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL environment variable is required.")

if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY environment variable is required for the backend API.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
