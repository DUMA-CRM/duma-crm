import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { FRONTEND_CAPABILITIES } from '../lib/auth/capabilities.ts';

/**
 * The contract the agent's own surface has to keep.
 *
 * `api-contract.test.mts` scans for `apiFetch(...)` and checks every path
 * against openapi.json. The agent does not use `apiFetch` — its tools call
 * `runtime.get(...)` and `runtime.send(...)` — so all 29 read tools and 17
 * write actions were outside that net. That is how `/hr/payslips/my` and
 * `/hr/expense-claims/*` survived in the agent for two months after the tables
 * were dropped: the one test that would have caught them could not see them.
 *
 * These modules cannot be imported here — they are `server-only` and use `@/`
 * aliases — so this reads them as source, the same approach
 * `service-worker-offline.test.mts` takes.
 */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const read = (file: string) => readFileSync(join(root, file), 'utf8');

const TOOLS_SOURCE = read('lib/ai/agent-tools.server.ts');
const ACTIONS_SOURCE = read('lib/ai/agent-actions.server.ts');
const RUNTIME_SOURCE = read('lib/ai/agent-runtime.server.ts');
const DUMA_AGENT_SOURCE = read('lib/ai/duma-agent.server.ts');
const AGENT_SOURCE = `${TOOLS_SOURCE}\n${ACTIONS_SOURCE}`;

