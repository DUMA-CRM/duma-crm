'use client';

import { CheckCircle2, Copy, Eye, Loader2, Trash2, TriangleAlert } from '@/components/icons';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import type { EmailAutomation, EmailAutomationRun, EmailTemplate, EmailWorkflowNode } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/communications';

import { TRIGGER_HELP, TRIGGER_OPTIONS } from './shared';
import { describeStep } from './stepSummary';
import { isMovableNode } from './workflowModel';
import { NODE_META } from './workflowNodes';

export type SidebarTab = 'step' | 'workflow' | 'runs';

const CONDITION_FIELDS = [
  { value: 'customer.marketingOptIn', label: 'Marketing opt-in' },
  { value: 'customer.tier', label: 'Loyalty tier' },
  { value: 'customer.pointsBalance', label: 'Points balance' },
  { value: 'order.status', label: 'Order status' },
  { value: 'order.totalAmount', label: 'Order total' },
  { value: 'order.paymentMethod', label: 'Payment method' },
];
const STAFF_CONDITION_FIELDS = [
  { value: 'staff.employmentType', label: 'Employment type' },
  { value: 'staff.locationId', label: 'Location' },
  { value: 'staff.role', label: 'Access role' },
];
const CONDITION_OPERATORS = [
  { value: 'equals', label: 'is' },
  { value: 'not_equals', label: 'isn’t' },
  { value: 'greater_than', label: 'is more than' },
  { value: 'greater_than_or_equal', label: 'is at least' },
  { value: 'less_than', label: 'is less than' },
  { value: 'less_than_or_equal', label: 'is at most' },
  { value: 'contains', label: 'contains' },
];
const DELAY_UNITS = [
  { value: 'minutes', label: 'minutes' },
  { value: 'hours', label: 'hours' },
  { value: 'days', label: 'days' },
];

const RUN_LABEL: Record<EmailAutomationRun['status'], string> = { running: 'Running', completed: 'Completed', failed: 'Failed' };
const RUN_GLYPH: Record<EmailAutomationRun['status'], string> = {
  running: 'bg-primary/8 text-primary',
  completed: 'bg-momentum/10 text-momentum',
  failed: 'bg-exception/8 text-exception',
};

/**
 * The editor's right-hand panel, in three tabs so nothing scrolls past what
 * you came for: the selected step (what it does, then its settings), the
 * workflow as a whole, and its recent runs.
 *
 * Read-only viewers get the same panel with every control disabled by one
 * fieldset; the things that only read — the email preview, the runs — stay live.
 */
