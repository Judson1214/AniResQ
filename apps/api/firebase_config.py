import firebase_admin
from firebase_admin import credentials, firestore

# Initialize Firebase Admin
# It will use the GOOGLE_APPLICATION_CREDENTIALS environment variable
try:
    firebase_admin.get_app()
except ValueError:
    firebase_admin.initialize_app()

db = firestore.client()
