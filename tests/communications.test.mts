import assert from 'node:assert/strict';
import test from 'node:test';

import {
  defaultTemplateDesign,
  htmlToDesign,
  renderTemplateDesign,
  templateChecks,
  templateDesignToPlainText,
} from '../components/communications/templateDesign.ts';
import {
  defaultWorkflow,
  insertWorkflowNode,
  orderedWorkflowNodes,
  removeWorkflowNode,
  workflowErrors,
} from '../components/communications/workflowModel.ts';

test('rich template designs compile to safe email HTML and plain text', () => {
  const design = defaultTemplateDesign();
  design.blocks = [
    { id: 'heading', type: 'heading', text: 'Hello <customer>', align: 'left' },
    { id: 'button', type: 'button', text: 'Visit', url: 'javascript:alert(1)', align: 'center' },
  ];
  const html = renderTemplateDesign(design);
  assert.match(html, /Hello &lt;customer&gt;/);
  assert.match(html, /href="#"/);
  assert.doesNotMatch(html, /javascript:/);
  assert.equal(templateDesignToPlainText(design), 'Hello <customer>\n\nVisit: javascript:alert(1)');
});

test('pasted HTML survives the trip back to the designer and sends verbatim', () => {
  const pasted =
    '<html><body><table><tr><td style="color:red">Hi {{customer.firstName}}</td></tr></table><a href="https://x.test">Order</a></body></html>';
  const base = { ...defaultTemplateDesign(), preheader: 'Fresh this week' };
  const design = htmlToDesign(pasted, base);

  assert.equal(design.blocks.length, 1);
  assert.equal(design.blocks[0].type, 'html');
  assert.equal(design.preheader, 'Fresh this week');

  const html = renderTemplateDesign(design);
  assert.match(html, /<td style="color:red">Hi \{\{customer\.firstName\}\}<\/td>/);
  assert.match(html, /<body><div style="display:none[^"]*">Fresh this week/);
  assert.equal(templateDesignToPlainText(design), 'Hi {{customer.firstName}}\n\nOrder (https://x.test)');

  // Editing in the HTML tab again must not stack a second preview line.
  const again = renderTemplateDesign(htmlToDesign(html, design));
  assert.equal(again.match(/Fresh this week/g)?.length, 1);

  assert.ok(templateChecks(htmlToDesign('<p>{{nope}}</p>'), 'Hi', ['customer.firstName']).some((check) => check.key === 'var-nope'));
});

test('inserting a condition creates valid yes and no workflow branches', () => {
  const workflow = defaultWorkflow({
    trigger: 'order_created',
    templateId: '8f480451-475f-43ae-8af0-78267b51faca',
  });
  const withCondition = insertWorkflowNode(workflow, workflow.edges[0].id, 'condition');
  const condition = withCondition.nodes.find((node) => node.type === 'condition');
  assert.ok(condition);
  const branches = withCondition.edges
    .filter((edge) => edge.source === condition.id)
    .map((edge) => edge.branch)
    .sort();
  assert.deepEqual(branches, ['no', 'yes']);
  assert.deepEqual(workflowErrors(withCondition), []);
});

test('removing a condition reconnects its yes path and prunes the abandoned branch', () => {
  const workflow = defaultWorkflow({
    trigger: 'order_created',
    templateId: '8f480451-475f-43ae-8af0-78267b51faca',
  });
  const withCondition = insertWorkflowNode(workflow, workflow.edges[0].id, 'condition');
  const condition = withCondition.nodes.find((node) => node.type === 'condition');
  assert.ok(condition);

  const withoutCondition = removeWorkflowNode(withCondition, condition.id);
  assert.equal(
    withoutCondition.nodes.some((node) => node.id === condition.id),
    false,
  );
  assert.equal(withoutCondition.nodes.filter((node) => node.type === 'end').length, 1);
  assert.deepEqual(workflowErrors(withoutCondition), []);
});

test('workflow display order follows graph connections rather than insertion order', () => {
  const workflow = defaultWorkflow({
    trigger: 'order_created',
    templateId: '8f480451-475f-43ae-8af0-78267b51faca',
  });
  const expanded = insertWorkflowNode(workflow, workflow.edges[0].id, 'delay');
  assert.deepEqual(
    orderedWorkflowNodes(expanded).map((node) => node.type),
    ['trigger', 'delay', 'send_email', 'end'],
  );
});

