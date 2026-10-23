import assert from 'node:assert/strict';
import test from 'node:test';
// The live CMS editor (UI-ADR-039) must give back Markdown that shows the same — run headless here,
// with the same extensions LiveMarkdownEditor uses, on the constructs websites depend on.
import { MarkdownManager } from '@tiptap/markdown';
import { StarterKit } from '@tiptap/starter-kit';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { TableKit } from '@tiptap/extension-table';
import { Image } from '@tiptap/extension-image';
import { CmsCallout, CmsVideo } from '../components/cms/liveMarkdownNodes.ts';
import { survivesRoundTrip } from '../lib/utils/markdown-roundtrip.ts';

const manager = new MarkdownManager({ extensions: [StarterKit, TaskList, TaskItem, TableKit, Image, CmsCallout, CmsVideo] as never });
const trip = (md: string) => manager.serialize(manager.parse(md));

const samples = {
  callout: 'Intro\n\n> [!WARNING]\n> Hot drinks are hot.\n> Mind the lid.\n\nAfter',
  video: 'Watch this:\n\nhttps://www.youtube.com/watch?v=dQw4w9WgXcQ\n\nThanks',
  quote: '> Just a quote',
  mixed: '# Menu\n\nOur _seasonal_ **specials**:\n\n- Pumpkin latte\n- [Chai](https://example.com/chai)\n\n![Cup](https://cdn.example.com/cup.png)',
  tasks: '- [ ] Open\n- [x] Done',
  table: '| Drink | Price |\n| --- | --- |\n| Latte | 3.50 |',
  codeBlock: 'Run it:\n\n```js\nconsole.log("hi");\n```\n\nDone',
};
for (const [name, md] of Object.entries(samples)) {
  test(`round trip keeps ${name}`, () => {
    const back = trip(md);
    assert.ok(survivesRoundTrip(md, back), `\n--- in\n${md}\n--- out\n${back}`);
  });
}
test('callout parses as a callout, not a quote', () => {
  const doc = manager.parse(samples.callout);
  assert.ok(JSON.stringify(doc).includes('"type":"callout"'));
  assert.ok(JSON.stringify(manager.parse(samples.video)).includes('"type":"videoEmbed"'));
  assert.ok(!JSON.stringify(manager.parse('see https://www.youtube.com/watch?v=dQw4w9WgXcQ here')).includes('videoEmbed'));
});
