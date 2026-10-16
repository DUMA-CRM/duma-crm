import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (file: string) => readFileSync(new URL(`../components/settings/connectors/${file}.tsx`, import.meta.url), 'utf8');

for (const [service, capability, files] of [
  ['getEmailConnection', 'email.connections:read', ['ConnectorsGrid', 'EmailConnector']],
  ['getPaymentConnections', 'payments.connections:read', ['ConnectorsGrid', 'PaymentsConnector']],
] as const) {
  test(`${service} is permission-gated in the overview and detail page`, () => {
    for (const file of files) {
      const source = read(file);
      const start = source.indexOf(`queryFn: () => ${service}(`);
      assert.ok(start >= 0, `${file}: missing connection query`);
      const query = source.slice(start, source.indexOf('});', start));
      assert.match(query, /enabled:/);
      assert.ok(query.includes(`hasCapability(capabilities, '${capability}')`), `${file}: missing API read capability`);
    }
  });
}

test('direct connector links check read and write access before mounting detail pages', () => {
  const source = read('ConnectorsRoute');
  const gate = source.indexOf('if (definition &&');
  assert.ok(gate > 0 && gate < source.indexOf("if (connector === 'email')"));
  assert.ok(gate < source.indexOf("if (connector === 'card-payments')"));
  assert.match(source, /!hasCapability\(capabilities, definition\.capability\)/);
  assert.match(source, /!hasCapability\(capabilities, definition\.readCapability\)/);
});
