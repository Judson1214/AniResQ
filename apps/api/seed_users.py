import os
import sys
import argparse
import getpass
from pathlib import Path

# Load environment
from dotenv import load_dotenv
env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)
load_dotenv()

from supabase_config import supabase

def get_or_create_user(email: str, password: str, display_name: str, role: str) -> str:
    """
    Creates or updates a user in Supabase Auth and sets their role in public.users.
    """
    # 1. Search for existing user by email
    existing_users = supabase.auth.admin.list_users()
    user_id = None
    for user in existing_users:
        if user.email and user.email.lower() == email.lower():
            user_id = user.id
            break

    if user_id:
        print(f"[*] User {email} already exists (ID: {user_id}). Updating password & metadata...")
        supabase.auth.admin.update_user_by_id(
            user_id,
            {
                "password": password,
                "email_confirm": True,
                "user_metadata": {"display_name": display_name}
            }
        )
    else:
        print(f"[*] Creating new user in Supabase Auth: {email}...")
        res = supabase.auth.admin.create_user({
            "email": email,
            "password": password,
            "email_confirm": True,
            "user_metadata": {"display_name": display_name}
        })
        user_id = res.user.id
        print(f"[+] Created user {email} (ID: {user_id})")

    # 2. Update role and display_name in public.users via service client
    try:
        # Check if record in public.users exists (trigger may take a moment or already handled it)
        user_row = supabase.table("users").select("id").eq("id", user_id).execute()
        if user_row.data:
            supabase.table("users").update({
                "role": role,
                "display_name": display_name,
                "email": email
            }).eq("id", user_id).execute()
        else:
            supabase.table("users").insert({
                "id": user_id,
                "email": email,
                "display_name": display_name,
                "role": role
            }).execute()
        print(f"[+] Assigned role '{role}' in public.users for {email}")
    except Exception as e:
        print(f"[!] Warning updating public.users profile: {e}")

    return user_id

def main():
    parser = argparse.ArgumentParser(description="Seed initial admin and test users into Supabase.")
    parser.add_argument("--admin-email", default=os.getenv("SEED_ADMIN_EMAIL", "admin@aniresq.com"))
    parser.add_argument("--admin-password", default=os.getenv("SEED_ADMIN_PASSWORD") or os.getenv("ADMIN_PASSWORD"))
    parser.add_argument("--citizen-email", default=os.getenv("SEED_CITIZEN_EMAIL", "citizen@aniresq.com"))
    parser.add_argument("--citizen-password", default=os.getenv("SEED_CITIZEN_PASSWORD") or os.getenv("CITIZEN_PASSWORD"))
    
    args = parser.parse_args()

    admin_pwd = args.admin_password
    if not admin_pwd:
        if sys.stdin.isatty():
            admin_pwd = getpass.getpass("Enter password for admin user (SEED_ADMIN_PASSWORD not set): ")
        else:
            print("Error: Admin password must be supplied via SEED_ADMIN_PASSWORD env var or --admin-password flag.")
            sys.exit(1)

    citizen_pwd = args.citizen_password or admin_pwd

    print("=== AniResQ Supabase User Seeder ===")
    
    # Seed Admin User
    get_or_create_user(
        email=args.admin_email,
        password=admin_pwd,
        display_name="System Admin",
        role="ADMIN"
    )

    # Seed Demo Citizen User
    get_or_create_user(
        email=args.citizen_email,
        password=citizen_pwd,
        display_name="Demo Citizen",
        role="CITIZEN"
    )

    print("\n[✓] User seeding completed successfully.")

if __name__ == "__main__":
    main()
