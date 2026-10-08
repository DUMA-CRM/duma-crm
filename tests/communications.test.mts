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
  const pasted = '<html><body><table><tr><td style="color:red">Hi {{customer.firstName}}</td></tr></table><a href="https://x.test">Order</a></body></html>';
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
