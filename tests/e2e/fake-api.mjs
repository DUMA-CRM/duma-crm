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
    return json(response, 200, { user, session }, {
      'set-cookie': 'better-auth.session_token=smoke-token; Path=/; HttpOnly; SameSite=Lax',
    });
  }

  if (!authenticated(request)) return json(response, 401, { error: 'Unauthorized', code: 'unauthorized' });

  if (url.pathname === '/v1/auth/get-session') return json(response, 200, { user, session });
  if (url.pathname === '/v1/staff/me') {
    return json(response, 200, {
      id: user.id,
      userId: user.id,
      tenantId: '11111111-1111-4111-8111-111111111111',
      role: 'barista',
      scope: 'location',
      isActive: true,
      locationIds: ['22222222-2222-4222-8222-222222222222'],
      createdAt: user.createdAt,
      capabilities: [],
      user,
    });
  }
  if (url.pathname === '/v1/shifts/my' || url.pathname === '/v1/scheduled-shifts/my') return json(response, 200, []);

  return json(response, 404, { error: 'Not found', path: url.pathname });
}).listen(47778, '127.0.0.1');
