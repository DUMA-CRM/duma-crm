import { createServer } from 'node:http';

const user = {
  id: 'smoke-user',
  name: 'Sam Barista',
  email: 'sam@example.test',
  emailVerified: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};
const session = {
  id: 'smoke-session',
  userId: user.id,
  token: 'smoke-token',
  expiresAt: '2030-01-01T00:00:00.000Z',
};
const tenantId = '11111111-1111-4111-8111-111111111111';
const locationId = '22222222-2222-4222-8222-222222222222';
const capabilities = ['staff:read', 'scheduling:read', 'scheduling:write', 'shifts:read', 'shifts:write', 'hr.sensitive:read'];
const staffProfile = {
  id: 'staff-profile-1',
  userId: user.id,
  tenantId,
  role: 'franchise_owner',
  scope: 'franchise',
  isActive: true,
  locationIds: [locationId],
  createdAt: user.createdAt,
  capabilities,
  user,
};
const location = {
  id: locationId,
  tenantId,
  name: 'High Street',
  address: '1 Test Street',
  timezone: 'Europe/London',
  isActive: true,
  createdAt: user.createdAt,
};
const workedWithoutRota = {
  id: '33333333-3333-4333-8333-333333333333',
  userId: user.id,
  locationId,
  clockedIn: '2026-09-14T08:02:00.000Z',
  clockedOut: '2026-09-14T13:44:00.000Z',
  durationMinutes: 342,
  staff: { userId: user.id, user },
  location,
};

function json(response, status, body, headers = {}) {
  response.writeHead(status, { 'content-type': 'application/json', ...headers });
  response.end(JSON.stringify(body));
}

function authenticated(request) {
  return request.headers.cookie?.includes('better-auth.session_token=smoke-token') ?? false;
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:47778');

  if (url.pathname === '/health') return json(response, 200, { status: 'ok' });

  if (request.method === 'POST' && url.pathname === '/v1/auth/sign-in/email') {
    return json(
      response,
      200,
      { user, session },
      {
        'set-cookie': 'better-auth.session_token=smoke-token; Path=/; HttpOnly; SameSite=Lax',
      },
    );
  }

  if (!authenticated(request)) return json(response, 401, { error: 'Unauthorized', code: 'unauthorized' });

  if (url.pathname === '/v1/auth/get-session') return json(response, 200, { user, session });
  if (url.pathname === '/v1/staff/me') {
    return json(response, 200, staffProfile);
  }
  if (url.pathname === '/v1/staff') return json(response, 200, [staffProfile]);
  if (url.pathname === `/v1/locations/tenant/${tenantId}` || url.pathname === '/v1/locations') return json(response, 200, [location]);
  if (url.pathname === '/v1/hr/employees') {
    return json(response, 200, [
      {
        id: 'employee-1',
        userId: user.id,
        tenantId,
        jobTitle: 'Manager',
        employmentType: 'full_time',
        startDate: '2026-01-01',
        isActive: true,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        payType: 'hourly',
        hourlyRate: '12.50',
        unpaidBreakMins: 0,
      },
    ]);
  }
  if (url.pathname === '/v1/scheduled-shifts/variance') return json(response, 200, []);
  if (url.pathname === '/v1/scheduled-shifts') return json(response, 200, []);
  if (url.pathname === '/v1/shifts/active') return json(response, 200, []);
  if (url.pathname === '/v1/shifts') return json(response, 200, [workedWithoutRota]);
  if (url.pathname === '/v1/payroll/runs') return json(response, 200, []);
  if (url.pathname === '/v1/shifts/my' || url.pathname === '/v1/scheduled-shifts/my') return json(response, 200, []);

  return json(response, 404, { error: 'Not found', path: url.pathname });
}).listen(47778, '127.0.0.1');