test('the HTML editor checks the HTML and plain text, not the blocks it is not sending', async () => {
  const { templateChecks, defaultTemplateDesign } = await import('../components/communications/templateDesign.ts');
  const html = { htmlBody: '<p>Hi {{customer_name}}, order {{order.number}}</p>', textBody: 'Total {{order_total}}' };
  const checks = templateChecks(defaultTemplateDesign(), 'Hi', ['customer.firstName', 'order.number'], html);
  assert.deepEqual(
    checks.filter((check) => check.token).map((check) => check.token),
    ['customer_name', 'order_total'],
  );
  // The preview text is read from the HTML there: none in it, so it's asked for…
  assert.ok(checks.some((check) => check.key === 'preheader'));
  // …and once the HTML carries one, it isn't.
  const { setHtmlPreheader } = await import('../components/communications/templateDesign.ts');
  const withPreview = { ...html, htmlBody: setHtmlPreheader(html.htmlBody, 'Fresh this week') };
  assert.ok(!templateChecks(defaultTemplateDesign(), 'Hi', ['customer.firstName'], withPreview).some((check) => check.key === 'preheader'));
});

test('token segments mark only the fields we cannot fill, and keep every character', async () => {
  const { tokenSegments } = await import('../components/communications/templateDesign.ts');
  const text = 'Hi {{customer.firstName}}, see {{ nope }}.';
  const segments = tokenSegments(text, ['customer.firstName']);
  assert.equal(segments.map((segment) => segment.text).join(''), text);
  assert.deepEqual(
    segments.filter((segment) => segment.unknown).map((segment) => segment.text),
    ['{{ nope }}'],
  );
  // Before the variables load, nothing is called wrong.
  assert.ok(tokenSegments(text, []).every((segment) => !segment.unknown));
});

test('preview text round-trips through the HTML, and matches what the renderer writes', async () => {
  const { readHtmlPreheader, setHtmlPreheader, renderTemplateDesign, htmlToDesign, defaultTemplateDesign } =
    await import('../components/communications/templateDesign.ts');
  const design = { ...defaultTemplateDesign(), preheader: 'Old line' };
  const rendered = renderTemplateDesign(design);
  // Replaced in place: the same bytes the renderer writes for the new text.
  assert.equal(setHtmlPreheader(rendered, 'Fish & chips <today>'), renderTemplateDesign({ ...design, preheader: 'Fish & chips <today>' }));
  assert.equal(readHtmlPreheader(setHtmlPreheader(rendered, 'Fish & chips <today>')), 'Fish & chips <today>');
  // Cleared, then added back to HTML that never had one.
  assert.equal(readHtmlPreheader(setHtmlPreheader(rendered, '')), null);
  const page = '<html><body><p>Hi</p></body></html>';
  assert.equal(readHtmlPreheader(setHtmlPreheader(page, 'New')), 'New');
  // Opening HTML brings its preview text into the design.
  assert.equal(htmlToDesign(setHtmlPreheader(page, 'From the HTML'), design).preheader, 'From the HTML');
});

test('a preview line written by hand, in another shape, is read and rewritten in place', async () => {
  const { readHtmlPreheader, setHtmlPreheader } = await import('../components/communications/templateDesign.ts');
  const byClass = '<body><span class="preheader" style="color:transparent">Your table is booked&nbsp;&zwnj;&#847;</span><p>Hi</p></body>';
  assert.equal(readHtmlPreheader(byClass), 'Your table is booked');
  const rewritten = setHtmlPreheader(byClass, 'See you at 7');
  assert.equal(readHtmlPreheader(rewritten), 'See you at 7');
  // Their markup is kept; only the words change.
  assert.ok(rewritten.startsWith('<body><span class="preheader" style="color:transparent">See you at 7'));
  assert.ok(rewritten.endsWith('</span><p>Hi</p></body>'));

  const byStyle = '<div style="display: none; font-size:1px">Order &amp; pay ahead</div><p>Body</p>';
  assert.equal(readHtmlPreheader(byStyle), 'Order & pay ahead');
  assert.equal(setHtmlPreheader(byStyle, ''), '<p>Body</p>');
  assert.equal(readHtmlPreheader('<p>No preview here</p>'), null);
});

test('the preview element holds just the words — no spacer entities — and old padded ones still read clean', async () => {
  const { readHtmlPreheader, setHtmlPreheader, renderTemplateDesign, defaultTemplateDesign } =
    await import('../components/communications/templateDesign.ts');
  const html = renderTemplateDesign({ ...defaultTemplateDesign(), preheader: 'Ми вже почали його обробку' });
  assert.ok(html.includes('mso-hide:all">Ми вже почали його обробку</div>'));
  assert.ok(!/&#847;|&zwnj;|&nbsp;/.test(html.slice(0, html.indexOf('</div>') + 6)));
  const padded = `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">Old line${'&#847;&zwnj;&nbsp;'.repeat(40)}</div><p>Hi</p>`;
  assert.equal(readHtmlPreheader(padded), 'Old line');
  assert.equal(
    setHtmlPreheader(padded, 'New line'),
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">New line</div><p>Hi</p>',
  );
});
