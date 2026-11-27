import { test, expect } from '@playwright/test';

// Default mock handlers for common background queries
async function setupGlobalApiMocks(page) {
  // Regex interceptor for all Supabase Auth requests
  await page.route(/\/auth\/v1\//, async (route) => {
    const url = route.request().url();
    if (url.includes('token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock-jwt-token-e2e',
          token_type: 'bearer',
          expires_in: 3600,
          refresh_token: 'mock-refresh-token',
          user: {
            id: 'usr-e2e-1',
            aud: 'authenticated',
            role: 'authenticated',
            email: 'citizen@aniresq.com',
            user_metadata: { display_name: 'Test Citizen' },
          },
        }),
      });
    } else if (url.includes('logout')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    } else if (url.includes('user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr-e2e-1',
          email: 'citizen@aniresq.com',
          user_metadata: { display_name: 'Test Citizen' },
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });

  // Catch-all regex interceptor for backend API routes
  await page.route(/\/api\/notifications/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });

  await page.route(/\/api\/rescues/, async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'rescue-e2e-1',
          title: 'Injured puppy',
          status: 'REPORTED',
        }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
  });

  await page.route(/\/api\/lostfound/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function mockSignIn(
  page,
  { id = 'usr-e2e-1', role = 'CITIZEN', email = 'citizen@aniresq.com' } = {}
) {
  await setupGlobalApiMocks(page);

  await page.route(new RegExp(`/api/users/${id}`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id,
        email,
        displayName: 'Test Citizen',
        role,
      }),
    });
  });

  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill('ValidPass123!');
  await page.getByRole('button', { name: /Authenticate/i }).click();
  await page.waitForURL('**/dashboard');
}

test.describe('Authentication and Route Guard Flows', () => {
  test('login page loads and renders authentication form correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByText('System Authentication')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Authenticate/i })).toBeVisible();
  });

  test('register page loads and displays registration fields', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByText('Request Clearance')).toBeVisible();
    await expect(page.locator('#displayName')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Create Account/i })).toBeVisible();
  });

  test('unauthenticated visit to protected dashboard redirects to login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login?returnTo=%2Fdashboard');
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('returnTo=%2Fdashboard');
  });

  test('sign in and out flow', async ({ page }) => {
    await mockSignIn(page);
    expect(page.url()).toContain('/dashboard');

    const signOutBtn = page.getByRole('button', { name: /Sign Out/i }).first();
    await expect(signOutBtn).toBeVisible();
    await signOutBtn.click();

    await page.waitForURL('**/login*');
    expect(page.url()).toContain('/login');
  });

  test('anonymous user sees "Sign in to view" on Lost & Found', async ({ page }) => {
    await page.route(/\/api\/lostfound/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'lf-anon-1',
            reporterId: 'rep-1',
            type: 'LOST',
            status: 'ACTIVE',
            title: 'Lost Golden Retriever in Sector 4',
            species: 'DOG',
            breed: 'Golden Retriever',
            color: 'Golden',
            description: 'Friendly golden dog with red collar',
            lastSeenAddress: 'Central Park West',
            contactPhone: null,
            createdAt: new Date().toISOString(),
            photoUrls: [],
          },
        ]),
      });
    });

    await page.goto('/lost-found');
    await expect(page.getByRole('heading', { level: 1, name: 'Lost & Found' })).toBeVisible();
    await expect(page.getByText('Sign in to view')).toBeVisible();
  });

  test('signed-in user sees contact details on Lost & Found', async ({ page }) => {
    await mockSignIn(page);

    await page.route(/\/api\/lostfound/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'lf-auth-1',
            reporterId: 'rep-1',
            type: 'LOST',
            status: 'ACTIVE',
            title: 'Found Labrador in Sector 2',
            species: 'DOG',
            breed: 'Labrador',
            color: 'Black',
            description: 'Found near metro station',
            lastSeenAddress: 'Metro Gate 3',
            contactPhone: '+91 9876543210',
            createdAt: new Date().toISOString(),
            photoUrls: [],
          },
        ]),
      });
    });

    await page.goto('/lost-found');
    await expect(page.getByRole('heading', { level: 1, name: 'Lost & Found' })).toBeVisible();
    await expect(page.getByText('+91 9876543210')).toBeVisible();
    await expect(page.getByText('Sign in to view')).not.toBeVisible();
  });

  test('apply for adoption and see duplicate (409) message', async ({ page }) => {
    await mockSignIn(page);

    await page.route(/\/api\/animals\/an-e2e-1/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'an-e2e-1',
          name: 'Buddy',
          species: 'DOG',
          breed: 'Golden Retriever',
          gender: 'MALE',
          ageYears: 2,
          adoptionStatus: 'AVAILABLE',
          photoUrls: [],
        }),
      });
    });

    await page.route(/\/api\/adoptions/, async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            detail: 'You have an active open application for this animal',
          }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    await page.goto('/adoption/an-e2e-1');
    await expect(page.getByText('Adoption Application')).toBeVisible();

    // Step 1: Living Situation
    await page.locator('#environmentType').selectOption('house');
    await page.locator('#otherPets').fill('None');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 2: Personal & Household
    await page.locator('#familyMembers').fill('3');
    await page.locator('#workSchedule').fill('Flexible work schedule');
    await page.locator('#priorExperience').fill('Had dogs before for 5 years');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 3: Motivation
    await page.locator('#motivation').fill('Looking for a friendly companion for our home');
    await page.getByRole('button', { name: 'Next' }).click();

    // Step 4: Review and submit
    await page.getByRole('button', { name: /Submit Application/i }).click();

    // Assert 409 duplicate error toast
    await expect(page.getByText(/active open application/i)).toBeVisible();
  });

  test('report a rescue flow', async ({ page }) => {
    await mockSignIn(page);

    await page.route(/\/nominatim\.openstreetmap\.org\//, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          { lat: '13.0827', lon: '80.2707', display_name: 'Anna Nagar, Chennai' },
        ]),
      });
    });

    await page.goto('/report-rescue');
    await expect(page.getByRole('heading', { level: 1, name: 'Emergency SOS' })).toBeVisible();

    await page.getByPlaceholder(/Injured stray dog/i).fill('Injured puppy near market');
    await page.getByPlaceholder(/Describe the animal/i).fill('Puppy with limp leg, needs immediate assistance');
    await page.getByPlaceholder(/Anna Nagar/i).fill('Anna Nagar, Chennai');
    await page.getByRole('button', { name: /Search Map/i }).click();

    // Small delay to allow address & position to update
    await page.waitForTimeout(500);

    await page.getByRole('button', { name: /DISPATCH SOS/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('non-admin visiting /admin is redirected to /unauthorized', async ({ page }) => {
    await mockSignIn(page, { role: 'CITIZEN' });

    await page.goto('/admin');
    await page.waitForURL('**/unauthorized');
    expect(page.url()).toContain('/unauthorized');
    await expect(
      page.getByText(/Access Restricted|Unauthorized|Insufficient Clearance/i)
    ).toBeVisible();
  });

  test('401 from API redirects to /login with safe returnTo', async ({ page }) => {
    await mockSignIn(page);

    // Any subsequent API call to users returns 401
    await page.route(/\/api\/users\//, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Token expired' }),
      });
    });

    await page.goto('/profile');
    await page.waitForURL('**/login?returnTo=%2Fprofile');
    expect(page.url()).toContain('/login');
    expect(page.url()).toContain('returnTo=%2Fprofile');
  });
});
