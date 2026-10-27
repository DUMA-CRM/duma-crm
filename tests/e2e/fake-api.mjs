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
const moduleIds = [
  'core', 'identity', 'organization', 'customers', 'catalog', 'ordering', 'pos', 'payments', 'inventory',
  'purchasing', 'workforce', 'people', 'payroll', 'communications', 'automation', 'compliance', 'audit', 'analytics', 'agent', 'support', 'cms',
];
const capabilities = ['settings:write', 'analytics:read', 'email:read', 'email:write', 'email:publish', 'helpdesk:manage', 'staff:read', 'scheduling:read', 'scheduling:write', 'shifts:read', 'shifts:write', 'hr.sensitive:read'];
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


// ── Website analytics: a connected Umami with a believable month ──────────────
const analyticsConnection = {
  id: 'analytics-1',
  provider: 'umami',
  displayName: 'High Street website',
  siteId: '4f9a2c1e-0b7d-4e21-9c3a-5d8e7f6a1b2c',
  apiUrl: 'https://stats.example.test',
  lastTestedAt: '2026-10-20T09:00:00.000Z',
};

/** Deterministic visitors for a day: a weekly shape, a gentle climb, no randomness. */
function visitorsOn(date) {
  const weekday = date.getUTCDay();
  const shape = [0.8, 0.75, 0.8, 0.9, 1.15, 1.45, 1.3][weekday];
  const climb = 1 + ((date.getTime() / 86_400_000) % 60) / 120;
  return Math.round(140 * shape * climb);
}

