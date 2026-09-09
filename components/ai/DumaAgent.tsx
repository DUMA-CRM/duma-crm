'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';

import { ActionCard } from '@/components/ai/ActionCard';
import { AgentMetrics } from '@/components/ai/AgentMetrics';
import { LiveMarkdown } from '@/components/ai/LiveMarkdown';
import { Mascot } from '@/components/ai/Mascot';
import { type AgentMood, type AgentPhase, useAgentMood } from '@/components/ai/useAgentMood';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  type IconComponent,
  Loader2,
  Mail,
  MapPin,
  Maximize,
  Minus,
  Package,
  Plus,
  QrCode,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  X,
  Zap,
} from '@/components/icons';
import { Button } from '@/components/ui/button';

import type {
  AgentActionSubmission,
  AgentChatMessage,
  AgentChatResponse,
  AgentPendingAction,
  AgentShortcut,
  AgentStreamEvent,
} from '@/lib/ai/agent-types';
import type { AgentRefusal } from '@/lib/ai/agent-types';
import { type Capability, hasAllCapabilities } from '@/lib/auth/capabilities';
import { STATE_BY_ID } from '@/lib/mascot/engine/states';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

interface StarterPrompt {
  icon: IconComponent;
  label: string;
  prompt: string;
}

interface PageWelcome {
  title: string;
  description: string;
  prompts: StarterPrompt[];
}

const DEFAULT_WELCOME: PageWelcome = {
  title: 'What should we work on?',
  description: 'Ask about live operations, compare performance, or describe a task for DUMA to prepare.',
  prompts: [
    { icon: BookOpen, label: 'Learn this workspace', prompt: 'Explain what I can do on this page and show the most useful action.' },
    { icon: Package, label: 'Check stock risk', prompt: 'What runs out first at this location, and what should I reorder?' },
    { icon: Users, label: 'Check team cover', prompt: 'Who is working this week, and is anything uncovered?' },
    { icon: ShoppingCart, label: 'Prepare a stock order', prompt: 'Help me create a purchase order for the stock we need most.' },
  ],
};