/** Every literal path the agent asks the API for. */
function agentPaths(source: string): string[] {
  const paths = new Set<string>();
  // runtime.get<T>('/path'), runtime.send('/path', 'POST', …) — literal first
  // argument only. A template literal keeps its ${…} and is normalised below.
  for (const match of source.matchAll(/runtime\.(?:get|send)(?:<[^>]*>)?\(\s*[`'"]([^`'"]+)[`'"]/g)) {
    paths.add(match[1].replace(/\$\{[^}]*\}/g, '{param}').split('?')[0]);
  }
  return [...paths].sort();
}

/**
 * Endpoints duma-api does not have. Verified 2026-09-10 by grepping the whole
 * of `duma-api/src` for "payslip" and "expense": zero matches. The tables were
 * dropped in 2026-07.
 *
 * This is a ratchet that may only ever shrink. If duma-api brings one of these
 * back, delete the line — do not add to it. Anything new belongs in duma-api
 * first.
 *
 * `/hr/payslips` left the list on 2026-10-05: payslips came back as issued pay
 * run lines (duma-api `src/routes/payslips.ts`, mounted at `/v1/hr/payslips`;
 * `GET /my` is session-subject), which My HR → Documents already reads.
 */
const DEAD_PREFIXES = ['/hr/expense-claims'] as const;

test('the agent calls no endpoint that duma-api has deleted', () => {
  const dead = agentPaths(AGENT_SOURCE).filter((path) => DEAD_PREFIXES.some((prefix) => path.startsWith(prefix)));
  assert.deepEqual(
    dead,
    [],
    'These paths do not exist in duma-api. A tool that calls one will draft an action, ' +
      'take the operator’s approval, and fail:\n  ' +
      dead.join('\n  '),
  );
});

test('every agent path is absolute and carries no origin', () => {
  for (const path of agentPaths(AGENT_SOURCE)) {
    assert.ok(path.startsWith('/'), `agent path is not absolute: ${path}`);
    assert.ok(!path.includes('://'), `agent path hardcodes an origin: ${path}`);
    // `/be` is chosen by lib/api/client.ts from the execution context. A tool
    // that hardcodes it breaks server-side, where calls go direct.
    assert.ok(!path.startsWith('/be/'), `agent path hardcodes the browser proxy prefix: ${path}`);
  }
});

/** `capability: 'x:y'` on any tool or action. */
function declaredCapabilities(source: string): string[] {
  return [...source.matchAll(/^\s*capability: '([^']+)'/gm)].map((match) => match[1]);
}

test('every capability an agent tool gates on is one the frontend knows', () => {
  const known = new Set<string>(FRONTEND_CAPABILITIES);
  const unknown = [...new Set(declaredCapabilities(AGENT_SOURCE))].filter((capability) => !known.has(capability)).sort();
  assert.deepEqual(
    unknown,
    [],
    'A capability the agent gates on is not in FRONTEND_CAPABILITIES. `hasCapability` ' +
      'fails closed on an unknown string, so the tool is silently unreachable for every role:\n  ' +
      unknown.join('\n  '),
  );
});

/** Tool and action names, as the model sees them. */
const toolNames = [...TOOLS_SOURCE.matchAll(/^\s{2}name: '([a-z_]+)',$/gm)].map((match) => match[1]);
const actionToolNames = [...ACTIONS_SOURCE.matchAll(/^\s{4}name: '(draft_[a-z_]+)',$/gm)].map((match) => match[1]);

test('the model is offered a coherent, unambiguous tool list', () => {
  const all = [...toolNames, ...actionToolNames];
  assert.ok(toolNames.length >= 25, `only ${toolNames.length} read tools parsed — the shape of the file changed`);
  assert.ok(actionToolNames.length >= 15, `only ${actionToolNames.length} write actions parsed — the shape of the file changed`);

  const duplicates = all.filter((name, index) => all.indexOf(name) !== index);
  assert.deepEqual(duplicates, [], `two tools share a name, so one is unreachable: ${duplicates.join(', ')}`);

  for (const name of all) {
    assert.match(name, /^[a-z][a-z0-9_]*$/, `${name} is not a valid tool name for every router`);
    assert.ok(name.length <= 64, `${name} exceeds the 64-character tool-name limit some routers impose`);
  }
});

test('every write action names the capability it needs, or is self-service by design', () => {
  // An action with no capability is reachable by every signed-in operator. That
  // is correct for "book my own leave" and wrong for anything else, so the count
  // is pinned: a new uncapped action has to be a deliberate edit here.
  const blocks = ACTIONS_SOURCE.split(/^const \w+: ActionDefinition = \{$/m).slice(1);
  const selfService = blocks.filter((block) => !/^\s*capability: '/m.test(block.split('\n  tool:')[0] ?? ''));
  assert.ok(
    selfService.length <= 6,
    `${selfService.length} write actions require no capability (bound is 6). Each one is ` +
      'writable by every signed-in operator — confirm that is intended before raising this.',
  );
});

test('no tool description promises data DUMA does not hold', () => {
  // The agent used to advertise payslips and expenses in two tool descriptions
  // while the endpoints 404'd, so the model confidently offered to fetch them.
  // Payslips are real again (issued pay runs); expense claims are not.
  for (const [label, source] of [
    ['tools', TOOLS_SOURCE],
    ['actions', ACTIONS_SOURCE],
  ] as const) {
    const offers = [...source.matchAll(/description:\s*\n?\s*'([^']{0,4000})'/g)]
      .map((match) => match[1])
      .filter((description) => /\bexpense claims?\b/i.test(description))
      // One description names them to tell the model they are *not* held.
      .filter((description) => !/does not hold/i.test(description));
    assert.deepEqual(offers, [], `an agent ${label} description still offers expense claims`);
  }
});

test('a missing optional HR record does not erase the signed-in account identity', () => {
  const profileStart = TOOLS_SOURCE.indexOf('const getMyProfile: ToolDefinition = {');
  const profileEnd = TOOLS_SOURCE.indexOf('// ── My HR: attendance', profileStart);
  assert.ok(profileStart >= 0 && profileEnd > profileStart, 'could not find the get_my_profile tool');

  const profileTool = TOOLS_SOURCE.slice(profileStart, profileEnd);
  assert.match(profileTool, /module: 'identity'/, 'account identity must remain available when the people module is disabled');
  assert.match(profileTool, /runtime\.myEmployee\(\)/, 'the profile tool must use the nullable employee lookup');
  assert.match(profileTool, /employeeRecordAvailable/, 'the tool must distinguish account identity from employment details');
  assert.doesNotMatch(
    profileTool,
    /runtime\.get<HrEmployee>\('\/hr\/employees\/me'\)/,
    'the profile tool must not hard-fail when the optional employee row is absent',
  );

  assert.match(
    RUNTIME_SOURCE,
    /error instanceof ApiError && error\.status === 404\) return null/,
    'only a missing employee row should become null; other API errors must still surface',
  );
  assert.match(
    DUMA_AGENT_SOURCE,
    /absence never means the account is unlinked/,
    'the model must be told not to describe an authenticated account as unlinked',
  );
});

test('a read tool gates on the capability its endpoint actually enforces', () => {
  // Each pair was checked against duma-api's requireCapability on 2026-10-05.
  // A broader capability offers the tool to a role the API then refuses —
  // till staff hold inventory:read, but not stock.locations:read.
  const gateOf = (name: string) => {
    const start = TOOLS_SOURCE.indexOf(`  name: '${name}',`);
    assert.ok(start >= 0, `tool ${name} not found`);
    const block = TOOLS_SOURCE.slice(TOOLS_SOURCE.lastIndexOf(': ToolDefinition = {', start), TOOLS_SOURCE.indexOf('async run', start));
    return block.match(/^\s*capability: '([^']+)'/m)?.[1] ?? null;
  };
  assert.equal(gateOf('get_inventory_status'), 'stock.locations:read'); // GET /location-stock/alerts
  assert.equal(gateOf('get_stock_operations'), 'stock.transfers:read'); // GET /stock-transfers
  assert.equal(gateOf('get_cash_up_status'), 'cashups:read'); // GET /cash-ups, /cash-ups/:id/expected
  assert.equal(gateOf('get_rota_variance'), 'scheduling:read'); // GET /scheduled-shifts/variance
  assert.equal(gateOf('list_recipe_gaps'), 'recipes:read'); // GET /menu-item-recipes/gaps
  assert.equal(gateOf('get_customer'), 'customers:read'); // GET /customers/:id
  assert.equal(gateOf('get_my_payslips'), null); // GET /hr/payslips/my is session-subject
});

test('optional reads behind a second capability do not fail the whole tool', () => {
  // GET /email/connection needs email.connections:read, which store and
  // marketing managers lack; fetching it unconditionally failed the tool for
  // the roles that run email.
  assert.match(TOOLS_SOURCE, /canSeeConnection = hasCapability\(runtime\.profile, 'email\.connections:read'\)/);
  assert.match(TOOLS_SOURCE, /canReadStocktakes = hasCapability\(runtime\.profile, 'stocktakes:read'\)/);
});

test('the app map in the brief names every sidebar entry as the app labels it', () => {
  const nav = read('lib/constants/nav.ts');
  const labels = [...nav.matchAll(/label: '([^']+)', href: '\/[a-z-]*'/g)].map((match) => match[1]);
  assert.ok(labels.length >= 14, `only ${labels.length} nav labels parsed — the shape of nav.ts changed`);
  const start = DUMA_AGENT_SOURCE.indexOf('export const APP_MAP');
  const brief = DUMA_AGENT_SOURCE.slice(start, DUMA_AGENT_SOURCE.indexOf('function agentInstructions', start));
  const missing = labels.filter((label) => !brief.includes(label));
  assert.deepEqual(missing, [], `the agent's app map does not mention: ${missing.join(', ')}`);
  // Retired names the brief must not send anyone to.
  assert.doesNotMatch(brief, /POS terminal|Settings → Locations|End of day page/);
});
