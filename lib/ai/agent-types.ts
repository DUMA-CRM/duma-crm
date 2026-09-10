export type AgentChatRole = 'user' | 'assistant';

export interface AgentShortcut {
  label: string;
  href: string;
  description?: string;
  /** When present, opening the shortcut first switches the workspace location. */
  locationId?: string;
  kind: 'page' | 'filtered' | 'support';
}

/** A metric strip rendered above the answer — built from tool data, never from model prose. */
export interface AgentMetric {
  label: string;
  value: string;
  hint?: string;
  trend?: 'up' | 'down' | 'flat';
  tone?: 'default' | 'positive' | 'negative' | 'warning';
}

export interface AgentMetricCard {
  kind?: 'metrics';
  title: string;
  caption?: string;
  metrics: AgentMetric[];
}

export interface AgentListRow {
  label: string;
  value?: string;
  meta?: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
}

/** Compact records rendered from tool output, not generated Markdown. */
export type AgentEmptyTone = 'clean' | 'search' | 'none';

export interface AgentListCard {
  kind: 'list';
  title: string;
  caption?: string;
  rows: AgentListRow[];
  emptyLabel?: string;
  /**
   * What an empty result *means*, so the card can mark it correctly.
   *
   * `clean` — the absence is the good news ("nothing failed").
   * `search` — a query matched nothing.
   * `none` — the set is simply empty. The default, because most absences are
   * neither reassuring nor a failed search, and a green tick over "no orders in
   * this range" congratulates the reader on nothing at all.
   */
  emptyTone?: AgentEmptyTone;
}

export type AgentCard = AgentMetricCard | AgentListCard;

// ── Editable action cards ────────────────────────────────────────────────────
// Every write the agent proposes arrives as a field spec rather than a fixed
// card, so the operator can correct the supplier, a price, a quantity or a date
// in place instead of re-prompting. The spec is signed server-side; on approval
// the server replays the operator's edits against the sealed spec and rejects
// anything the draft never offered.

export type AgentFieldType = 'select' | 'text' | 'textarea' | 'number' | 'money' | 'date' | 'time';

export interface AgentFieldOption {
  value: string;
  label: string;
  hint?: string;
  /** Seed values for a line added from this option, keyed by line field. */
  prefill?: Record<string, string | number>;
}

export interface AgentField {
  key: string;
  label: string;
  type: AgentFieldType;
  value: string | number | null;
  options?: AgentFieldOption[];
  /** Suffix shown after the value — "L", "kg", "pts". */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  hint?: string;
  optional?: boolean;
  readOnly?: boolean;
  /** Only render this field while another field holds a given value. */
  showWhen?: { field: string; equals: string };
}

export interface AgentActionLine {
  id: string;
  title: string;
  subtitle?: string;
  fields: AgentField[];
}

export interface AgentLineTotal {
  label: string;
  /** One key sums that field; two keys sum the product of both across lines. */
  multiply: string[];
  format: 'currency' | 'number';
}

export interface AgentLineGroup {
  label: string;
  addLabel: string;
  emptyLabel: string;
  /** Everything the operator may add — the server accepts no line outside this list. */
  options: AgentFieldOption[];
  /** Field spec applied to a newly added line. */
  template: AgentField[];
  lines: AgentActionLine[];
  total?: AgentLineTotal;
  minLines: number;
  maxLines: number;
}

export interface AgentPendingAction {
  kind: string;
  title: string;
  summary: string;
  confirmLabel: string;
  /** What confirming actually does, in the operator's language. */
  note?: string;
  tone?: 'default' | 'critical';
  fields: AgentField[];
  lineGroup?: AgentLineGroup;
  /** Server-signed, short-lived approval proof. Edits are re-validated against it. */
  approvalToken?: string;
}

/** What the client sends back on approval: the signed token plus the operator's edits. */
export interface AgentActionSubmission {
  approvalToken: string;
  fields: Record<string, string | number | null>;
  lines?: Array<{ id: string; values: Record<string, string | number | null> }>;
}

/**
 * Why a request was declined by a rule rather than answered.
 *
 * `scope` — outside what this assistant does at all (code, poems, the weather).
 *   An ordinary boundary, and the reader has done nothing wrong: they get told
 *   plainly what it *does* do.
 * `security` — the operator is not permitted to do this, or an approval could not
 *   be verified. A different thing entirely, and the only one the mascot is cross
 *   about.
 */
export type AgentRefusal = 'scope' | 'security';

export interface AgentChatMessage {
  role: AgentChatRole;
  content: string;
  evidence?: string[];
  scope?: string;
  /** Set when a rule declined the request instead of it being answered. */
  refused?: AgentRefusal;
  shortcuts?: AgentShortcut[];
  cards?: AgentCard[];
  followUps?: string[];
  /** Names the backup model when the primary was out of capacity for this answer. */
  fallbackModel?: string;
  /** Reveal a newly-arrived assistant message progressively in the client. */
  live?: boolean;
  /**
   * Render the model picker under this message.
   *
   * Client-side only, and set only by the deterministic model-intent rule in
   * `lib/ai/agent-model-intent.ts` — no model ever asks for it. The picker reads
   * live state, so one left in the transcript still shows the current model.
   */
  modelPicker?: boolean;
  /**
   * The steps taken to reach this answer, kept with it once it arrives.
   *
   * Client-side only — the panel records what it saw stream past. A sweep that
   * paged through hundreds of records is provenance an auditor may need later,
   * and losing it the moment the answer lands makes the answer unverifiable.
   */
  steps?: string[];
}

export interface AgentChatResponse {
  message: string;
  evidence?: string[];
  scope?: string;
  /**
   * The request was declined by a rule rather than answered, and by which kind.
   *
   * Stated explicitly rather than left for the client to infer from
   * `model: 'scope-guard'` or by matching words in an error message. The client
   * presents the two kinds differently, so it needs a fact it can rely on — a model
   * name is an implementation detail, and a message is copy someone will reword.
   */
  refused?: AgentRefusal;
  shortcuts?: AgentShortcut[];
  cards?: AgentCard[];
  followUps?: string[];
  pendingAction?: AgentPendingAction;
  model: string;
  /** Set when the primary model was out of capacity and a backup answered instead. */
  fallbackModel?: string;
}

/** NDJSON frames streamed from POST /api/agent while the agent works. */
export type AgentStreamEvent =
  | { type: 'step'; label: string }
  /** A fragment of the answer as the model writes it. Append in arrival order. */
  | { type: 'delta'; text: string }
  /**
   * Discard whatever has been streamed so far.
   *
   * Some models write a sentence of preamble before deciding to call a tool.
   * That text is not the answer, so once a round turns out to be a tool round
   * the client is told to throw it away rather than leave a false start on
   * screen that the final result would later contradict.
   */
  | { type: 'delta-reset' }
  | { type: 'result'; response: AgentChatResponse }
  | { type: 'error'; message: string };