const PAGE_WELCOMES: Record<string, PageWelcome> = {
  dashboard: {
    title: 'What needs attention today?',
    description: 'Use the live workspace to find exceptions, understand pace, and decide the next useful action.',
    prompts: [
      {
        icon: ClipboardCheck,
        label: 'Set today’s priorities',
        prompt: 'Review today’s operations and tell me the three things that need attention first.',
      },
      { icon: BarChart3, label: 'Check trading pace', prompt: 'How is this location performing today compared with its recent pattern?' },
      { icon: Package, label: 'Find stock risks', prompt: 'Which stock items are most at risk at this location?' },
      { icon: Users, label: 'Check who is working', prompt: 'Who is scheduled today, and is anyone currently clocked in off rota?' },
    ],
  },
  orders: {
    title: 'What do you need from Orders?',
    description: 'Investigate a sale, review fulfilment, or narrow the order history without rebuilding the filters by hand.',
    prompts: [
      { icon: ShoppingCart, label: 'Review active orders', prompt: 'Show me the orders that are still pending, preparing, or ready.' },
      { icon: Search, label: 'Investigate an order', prompt: 'Help me find and explain a specific order.' },
      { icon: Receipt, label: 'Check cancellations', prompt: 'Summarise recent cancelled orders and any patterns in their reasons.' },
      { icon: QrCode, label: 'Review QR orders', prompt: 'Show recent QR code orders separately from POS and Mobile.' },
      {
        icon: BarChart3,
        label: 'Compare order performance',
        prompt: 'Compare order volume and average value this week with the same days last week.',
      },
    ],
  },
  inventory: {
    title: 'What should we do with stock?',
    description: 'Check cover, prepare purchasing work, or walk through a physical stock workflow from this workspace.',
    prompts: [
      { icon: Package, label: 'Find low-stock risks', prompt: 'What is low or critical at this location, and what runs out first?' },
      { icon: ShoppingCart, label: 'Prepare a purchase order', prompt: 'Help me order the stock this location needs most.' },
      {
        icon: ClipboardCheck,
        label: 'Review open stock work',
        prompt: 'Show me pending transfers, restock requests, and stocktakes in progress.',
      },
      { icon: BookOpen, label: 'Guide a stocktake', prompt: 'Guide me through starting and completing a stocktake.' },
    ],
  },
  reports: {
    title: 'What do you want to understand?',
    description: 'Turn the current reporting question into a clear comparison, ranking, or operational recommendation.',
    prompts: [
      {
        icon: BarChart3,
        label: 'Compare this week',
        prompt: 'Compare sales this week with the same days last week and explain the main change.',
      },
      { icon: ShoppingCart, label: 'Rank menu performance', prompt: 'What sold most and least this week, and what should I review?' },
      { icon: Receipt, label: 'Review refunds', prompt: 'Summarise refunds this week and compare them with last week.' },
      { icon: Users, label: 'Check labour performance', prompt: 'Show staff hours for this week and highlight anything unusual.' },
    ],
  },
  customers: {
    title: 'How can I help with customers?',
    description: 'Find a guest, understand loyalty activity, review segments, or work through a sensitive customer task.',
    prompts: [
      { icon: Search, label: 'Find a customer', prompt: 'Help me find a customer by their name, phone number, or email.' },
      { icon: Users, label: 'Review customer segments', prompt: 'Show me the saved customer segments and explain what each one targets.' },
      {
        icon: ClipboardCheck,
        label: 'Check duplicate workflow',
        prompt: 'Guide me through reviewing and safely merging duplicate customers.',
      },
      { icon: BarChart3, label: 'Review retention', prompt: 'How many customers were new versus returning this month?' },
    ],
  },
  communications: {
    title: 'What should we check in Communications?',
    description: 'Review connection health, active automations, templates, and delivery problems before sending anything.',
    prompts: [
      {
        icon: Mail,
        label: 'Check email health',
        prompt: 'Check the email connection, active templates, automations, and recent failures.',
      },
      {
        icon: ClipboardCheck,
        label: 'Review failed deliveries',
        prompt: 'Summarise recent failed email deliveries and what needs fixing.',
      },
      {
        icon: BookOpen,
        label: 'Set up an automation',
        prompt: 'Guide me through creating and safely enabling a customer email automation.',
      },
      { icon: Users, label: 'Prepare an audience', prompt: 'Show me the customer segments available for a targeted email.' },
    ],
  },
  staff: {
    title: 'What does the team need?',
    description: 'Check cover, leave, payroll, or people operations using the permissions available to you.',
    prompts: [
      { icon: CalendarDays, label: 'Check rota cover', prompt: 'Review this week’s rota and highlight gaps or unusual shifts.' },
      { icon: ClipboardCheck, label: 'Review leave requests', prompt: 'Show me the pending leave requests that need a decision.' },
      { icon: CreditCard, label: 'Preview payroll', prompt: 'Preview this week’s payroll totals and flag incomplete or unusual entries.' },
      { icon: Users, label: 'Review helpdesk work', prompt: 'Show open staff helpdesk requests, prioritised by urgency.' },
    ],
  },
  scheduling: {
    title: 'What do you need from the rota?',
    description: 'Check your working pattern or get help resolving a shift, attendance, or leave question.',
    prompts: [
      { icon: CalendarDays, label: 'Understand my shifts', prompt: 'Summarise my rota and show me where to check each shift’s details.' },
      { icon: BookOpen, label: 'Request leave', prompt: 'Explain how to request leave and open the right place in My HR.' },
      { icon: ClipboardCheck, label: 'Fix attendance', prompt: 'Show me how to request an attendance correction.' },
      { icon: Users, label: 'Report a rota problem', prompt: 'What should I do if a shift time or location on my rota looks wrong?' },
    ],
  },
  'my-hr': {
    title: 'What can I help you do in My HR?',
    description: 'Get guidance for your personal details, leave, attendance, documents, or a private support request.',
    prompts: [
      { icon: CalendarDays, label: 'Request leave', prompt: 'Guide me through submitting a leave request.' },
      { icon: ClipboardCheck, label: 'Correct attendance', prompt: 'Guide me through reporting a missing or incorrect clock event.' },
      { icon: CreditCard, label: 'Update payroll details', prompt: 'Show me how to review or update my payroll and bank details safely.' },
      { icon: Mail, label: 'Raise a private request', prompt: 'Guide me through raising a private HR or payroll request.' },
    ],
  },
  menu: {
    title: 'What should we change in the menu?',
    description: 'Review availability and pricing, or get guided help with recipes and modifiers.',
    prompts: [
      { icon: Search, label: 'Check an item', prompt: 'Find a menu item and show its price, category, and availability.' },
      { icon: ShoppingCart, label: 'Update an item', prompt: 'Help me update a menu item’s price or availability.' },
      { icon: BookOpen, label: 'Build a recipe', prompt: 'Guide me through adding or updating a recipe for a menu item.' },
      { icon: Package, label: 'Review ingredient risk', prompt: 'Which low-stock ingredients could affect the menu at this location?' },
    ],
  },
  pos: {
    title: 'How can I help at the till?',
    description: 'Get quick guidance for service, customer identification, payment, or an interrupted transaction.',
    prompts: [
      { icon: BookOpen, label: 'Take an order', prompt: 'Guide me through taking and completing an order in POS.' },
      { icon: Users, label: 'Add a customer', prompt: 'Show me how to identify a customer before payment.' },
      { icon: CreditCard, label: 'Resolve a payment issue', prompt: 'Help me troubleshoot a payment that did not complete.' },
      { icon: ShoppingCart, label: 'Check menu availability', prompt: 'Show menu items that are currently unavailable.' },
    ],
  },
  kds: {
    title: 'What does the kitchen need?',
    description: 'Review the live queue or get guidance for moving tickets cleanly through preparation and hand-off.',
    prompts: [
      { icon: ShoppingCart, label: 'Review the active queue', prompt: 'Show orders that are pending, preparing, or ready.' },
      { icon: BookOpen, label: 'Run the KDS workflow', prompt: 'Guide me through moving an order from pending to collected.' },
      {
        icon: ClipboardCheck,
        label: 'Investigate a delayed order',
        prompt: 'Help me investigate an order that has been waiting too long.',
      },
      { icon: Settings, label: 'Check device setup', prompt: 'Show me how to configure KDS sound and device settings.' },
    ],
  },
  'cash-up': {
    title: 'What should we reconcile?',
    description: 'Check the trading-day state, understand a difference, or work through closing the location safely.',
    prompts: [
      { icon: Receipt, label: 'Check cash-up status', prompt: 'Show the latest cash-up record and any cash or card variance.' },
      { icon: BookOpen, label: 'Close the trading day', prompt: 'Guide me through closing and reconciling the trading day.' },
      { icon: Search, label: 'Explain a variance', prompt: 'Help me investigate the latest cash or card variance.' },
      { icon: ShoppingCart, label: 'Check unfinished orders', prompt: 'Show any active orders that should be resolved before cash-up.' },
    ],
  },
  compliance: {
    title: 'What needs attention in Compliance?',
    description: 'Review privacy deadlines and statuses, or get careful guidance for handling customer data requests.',
    prompts: [
      {
        icon: ShieldCheck,
        label: 'Review open requests',
        prompt: 'Show privacy requests that are still open and highlight overdue items.',
      },
      { icon: BookOpen, label: 'Handle a privacy request', prompt: 'Guide me through safely processing a customer privacy request.' },
      { icon: Users, label: 'Find the customer', prompt: 'Help me find the customer connected to a privacy request.' },
      {
        icon: ClipboardCheck,
        label: 'Check the audit trail',
        prompt: 'Show recent audit activity related to customer or privacy changes.',
      },
    ],
  },
  'audit-log': {
    title: 'What change are you investigating?',
    description: 'Narrow recent activity by actor, action, resource, or period and connect it back to the affected record.',
    prompts: [
      { icon: ClipboardCheck, label: 'Review recent changes', prompt: 'Summarise the most recent audit activity.' },
      { icon: Search, label: 'Investigate a record', prompt: 'Help me find audit events for a specific order, customer, or stock item.' },
      { icon: Users, label: 'Review an actor', prompt: 'Show recent changes made by a specific team member.' },
      { icon: ShieldCheck, label: 'Check sensitive changes', prompt: 'Show recent privacy, access, or customer-data changes.' },
    ],
  },
  settings: {
    title: 'What do you want to configure?',
    description: 'Get guidance or prepare safe changes for QR ordering, locations, security, trading details, payments, and connections.',
    prompts: [
      {
        icon: QrCode,
        label: 'Check QR ordering',
        prompt: 'Can customers place a QR order at this location right now? Explain any blocker.',
      },
      { icon: Settings, label: 'Update QR ordering', prompt: 'Help me enable, disable, pause, or update QR ordering for this location.' },
      { icon: Settings, label: 'Configure a location', prompt: 'Guide me through updating a location and its trading hours.' },
      { icon: ShieldCheck, label: 'Review security', prompt: 'Guide me through reviewing sessions and securing the account.' },
      { icon: CreditCard, label: 'Set up payments', prompt: 'Guide me through connecting and testing a payment provider.' },
      { icon: Mail, label: 'Connect customer email', prompt: 'Guide me through setting up and testing the email connection.' },
    ],
  },
  support: {
    title: 'What do you need help with?',
    description: 'Describe the task or problem and DUMA will find the closest guide or walk through it with you.',
    prompts: [
      { icon: Search, label: 'Find the right guide', prompt: 'Help me find the guide for the task I am trying to complete.' },
      { icon: ShoppingCart, label: 'Run a service workflow', prompt: 'Show me the guide for running a shift from open to close.' },
      { icon: Package, label: 'Fix a stock workflow', prompt: 'Show me the guide for receiving a delivery and updating stock correctly.' },
      { icon: Users, label: 'Get people help', prompt: 'Show me how to raise and track an HR, payroll, scheduling, or IT request.' },
    ],
  },
};

