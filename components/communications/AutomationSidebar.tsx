'use client';

import { motion } from 'motion/react';

import { ActionRow, ActionRows, InfoRow, InfoRows, RowTile } from '@/components/cms/rows';
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Eye,
  FileText,
  GitCompareArrows,
  Globe,
  Loader2,
  MapPin,
  Send,
  Trash2,
  TriangleAlert,
  Type,
  Users,
  XCircle,
  Zap,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { AmountUnitPicker } from '@/components/ui/amount-unit-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import type { EmailAutomation, EmailAutomationRun, EmailTemplate, EmailWorkflowNode } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';
import { timeAgo } from '@/lib/utils/communications';
import { formatDelay } from '@/lib/utils/duration';
import { resolvedTimeZone } from '@/lib/utils/workspace-time';

import { ExpandRow } from './ExpandRow';
import { TRIGGER_HELP, TRIGGER_OPTIONS } from './shared';
import { describeStep } from './stepSummary';
import { isMovableNode } from './workflowModel';
import { NODE_META } from './workflowNodes';

/** Sections rise in one after another, as in the Content editors. */
const STAGGER = { shown: { transition: { staggerChildren: 0.06 } } };

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

const RUN_LABEL: Record<EmailAutomationRun['status'], string> = { running: 'Running', completed: 'Completed', failed: 'Failed' };
const RUN_TILE = {
  running: { icon: Loader2, tone: 'default' },
  completed: { icon: CheckCircle2, tone: 'success' },
  failed: { icon: TriangleAlert, tone: 'danger' },
} as const;

