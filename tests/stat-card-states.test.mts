import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * A ratchet for the mistake this codebase keeps making.
 *
 * "A query defaulting to `[]` makes a failure look like 'no data' — which is
 * exactly how a dead feature went unnoticed for two months." The panels were
 * fixed, `ErrorState` was written for it, and then the same bug reappeared in
 * stat tiles days later: a failed entitlements read rendered
 * "— · No allowance set", and a failed rota read rendered "Nothing in the next
 * four weeks". Both are confident claims about somebody that nothing had
 * checked.
 *
 * The rule this pins: **a `StatCard` fed by a query must be able to say it
 * does not know.** If a tile passes `loading`, it is reading something that
 * can fail, so it must also pass `error`.
 *
 * Static, like the contract test — it runs with no browser and no network, so
 * nobody has a reason to skip it.
 */

const here = dirname(fileURLToPath(import.meta.url));
const componentsDir = join(here, '..', 'components');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return tsxFiles(full);
    return full.endsWith('.tsx') ? [full] : [];
  });
}

/** Each `<StatCard …/>` element's attribute text, with its file and line. */
function statCards(source: string, file: string) {
  const found: { file: string; line: number; attrs: string }[] = [];
  let index = source.indexOf('<StatCard');
  while (index !== -1) {
    // Walk to the element's closing bracket, tracking brace depth so a `/>`
    // inside an expression (a nested element, a ternary) does not end it early.
    let depth = 0;
    let cursor = index + '<StatCard'.length;
    for (; cursor < source.length; cursor++) {
      const char = source[cursor];
      if (char === '{') depth++;
      else if (char === '}') depth--;
      else if (char === '>' && depth === 0) break;
    }
    found.push({
      file,
      line: source.slice(0, index).split('\n').length,
      attrs: source.slice(index, cursor),
    });
    index = source.indexOf('<StatCard', cursor);
  }
  return found;
}

/**
 * Tiles that take `loading` without `error`, as of 2026-09-11.
 *
 * A RATCHET, not an excuse — the same shape as `UNDECLARED_BY_DESIGN` in
 * `api-contract.test.mts`. The counts are asserted exactly, so:
 *
 *  • a new unguarded tile fails the build;
 *  • fixing one fails too, telling you to decrement the number — the list
 *    cannot rot in either direction.
 *
 * All of these predate the rule. They are almost entirely Reports, where the
 * query plumbing needs reading before an error state can be threaded through
 * honestly, and that is its own afternoon rather than a drive-by.
 */
const UNGUARDED_BY_DESIGN: Record<string, number> = {
  'components/reports/BusinessReportPage.tsx': 16,
  'components/reports/TopItemsReportPage.tsx': 6,
  'components/dashboard/TodayKpiRow.tsx': 4,
  'components/reports/ReportsWorkspace.tsx': 1,
  'components/reports/RefundReportPage.tsx': 1,
  'components/reports/MetricReportPage.tsx': 1,
  'components/people/my-hr/Overview.tsx': 1,
};

test('a StatCard that can load can also fail', () => {
  const counts: Record<string, number> = {};

  for (const file of tsxFiles(componentsDir)) {
    const source = readFileSync(file, 'utf8');
    if (!source.includes('<StatCard')) continue;

    for (const card of statCards(source, file)) {
      const reads = /\bloading=/.test(card.attrs);
      const handlesFailure = /\berror=/.test(card.attrs);
      if (reads && !handlesFailure) {
        const relative = file.replace(join(here, '..') + '/', '');
        counts[relative] = (counts[relative] ?? 0) + 1;
      }
    }
  }

  assert.deepEqual(
    counts,
    UNGUARDED_BY_DESIGN,
    'The set of StatCards that cannot report a failed read has changed.\n' +
      '  • More than expected: a tile takes `loading` but not `error`, so a failed\n' +
      '    read renders as a real figure. Pass `error={query.isError}`.\n' +
      '  • Fewer: you fixed one — decrement it here, or delete the line.',
  );
});

test('the scanner actually finds the tiles it is meant to police', () => {
  // A regex that silently matched nothing would make the test above vacuous.
  const total = tsxFiles(componentsDir)
    .map((file) => statCards(readFileSync(file, 'utf8'), file).length)
    .reduce((sum, count) => sum + count, 0);
  assert.ok(total > 10, `expected to find StatCards across the app, found ${total}`);
});

test('a StatCard with no query needs no error prop', () => {
  // The rule is about tiles fed by a request, not every tile. A static figure
  // cannot fail, and demanding `error` there would be noise.
  const sample = '<StatCard label="Employment" value="Full time" />';
  const [card] = statCards(sample, 'inline');
  assert.equal(/\bloading=/.test(card.attrs), false);
});