/** Data-backed starters only appear when the API grants every capability they need. */
const PROMPT_CAPABILITIES: Partial<Record<string, Capability[]>> = {
  'Review performance': ['analytics:read'],
  'Check stock risk': ['inventory:read'],
  'Check team cover': ['scheduling:read'],
  'Prepare a stock order': ['purchasing:write'],
  'Set today’s priorities': ['analytics:read', 'inventory:read', 'scheduling:read'],
  'Check trading pace': ['analytics:read'],
  'Find stock risks': ['inventory:read'],
  'Check who is working': ['scheduling:read'],
  'Review active orders': ['orders:read'],
  'Investigate an order': ['orders:read'],
  'Check cancellations': ['orders:read'],
  'Review QR orders': ['orders:read'],
  'Compare order performance': ['analytics:read'],
  'Find low-stock risks': ['inventory:read'],
  'Prepare a purchase order': ['purchasing:write'],
  'Review open stock work': ['stock:read'],
  'Compare this week': ['analytics:read'],
  'Rank menu performance': ['analytics:read'],
  'Review refunds': ['analytics:read'],
  'Check labour performance': ['analytics:read'],
  'Find a customer': ['customers:read'],
  'Review customer segments': ['segments:read'],
  'Check duplicate workflow': ['customers:merge'],
  'Review retention': ['analytics:read'],
  'Check email health': ['email:read'],
  'Review failed deliveries': ['email:read'],
  'Set up an automation': ['email:send'],
  'Prepare an audience': ['segments:read'],
  'Check rota cover': ['scheduling:read'],
  'Review leave requests': ['hr.leave:read'],
  'Preview payroll': ['hr.payroll:read'],
  'Review helpdesk work': ['helpdesk:manage'],
  'Update an item': ['menu:write'],
  'Build a recipe': ['recipes:write'],
  'Review ingredient risk': ['inventory:read'],
  'Review the active queue': ['orders:read'],
  'Investigate a delayed order': ['orders:read'],
  'Check cash-up status': ['cashups:read'],
  'Explain a variance': ['cashups:read'],
  'Check unfinished orders': ['orders:read'],
  'Review open requests': ['privacy:read'],
  'Find the customer': ['customers:read'],
  'Check the audit trail': ['audit:read'],
  'Review recent changes': ['audit:read'],
  'Investigate a record': ['audit:read'],
  'Review an actor': ['audit:read'],
  'Check sensitive changes': ['audit:read'],
  'Configure a location': ['locations:write'],
  'Check QR ordering': ['qr-ordering:read'],
  'Update QR ordering': ['qr-ordering:write'],
  'Set up payments': ['payments.connections:write'],
  'Connect customer email': ['email.connections:write'],
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
const SHORTCUT_FEEDBACK_MS = 450;
const MIN_RESPONSE_MS = 1_000;
const DESKTOP_PANEL_WIDTH = 460;
const WINDOW_MARGIN = 16;
/** Recent turns sent with each request — the panel keeps the rest for display only. */
const HISTORY_SENT = 24;

interface FloatingPosition {
  x: number;
  y: number;
}

interface DragState {
  offsetX: number;
  offsetY: number;
}

const PAGE_NAMES: Record<string, string> = {
  'audit-log': 'Audit log',
  'cash-up': 'Cash-up',
  communications: 'Communications',
  compliance: 'Compliance',
  customers: 'Customers',
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  kds: 'Kitchen display',
  menu: 'Menu',
  'my-hr': 'My HR',
  orders: 'Orders',
  pos: 'POS terminal',
  reports: 'Reports',
  scheduling: 'My rota',
  settings: 'Settings',
  staff: 'Staff',
  support: 'Support',
};

function pageName(pathname: string) {
  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return PAGE_NAMES[segment] ?? segment.replaceAll('-', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function pageId(pathname: string) {
  const segment = pathname.split('/').filter(Boolean)[0] ?? 'dashboard';
  return Object.hasOwn(PAGE_NAMES, segment) ? segment : undefined;
}

async function waitForMinimum(startedAt: number) {
  const remaining = MIN_RESPONSE_MS - (performance.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));
}

function clampPosition(position: FloatingPosition, width: number, height: number) {
  return {
    x: Math.min(Math.max(WINDOW_MARGIN, position.x), Math.max(WINDOW_MARGIN, window.innerWidth - width - WINDOW_MARGIN)),
    y: Math.min(Math.max(WINDOW_MARGIN, position.y), Math.max(WINDOW_MARGIN, window.innerHeight - height - WINDOW_MARGIN)),
  };
}

function shortcutKey(shortcut: AgentShortcut) {
  return `${shortcut.href}-${shortcut.locationId ?? ''}`;
}

/**
 * The steps the agent actually took, streamed as it takes them. Completed steps
 * stay ticked so a slow answer reads as progress on real work rather than as a
 * spinner that might mean anything.
 */
/**
 * What the agent is doing right now.
 *
 * One live line rather than a growing stack: the current step is the only one
 * that matters while waiting, and a list that reflows on every event pushes the
 * conversation around. The three things it adds are the ones a person actually
 * wants during a wait — what it is doing, how long it has been at it, and what
 * it has already finished.
 *
 * The elapsed count is deliberately absent for the first few seconds. Most
 * turns finish inside that window, and a timer on a fast answer reads as an
 * apology for speed it did not need to make.
 */
function ThinkingTrail({ steps, caption }: { steps: string[]; caption: string }) {
  const [elapsed, setElapsed] = useState(0);
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Math.round((Date.now() - startedAt) / 1000)), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  // The mood's own caption until a real step arrives, so the row can appear the
  // moment the request goes out. It used to wait for the first step and render
  // nothing before it, which left the mascot with no words beside it during the
  // part of the wait that most needs them.
  const current = steps[steps.length - 1] ?? caption;
  const done = steps.slice(0, -1);

  return (
    <div>
      <div className="flex items-center gap-2">
        {/* Keyed on the label so a new step crossfades in rather than swapping
            character-for-character under the reader. */}
        <span
          key={current}
          role="status"
          aria-live="polite"
          className="min-w-0 flex-1 truncate text-sm leading-7 text-muted-foreground duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {current}…
        </span>
        {elapsed >= 3 && (
          <span aria-hidden="true" className="shrink-0 font-mono text-label tabular-nums text-muted-foreground/70">
            {elapsed}s
          </span>
        )}
        {done.length > 0 && (
          <button
            type="button"
            onClick={() => setShowDone((value) => !value)}
            aria-expanded={showDone}
            className="flex shrink-0 items-center gap-1 rounded-sm text-label font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
          >
            <ChevronRight
              size={11}
              aria-hidden="true"
              className={cn('shrink-0 transition-transform duration-150', showDone && 'rotate-90')}
            />
            {done.length} done
          </button>
        )}
      </div>

      {showDone && (
        <ol className="mt-2 space-y-1 border-l border-rule pl-3">
          {done.map((step, index) => (
            <li key={`${step}-${index}`} className="flex items-start gap-1.5 text-label leading-4 text-muted-foreground">
              <Check size={10} className="mt-0.5 shrink-0 text-momentum" aria-hidden="true" />
              {step}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * What the agent did, folded away under the answer.
 *
 * Shut by default because the answer is the point; kept at all because "how did
 * it know that" is the first question anyone asks of a figure, and a sweep that
 * read five pages of the audit log should be able to say so.
 */
function StepsTaken({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  return (
    <details className="group mt-2">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm py-0.5 text-label font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight size={11} aria-hidden="true" className="shrink-0 transition-transform duration-150 group-open:rotate-90" />
        {steps.length} {steps.length === 1 ? 'step' : 'steps'} taken
      </summary>
      <ol className="mt-1.5 space-y-1 border-l border-rule pl-3">
        {steps.map((step, index) => (
          <li key={`${step}-${index}`} className="flex items-start gap-1.5 text-label leading-4 text-muted-foreground">
            <Check size={10} className="mt-0.5 shrink-0 text-momentum" aria-hidden="true" />
            {step}
          </li>
        ))}
      </ol>
    </details>
  );
}

/**
 * The arrival flourish, shared by both of the panel's mascots.
 *
 * `swirl` is the engine's own interface transition and the reason it exists:
 * three rings sweep in around a mascot that keeps both its body and its resting
 * face, so it is already tracking the cursor on its first frame. Opening a panel
 * is exactly the occasion it was built for.
 *
 * It replaced a spin of the eyes right round the sphere, which was the nicer
 * effect and is not available to us: anything anchored to the outline is refitted
 * to the real radius in its own direction, so on a hexagonal body the eyes step
 * over the flats and corners instead of gliding. See `SPIN` in `lib/mascot/gaze`.
 *
 * Returns whether the entrance is still playing. It yields the moment there is
 * real news to carry — someone who opens the panel and immediately clicks a
 * starter prompt should see the wait, not the greeting finishing — so any pose
 * other than resting wins outright.
 */
function useEntrance(mood: AgentMood) {
  const [entering, setEntering] = useState(true);

  useEffect(() => {
    if (!entering) return;
    // Held for `swirl`'s own measured length, at the end of which its rings have
    // already faded — so the handover lands on a frame that is clean anyway.
    const timer = window.setTimeout(() => setEntering(false), (STATE_BY_ID.get('swirl')?.duration ?? 1.3) * 1_000);
    return () => window.clearTimeout(timer);
  }, [entering]);

  return entering && mood.state === 'idle';
}

/**
 * The mascot at the top of the open panel: who you are talking to, and what it is
 * doing right now.
 *
 * It tracks the pointer, unlike the minimised bar's, and that is the difference
 * between chrome and a presence: this is the thing you opened the panel to talk
 * to, so it looks at you while you type at it. The welcome hero does the same, and
 * the two are only ever on screen together before the first question, where they
 * read as one character large and small rather than two disagreeing: same mood,
 * same cursor.
 *
 * 48 for a 30px ball, against the 21px this header carried before. It has to be a
 * presence rather than a favicon, because it is the whole of the assistant's
 * embodiment here and it has to hold poses that have somewhere to go — the rings
 * of a wait, the pastille of an answer landing, the travelling "!" of a failure.
 * At badge size those were smudges.
 */
function PanelMark({ mood }: { mood: AgentMood }) {
  const arriving = useEntrance(mood);
  return <Mascot size={48} state={arriving ? 'swirl' : mood.state} expression={mood.expression} follow />;
}

/**
 * The mascot in the minimised bar.
 *
 * The one place it stays a badge, and only because there is no conversation on
 * screen to be present in: collapsed, this strip and its status line are all a
 * reader has. So it plays the arrival and then holds the mood, but it does **not**
 * track the pointer — a strip in the corner of the screen is chrome, and eyes
 * following you out of chrome are a distraction rather than a greeting.
 */
function MinimizedMark({ mood }: { mood: AgentMood }) {
  const arriving = useEntrance(mood);
  return <Mascot size={44} state={arriving ? 'swirl' : mood.state} expression={mood.expression} />;
}

/**
 * Frame rate for the header mascot at rest.
 *
 * It used to hold a completely still frame, which was the wrong trade: this is the
 * product's mark, on screen on every page, and a motionless character reads as a
 * broken image rather than a calm one. But a full 60fps loop running all shift on a
 * till or kitchen tablet is a real cost for breathing nobody asked to see.
 *
 * So it breathes and blinks at a third of the rate. The engine is a pure function
 * of time, so this is genuinely the same animation with fewer frames drawn, and
 * everything it does at rest is slow: a 0.5% breath over 3.4s, gaze drift on 4–11s
 * periods.
 *
 * The blink is the one brief thing, at 0.18s, and it set this number. Auditing the
 * whole pre-drawn 900s blink schedule against each candidate rate, 20fps is the
 * cheapest that catches **every** blink — 15 drops 6 of 316 and 12 drops 12. A
 * missed blink is not a rough blink, it is a blink that never happened, and a mascot
 * that blinks only most of the time reads as one that stutters.
 */
const IDLE_FPS = 20;

/**
 * The mascot in the application header: the control that opens the panel.
 *
 * It owns the button rather than sitting inside one, because waking up is a
 * property of the control and not of the drawing. Both halves of that were bugs
 * when the mascot was a child: `display: contents` gives an element no box to
 * hit-test, and `onFocus` on a child never fires for focus that lands on the
 * button above it — so a keyboard user got no reaction at all.
 *
 * **Quiet until it has a reason not to be.** At rest it breathes and blinks at
 * `IDLE_FPS` and looks straight ahead. Reaching for it — pointer or focus ring —
 * brings it to full rate, starts it tracking the cursor and plays a wink; so does a
 * request in flight with the panel shut, which is the one time the header has news
 * of its own.
 *
 * Waking is the reaction, not a decoration on top of one, which is also why the
 * button drops the hover plate its neighbours carry: a grey rectangle sliding in
 * behind a character that is already looking at you is the weaker signal and the
 * redundant one.
 */
function AgentLauncher({
  mood,
  busy,
  open,
  onOpen,
}: {
  mood: AgentMood;
  busy: boolean;
  open: boolean;
  onOpen: (opener: HTMLElement) => void;
}) {
  const [reached, setReached] = useState(false);
  /** The greeting, which plays once per arrival rather than for as long as you hover. */
  const [greeting, setGreeting] = useState(false);
  /**
   * Whether the greeting is still owed. It is spent on the first arrival and never
   * refilled while the page lives.
   *
   * It used to play on every arrival, and a wink each time the pointer crosses a
   * header button is a tic rather than a greeting — it fires while somebody is
   * travelling to the control beside it, several times a minute, and the mascot ends
   * up winking at an empty room. Once is a greeting; the waking and the gaze that
   * follow every arrival are the reaction, and they are the part that should repeat.
   */
  const owed = useRef(true);
  const awake = reached || busy;

  // The greeting is *started* by the arrival that causes it and only ended here,
  // so this effect subscribes to a clock rather than deciding anything. Arriving
  // again while a wink is still running does not restart it, which keeps a
  // jittery pointer on the edge of the button from stuttering.
  useEffect(() => {
    if (!greeting) return;
    // Held for `wink`'s own measured duration, so the greeting ends where the
    // pose does rather than at a number picked to look about right.
    const timer = window.setTimeout(() => setGreeting(false), (STATE_BY_ID.get('wink')?.duration ?? 1.6) * 1_000);
    return () => window.clearTimeout(timer);
  }, [greeting]);

  const arrive = () => {
    setReached(true);
    if (owed.current) {
      owed.current = false;
      setGreeting(true);
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-touch"
      onClick={(event) => onOpen(event.currentTarget)}
      // Touch has no hover, so a tap would wake it and never let it sleep again,
      // leaving a loop running for the session on exactly the devices that can
      // least afford one. A tap opens the panel anyway, which is a better greeting.
      onPointerEnter={(event) => event.pointerType !== 'touch' && arrive()}
      onPointerLeave={() => setReached(false)}
      onFocus={arrive}
      onBlur={() => setReached(false)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Ask DUMA"
      className={cn('hover:bg-transparent', open && 'bg-band text-primary')}
    >
      <Mascot
        // Matched to the 44px button — the design system's named touch size — so
        // the box has no overflow to collide with the controls beside it and the
        // orbit rings of a wait still land inside it.
        //
        // That is a 28px ball against the 22px the logo tile drew here before, and
        // it sits deliberately past its 36px neighbours: the reload and theme
        // controls are glyphs, this one is a character and the way into the
        // assistant, and a taller thing in a row of even ones reads as hierarchy
        // rather than as misalignment.
        size={44}
        // No `eye` override, and that is worth a line because there used to be
        // one. The eyes were holes through to whatever was behind, and this button
        // has two grounds — band while the panel is open, porcelain otherwise — so
        // the open state had to hand the mascot its own plate colour or the eyes
        // stayed porcelain on a band button. They are an opaque well of their own
        // now, so the character no longer depends on what it is standing on.
        //
        // A greeting only makes sense when there is no news to carry: a request in
        // flight outranks being winked at.
        state={!busy && greeting ? 'wink' : mood.state}
        expression={mood.expression}
        follow={awake}
        fps={awake ? undefined : IDLE_FPS}
      />
    </Button>
  );
}

/**
 * Where an answer can be carried on to — the pages that hold the records it
 * was built from.
 *
 * Chips rather than rows, and bordered rather than filled, so they read as
 * destinations at a glance: the follow-up suggestions below an answer are
 * band-filled text, and two stacks of near-identical rows under every reply
 * made it ambiguous which ones navigated. The glyph takes the reference ink the
 * system gives links, which is the affordance the old section heading was
 * carrying on their behalf.
 */
function ShortcutList({
  shortcuts,
  openingKey,
  onOpen,
}: {
  shortcuts: AgentShortcut[];
  openingKey?: string;
  onOpen: (shortcut: AgentShortcut) => void;
}) {
  return (
    <section className="mt-4 flex flex-wrap gap-1.5" aria-label="Open in DUMA">
      {shortcuts.map((shortcut) => {
        const key = shortcutKey(shortcut);
        const opening = openingKey === key;
        const Icon = shortcut.kind === 'support' ? BookOpen : shortcut.locationId ? MapPin : ArrowUpRight;
        const progressLabel = shortcut.locationId ? 'Switching location…' : shortcut.kind === 'support' ? 'Opening guide…' : 'Opening…';
        return (
          <button
            key={key}
            type="button"
            onClick={() => onOpen(shortcut)}
            disabled={Boolean(openingKey)}
            title={shortcut.description}
            className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-sm border border-rule bg-field px-2.5 text-xs font-medium text-foreground shadow-sm transition-colors duration-150 hover:border-primary/45 hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
          >
            {opening ? (
              <Loader2 size={12} className="shrink-0 animate-spin text-reference" aria-hidden="true" />
            ) : (
              <Icon size={12} className="shrink-0 text-reference" aria-hidden="true" />
            )}
            <span className="truncate">{opening ? progressLabel : shortcut.label}</span>
            {/* Changing the active location changes what every other page shows,
                so it is stated on the control rather than left to the tooltip. */}
            {shortcut.locationId && !opening && <span className="shrink-0 text-muted-foreground">· switches location</span>}
          </button>
        );
      })}
    </section>
  );
}

function CopyAnswer({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(content).then(() => setCopied(true));
      }}
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-label font-semibold text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function DumaAgent() {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [position, setPosition] = useState<FloatingPosition>();
  const [dragging, setDragging] = useState(false);
  /**
   * How the last turn ended, kept so the mascot can react to it rather than
   * inferring from the transcript. Sniffing the last message's text for "Stopped"
   * would tie a pose to a sentence, and the sentence is the part that gets
   * rewritten. It is never cleared on a timer — `useAgentMood` decays the
   * reaction itself — only replaced by the next turn.
   */
  const [outcome, setOutcome] = useState<'delivered' | 'stopped' | 'completed'>();
  /**
   * Which rule declined the last request, if one did.
   *
   * Kept apart from `error` because the two are not the same event: a security
   * refusal also puts a message in the error box, but it is the product refusing to
   * be talked past rather than something going wrong, and it gets a different face.
   */
  const [refusal, setRefusal] = useState<AgentRefusal>();
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction>();
  const [testMode, setTestMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  /** Mirrors `steps` for the stream handler, which closes over stale state. */
  const takenRef = useRef<string[]>([]);
  const [openingShortcut, setOpeningShortcut] = useState<string>();
  const [error, setError] = useState('');
  const [drawerRect, setDrawerRect] = useState<DOMRect>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstSuggestionRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController>(null);
  const navigationTimerRef = useRef<number | undefined>(undefined);
  const dragRef = useRef<DragState | null>(null);
  const wasOpenRef = useRef(false);
  const locationId = useWorkspaceStore((state) => state.locationId);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const setLocationId = useWorkspaceStore((state) => state.setLocationId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingAction, busy, steps]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 640px)');
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const syncDrawer = () => {
      const drawer = document.querySelector<HTMLElement>('[data-duma-drawer]');
      const nextRect = drawer?.getBoundingClientRect();
      setDrawerRect(nextRect);
      if (nextRect && window.innerWidth - nextRect.width - WINDOW_MARGIN * 2 < DESKTOP_PANEL_WIDTH) setMinimized(true);
    };
    syncDrawer();
    window.addEventListener('duma:drawer-change', syncDrawer);
    window.addEventListener('resize', syncDrawer);
    const observer = new MutationObserver(syncDrawer);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('duma:drawer-change', syncDrawer);
      window.removeEventListener('resize', syncDrawer);
    };
  }, []);

  useEffect(() => {
    if (!open || !isDesktop) return;
    const constrain = () => {
      const width = panelRef.current?.offsetWidth ?? (minimized ? 304 : DESKTOP_PANEL_WIDTH);
      const height = panelRef.current?.offsetHeight ?? (minimized ? 56 : Math.min(720, window.innerHeight - 32));
      setPosition((current) => {
        const preferred = current ?? { x: window.innerWidth - width - 20, y: 72 };
        const availableBesideDrawer = drawerRect ? drawerRect.left - WINDOW_MARGIN * 2 : Infinity;
        const besideDrawer = drawerRect
          ? availableBesideDrawer >= width
            ? { ...preferred, x: Math.min(preferred.x, drawerRect.left - width - 12) }
            : { x: WINDOW_MARGIN, y: window.innerHeight - height - WINDOW_MARGIN }
          : preferred;
        return clampPosition(besideDrawer, width, height);
      });
    };
    constrain();
    window.addEventListener('resize', constrain);
    return () => window.removeEventListener('resize', constrain);
  }, [drawerRect, isDesktop, minimized, open]);

  useEffect(
    () => () => {
      if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!open || minimized) return;
    const focusTimer = busy
      ? undefined
      : window.setTimeout(() => (messages.length === 0 ? (firstSuggestionRef.current ?? panelRef.current) : inputRef.current)?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMinimized(true);
        return;
      }
      if (isDesktop) return;
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      if (focusTimer) window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [busy, isDesktop, messages.length, minimized, open]);

  useEffect(() => {
    if (wasOpenRef.current && !open) openerRef.current?.focus();
    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || !minimized) return;
    const focusTimer = window.setTimeout(() => restoreRef.current?.focus(), 0);
    return () => window.clearTimeout(focusTimer);
  }, [minimized, open]);

  const openPanel = (opener: HTMLElement) => {
    openerRef.current = opener;
    setOpen(true);
    setMinimized(false);
  };

  const applyResponse = useCallback((result: AgentChatResponse, taken: string[] = []) => {
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        steps: taken,
        content: result.message,
        refused: result.refused,
        evidence: result.evidence,
        scope: result.scope,
        shortcuts: result.shortcuts,
        cards: result.cards,
        followUps: result.followUps,
        fallbackModel: result.fallbackModel,
        live: true,
      },
    ]);
    setPendingAction(result.pendingAction);
    setTestMode(result.testMode);
    setOutcome('delivered');
  }, []);

  const startDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isDesktop || event.button !== 0 || (event.target as HTMLElement).closest('button, a, input, textarea, label')) return;
    const bounds = panelRef.current?.getBoundingClientRect();
    if (!bounds) return;
    dragRef.current = { offsetX: event.clientX - bounds.left, offsetY: event.clientY - bounds.top };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const moveDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current || !panelRef.current) return;
    setPosition(
      clampPosition(
        { x: event.clientX - dragRef.current.offsetX, y: event.clientY - dragRef.current.offsetY },
        panelRef.current.offsetWidth,
        panelRef.current.offsetHeight,
      ),
    );
  };

  const stopDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  const moveWithKeyboard = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!isDesktop || !event.altKey || !position || !panelRef.current) return;
    const delta = event.shiftKey ? 32 : 12;
    const movement = {
      ArrowLeft: { x: -delta, y: 0 },
      ArrowRight: { x: delta, y: 0 },
      ArrowUp: { x: 0, y: -delta },
      ArrowDown: { x: 0, y: delta },
    }[event.key];
    if (!movement) return;
    event.preventDefault();
    setPosition(
      clampPosition(
        { x: position.x + movement.x, y: position.y + movement.y },
        panelRef.current.offsetWidth,
        panelRef.current.offsetHeight,
      ),
    );
  };

  const send = async (prompt = draft) => {
    const content = prompt.trim();
    if (!content || busy) return;
    const nextMessages: AgentChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    setPendingAction(undefined);
    setError('');
    setSteps([]);
    setOutcome(undefined);
    setRefusal(undefined);
    takenRef.current = [];
    setBusy(true);
    const startedAt = performance.now();

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the recent turns as plain text. The panel keeps the full
        // transcript for display, but cards, shortcuts and evidence are already
        // spent — replaying them would only grow the request every turn.
        body: JSON.stringify({
          messages: nextMessages.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content })),
          context: { locationId, tenantId, page: pageId(pathname) },
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const failure = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(failure.message || 'Ask DUMA could not complete the request.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answered = false;

      // NDJSON: one event per line, so a partial chunk waits for its newline.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AgentStreamEvent;
          if (event.type === 'step')
            setSteps((current) => {
              if (current[current.length - 1] === event.label) return current;
              const next = [...current, event.label];
              takenRef.current = next;
              return next;
            });
          else if (event.type === 'error') throw new Error(event.message);
          else if (event.type === 'result') {
            await waitForMinimum(startedAt);
            applyResponse(event.response, takenRef.current);
            answered = true;
          }
        }
      }

      if (!answered) throw new Error('The answer stopped before it arrived. Try again.');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setOutcome('stopped');
        setMessages((current) => [...current, { role: 'assistant', content: 'Stopped. Ask again when you are ready.' }]);
      } else {
        await waitForMinimum(startedAt);
        setError(caught instanceof Error ? caught.message : 'Ask DUMA could not complete the request.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setSteps([]);
    }
  };

  /**
   * Back to an empty panel.
   *
   * Promoted out of a text link in the composer footer and into the header, where
   * a destructive-ish action belongs beside the other window controls rather than
   * a thumb's width from Send. It clears the outcome too: without that, wiping the
   * transcript left the mascot still holding the pose of an answer that is no
   * longer on screen.
   */
  const startFresh = () => {
    setMessages([]);
    setPendingAction(undefined);
    setError('');
    setOutcome(undefined);
    setRefusal(undefined);
  };

  const openShortcut = (shortcut: AgentShortcut) => {
    if (!shortcut.href.startsWith('/') || openingShortcut) return;
    setOpeningShortcut(shortcutKey(shortcut));
    navigationTimerRef.current = window.setTimeout(() => {
      if (shortcut.locationId) setLocationId(shortcut.locationId);
      if (!isDesktop) setMinimized(true);
      setOpeningShortcut(undefined);
      router.push(shortcut.href);
    }, SHORTCUT_FEEDBACK_MS);
  };

  const confirmAction = async (submission: AgentActionSubmission) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSteps(['Checking your approval', 'Validating the details', testMode ? 'Running a safe test' : 'Writing to DUMA']);
    const startedAt = performance.now();
    /** Carried out of the try so the catch can tell a refusal from a failure. */
    let refused: AgentRefusal | undefined;
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedAction: submission, context: { locationId, tenantId } }),
      });
      const result = (await response.json()) as AgentChatResponse;
      await waitForMinimum(startedAt);
      if (!response.ok) {
        refused = result.refused;
        throw new Error(result.message || 'The action could not be completed.');
      }
      setMessages((current) => [...current, { role: 'assistant', content: result.message, shortcuts: result.shortcuts, live: true }]);
      setPendingAction(undefined);
      setTestMode(result.testMode);
      // A rehearsal changed nothing, so it does not get the pose of a write that
      // went through.
      setOutcome(result.testMode ? 'delivered' : 'completed');
    } catch (caught) {
      await waitForMinimum(startedAt);
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
      if (refused) setRefusal(refused);
    } finally {
      setBusy(false);
      setSteps([]);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const followUps = !busy && !pendingAction && lastMessage?.role === 'assistant' ? (lastMessage.followUps ?? []) : [];
  const currentPage = pageName(pathname);
  const welcome = PAGE_WELCOMES[pageId(pathname) ?? ''] ?? DEFAULT_WELCOME;
  const permittedPrompts = welcome.prompts.filter((prompt) => {
    const required = PROMPT_CAPABILITIES[prompt.label];
    return !required || hasAllCapabilities(capabilities, ...required);
  });
  const visiblePrompts = permittedPrompts.length > 0 ? permittedPrompts : [DEFAULT_WELCOME.prompts[0]];
  const floatingStyle = isDesktop && position ? { left: position.x, top: position.y } : undefined;

  /**
   * What the panel is doing, in the mascot's terms. Ordered by what a person
   * would notice first if two were true at once.
   *
   * `listening` sits above `delivered` on purpose: an answer that has just landed
   * is still dwelling on the mascot, and someone who has already started typing
   * their follow-up should be looked at rather than kept waiting for the pastille
   * to fade. It sits *below* `writing` for the mirror reason — typing while the
   * answer is still arriving does not mean the answer stopped arriving.
   *
   * `thinking` and `working` split on whether any step has streamed back yet, so
   * the three dots mean "nothing to report" and the rings mean "it is on the
   * second thing" — which is the distinction the caption is also making.
   */
  /**
   * Which rule declined the last turn, from either place one can speak: the scope
   * guard answers with a message that carries the reason, while a security rule
   * fails the request instead of answering it.
   */
  const declined = refusal ?? (lastMessage?.role === 'assistant' ? lastMessage.refused : undefined);

  const phase: AgentPhase = // A security refusal outranks even the error box it also fills. It is the one
    // thing in this list the mascot is angry about, and that is the point of it.
    declined === 'security'
      ? 'blocked'
      : error
        ? 'failed'
        : pendingAction
          ? 'asking'
          : busy
            ? steps.length > 1
              ? 'working'
              : 'thinking'
            : // A refusal is never `writing`: that pose is eager, and being eager
              // while declining someone is the wrong face on the right words. Both
              // refusals rank below `listening`, so typing a follow-up gets you
              // looked at rather than go on being refused at.
              lastMessage?.role === 'assistant' && lastMessage.live && !declined
              ? 'writing'
              : draft.trim()
                ? 'listening'
                : declined === 'scope'
                  ? 'declined'
                  : outcome === 'completed'
                    ? 'completed'
                    : outcome === 'stopped'
                      ? 'stopped'
                      : outcome === 'delivered'
                        ? 'delivered'
                        : 'resting';

  /**
   * Resolved once, here, and passed down — not called per mascot.
   *
   * Two mascots are on screen together before the first question (the header
   * badge and the welcome hero) and they have to be the same character: separate
   * hook instances would run separate timers and could hold different poses, at
   * which point they read as two mascots that disagree.
   */
  const mood = useAgentMood(phase, { canDoze: open && !minimized });

  /**
   * The mascot's pose in words.
   *
   * Not decoration: a pose is colour-and-shape, and the product's Two-Channel
   * Rule says no state may be carried by that alone. It is also the more useful
   * of the two channels mid-request — "Reading the order history" says something
   * the three pulsing dots cannot — so the live step wins over the mood's own
   * caption whenever there is one.
   */
  const status = busy && steps.length > 0 ? `${steps[steps.length - 1]}…` : mood.caption;

  const dragHandleProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
    onKeyDown: moveWithKeyboard,
  };

  return (
    <>
      <AgentLauncher mood={mood} busy={busy} open={open} onOpen={openPanel} />

      {mounted
        ? createPortal(
            <>
              {open && (
                <section
                  ref={panelRef}
                  role="dialog"
                  aria-modal={isDesktop ? undefined : !minimized}
                  aria-labelledby="duma-agent-title"
                  tabIndex={-1}
                  data-duma-agent
                  style={floatingStyle}
                  className={cn(
                    'fixed z-[70] overflow-hidden bg-card shadow-2xl animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none',
                    minimized
                      ? 'right-3 bottom-3 flex h-14 w-[calc(100vw-1.5rem)] rounded-lg sm:right-auto sm:bottom-auto sm:w-80'
                      : 'inset-0 flex flex-col sm:inset-auto sm:h-[min(720px,calc(100vh-32px))] sm:w-115 sm:rounded-lg',
                    dragging && 'select-none',
                  )}
                >
                  {minimized ? (
                    <header className="flex h-full w-full items-center gap-2 border-b border-divider bg-card px-2.5">
                      <div
                        {...dragHandleProps}
                        role={isDesktop ? 'group' : undefined}
                        tabIndex={isDesktop ? 0 : -1}
                        aria-label={isDesktop ? 'Drag Ask DUMA. Hold Alt and use arrow keys to move it.' : undefined}
                        title={isDesktop ? 'Drag Ask DUMA' : undefined}
                        className={cn(
                          'flex min-w-0 flex-1 touch-none items-center gap-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:cursor-grab',
                          dragging && 'sm:cursor-grabbing',
                        )}
                      >
                        <MinimizedMark mood={mood} />
                        <div className="min-w-0 flex-1">
                          <h2 id="duma-agent-title" className="truncate text-sm font-semibold">
                            Ask DUMA
                          </h2>
                          {/* Minimised, this line is the only thing left that can
                              say what is happening, so it carries the live status
                              rather than the page being followed. */}
                          <p className="truncate text-label text-muted-foreground" role="status" aria-live="polite">
                            {status}
                          </p>
                        </div>
                      </div>
                      <Button
                        ref={restoreRef}
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMinimized(false)}
                        aria-label="Restore Ask DUMA"
                      >
                        <Maximize aria-hidden="true" />
                      </Button>
                      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close Ask DUMA">
                        <X aria-hidden="true" />
                      </Button>
                    </header>
                  ) : (
                    <>
                      <header className="flex shrink-0 items-center gap-2 border-b border-divider bg-card px-3 py-2">
                        <div
                          {...dragHandleProps}
                          role={isDesktop ? 'group' : undefined}
                          tabIndex={isDesktop ? 0 : -1}
                          aria-label={isDesktop ? 'Drag Ask DUMA. Hold Alt and use arrow keys to move it.' : undefined}
                          title={isDesktop ? 'Drag Ask DUMA' : undefined}
                          onDoubleClick={() => isDesktop && setMinimized(true)}
                          className={cn(
                            'flex min-w-0 flex-1 touch-none items-center gap-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring sm:cursor-grab',
                            dragging && 'sm:cursor-grabbing',
                          )}
                        >
                          {/*
                            The panel's face, and the only mascot in it once a
                            conversation is running.

                            Large enough to be a presence rather than a favicon — a
                            30px ball, against the 21px this header carried before —
                            because it is the whole of the assistant's embodiment
                            here, and it has to hold poses that have somewhere to
                            go: the orbit rings of a wait, the pastille of an answer
                            landing, the travelling "!" of a failure. At the old
                            size those were smudges.
                          */}
                          <PanelMark mood={mood} />
                          <div className="min-w-0 flex-1">
                            <h2 id="duma-agent-title" className="truncate text-sm font-semibold text-foreground">
                              Ask DUMA
                            </h2>
                            {/* The pose is colour and shape, and the product's
                                Two-Channel Rule says no state travels on that
                                alone — so the mood's own words sit under the title,
                                replaced by the live step once there is one. Held to
                                one line so a changing status cannot reflow the
                                header under the reader. */}
                            <p className="truncate text-label text-muted-foreground" role="status" aria-live="polite">
                              {status}
                            </p>
                          </div>
                        </div>
                        {messages.length > 0 && (
                          <Button variant="ghost" size="icon-sm" onClick={startFresh} aria-label="Start a new chat">
                            <Plus aria-hidden="true" />
                          </Button>
                        )}
                        <Button variant="ghost" size="icon-sm" onClick={() => setMinimized(true)} aria-label="Minimize Ask DUMA">
                          <Minus aria-hidden="true" />
                        </Button>
                        <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close Ask DUMA">
                          <X aria-hidden="true" />
                        </Button>
                      </header>

                      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
                        {messages.length === 0 ? (
                          /* Fills the scroller so the greeting can float in the
                             free space and the prompts sit against the composer,
                             where the hand already is. */
                          <div className="flex min-h-full flex-col duration-200 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
                            <section
                              className="flex flex-1 flex-col items-center justify-center py-6 text-center"
                              aria-labelledby="duma-welcome-title"
                            >
                              {/*
                                The greeting, and the one place the mascot is the
                                character rather than a badge: it spins up on
                                arrival and then watches the cursor, so an empty
                                panel is somebody waiting rather than a blank box
                                with a tip in it.

                                It replaced an icon-in-a-tile that changed per
                                page — a second, quieter picture of what the page
                                was, three lines above a heading that already said
                                so. The mascot says the thing the tile could not,
                                which is that there is someone here.
                              */}
                              <Mascot size={112} state={mood.state} expression={mood.expression} follow label="DUMA's assistant" />
                              <h3 id="duma-welcome-title" className="mt-2 text-base font-semibold tracking-title text-foreground">
                                {welcome.title}
                              </h3>
                              <p className="mx-auto mt-1 max-w-[40ch] text-sm leading-6 text-muted-foreground">{welcome.description}</p>
                            </section>

                            <p className="mt-6 shrink-0 text-label font-semibold tracking-label uppercase text-muted-foreground">
                              Suggested for {currentPage}
                            </p>

                            <div className="-mx-2 mt-1 shrink-0">
                              {visiblePrompts.map(({ icon: Icon, label, prompt }, index) => (
                                <button
                                  key={label}
                                  ref={index === 0 ? firstSuggestionRef : undefined}
                                  type="button"
                                  onClick={() => void send(prompt)}
                                  className="group flex w-full items-center gap-3 rounded-sm px-2 py-2.5 text-left transition-colors duration-150 hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                                >
                                  <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                                  <span className="min-w-0">
                                    <span className="block text-sm text-foreground">{label}</span>
                                    <span className="mt-0.5 block line-clamp-1 text-xs leading-5 text-muted-foreground">{prompt}</span>
                                  </span>
                                  <ChevronRight
                                    size={14}
                                    className="ml-auto shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transition-none"
                                    aria-hidden="true"
                                  />
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-5">
                            {messages.map((message, index) =>
                              message.role === 'user' ? (
                                /* Only the question is boxed, and quietly. The
                                   answer is prose hanging off the mascot column, so
                                   a turn reads as one conversation with two sides
                                   rather than a stack of matching bubbles. */
                                <div key={`user-${index}`} className="flex justify-end">
                                  <p className="max-w-[85%] rounded-md bg-band px-3 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground">
                                    {message.content}
                                  </p>
                                </div>
                              ) : (
                                <div key={`assistant-${index}`} className="text-sm leading-7 text-foreground">
                                  <LiveMarkdown
                                    content={message.content}
                                    active={message.live}
                                    onDone={() =>
                                      setMessages((current) =>
                                        current.map((item, itemIndex) => (itemIndex === index ? { ...item, live: false } : item)),
                                      )
                                    }
                                  />
                                  {message.cards?.map((card, cardIndex) => (
                                    <AgentMetrics key={cardIndex} card={card} />
                                  ))}
                                  {message.shortcuts?.length ? (
                                    <ShortcutList shortcuts={message.shortcuts} openingKey={openingShortcut} onOpen={openShortcut} />
                                  ) : null}
                                  {message.fallbackModel ? (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-label text-muted-foreground">
                                      <Zap size={11} className="shrink-0 text-stock" aria-hidden="true" />
                                      Primary model was at its limit — answered by {message.fallbackModel}
                                    </p>
                                  ) : null}
                                  <div className="mt-1 flex items-center justify-between gap-3">
                                    <StepsTaken steps={message.steps ?? []} />
                                    <CopyAnswer content={message.content} />
                                  </div>
                                </div>
                              ),
                            )}

                            {/* No spinner beside it: the mascot at the top of the
                                panel is the indicator, and a second animation down
                                here would be the same news told twice. What this
                                row owes the reader is the words — which step, how
                                long, what is already done. */}
                            {busy && <ThinkingTrail steps={steps} caption={mood.caption} />}

                            {error && (
                              <p className="rounded-sm border border-exception/50 bg-exception/5 p-3 text-sm text-exception" role="alert">
                                {error}
                              </p>
                            )}

                            {pendingAction && (
                              <ActionCard
                                action={pendingAction}
                                testMode={testMode}
                                busy={busy}
                                onConfirm={(submission) => void confirmAction(submission)}
                                onCancel={() => setPendingAction(undefined)}
                              />
                            )}

                            {followUps.length > 0 && (
                              <div className="flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
                                {followUps.map((followUp) => (
                                  <button
                                    key={followUp}
                                    type="button"
                                    onClick={() => void send(followUp)}
                                    className="rounded-sm bg-band px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                                  >
                                    {followUp}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <form
                        className="shrink-0 border-t border-divider bg-card px-3 pt-3 pb-2.5"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void send();
                        }}
                      >
                        <div className="flex items-end gap-2 rounded-md border border-input bg-field py-1.5 pr-1.5 pl-2 shadow-sm focus-within:border-measured focus-within:outline-2 focus-within:outline-measured">
                          <textarea
                            ref={inputRef}
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                void send();
                              }
                            }}
                            rows={1}
                            maxLength={4_000}
                            placeholder="Ask anything…"
                            aria-label="Message Ask DUMA"
                            className="max-h-40 min-h-9 flex-1 resize-none self-center bg-transparent px-1 py-1.5 text-base leading-6 text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
                            disabled={busy}
                          />
                          {busy ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="outline"
                              onClick={() => abortRef.current?.abort()}
                              aria-label="Stop generating"
                            >
                              <X aria-hidden="true" />
                            </Button>
                          ) : (
                            <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
                              <Send aria-hidden="true" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1.5 px-1 text-label text-muted-foreground">
                          {testMode ? 'Test mode · writes are simulated' : 'Live mode · writes need approval'}
                        </p>
                      </form>
                    </>
                  )}
                </section>
              )}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
