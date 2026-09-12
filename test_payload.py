import requests

payload = {
    'type': 'LOST',
    'title': 'Lost dog',
    'description': 'very nice dog',
    'species': 'DOG',
    'color': 'black',
    'contactPhone': '1234567890',
    'contactEmail': 'test@test.com',
    'location': {'latitude': 1.0, 'longitude': 2.0},
    'lastSeenAddress': 'test address',
    'lastSeenDate': '2023',
    'reporterId': '123',
    'photoUrls': []
}

res = requests.post('http://127.0.0.1:8000/api/lostfound/', json=payload)
print(res.status_code)
print(res.text)
