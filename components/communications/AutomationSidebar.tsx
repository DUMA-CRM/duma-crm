'use client';

import { useState } from 'react';

import { TriggerDialog, triggerIcon } from '@/components/automation/TriggerPicker';
import { RowMenu, RowWarning } from '@/components/shared/rows';
import {
  CalendarDays,
  Clock,
  Copy,
  Eye,
  FileText,
  GitCompareArrows,
  Globe,
  MapPin,
  Send,
  Trash2,
  Type,
  Users,
  Zap,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { ChangeRow, ValueAside, ValueMissing } from '@/components/settings/controls';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { AmountUnitPicker } from '@/components/ui/amount-unit-picker';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { proxiedImageForEmail } from '@/lib/api/client';
import type { EmailAutomation, EmailTemplate, EmailWorkflowNode } from '@/lib/modules/communications/client';
import { cn } from '@/lib/utils/cn';
import { relativeTime } from '@/lib/utils/relative-time';
import { formatDelay } from '@/lib/utils/duration';
import { previewEmailHtml } from '@/lib/utils/email-images';
import {
  CONDITION_FIELDS,
  OPERATOR_LABELS,
  conditionDefaults,
  conditionField,
  conditionSentence,
  operatorsFor,
  validOperator,
} from '@/lib/utils/workflow-conditions';
import { resolvedTimeZone } from '@/lib/utils/workspace-time';

import { TRIGGER_HELP, TRIGGER_OPTIONS } from './shared';
import { describeStep } from './stepSummary';
import { isMovableNode } from './workflowModel';
import { NODE_META } from './workflowNodes';
import { workflowFieldAvailable } from './workflowPolicy';

const labelOf = (options: { value: string; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

/**
 * The editor's sidebar: the workflow as a whole, then the selected step — each
 * a titled card of rows whose Change opens the control in place, one at a time.
 * Sticky beside a long flow, so a step's settings stay in view as you pick it.
 *
 * Read-only viewers get the same cards with every control disabled by one
 * fieldset; the email preview, which only reads, stays live.
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
  bookingAudience = false,
  triggerEvent,
  now,
  readOnly,
  templateName,
  onChange,
  onDuplicate,
  onRemove,
  onPreview,
  unpublished = false,
  stepIssues,
  chooseTrigger = false,
  onTriggerChosen,
}: {
  node?: EmailWorkflowNode;
  automation?: EmailAutomation;
  name: string;
  onName: (name: string) => void;
  templates: EmailTemplate[];
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  staffAudience: boolean;
  /** A booking's guest email: steps speak of "the guest". */
  bookingAudience?: boolean;
  triggerEvent: string;
  now: number;
  readOnly: boolean;
  templateName: (id: string) => string;
  onChange: (node: EmailWorkflowNode) => void;
  onDuplicate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onPreview: () => void;
  /** Saved changes not yet published — flagged beside the status. */
  unpublished?: boolean;
  /** What's wrong with the selected step — shown at the top of its card. */
  stepIssues?: string[];
  /** A new workflow whose trigger isn't chosen yet: its event row opens on the event list. */
  chooseTrigger?: boolean;
  onTriggerChosen?: () => void;
}) {
  const [nameOpen, setNameOpen] = useState(() => !name.trim());
  const failed = automation?.failedRunCount ?? 0;
  return (
    // Stacked (below lg) the sidebar comes first, so a new workflow starts on its name and trigger.
    <div className="-m-1 flex min-w-0 flex-col gap-5 p-1 max-lg:order-first lg:sticky lg:top-0 lg:max-h-[calc(100dvh-var(--header-height))] lg:overflow-y-auto">
      <RecordGroup
        card
        id="workflow-details"
        title="Workflow"
        actions={
          <div className="flex items-center gap-1.5">
            {unpublished && <Badge variant="warning">Unpublished changes</Badge>}
            <Badge variant={automation?.isEnabled ? 'success' : 'muted'}>
              {automation?.isEnabled
                ? `Live · v${automation.publishedVersion}`
                : automation?.publishedVersion
                  ? `Off · v${automation.publishedVersion}`
                  : automation
                    ? 'Draft'
                    : 'New'}
            </Badge>
          </div>
        }
      >
        <fieldset disabled={readOnly} className="min-w-0">
          <ChangeRow
            icon={Type}
            label="Name"
            value={name.trim() ? <span className="truncate">{name}</span> : <ValueMissing>Not named</ValueMissing>}
            tone={!name.trim() && !readOnly ? 'warning' : undefined}
            open={nameOpen}
            onToggle={() => setNameOpen((current) => !current)}
            verbs={['Change', 'Done']}
          >
            <Input
              id="workflow-name"
              aria-label="Workflow name"
              value={name}
              onChange={(event) => onName(event.target.value)}
              required
              placeholder="Order ready"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Only your team sees this.</p>
          </ChangeRow>
          <ChangeRow
            icon={Users}
            label="About"
            value={
              triggerEvent === 'stock_low' ? 'Stock items' : staffAudience ? 'Employees' : bookingAudience ? 'Booking guests' : 'Customers'
            }
          />
          {automation && (
            <ChangeRow
              icon={Send}
              label="Runs"
              tone={failed ? 'danger' : undefined}
              value={
                <>
                  <span className="tabular-nums">{(automation.runCount ?? 0).toLocaleString()}</span>
                  {failed > 0 && <span className="tabular-nums text-exception">· {failed} failed</span>}
                  <ValueAside>· checked {automation.lastEvaluatedAt ? relativeTime(automation.lastEvaluatedAt, now) : 'not yet'}</ValueAside>
                </>
              }
            />
          )}
        </fieldset>
      </RecordGroup>

      {node ? (
        // Keyed by step, so each one opens with its empty settings ready and the rest folded.
        <StepPanel
          key={node.id}
          issues={stepIssues}
          node={node}
          triggerEvent={triggerEvent}
          templates={templates}
          locations={locations}
          segments={segments}
          staffAudience={staffAudience}
          bookingAudience={bookingAudience}
          readOnly={readOnly}
          templateName={templateName}
          onChange={onChange}
          onDuplicate={() => onDuplicate(node.id)}
          onRemove={() => onRemove(node.id)}
          onPreview={onPreview}
          chooseTrigger={chooseTrigger}
          onTriggerChosen={onTriggerChosen}
        />
      ) : (
        <RecordGroup card id="workflow-step" title="Step">
          <p className="text-sm text-muted-foreground">Select a step and its settings open here.</p>
        </RecordGroup>
      )}
    </div>
  );
}

function StepPanel({
  issues,
  node,
  triggerEvent,
  templates,
  locations,
  segments,
  staffAudience,
  bookingAudience,
  readOnly,
  templateName,
  onChange,
  onDuplicate,
  onRemove,
  onPreview,
  chooseTrigger,
  onTriggerChosen,
}: {
  issues?: string[];
  chooseTrigger: boolean;
  onTriggerChosen?: () => void;
  node: EmailWorkflowNode;
  triggerEvent: string;
  templates: EmailTemplate[];
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  staffAudience: boolean;
  bookingAudience: boolean;
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
  // One setting open at a time; the step opens on what still needs filling in.
  const [open, setOpen] = useState<string | null>(() => firstOpenRow(node, chooseTrigger));
  const toggle = (id: string) => setOpen((current) => (current === id ? null : id));
  const nameRow = node.type !== 'end' && (
    <Row id="name" open={open} onToggle={toggle} icon={meta.icon} title="Name" value={node.name}>
      <Input
        id="step-name"
        aria-label="Step name"
        value={node.name}
        autoFocus
        onChange={(event) => onChange({ ...node, name: event.target.value })}
        placeholder={meta.label}
      />
      <p className="text-xs text-muted-foreground">How this step reads in the flow.</p>
    </Row>
  );

  return (
    <RecordGroup
      card
      id="workflow-step"
      title={node.type === 'trigger' ? 'Starts when' : meta.label}
      actions={
        !readOnly && (duplicable || removable) ? (
          <RowMenu
            label={`${node.name || meta.label} actions`}
            items={[
              ...(duplicable ? [{ icon: Copy, label: 'Duplicate this step', onClick: onDuplicate }] : []),
              ...(removable ? [{ icon: Trash2, label: 'Remove this step', danger: true, onClick: onRemove }] : []),
            ]}
          />
        ) : undefined
      }
      // The step in one sentence — what the rows add up to (nothing to say until a trigger has its event).
      footnote={
        (node.type === 'trigger' && chooseTrigger) || node.type === 'end'
          ? undefined
          : describeStep(node, { templateName, locationName, staff: staffAudience, booking: bookingAudience })
      }
    >
      {/* Checked on every change: what still stops this step, before its settings. */}
      {issues?.length ? (
        <RowWarning className="mb-3">
          {issues.length === 1 ? (
            issues[0]
          ) : (
            <ul className="space-y-0.5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
        </RowWarning>
      ) : null}
      {node.type === 'end' && <p className="text-sm text-muted-foreground">Nothing to set — this branch finishes here.</p>}
      <fieldset disabled={readOnly} className="min-w-0">
        {node.type !== 'trigger' && nameRow}
        <StepSettings
          triggerChosen={!chooseTrigger}
          open={open}
          onToggle={toggle}
          onTriggerChosen={() => {
            onTriggerChosen?.();
            setOpen(null);
          }}
          node={node}
          triggerEvent={triggerEvent}
          templates={templates}
          locations={locations}
          segments={segments}
          locationName={locationName ?? null}
          onChange={onChange}
        />
        {/* A trigger's name rarely matters — it comes after what starts the workflow. */}
        {node.type === 'trigger' && nameRow}
      </fieldset>
      {/* Outside the fieldset: previewing is reading, so a read-only viewer keeps it. */}
      {node.type === 'send_email' && selectedTemplate && (
        <button
          type="button"
          onClick={onPreview}
          aria-label={`Preview ${selectedTemplate.name}`}
          className="group relative mt-3 block w-full overflow-hidden rounded-md border border-border bg-white text-left focus-visible:outline-2 focus-visible:outline-ring"
        >
          <span className="block aspect-4/3 overflow-hidden">
            <iframe
              title=""
              sandbox=""
              tabIndex={-1}
              srcDoc={previewEmailHtml(selectedTemplate.htmlBody, proxiedImageForEmail)}
              className="pointer-events-none h-150 w-[200%] origin-top-left scale-50 border-0 bg-white"
            />
          </span>
          <span className="flex items-center gap-2 border-t border-border bg-card px-3 py-2.5">
            <span className="min-w-0 flex-1 truncate text-xs font-semibold text-foreground">{selectedTemplate.subject}</span>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
              <Eye size={13} aria-hidden="true" /> Preview
            </span>
          </span>
        </button>
      )}
    </RecordGroup>
  );
}

/** The step's settings as one-line rows — icon tile, title, its value — each opening its input underneath. */
function StepSettings({
  triggerChosen,
  open,
  onToggle,
  onTriggerChosen,
  node,
  triggerEvent,
  templates,
  locations,
  segments,
  locationName,
  onChange,
}: {
  node: EmailWorkflowNode;
  triggerEvent: string;
  templates: EmailTemplate[];
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
  locationName: string | null;
  onChange: (node: EmailWorkflowNode) => void;
  open: string | null;
  onToggle: (id: string) => void;
  onTriggerChosen: () => void;
  /** False on a new workflow until an event is picked. */
  triggerChosen: boolean;
}) {
  const formatMoney = useFormatMoney();
  if (node.type === 'trigger') {
    const event = node.config.event;
    const days = Math.abs(node.config.offsetDays ?? 0);
    return (
      <>
        {/* The event as a row like the rest; Change opens the event dialog. */}
        <ChangeRow
          icon={triggerChosen ? triggerIcon(event) : Zap}
          label="Event"
          value={triggerChosen ? labelOf(TRIGGER_OPTIONS, event) : <ValueMissing>Choose an event</ValueMissing>}
          tone={triggerChosen ? undefined : 'warning'}
          open={open === 'event'}
          onToggle={() => onToggle('event')}
          verbs={['Change', 'Done']}
        >
          <p className="text-xs leading-relaxed text-muted-foreground">
            {triggerChosen ? TRIGGER_HELP[event] : 'Whatever should start this workflow — an order, a birthday, a booking.'}
          </p>
        </ChangeRow>
        {open === 'event' && (
          <TriggerDialog
            current={triggerChosen ? event : undefined}
            onClose={() => onToggle('event')}
            onChoose={(value) => {
              onChange({
                ...node,
                config: {
                  ...node.config,
                  event: value as typeof node.config.event,
                  offsetDays: value === 'customer_inactive' ? 30 : 0,
                  offsetHours: value === 'reservation_reminder' ? (node.config.offsetHours ?? 24) : undefined,
                  locationId:
                    value.startsWith('order_') || value.startsWith('reservation_') || value === 'stock_low' ? node.config.locationId : null,
                  // Dropped when the trigger stops being segment-driven, so a
                  // leftover id cannot silently scope a different trigger.
                  segmentId: value === 'segment_entered' ? node.config.segmentId : null,
                },
              });
              onTriggerChosen();
            }}
          />
        )}
        {event === 'segment_entered' && (
          <Row
            id="segment"
            open={open}
            onToggle={onToggle}
            icon={Users}
            title="Segment"
            value={segments.find((segment) => segment.id === node.config.segmentId)?.name ?? ''}
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
            <p className="text-xs leading-relaxed text-muted-foreground">
              {segments.length
                ? 'Save a filtered customer list as a segment to use it here.'
                : 'Filter the customer list, then save it as a segment — it appears here.'}
            </p>
          </Row>
        )}
        {event === 'reservation_reminder' && (
          <Row
            id="hours"
            open={open}
            onToggle={onToggle}
            icon={CalendarDays}
            title="Hours before"
            value={`${node.config.offsetHours ?? 24} h before`}
          >
            <Input
              id="trigger-hours"
              type="number"
              min={1}
              max={168}
              aria-label="Hours before the booking"
              value={node.config.offsetHours ?? 24}
              onChange={(change) =>
                onChange({ ...node, config: { ...node.config, offsetHours: Math.min(168, Math.max(1, Number(change.target.value) || 1)) } })
              }
            />
            <p className="text-xs text-muted-foreground">
              How long before the booking the reminder goes. Bookings made later than that get none.
            </p>
          </Row>
        )}
        {(event.startsWith('order_') || event.startsWith('reservation_') || event === 'stock_low') && (
          // "Any location" is a real answer, not a missing one — it starts folded.
          <Row id="at" open={open} onToggle={onToggle} icon={MapPin} title="At" value={locationName ?? 'Any location'}>
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
          </Row>
        )}
        {(event === 'customer_birthday' || event === 'customer_inactive') && (
          <>
            <Row
              id="days"
              open={open}
              onToggle={onToggle}
              icon={CalendarDays}
              title={event === 'customer_birthday' ? 'Days before' : 'Days away'}
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
            </Row>
            <Row id="tz" open={open} onToggle={onToggle} icon={Globe} title="Time zone" value={node.config.timezone ?? resolvedTimeZone()}>
              <TimezoneSelect
                value={node.config.timezone ?? resolvedTimeZone()}
                onChange={(timezone) => onChange({ ...node, config: { ...node.config, timezone } })}
              />
              <p className="text-xs text-muted-foreground">Whose midnight counts as the day.</p>
            </Row>
          </>
        )}
      </>
    );
  }

  if (node.type === 'send_email')
    return (
      <Row
        id="template"
        open={open}
        onToggle={onToggle}
        icon={FileText}
        title="Template"
        value={templates.find((template) => template.id === node.config.templateId)?.name ?? ''}
      >
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
      </Row>
    );

  if (node.type === 'delay')
    return (
      // Reads as the sentence it sets: "Wait [3] [days]".
      <Row
        id="wait"
        open={open}
        onToggle={onToggle}
        icon={Clock}
        title="Wait for"
        value={formatDelay(node.config.amount, node.config.unit)}
      >
        <AmountUnitPicker
          aria-label="How long to wait"
          amount={node.config.amount}
          unit={node.config.unit}
          onValueChange={({ amount, unit }) => onChange({ ...node, config: { ...node.config, amount, unit } })}
        />
      </Row>
    );

  if (node.type === 'send_telegram')
    return (
      <Row id="message" open={open} onToggle={onToggle} icon={FileText} title="Telegram message" value={node.config.message}>
        <textarea
          aria-label="Telegram message"
          value={node.config.message}
          rows={5}
          maxLength={3500}
          className="w-full rounded-md border border-input bg-control p-3 text-sm outline-none focus:border-primary"
          onChange={(e) => onChange({ ...node, config: { ...node.config, message: e.target.value } })}
        />
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={node.config.includeOrderDetails}
            onChange={(e) => onChange({ ...node, config: { ...node.config, includeOrderDetails: e.target.checked } })}
            className="mt-1 size-4 accent-primary"
          />
          Include order number, items, total, status and fulfilment when available
        </label>
        <p className="text-xs text-muted-foreground">
          Plain text, sent to this workspace’s Telegram destination. Configure and test it in{' '}
          <a className="text-primary underline" href="/settings/connectors?connector=telegram" target="_blank" rel="noreferrer">
            Connections
          </a>
          . Paused connections skip this step.
        </p>
      </Row>
    );

  if (node.type === 'create_task')
    return (
      <>
        <Row id="subject" open={open} onToggle={onToggle} icon={Type} title="Task subject" value={node.config.subject}>
          <Input
            id="task-subject"
            aria-label="Task subject"
            value={node.config.subject}
            maxLength={200}
            autoFocus
            onChange={(event) => onChange({ ...node, config: { ...node.config, subject: event.target.value } })}
          />
          <p className="text-xs text-muted-foreground">The request’s title in Staff → Helpdesk.</p>
        </Row>
        <Row id="body" open={open} onToggle={onToggle} icon={FileText} title="What needs doing" value={node.config.body}>
          <textarea
            id="task-body"
            aria-label="What needs doing"
            value={node.config.body}
            maxLength={10000}
            rows={5}
            autoFocus
            className="w-full rounded-md border border-input bg-control p-3 text-sm outline-none focus:border-primary"
            onChange={(event) => onChange({ ...node, config: { ...node.config, body: event.target.value } })}
          />
          <p className="text-xs text-muted-foreground">The workflow’s publisher must keep helpdesk management permission.</p>
        </Row>
      </>
    );

  if (node.type === 'condition') {
    type Field = typeof node.config.field;
    type Operator = typeof node.config.operator;
    // Only the facts this trigger provides; a field from a previous trigger stays visible, flagged, so nothing silently changes.
    const available = CONDITION_FIELDS.filter((entry) => workflowFieldAvailable(triggerEvent, entry.field));
    const current = conditionField(node.config.field);
    const kind = current?.kind ?? 'text';
    const unavailable = !available.some((entry) => entry.field === node.config.field);
    const operators = operatorsFor(kind);
    const set = (patch: Partial<typeof node.config>) => onChange({ ...node, config: { ...node.config, ...patch } });
    const locationName = (id: string) => locations.find((location) => location.id === id)?.name;
    const raw = node.config.value;
    const blank = raw === undefined || raw === null || String(raw).trim() === '';
    const sentence = conditionSentence(
      { field: node.config.field, operator: node.config.operator, value: node.config.value },
      { money: (amount) => formatMoney(amount, 2), locationName },
    );

    return (
      <>
        {/* One row for the whole check: the sentence when folded; what, rule and value together when open. */}
        <Row
          id="if"
          open={open}
          onToggle={onToggle}
          icon={GitCompareArrows}
          title="If"
          value={blank && kind !== 'yesno' ? '' : sentence.charAt(0).toUpperCase() + sentence.slice(1)}
        >
          <Select
            value={node.config.field}
            onValueChange={(field) =>
              set({ field: field as Field, ...conditionDefaults(field), operator: conditionDefaults(field).operator as Operator })
            }
            options={[
              ...(unavailable
                ? [{ value: node.config.field, label: `${current?.label ?? node.config.field} (not available)`, dividerAfter: true }]
                : []),
              ...available.map((entry, index) => ({
                value: entry.field,
                label: `${entry.group} · ${entry.label}`,
                dividerAfter: available[index + 1] !== undefined && available[index + 1]!.group !== entry.group,
              })),
            ]}
            ariaLabel="What to check"
            className="w-full"
          />
          <div className={cn('grid gap-2', operators.length > 1 && 'grid-cols-[minmax(0,9rem)_minmax(0,1fr)]')}>
            {operators.length > 1 && (
              <Select
                value={validOperator(node.config.field, node.config.operator)}
                onValueChange={(operator) => set({ operator: operator as Operator })}
                options={operators.map((operator) => ({ value: operator, label: OPERATOR_LABELS[operator] }))}
                ariaLabel="Rule"
                className="w-full"
              />
            )}
            {kind === 'yesno' ? (
              <Select
                value={raw === true || raw === 'true' ? 'yes' : 'no'}
                onValueChange={(answer) => set({ value: answer === 'yes' })}
                options={[
                  { value: 'yes', label: 'Yes' },
                  { value: 'no', label: 'No' },
                ]}
                ariaLabel="Answer"
                className="w-full"
              />
            ) : kind === 'choice' ? (
              <Select
                value={String(raw ?? '')}
                onValueChange={(value) => set({ value })}
                options={(current?.options ?? []).map((option) => ({ value: option.value, label: option.label }))}
                ariaLabel="Value"
                className="w-full"
              />
            ) : kind === 'location' ? (
              <Select
                value={String(raw ?? '')}
                onValueChange={(value) => set({ value })}
                options={[
                  { value: '', label: 'Choose a location…' },
                  ...locations.map((location) => ({ value: location.id, label: location.name })),
                ]}
                ariaLabel="Location"
                className="w-full"
              />
            ) : kind === 'number' || kind === 'money' ? (
              <Input
                type="number"
                inputMode="decimal"
                step={kind === 'money' ? '0.01' : '1'}
                aria-label="Value"
                value={blank ? '' : String(raw)}
                onChange={(event) => set({ value: event.target.value === '' ? '' : Number(event.target.value) })}
              />
            ) : (
              <Input aria-label="Value" value={String(raw ?? '')} onChange={(event) => set({ value: event.target.value })} />
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {kind === 'money' ? 'Amounts are in your workspace currency. ' : ''}Changing what’s checked resets the rule and value to ones
            that can match.
          </p>
        </Row>
        {unavailable && (
          <RowWarning className="mt-2">
            This trigger doesn’t provide “{current?.label ?? node.config.field}”, so the check can’t pass. Choose another under If.
          </RowWarning>
        )}
      </>
    );
  }

  return null;
}

/** A setting as a row: its value in words (or "Not set", muted), Change opening its control underneath. */
function Row({
  id,
  open,
  onToggle,
  icon,
  title,
  value,
  children,
}: {
  id: string;
  open: string | null;
  onToggle: (id: string) => void;
  icon: IconComponent;
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <ChangeRow
      icon={icon}
      label={title}
      value={value.trim() ? <span className="truncate">{value}</span> : <ValueMissing>Not set</ValueMissing>}
      open={open === id}
      onToggle={() => onToggle(id)}
      verbs={['Change', 'Done']}
    >
      <div className="space-y-1.5">{children}</div>
    </ChangeRow>
  );
}

/** Which setting a step opens on: the trigger's event list for a new workflow, else whatever is still empty. */
function firstOpenRow(node: EmailWorkflowNode, chooseTrigger: boolean): string | null {
  if (node.type === 'trigger') return chooseTrigger ? 'event' : null;
  if (node.type === 'send_telegram') return node.config.message.trim() ? null : 'message';
  if (node.type === 'send_email') return node.config.templateId ? null : 'template';
  if (node.type === 'create_task') return !node.config.subject.trim() ? 'subject' : !node.config.body.trim() ? 'body' : null;
  if (node.type === 'condition') return String(node.config.value ?? '').trim() ? null : 'if';
  return null;
}
