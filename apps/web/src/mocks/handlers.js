import { http, HttpResponse } from 'msw';

export const handlers = [
  // Auth endpoints
  http.get('/api/users/me', () => {
    return HttpResponse.json({
      id: 'usr-11111111-1111-1111-1111-111111111111',
      email: 'citizen@aniresq.test',
      displayName: 'Test Citizen',
      role: 'CITIZEN',
      phone: '+1234567890',
    });
  }),

  // Lost & Found
  http.get('/api/lostfound', () => {
    return HttpResponse.json({
      items: [
        {
          id: 'lf-1',
          reporterId: 'reporter-1',
          type: 'LOST',
          status: 'ACTIVE',
          title: 'Lost Golden Retriever',
          species: 'DOG',
          breed: 'Golden Retriever',
          color: 'Golden',
          description: 'Friendly dog with red collar',
          lastSeenAddress: '123 Main St, Springfield',
          contactPhone: null, // Redacted for anonymous
          createdAt: new Date().toISOString(),
          photoUrls: [],
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
  }),

  http.get('/api/lostfound/:id/replies', () => {
    return HttpResponse.json([]);
  }),

  http.post('/api/lostfound/:id/replies', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({
      id: 'reply-1',
      postId: 'lf-1',
      userId: 'user-1',
      userName: 'Test User',
      text: body.text,
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // Adoptions
  http.post('/api/adoptions', async ({ request }) => {
    const body = await request.json();
    if (body.animalId === 'already-applied-animal-id') {
      return HttpResponse.json(
        { detail: 'You already have an open adoption application for this animal.' },
        { status: 409 }
      );
    }
    return HttpResponse.json({
      id: 'app-999',
      animalId: body.animalId,
      applicantId: body.applicantId,
      status: 'SUBMITTED',
      createdAt: new Date().toISOString(),
    }, { status: 201 });
  }),

  // Rescues
  http.get('/api/rescues', () => {
    return HttpResponse.json({
      items: [],
      total: 0,
      page: 1,
      limit: 20,
    });
  }),

  // Notifications
  http.get('/api/notifications', () => {
    return HttpResponse.json({
      items: [],
      unreadCount: 0,
    });
  }),
];