const labelOf = (options: { value: string; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/**
 * The editor's right rail, in the Content editors' vocabulary and all on one
 * scroll: the workflow as a whole, then the selected step (what it does, then
 * its settings as one-line rows that open their input), and its recent runs.
 *
 * Read-only viewers get the same rail with every control disabled by one
 * fieldset; the things that only read — the email preview, the runs — stay live.
 */
export function AutomationSidebar({
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
    <aside className="min-h-0 overflow-auto border-t border-divider bg-background lg:border-l lg:border-t-0">
      <motion.div initial="hidden" animate="shown" variants={STAGGER} className="flex flex-col gap-4 p-4">
        <SettingsSection title="Workflow">
          <div className="space-y-3">
            <fieldset disabled={readOnly} className="min-w-0">
              <ExpandRow icon={Type} title="Name" htmlFor="workflow-name" value={name}>
                <Input
                  id="workflow-name"
                  value={name}
                  onChange={(event) => onName(event.target.value)}
                  required
                  placeholder="Order ready"
                />
                <p className="text-xs text-muted-foreground">Only your team sees this.</p>
              </ExpandRow>
            </fieldset>
            <InfoRows>
              <InfoRow icon={Users} title="Sends to">
                <span className="text-sm text-muted-foreground">{staffAudience ? 'Employees' : 'Customers'}</span>
              </InfoRow>
              {automation && (
                <>
                  <InfoRow icon={Send} title="Runs">
                    <span className="text-sm tabular-nums text-muted-foreground">{(automation.runCount ?? 0).toLocaleString()}</span>
                  </InfoRow>
                  {Boolean(automation.failedRunCount) && (
                    <InfoRow icon={XCircle} title="Failed runs">
                      <span className="text-sm font-semibold tabular-nums text-exception">{automation.failedRunCount}</span>
                    </InfoRow>
                  )}
                  <InfoRow icon={Clock} title="Last checked">
                    <span className="text-sm text-muted-foreground">
                      {automation.lastEvaluatedAt ? timeAgo(automation.lastEvaluatedAt, now) : 'Not yet'}
                    </span>
                  </InfoRow>
                </>
              )}
            </InfoRows>
          </div>
        </SettingsSection>

        {node ? (
          // Keyed by step, so each one opens with its empty settings ready and the rest folded.
          <StepPanel
            key={node.id}
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
          <SettingsSection title="Step">
            <p className="text-sm text-muted-foreground">Select a step on the canvas to see what it does and change it.</p>
          </SettingsSection>
        )}

        <SettingsSection
          title="Recent runs"
          actions={
            runs.length > 0 ? (
              <span className="text-xs tabular-nums text-muted-foreground">
                {runs.length}
                {failedRuns > 0 && <span className="font-semibold text-exception"> · {failedRuns} failed</span>}
              </span>
            ) : undefined
          }
        >
          {!automation ? (
            <p className="text-sm text-muted-foreground">Save the workflow and its runs appear here.</p>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet. Each time the trigger fires, a run appears here.</p>
          ) : (
            <ul className="-mx-2 flex flex-col gap-0.5">
              {runs.map((run) => {
                const tile = RUN_TILE[run.status];
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      onClick={() => onOpenRun(run.id)}
                      className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                    >
                      <span className={cn(run.status === 'running' && '[&_svg]:animate-spin')}>
                        <RowTile icon={tile.icon} tone={tile.tone} />
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
                      <ChevronRight
                        size={14}
                        className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </SettingsSection>
      </motion.div>
    </aside>
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
  const duplicable = isMovableNode(node);
  const selectedTemplate = node.type === 'send_email' ? templates.find((template) => template.id === node.config.templateId) : undefined;

  return (
    <>
      {/* One card for the step: who it is and what it does, then the how — every line the same row. */}
      <SettingsSection title="Step" description={describeStep(node, { templateName, locationName, staff: staffAudience })}>
        <fieldset disabled={readOnly} className="min-w-0 space-y-4">
          <ExpandRow icon={meta.icon} title={meta.label} htmlFor="step-name" value={node.name}>
            <Input
              id="step-name"
              value={node.name}
              onChange={(event) => onChange({ ...node, name: event.target.value })}
              placeholder={meta.label}
            />
            <p className="text-xs text-muted-foreground">How this step reads on the canvas.</p>
          </ExpandRow>
          <StepSettings
            node={node}
            templates={templates}
            locations={locations}
            segments={segments}
            staffAudience={staffAudience}
            locationName={locationName ?? null}
            onChange={onChange}
          />
        </fieldset>
        {/* Outside the fieldset: previewing is reading, so a read-only viewer keeps it. */}
        {node.type === 'send_email' && selectedTemplate && (
          <button
            type="button"
            onClick={onPreview}
            aria-label={`Preview ${selectedTemplate.name}`}
            className="group relative mt-4 block w-full overflow-hidden rounded-lg border border-rule/60 bg-white text-left focus-visible:outline-2 focus-visible:outline-ring"
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
        )}
      </SettingsSection>

      {!readOnly && (duplicable || removable) && (
        // Untitled and unruled: two rows that speak for themselves.
        <SettingsSection bodyClassName="py-3">
          <ActionRows>
            {duplicable && <ActionRow icon={Copy} label="Duplicate this step" onClick={onDuplicate} />}
            {removable && <ActionRow icon={Trash2} label="Remove this step" danger onClick={onRemove} />}
          </ActionRows>
        </SettingsSection>
      )}
    </>
  );
}

/** The step's settings as one-line rows — icon tile, title, its value — each opening its input underneath. */
function StepSettings({
  node,
  templates,
  locations,
  segments,
  staffAudience,
  locationName,
  onChange,
}: {
  node: EmailWorkflowNode;
  templates: EmailTemplate[];
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  staffAudience: boolean;
  locationName: string | null;
  onChange: (node: EmailWorkflowNode) => void;
}) {
  if (node.type === 'trigger') {
    const event = node.config.event;
    const days = Math.abs(node.config.offsetDays ?? 0);
    return (
      <>
        <ExpandRow icon={Zap} title="Starts when" value={labelOf(TRIGGER_OPTIONS, event)}>
          <Select
            value={event}
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
          <p className="text-xs leading-relaxed text-muted-foreground">{TRIGGER_HELP[event]}</p>
        </ExpandRow>
        {event === 'segment_entered' && (
          <ExpandRow icon={Users} title="Segment" value={segments.find((segment) => segment.id === node.config.segmentId)?.name ?? ''}>
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              {segments.length
                ? 'Save a filtered customer list as a segment to use it here.'
                : 'Filter the customer list, then save it as a segment — it appears here.'}
            </p>
          </ExpandRow>
        )}
        {event.startsWith('order_') && (
          // "Any location" is a real answer, not a missing one — it starts folded.
          <ExpandRow icon={MapPin} title="At" value={locationName ?? 'Any location'}>
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
          </ExpandRow>
        )}
        {(event === 'customer_birthday' || event === 'customer_inactive') && (
          <>
            <ExpandRow
              icon={CalendarDays}
              title={event === 'customer_birthday' ? 'Days before' : 'Days away'}
              htmlFor="trigger-days"
              value={event === 'customer_birthday' && days === 0 ? 'On the day' : `${days} ${days === 1 ? 'day' : 'days'}`}
            >
              <Input
                id="trigger-days"
                type="number"
                min={event === 'customer_birthday' ? 0 : 1}
                aria-label={event === 'customer_birthday' ? 'Days before the birthday' : 'Days without a visit'}
                value={days}
                onChange={(change) =>
                  onChange({
                    ...node,
                    config: {
                      ...node.config,
                      offsetDays:
                        event === 'customer_birthday' ? -Math.abs(Number(change.target.value)) : Math.max(1, Number(change.target.value)),
                    },
                  })
                }
              />
              <p className="text-xs text-muted-foreground">
                {event === 'customer_birthday' ? 'How long before the birthday it sends.' : 'How long without a visit before it sends.'}
              </p>
            </ExpandRow>
            <ExpandRow icon={Globe} title="Time zone" value={node.config.timezone ?? resolvedTimeZone()}>
              <TimezoneSelect
                value={node.config.timezone ?? resolvedTimeZone()}
                onChange={(timezone) => onChange({ ...node, config: { ...node.config, timezone } })}
              />
              <p className="text-xs text-muted-foreground">Whose midnight counts as the day.</p>
            </ExpandRow>
          </>
        )}
      </>
    );
  }

  if (node.type === 'send_email')
    return (
      <ExpandRow icon={FileText} title="Template" value={templates.find((template) => template.id === node.config.templateId)?.name ?? ''}>
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
      </ExpandRow>
    );

  if (node.type === 'delay')
    return (
      // Reads as the sentence it sets: "Wait [3] [days]".
      <ExpandRow icon={Clock} title="Wait for" value={formatDelay(node.config.amount, node.config.unit)}>
        <AmountUnitPicker
          aria-label="How long to wait"
          amount={node.config.amount}
          unit={node.config.unit}
          onValueChange={({ amount, unit }) => onChange({ ...node, config: { ...node.config, amount, unit } })}
        />
      </ExpandRow>
    );

  if (node.type === 'condition') {
    const fields = staffAudience ? STAFF_CONDITION_FIELDS : CONDITION_FIELDS;
    const summary = `${labelOf(fields, node.config.field)} ${labelOf(CONDITION_OPERATORS, node.config.operator)} ${String(node.config.value ?? '').trim() || '…'}`;
    return (
      <>
        <ExpandRow icon={GitCompareArrows} title="If" value={String(node.config.value ?? '').trim() ? summary : ''}>
          <Select
            value={node.config.field}
            onValueChange={(field) => onChange({ ...node, config: { ...node.config, field: field as typeof node.config.field } })}
            options={fields}
            ariaLabel="Condition field"
            className="w-full"
          />
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
        </ExpandRow>
        {/* Which way each answer goes — one full line each, so neither wraps mid-phrase in the narrow rail. */}
        <ul className="space-y-1.5 text-xs">
          <li className="flex items-center gap-2 rounded-md border border-momentum/30 bg-momentum/6 px-3 py-2 text-foreground">
            <span className="w-7 shrink-0 font-semibold text-momentum">Yes</span>
            <span className="min-w-0">goes down the left branch</span>
          </li>
          <li className="flex items-center gap-2 rounded-md border border-rule/60 bg-band/40 px-3 py-2 text-foreground">
            <span className="w-7 shrink-0 font-semibold">No</span>
            <span className="min-w-0">goes down the right branch</span>
          </li>
        </ul>
      </>
    );
  }

  return null;
}
