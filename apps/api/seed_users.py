import firebase_admin
from firebase_admin import credentials, auth, firestore
import sys

def seed_users():
    try:
        cred = credentials.Certificate("serviceAccountKey.json")
        firebase_admin.initialize_app(cred)
    except Exception as e:
        print(f"Failed to initialize Firebase: {e}")
        return

    db = firestore.client()

    users_to_seed = [
        {
            "email": "admin@aniresq.com", 
            "password": "Password123!", 
            "displayName": "System Admin", 
            "role": "ADMIN"
        },
        {
            "email": "public@aniresq.com", 
            "password": "Password123!", 
            "displayName": "John Citizen", 
            "role": "CITIZEN"
        }
    ]

    for u in users_to_seed:
        try:
            user_record = auth.get_user_by_email(u["email"])
            print(f"User {u['email']} already exists. Updating password...")
            auth.update_user(user_record.uid, password=u["password"])
            uid = user_record.uid
        except firebase_admin.exceptions.NotFoundError:
            user_record = auth.create_user(email=u["email"], password=u["password"], display_name=u["displayName"])
            uid = user_record.uid
            print(f"Created Auth user {u['email']}")
        except Exception as e:
            # Fallback for other errors (like no-user-found in some SDK versions)
            if "not found" in str(e).lower() or "no user record" in str(e).lower():
                user_record = auth.create_user(email=u["email"], password=u["password"], display_name=u["displayName"])
                uid = user_record.uid
                print(f"Created Auth user {u['email']}")
            else:
                print(f"Error handling {u['email']}: {e}")
                continue

        # Save to Firestore
        try:
            db.collection("users").document(uid).set({
                "email": u["email"],
                "displayName": u["displayName"],
                "role": u["role"]
            }, merge=True)
            print(f"Seeded Firestore profile for {u['role']}")
        except Exception as e:
            print(f"Failed to write to Firestore: {e}")

if __name__ == "__main__":
    seed_users()
