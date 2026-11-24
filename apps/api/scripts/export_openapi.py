"""
Utility script to export the current FastAPI OpenAPI JSON schema.
Used to synchronize TypeScript frontend client contracts with Pydantic backend models.
"""
import json
import os
import sys
from pathlib import Path

# Provide mock environment variables for schema generation if running in bare environments
os.environ.setdefault("SUPABASE_URL", "https://placeholder-project.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")

# Add apps/api to path
api_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(api_dir))

from main import app  # noqa: E402

def export_schema(output_path: Path):
    schema = app.openapi()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(schema, f, indent=2)
    print(f"Exported OpenAPI schema to {output_path}")

if __name__ == "__main__":
    repo_root = api_dir.parent.parent
    target_path = repo_root / "packages" / "shared-types" / "openapi.json"
    export_schema(target_path)