function webReport(url) {
  const from = new Date(url.searchParams.get('from') ?? '2026-10-01T00:00:00Z');
  const to = new Date(url.searchParams.get('to') ?? '2026-10-31T00:00:00Z');
  const sections = new Set((url.searchParams.get('sections') ?? '').split(',').filter(Boolean));
  const daily = [];
  for (let day = new Date(from); day < to; day = new Date(day.getTime() + 86_400_000)) {
    const visitors = visitorsOn(day);
    daily.push({ date: new Date(day.getTime() + 12 * 3_600_000).toISOString().slice(0, 10), visitors, pageviews: Math.round(visitors * 2.9) });
  }
  const visitors = daily.reduce((sum, day) => sum + day.visitors, 0);
  const pageviews = daily.reduce((sum, day) => sum + day.pageviews, 0);
  const visits = Math.round(visitors * 1.18);
  const scale = (rows) => rows.map(([key, part]) => ({ key, value: Math.round(visitors * part) }));
  const report = { provider: 'umami', breakdowns: {} };
  if (sections.has('summary')) report.summary = { pageviews, visitors, visits, bounceRate: 0.38, avgVisitSeconds: 222 };
  if (sections.has('daily')) report.daily = daily;
  if (sections.has('hourly')) {
    // Local hours in the report's timezone, like the API: a lunch and an evening peak.
    const timeZone = url.searchParams.get('timezone') ?? 'UTC';
    const key = (at) => {
      const part = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(at).map((p) => [p.type, p.value]));
      return { hour: `${part.year}-${part.month}-${part.day} ${part.hour}`, at: Number(part.hour) };
    };
    report.hourly = [];
    for (let at = new Date(from); at < to; at = new Date(at.getTime() + 3_600_000)) {
      const { hour, at: h } = key(at);
      const visitors = Math.round(4 + 22 * Math.exp(-((h - 12.5) ** 2) / 5) + 30 * Math.exp(-((h - 18.5) ** 2) / 4));
      report.hourly.push({ hour, visitors, pageviews: Math.round(visitors * 2.8) });
    }
  }
  if (sections.has('active')) report.active = 12;
  if (sections.has('weekly')) {
    report.weekly = Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 24 }, (_, hour) => {
        const open = hour >= 7 && hour <= 21 ? 1 : 0.08;
        const lunch = Math.exp(-((hour - 12.5) ** 2) / 4) * 1.4;
        const evening = Math.exp(-((hour - 18.5) ** 2) / 3) * (day >= 4 ? 1.6 : 0.9);
        return Math.round(visits / 7 / 24 * open * (0.4 + lunch + evening) * (day >= 5 ? 1.3 : 1));
      }),
    );
  }
  if (sections.has('eventsDaily')) {
    const weights = { view_menu: 0.9, add_to_cart: 0.42, checkout_started: 0.2, order_placed: 0.11, signup: 0.05, apply_promo: 0.02 };
    report.eventSeries = daily.flatMap((day) => Object.entries(weights).map(([event, w]) => ({ bucket: day.date, event, count: Math.round(day.visitors * w) })));
  }
  if (sections.has('eventsHourly') && report.hourly) {
    const weights = { view_menu: 0.9, add_to_cart: 0.42, checkout_started: 0.2, order_placed: 0.11, signup: 0.05 };
    report.eventSeries = report.hourly.flatMap((h) => Object.entries(weights).map(([event, w]) => ({ bucket: h.hour, event, count: Math.round(h.visitors * w) })));
  }
  const breakdowns = {
    pages: scale([['/menu', 1.09], ['/order', 0.65], ['/locations', 0.43], ['/loyalty', 0.31], ['/about', 0.12]]),
    entries: scale([['/', 0.52], ['/menu', 0.31], ['/locations', 0.1]]),
    referrers: scale([['google.com', 0.4], ['instagram.com', 0.2], ['facebook.com', 0.13], ['t.co', 0.06], ['bing.com', 0.03]]),
    channels: scale([['organicSearch', 0.38], ['paidSearch', 0.04], ['organicSocial', 0.22], ['direct', 0.24], ['referral', 0.08], ['email', 0.04]]),
    campaigns: scale([['meta', 0.12], ['newsletter', 0.04], ['google', 0.03]]),
    countries: scale([['GB', 0.71], ['US', 0.09], ['IE', 0.06], ['FR', 0.04], ['DE', 0.03]]),
    devices: scale([['mobile', 0.66], ['desktop', 0.18], ['laptop', 0.11], ['tablet', 0.05]]),
    browsers: scale([['ios', 0.48], ['chrome', 0.31], ['samsung', 0.08], ['edge-chromium', 0.05]]),
    os: scale([['iOS', 0.5], ['Android', 0.21], ['Windows 10', 0.16], ['Mac OS', 0.11]]),
    events: scale([['view_menu', 0.9], ['add_to_cart', 0.42], ['checkout_started', 0.2], ['order_placed', 0.11], ['signup', 0.05]]),
  };
  for (const [key, rows] of Object.entries(breakdowns)) if (sections.has(key)) report.breakdowns[key] = rows;
  return report;
}

function webFunnel(url) {
  const steps = JSON.parse(url.searchParams.get('steps') ?? '[]');
  const shares = [1, 0.55, 0.22, 0.12, 0.08, 0.05];
  return steps.map((step, index) => ({ ...step, visitors: Math.round(5243 * shares[index]) }));
}

