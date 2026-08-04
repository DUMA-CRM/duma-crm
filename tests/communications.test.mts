import assert from 'node:assert/strict';
import test from 'node:test';

import { defaultTemplateDesign, renderTemplateDesign, templateDesignToPlainText } from '../components/communications/templateDesign.ts';
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