export function AutomationSidebar({
  tab,
  onTab,
  node,
  automation,
  name,
  onName,
  templates,
  locations,
  segments,
  staffAudience,
  runs,
  now,
  readOnly,
  templateName,
  onChange,
  onDuplicate,
  onRemove,
  onPreview,
  onOpenRun,
}: {
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  node?: EmailWorkflowNode;
  automation?: EmailAutomation;
  name: string;
  onName: (name: string) => void;
  templates: EmailTemplate[];
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  staffAudience: boolean;
  runs: EmailAutomationRun[];
  now: number;
  readOnly: boolean;
  templateName: (id: string) => string;
  onChange: (node: EmailWorkflowNode) => void;
  onDuplicate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onPreview: () => void;
  onOpenRun: (runId: string) => void;
}) {
  const failedRuns = runs.filter((run) => run.status === 'failed').length;
  return (
    <aside className="flex min-h-0 flex-col border-t border-rule/60 bg-card lg:border-l lg:border-t-0">
      <div className="shrink-0 border-b border-rule/45 p-3">
        <SegmentedControl<SidebarTab>
          value={tab}
          onChange={onTab}
          ariaLabel="Panel"
          className="w-full [&>button]:flex-1"
          options={[
            { value: 'step', label: 'Step' },
            { value: 'workflow', label: 'Workflow' },
            { value: 'runs', label: runs.length ? `Runs ${runs.length}` : 'Runs' },
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'step' &&
          (node ? (
            <StepPanel
              node={node}
              templates={templates}
              locations={locations}
              segments={segments}
              staffAudience={staffAudience}
              readOnly={readOnly}
              templateName={templateName}
              onChange={onChange}
              onDuplicate={() => onDuplicate(node.id)}
              onRemove={() => onRemove(node.id)}
              onPreview={onPreview}
            />
          ) : (
            <p className="p-5 text-sm text-muted-foreground">Select a step on the canvas to see what it does.</p>
          ))}

        {tab === 'workflow' && (
          <div className="space-y-5 p-5">
            <fieldset disabled={readOnly} className="min-w-0">
              <Input label="Name" value={name} onChange={(event) => onName(event.target.value)} required hint="Only your team sees this." />
            </fieldset>
            <dl className="divide-y divide-rule/45 overflow-hidden rounded-lg border border-rule/60">
              <Fact label="Status">
                {automation?.isEnabled ? (
                  <span className="font-semibold text-momentum">Sending</span>
                ) : automation?.publishedVersion ? (
                  'Switched off'
                ) : automation ? (
                  'Draft — never published'
                ) : (
                  'Not saved yet'
                )}
              </Fact>
              {Boolean(automation?.publishedVersion) && <Fact label="Live version">v{automation?.publishedVersion}</Fact>}
              <Fact label="Sends to">{staffAudience ? 'Employees' : 'Customers'}</Fact>
              {automation && (
                <Fact label="Runs">
                  {(automation.runCount ?? 0).toLocaleString()}
                  {Boolean(automation.failedRunCount) && (
                    <span className="ml-1.5 font-semibold text-exception">{automation.failedRunCount} failed</span>
                  )}
                </Fact>
              )}
              {automation?.lastEvaluatedAt && <Fact label="Last checked">{timeAgo(automation.lastEvaluatedAt, now)}</Fact>}
            </dl>
          </div>
        )}

        {tab === 'runs' && (
          <div className="p-5">
            {!automation ? (
              <p className="text-sm text-muted-foreground">Save the workflow and its runs appear here.</p>
            ) : runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet. Each time the trigger fires, a run appears here.</p>
            ) : (
              <>
                <p className="mb-2 px-1 text-xs text-muted-foreground">
                  The latest {runs.length}
                  {failedRuns > 0 && <span className="font-semibold text-exception"> · {failedRuns} failed</span>}. Open one to see each
                  step.
                </p>
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {runs.map((run) => (
                    <li key={run.id} className="border-b border-rule/45 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => onOpenRun(run.id)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
                      >
                        <span
                          className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', RUN_GLYPH[run.status])}
                          aria-hidden="true"
                        >
                          {run.status === 'completed' ? (
                            <CheckCircle2 size={15} />
                          ) : run.status === 'failed' ? (
                            <TriangleAlert size={15} />
                          ) : (
                            <Loader2 size={15} className="animate-spin" />
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">{RUN_LABEL[run.status]}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {run.stepCount} step{run.stepCount === 1 ? '' : 's'}
                            {run.failedStepCount > 0 && <span className="text-exception"> · {run.failedStepCount} failed</span>} · v
                            {run.version}
                          </span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{timeAgo(run.startedAt, now)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

/** A labelled control, in the same label style as `Input`. */
function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-label uppercase text-muted-foreground">{label}</p>
      {children}
      {hint && <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StepPanel({
  node,
  templates,
  locations,
  segments,
  staffAudience,
  readOnly,
  templateName,
  onChange,
  onDuplicate,
  onRemove,
  onPreview,
}: {
  node: EmailWorkflowNode;
  templates: EmailTemplate[];
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  staffAudience: boolean;
  readOnly: boolean;
  templateName: (id: string) => string;
  onChange: (node: EmailWorkflowNode) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onPreview: () => void;
}) {
  const meta = NODE_META[node.type];
  const locationName = node.type === 'trigger' ? locations.find((location) => location.id === node.config.locationId)?.name : null;
  const removable = node.type !== 'trigger' && node.type !== 'end';
  const selectedTemplate = node.type === 'send_email' ? templates.find((template) => template.id === node.config.templateId) : undefined;

  return (
    <div>
      {/* Who this step is, and what it does — before any of the how. */}
      <header className="border-b border-rule/45 p-5">
        <div className="flex items-start gap-3">
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', meta.chip)} aria-hidden="true">
            <meta.icon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-label uppercase text-muted-foreground">{meta.label}</p>
            <input
              value={node.name}
              onChange={(event) => onChange({ ...node, name: event.target.value })}
              disabled={readOnly}
              aria-label="Step name"
              className="-mx-1 w-full rounded-sm bg-transparent px-1 text-base font-semibold text-foreground outline-none transition-colors hover:bg-band/50 focus:bg-band/60 disabled:hover:bg-transparent"
            />
          </div>
          {!readOnly && (
            <span className="flex shrink-0 items-center">
              {isMovableNode(node) && (
                <Button variant="ghost" size="icon-sm" onClick={onDuplicate} aria-label={`Duplicate ${node.name}`} title="Duplicate">
                  <Copy />
                </Button>
              )}
              {removable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRemove}
                  aria-label={`Remove ${node.name}`}
                  title="Remove step"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              )}
            </span>
          )}
        </div>
        <p className="mt-3 rounded-md bg-band/50 px-3 py-2.5 text-sm leading-relaxed text-foreground">
          {describeStep(node, { templateName, locationName, staff: staffAudience })}
        </p>
      </header>

      <fieldset disabled={readOnly} className="min-w-0 space-y-5 p-5">
        {node.type === 'trigger' && (
          <>
            <Field label="Starts when" hint={TRIGGER_HELP[node.config.event]}>
              <Select
                value={node.config.event}
                onValueChange={(value) =>
                  onChange({
                    ...node,
                    config: {
                      ...node.config,
                      event: value as typeof node.config.event,
                      offsetDays: value === 'customer_inactive' ? 30 : 0,
                      locationId: value.startsWith('order_') ? node.config.locationId : null,
                      // Dropped when the trigger stops being segment-driven, so a
                      // leftover id cannot silently scope a different trigger.
                      segmentId: value === 'segment_entered' ? node.config.segmentId : null,
                    },
                  })
                }
                options={TRIGGER_OPTIONS}
                ariaLabel="Workflow trigger"
                className="w-full"
              />
            </Field>
            {node.config.event === 'segment_entered' && (
              <Field
                label="Segment"
                hint={
                  segments.length
                    ? 'Save a filtered customer list as a segment to use it here.'
                    : 'Filter the customer list, then save it as a segment — it appears here.'
                }
              >
                <Select
                  value={node.config.segmentId ?? ''}
                  onValueChange={(value) => onChange({ ...node, config: { ...node.config, segmentId: value || null } })}
                  options={[
                    { value: '', label: segments.length ? 'Choose a segment…' : 'No saved segments' },
                    ...segments.map((segment) => ({ value: segment.id, label: segment.name })),
                  ]}
                  ariaLabel="Segment to watch"
                  className="w-full"
                />
              </Field>
            )}
            {node.config.event.startsWith('order_') && (
              <Field label="At">
                <Select
                  value={node.config.locationId ?? ''}
                  onValueChange={(value) => onChange({ ...node, config: { ...node.config, locationId: value || null } })}
                  options={[
                    { value: '', label: 'Any location' },
                    ...locations.map((location) => ({ value: location.id, label: location.name })),
                  ]}
                  ariaLabel="Workflow location"
                  className="w-full"
                />
              </Field>
            )}
            {(node.config.event === 'customer_birthday' || node.config.event === 'customer_inactive') && (
              <>
                <Field label={node.config.event === 'customer_birthday' ? 'Days before the birthday' : 'Days without a visit'}>
                  <Input
                    type="number"
                    min={node.config.event === 'customer_birthday' ? 0 : 1}
                    aria-label={node.config.event === 'customer_birthday' ? 'Days before the birthday' : 'Days without a visit'}
                    value={Math.abs(node.config.offsetDays ?? 0)}
                    onChange={(event) =>
                      onChange({
                        ...node,
                        config: {
                          ...node.config,
                          offsetDays:
                            node.config.event === 'customer_birthday'
                              ? -Math.abs(Number(event.target.value))
                              : Math.max(1, Number(event.target.value)),
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Time zone" hint="Whose midnight counts as the day.">
                  <TimezoneSelect
                    value={node.config.timezone ?? 'Europe/London'}
                    onChange={(timezone) => onChange({ ...node, config: { ...node.config, timezone } })}
                  />
                </Field>
              </>
            )}
          </>
        )}

        {node.type === 'send_email' && (
          <Field label="Template">
            <Select
              value={node.config.templateId}
              onValueChange={(templateId) => onChange({ ...node, config: { templateId } })}
              options={
                templates.length
                  ? templates.map((template) => ({ value: template.id, label: template.name }))
                  : [{ value: '', label: 'No templates yet' }]
              }
              ariaLabel="Email template"
              className="w-full"
            />
          </Field>
        )}

        {node.type === 'delay' && (
          // Reads as the sentence it sets: "Wait [3] [days]".
          <Field label="Wait for">
            <div className="grid grid-cols-[6rem_1fr] gap-2">
              <Input
                type="number"
                min={1}
                aria-label="How long"
                value={node.config.amount}
                onChange={(event) => onChange({ ...node, config: { ...node.config, amount: Math.max(1, Number(event.target.value)) } })}
              />
              <Select
                value={node.config.unit}
                onValueChange={(unit) => onChange({ ...node, config: { ...node.config, unit: unit as typeof node.config.unit } })}
                options={DELAY_UNITS}
                ariaLabel="Unit"
                className="w-full"
              />
            </div>
          </Field>
        )}

        {node.type === 'condition' && (
          <>
            <Field label="If">
              <Select
                value={node.config.field}
                onValueChange={(field) => onChange({ ...node, config: { ...node.config, field: field as typeof node.config.field } })}
                options={staffAudience ? STAFF_CONDITION_FIELDS : CONDITION_FIELDS}
                ariaLabel="Condition field"
                className="w-full"
              />
            </Field>
            <div className="grid grid-cols-[9rem_1fr] gap-2">
              <Select
                value={node.config.operator}
                onValueChange={(operator) =>
                  onChange({ ...node, config: { ...node.config, operator: operator as typeof node.config.operator } })
                }
                options={CONDITION_OPERATORS}
                ariaLabel="Comparison"
                className="w-full"
              />
              <Input
                aria-label="Value"
                value={String(node.config.value)}
                onChange={(event) => onChange({ ...node, config: { ...node.config, value: event.target.value } })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <p className="rounded-md border border-momentum/30 bg-momentum/6 px-3 py-2 text-foreground">
                <span className="font-semibold text-momentum">Yes</span> — the left branch
              </p>
              <p className="rounded-md border border-rule/60 bg-band/40 px-3 py-2 text-foreground">
                <span className="font-semibold">No</span> — the right branch
              </p>
            </div>
          </>
        )}

        {node.type === 'end' && (
          <p className="text-sm text-muted-foreground">Nothing happens after this. Use + on the line above it to add a step.</p>
        )}
      </fieldset>

      {/* Outside the fieldset: previewing is reading, so a read-only viewer keeps it. */}
      {node.type === 'send_email' && selectedTemplate && (
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={onPreview}
            aria-label={`Preview ${selectedTemplate.name}`}
            className="group relative block w-full overflow-hidden rounded-lg border border-rule/60 bg-white text-left focus-visible:outline-2 focus-visible:outline-ring"
          >
            <span className="block aspect-4/3 overflow-hidden">
              <iframe
                title=""
                sandbox=""
                tabIndex={-1}
                srcDoc={selectedTemplate.htmlBody}
                className="pointer-events-none h-150 w-[200%] origin-top-left scale-50 border-0 bg-white"
              />
            </span>
            <span className="flex items-center gap-2 border-t border-rule/45 bg-card px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">{selectedTemplate.subject}</span>
                <span className="block text-micro text-muted-foreground">Subject line</span>
              </span>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
                <Eye size={13} aria-hidden="true" /> Preview
              </span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