function orderAnalytics() {
  return {
    summary: { totalOrders: 820, grossRevenue: '9840.00', refundsBySaleDate: '0.00', refundsByRefundDate: '0.00', totalRevenue: '9840.00', avgOrderValue: '12.00' },
    byStatus: [],
    bySource: [
      { source: 'pos', count: 640, revenue: '7680.00' },
      { source: 'web', count: 118, revenue: '1416.00' },
      { source: 'qr_code', count: 62, revenue: '744.00' },
    ],
    daily: [],
  };
}

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

  if (url.pathname === '/v1/tenants') return json(response, 200, [{ id: tenantId, name: 'High Street', slug: 'high-street', status: 'active', timezone: 'Europe/London' }]);
  if (url.pathname === '/v1/updates/unread') return json(response, 200, { count: 0, popup: null });
  if (url.pathname === '/v1/auth/get-session') return json(response, 200, { user, session });
  if (url.pathname === '/v1/staff/me') {
    return json(response, 200, request.headers.cookie?.includes('updates-test-admin=1') ? { ...staffProfile, role: 'super_admin', capabilities: [...capabilities, 'cms:read', 'cms:write', 'cms:publish'] } : staffProfile);
  }
  if (url.pathname === '/v1/modules/current') {
    return json(response, 200, {
      modules: moduleIds.map((moduleId) => ({
        moduleId,
        status: moduleId === 'cms' && request.headers.cookie?.includes('updates-test-cms-disabled=1') ? 'disabled' : 'enabled',
        configurationVersion: 1,
        configuration: {},
      })),
    });
  }
  // The tab's context in one answer (the CRM's content waits for it). A member,
  // in their own workspace, whose modules match /modules/current above.
  if (url.pathname === '/v1/workspace-context') {
    const admin = request.headers.cookie?.includes('updates-test-admin=1');
    return json(response, 200, {
      mode: 'workspace',
      actor: {
        userId: staffProfile.userId,
        kind: 'staff',
        platformRoles: [],
        homeTenantId: tenantId,
        role: admin ? 'super_admin' : staffProfile.role,
        capabilities: admin ? [...capabilities, 'cms:read', 'cms:write', 'cms:publish'] : staffProfile.capabilities,
        locationIds: staffProfile.locationIds ?? null,
      },
      workspace: {
        id: tenantId,
        name: 'High Street',
        slug: 'high-street',
        status: 'active',
        classification: 'customer',
        timezone: 'Europe/London',
        brand: 'forest',
        modules: moduleIds.map((moduleId) => ({
          moduleId,
          status: moduleId === 'cms' && request.headers.cookie?.includes('updates-test-cms-disabled=1') ? 'disabled' : 'enabled',
          configurationVersion: 1,
          configuration: {},
        })),
      },
    });
  }
  if (['/v1/email/automations', '/v1/email/templates', '/v1/email/automation-runs'].includes(url.pathname)) return json(response, 200, []);
  if (url.pathname === '/v1/customer-segments') return json(response, 200, { data: [] });
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
  // A team member's composed dashboard: just their own workday.
  if (url.pathname === '/v1/dashboard-layouts/resolved') {
    const widget = { widgetKey: 'workforce.my-day', gridColumn: 1, gridRow: 1, width: 12, height: 4 };
    return json(response, 200, {
      tenantId: user.tenantId ?? null,
      audienceKey: 'frontline_pos',
      source: 'system',
      layoutId: null,
      version: 1,
      layers: { system: { version: 1, widgetCount: 1 }, workspace: null, personal: null },
      availableWidgets: [widget],
      widgets: [widget],
    });
  }
  if (url.pathname === '/v1/scheduled-shifts/variance') return json(response, 200, []);
  if (url.pathname === '/v1/scheduled-shifts') return json(response, 200, []);
  if (url.pathname === '/v1/shifts/active') return json(response, 200, []);
  if (url.pathname === '/v1/shifts') return json(response, 200, [workedWithoutRota]);
  if (url.pathname === '/v1/payroll/runs') return json(response, 200, []);
  if (url.pathname === '/v1/shifts/my' || url.pathname === '/v1/scheduled-shifts/my') return json(response, 200, []);
  if (url.pathname === '/v1/analytics-connections') return json(response, 200, analyticsConnection);
  if (url.pathname === '/v1/analytics-connections/report') return json(response, 200, webReport(url));
  // No icons offline: the report falls back to its globe.
  if (url.pathname === '/v1/analytics-connections/favicon') return json(response, 404, { error: 'No icon.' });
  if (url.pathname === '/v1/analytics-connections/funnel') return json(response, 200, webFunnel(url));
  if (url.pathname === '/v1/analytics/orders') return json(response, 200, orderAnalytics());
  if (['/v1/analytics/hourly-volume', '/v1/analytics/top-items'].includes(url.pathname)) return json(response, 200, []);

  return json(response, 404, { error: 'Not found', path: url.pathname });
}).listen(47778, '127.0.0.1');
