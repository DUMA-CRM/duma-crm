import assert from 'node:assert/strict';
import test from 'node:test';

import { isRenderableMermaid, splitAgentContent } from '../lib/ai/mermaid-content.ts';

test('a complete supported diagram becomes a visual block between prose', () => {
  const content = 'Here is the flow.\n\n```mermaid\nflowchart LR\n  A[Order] --> B[Kitchen]\n```\n\nThe team can then hand it over.';
  assert.deepEqual(splitAgentContent(content), [
    { kind: 'markdown', content: 'Here is the flow.\n\n' },
    { kind: 'mermaid', source: 'flowchart LR\n  A[Order] --> B[Kitchen]' },
    { kind: 'markdown', content: '\n\nThe team can then hand it over.' },
  ]);
});

test('an unfinished streaming fence stays readable Markdown', () => {
  const content = '```mermaid\nflowchart LR\n  A --> B';
  assert.deepEqual(splitAgentContent(content), [{ kind: 'markdown', content }]);
});

test('unsupported, oversized, or interactive diagrams never render', () => {
  assert.equal(isRenderableMermaid('classDiagram\nA <|-- B'), false);
  assert.equal(isRenderableMermaid('flowchart LR\nclick A "https://example.com"'), false);
  assert.equal(isRenderableMermaid(`flowchart LR\n${'A --> B\n'.repeat(600)}`), false);
});
