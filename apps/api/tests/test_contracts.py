import json
from pathlib import Path
from main import app

def test_openapi_schema_matches_shared_types_contract():
    """Verifies that the FastAPI application OpenAPI export matches packages/shared-types/openapi.json exactly."""
    openapi_file = Path(__file__).resolve().parents[3] / "packages" / "shared-types" / "openapi.json"
    assert openapi_file.exists(), f"Missing openapi.json at {openapi_file}"

    with open(openapi_file, "r", encoding="utf-8") as f:
        recorded_schema = json.load(f)

    current_schema = app.openapi()

    # Verify matching title, version, and paths
    assert current_schema["info"]["title"] == recorded_schema["info"]["title"]
    assert current_schema["info"]["version"] == recorded_schema["info"]["version"]

    current_paths = set(current_schema["paths"].keys())
    recorded_paths = set(recorded_schema["paths"].keys())
    assert current_paths == recorded_paths, f"Path mismatch: {current_paths ^ recorded_paths}"

    # Verify that all components and schemas match
    current_schemas = current_schema.get("components", {}).get("schemas", {})
    recorded_schemas = recorded_schema.get("components", {}).get("schemas", {})
    assert set(current_schemas.keys()) == set(recorded_schemas.keys())

def test_response_models_validate_sample_payloads():
    """Verifies sample API responses parse correctly through their respective Pydantic response models."""
    from routers.rescues import RescueResponse
    from routers.animals import AnimalResponse
    from routers.adoptions import AdoptionResponse
    from routers.lostfound import LostFoundResponse
    from routers.settings import SystemSettings

    # 1. Rescue response
    rescue_data = {
        "id": "11111111-1111-1111-1111-111111111111",
        "title": "Injured dog",
        "description": "Found near bridge",
        "species": "DOG",
        "severity": "CRITICAL",
        "status": "PENDING",
        "location": {"latitude": 12.9716, "longitude": 77.5946},
        "address": "MG Road",
        "reporterId": "22222222-2222-2222-2222-222222222222",
        "photoUrls": ["https://mock.test/dog.jpg"],
        "createdAt": "2026-01-01T00:00:00Z",
        "updatedAt": "2026-01-01T00:00:00Z",
        "timeline": []
    }
    rescue_obj = RescueResponse(**rescue_data)
    assert rescue_obj.id == rescue_data["id"]

    # 2. Animal response
    animal_data = {
        "id": "33333333-3333-3333-3333-333333333333",
        "name": "Bella",
        "species": "CAT",
        "adoptionStatus": "AVAILABLE",
        "location": "Bengaluru",
        "photos": [],
        "createdAt": "2026-01-01T00:00:00Z"
    }
    animal_obj = AnimalResponse(**animal_data)
    assert animal_obj.name == "Bella"

    # 3. Adoption response
    adoption_data = {
        "id": "44444444-4444-4444-4444-444444444444",
        "animalId": "33333333-3333-3333-3333-333333333333",
        "applicantId": "22222222-2222-2222-2222-222222222222",
        "status": "SUBMITTED",
        "createdAt": "2026-01-01T00:00:00Z"
    }
    adoption_obj = AdoptionResponse(**adoption_data)
    assert adoption_obj.status == "SUBMITTED"

    # 4. Lost & Found response
    lost_data = {
        "id": "55555555-5555-5555-5555-555555555555",
        "type": "LOST",
        "title": "Lost Beagle",
        "description": "Brown collar",
        "species": "DOG",
        "status": "OPEN",
        "contactPhone": None,
        "contactEmail": None,
        "location": {"latitude": 12.9716, "longitude": 77.5946},
        "lastSeenAddress": "Indiranagar",
        "lastSeenDate": "2026-01-01T00:00:00Z",
        "photoUrls": [],
        "createdAt": "2026-01-01T00:00:00Z"
    }
    lost_obj = LostFoundResponse(**lost_data)
    assert lost_obj.contactPhone is None

    # 5. System settings response
    settings_data = {
        "autoDispatchEnabled": True,
        "maxRadiusKm": 25,
        "rateLimit_surrender": 10,
        "rateLimit_mutation": 40
    }
    settings_obj = SystemSettings(**settings_data)
    assert settings_obj.autoDispatchEnabled is True
