'use client';

import { motion, useReducedMotion } from 'motion/react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { ActionCard } from '@/components/ai/ActionCard';
import { AgentMetrics } from '@/components/ai/AgentMetrics';
import { ConversationHistory } from '@/components/ai/ConversationHistory';
import { LiveMarkdown } from '@/components/ai/LiveMarkdown';
import { Mascot } from '@/components/ai/Mascot';
import { ModelChoiceList, useAgentProviders } from '@/components/ai/ModelChoice';
import { PriorityBrief } from '@/components/ai/PriorityBrief';
import { type AgentMood, type AgentPhase, useAgentMood } from '@/components/ai/useAgentMood';
import {
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  Eye,
  History,
  type IconComponent,
  Loader2,
  Mail,
  MapPin,
  Maximize,
  MessageSquarePlus,
  Package,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  TriangleAlert,
  Users,
  X,
  Zap,
} from '@/components/icons';
import { Drawer, DrawerHeaderButton } from '@/components/shared/Drawer';
import { Button } from '@/components/ui/button';

import type { ModelIntent } from '@/lib/ai/agent-model-intent';
import { answerModelIntent, detectModelIntent } from '@/lib/ai/agent-model-intent';
import type {
  AgentActionSubmission,
  AgentCard,
  AgentChatMessage,
  AgentChatResponse,
  AgentPendingAction,
  AgentShortcut,
  AgentStreamEvent,
} from '@/lib/ai/agent-types';
import type { AgentRefusal } from '@/lib/ai/agent-types';
import { ASK_DUMA_EVENT, type AskDumaDetail } from '@/lib/ai/ask-duma';
import { visibleAnswer } from '@/lib/ai/conversation';
import { flushAgentHistoryOutbox, queueAgentTurn } from '@/lib/ai/history-outbox';
import { parsePriorityBrief } from '@/lib/ai/priority-brief';
import { createAgentConversation, getAgentConversation, saveAgentTurn } from '@/lib/api/agent-conversations.service';
import { type Capability, hasAllCapabilities } from '@/lib/auth/capabilities';
import { cn } from '@/lib/utils/cn';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';
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
        label: 'Run today’s briefing',
        prompt:
          'Give me today’s operations briefing. Check every area I can access, rank up to three issues, show the evidence, and give me the next action for each.',
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
      {
        icon: Users,
        label: 'Check labour performance',
        prompt: 'What was labour as a share of sales this week, and is the cost complete?',
      },
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
      { icon: CalendarDays, label: 'Check lateness', prompt: 'Compare this week’s rota with worked time — any no-shows or late starts?' },
      { icon: CreditCard, label: 'Preview payroll', prompt: 'Preview this week’s payroll totals and flag incomplete or unusual entries.' },
      { icon: Users, label: 'Review helpdesk work', prompt: 'Show open staff helpdesk requests, prioritised by urgency.' },
    ],
  },
  scheduling: {
    title: 'What do you need from the rota?',
    description: 'Check your working pattern or get help resolving a shift, attendance, or leave question.',
    prompts: [
      { icon: CalendarDays, label: 'Understand my shifts', prompt: 'When is my next shift, and what does the rest of my week look like?' },
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
      { icon: CreditCard, label: 'Check my payslips', prompt: 'Show my latest payslip and what was deducted.' },
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
      { icon: BookOpen, label: 'Take an order', prompt: 'Guide me through taking and completing an order on the till.' },
      { icon: Receipt, label: 'Check cash-up status', prompt: 'Is today’s trading day open, and did the last close balance?' },
      { icon: Users, label: 'Add a customer', prompt: 'Show me how to identify a loyalty customer before payment.' },
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
      { icon: Settings, label: 'Check device setup', prompt: 'Where do I change the kitchen screen layout and order chime?' },
    ],
  },
  'cash-up': {
    title: 'What should we reconcile?',
    description: 'Check the trading-day state, understand a difference, or work through closing the day at the till.',
    prompts: [
      { icon: Receipt, label: 'Check cash-up status', prompt: 'Show the latest cash-up record and any cash or card variance.' },
      { icon: BookOpen, label: 'Close the trading day', prompt: 'Guide me through closing the trading day from the till.' },
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
  'Review command centre': ['analytics:read'],
  'Check waiting workflows': ['analytics:read'],
  'Compare locations': ['analytics:read'],
  'Review AI quality': ['audit:read'],
  'Check stock risk': ['stock.locations:read'],
  'Check team cover': ['scheduling:read'],
  'Prepare a stock order': ['purchasing:write'],
  'Check trading pace': ['analytics:read'],
  'Find stock risks': ['stock.locations:read'],
  'Check who is working': ['scheduling:read'],
  'Review active orders': ['orders:read'],
  'Investigate an order': ['orders:read'],
  'Check cancellations': ['orders:read'],
  'Review QR orders': ['orders:read'],
  'Compare order performance': ['analytics:read'],
  'Find low-stock risks': ['stock.locations:read'],
  'Prepare a purchase order': ['purchasing:write'],
  'Review open stock work': ['stock.transfers:read'],
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
  'Set up an automation': ['email:write'],
  'Prepare an audience': ['segments:read'],
  'Check rota cover': ['scheduling:read'],
  'Review leave requests': ['hr.leave:read'],
  'Preview payroll': ['hr.payroll:read'],
  'Review helpdesk work': ['helpdesk:manage'],
  'Update an item': ['menu:write'],
  'Build a recipe': ['recipes:write'],
  'Review ingredient risk': ['stock.locations:read'],
  'Review the active queue': ['orders:read'],
  'Investigate a delayed order': ['orders:read'],
  'Check cash-up status': ['cashups:read'],
  'Explain a variance': ['cashups:read'],
  'Check lateness': ['scheduling:read'],
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
/** Docked widths: the working size, and wide for tables and long answers. */
const DESKTOP_PANEL_WIDTH = 440;
const EXPANDED_PANEL_WIDTH = 880;
const WINDOW_MARGIN = 16;
/** Recent turns sent with each request — the panel keeps the rest for display only. */
const HISTORY_SENT = 24;

const PAGE_NAMES: Record<string, string> = {
  'audit-log': 'Audit log',
  'cash-up': 'Cash-up',
  communications: 'Communications',
  compliance: 'Compliance',
  customers: 'Customers',
  dashboard: 'Dashboard',
  inventory: 'Inventory',
  kds: 'Kitchen',
  menu: 'Menu',
  'my-hr': 'My HR',
  orders: 'Orders',
  pos: 'Till',
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

/**
 * Sub-pages worth naming to the agent ("reports/end-of-day", "staff/payroll").
 * Dynamic segments — a customer or item id — are never sent: the server writes
 * the page into the prompt and only accepts lowercase words.
 */
const SUB_PAGES: Partial<Record<string, readonly string[]>> = {
  customers: ['loyalty', 'duplicates'],
  menu: ['items', 'categories', 'modifiers'],
  reports: [
    'sales-summary',
    'sales-by-hour',
    'sales-by-channel',
    'sales-by-location',
    'prime-cost',
    'payment-methods',
    'vat',
    'item-sales',
    'menu-engineering',
    'refunds',
    'discounts-voids',
    'labour-vs-sales',
    'staff-hours',
    'customer-retention',
    'stock-usage',
    'waste',
    'purchasing',
    'end-of-day',
  ],
  settings: ['security', 'configuration', 'workspaces', 'roles', 'modules', 'trading', 'connectors', 'qr-ordering'],
  staff: ['team', 'rota', 'requests', 'helpdesk', 'payroll'],
};

function pageId(pathname: string) {
  const [segment = 'dashboard', sub] = pathname.split('/').filter(Boolean);
  if (!Object.hasOwn(PAGE_NAMES, segment)) return undefined;
  return sub && SUB_PAGES[segment]?.includes(sub) ? `${segment}/${sub}` : segment;
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
        Sources & activity
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

/** Keep the evidence available without making five raw result cards compete with the decision brief. */
function PriorityEvidence({ cards, steps }: { cards: AgentCard[]; steps: string[] }) {
  if (cards.length === 0 && steps.length === 0) return null;
  return (
    <details className="group mt-3">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-sm py-0.5 text-label font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight size={11} aria-hidden="true" className="shrink-0 transition-transform duration-150 group-open:rotate-90" />
        Evidence checked
      </summary>
      <div className="mt-2 border-l border-rule pl-3">
        {cards.map((card, index) => (
          <AgentMetrics key={index} card={card} />
        ))}
        {steps.length ? (
          <ol className="mt-3 space-y-1">
            {steps.map((step, index) => (
              <li key={`${step}-${index}`} className="flex items-start gap-1.5 text-label leading-4 text-muted-foreground">
                <Check size={10} className="mt-0.5 shrink-0 text-momentum" aria-hidden="true" />
                {step}
              </li>
            ))}
          </ol>
        ) : null}
      </div>
    </details>
  );
}

function PanelMark({ mood }: { mood: AgentMood }) {
  // A 32px slot in the header, so the header keeps its height — but drawn at 60px: most of a
  // mascot's box is headroom for its rings and gestures, and at 32px the hexagon itself was ~18px.
  return (
    <span className="relative block size-8">
      <Mascot size={60} {...mood} gesture={undefined} follow fps={30} className="absolute -top-3.5 -left-3.5 max-w-none" />
    </span>
  );
}
function MinimizedMark({ mood }: { mood: AgentMood }) {
  return <Mascot size={44} {...mood} gesture={undefined} fps={20} />;
}
function AgentLauncher({ mood, open, onOpen }: { mood: AgentMood; busy: boolean; open: boolean; onOpen: (opener: HTMLElement) => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-touch"
      onClick={(event) => onOpen(event.currentTarget)}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-label="Ask DUMA"
      className={cn(open && 'bg-band text-primary')}
    >
      <Mascot size={44} {...mood} gesture={undefined} fps={20} />
    </Button>
  );
}

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
    <section className="mt-4" aria-label="Open in DUMA">
      <p className="px-0.5 text-label font-semibold tracking-label text-muted-foreground uppercase">Open in DUMA</p>
      <div className="mt-1.5 divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field">
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
              className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors duration-150 hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-reference">
                {opening ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Icon size={14} aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{opening ? progressLabel : shortcut.label}</span>
                {!opening && (shortcut.description || shortcut.locationId) ? (
                  <span className="mt-0.5 block truncate text-label text-muted-foreground">
                    {shortcut.description ?? 'Switches the active location before opening'}
                  </span>
                ) : null}
              </span>
              <ChevronRight
                size={14}
                className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    </section>
  );
}

function FollowUpList({ items, onSelect }: { items: string[]; onSelect: (item: string) => void }) {
  return (
    <section aria-label="Suggested follow-ups">
      <p className="px-0.5 text-label font-semibold tracking-label text-muted-foreground uppercase">Useful next questions</p>
      <div className="mt-1.5 divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field">
        {items.slice(0, 3).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onSelect(item)}
            className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <MessageSquarePlus size={14} className="shrink-0 text-reference" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-sm text-foreground">{item}</span>
            <ArrowUpRight
              size={13}
              className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </button>
        ))}
      </div>
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
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => {
          void navigator.clipboard?.writeText(content).then(() => setCopied(true));
        }}
        aria-label={copied ? 'Copied' : 'Copy answer'}
        title={copied ? 'Copied' : 'Copy answer'}
        className="text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="text-momentum" aria-hidden="true" /> : <Copy aria-hidden="true" />}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? 'Answer copied' : ''}
      </span>
    </>
  );
}

export function DumaAgent() {
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const locationId = useWorkspaceStore((state) => state.locationId);
  return <DumaAgentPanel key={JSON.stringify([userId, tenantId, locationId, capabilities])} />;
}

function DumaAgentPanel() {
  const reducedMotion = useReducedMotion();
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const [conversationId, setConversationId] = useState<string>();
  const historyGroupRef = useRef(`chat-${Date.now()}`);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  // Docked on the right; wide is for tables and long answers.
  const [expanded, setExpanded] = useState(false);
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
  /**
   * The answer as it is being written, before the result frame lands.
   *
   * Held apart from `messages` so a stream that fails leaves no half-answer in
   * the transcript, and so a `delta-reset` (preamble the model wrote before
   * deciding to call a tool) can be taken back with one assignment.
   */
  const [streaming, setStreaming] = useState('');
  const [pendingAction, setPendingAction] = useState<AgentPendingAction>();
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  /** Mirrors `steps` for the stream handler, which closes over stale state. */
  const takenRef = useRef<string[]>([]);
  /** The streamed text, in a ref so the read loop never races a re-render. */
  const streamedRef = useRef('');
  const [openingShortcut, setOpeningShortcut] = useState<string>();
  const [error, setError] = useState('');
  const [drawerRect, setDrawerRect] = useState<DOMRect>();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const firstSuggestionRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followScrollRef = useRef(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController>(null);
  const navigationTimerRef = useRef<number | undefined>(undefined);
  const wasOpenRef = useRef(false);
  // Which model answers, chosen per device here or in Settings → General. The
  // route allow-lists it again — this is a preference, not a trusted instruction.
  const provider = useAgentSettingsStore((state) => state.provider);
  const setProvider = useAgentSettingsStore((state) => state.setProvider);
  const locationId = useWorkspaceStore((state) => state.locationId);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const setLocationId = useWorkspaceStore((state) => state.setLocationId);
  const capabilities = useAuthStore((state) => state.capabilities);
  // Only while the panel is open: this component is mounted on every page, and
  // the model list is worth nothing to a reader who has not asked for it.
  const { data: availableModels } = useAgentProviders({ enabled: open });
  useEffect(() => {
    if (!open) return;
    const retry = () =>
      void flushAgentHistoryOutbox().then(({ saved, remaining }) => {
        if (saved)
          setNotice(
            remaining
              ? `${saved} answer${saved === 1 ? '' : 's'} saved. ${remaining} will retry automatically.`
              : 'Your pending chat history is saved.',
          );
      });
    retry();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [open]);
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (el && followScrollRef.current) el.scrollTo({ top: el.scrollHeight, behavior: reducedMotion || busy ? 'instant' : 'smooth' });
  }, [messages, pendingAction, busy, steps, streaming, reducedMotion]);

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
      // Layout position, not the painted box: a drawer is still sliding in when
      // this runs, and its entry transform would leave the two panels overlapping.
      const nextRect = drawer ? new DOMRect(drawer.offsetLeft, drawer.offsetTop, drawer.offsetWidth, drawer.offsetHeight) : undefined;
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
      // Only when you're in it: with a drawer open too, Escape closes the one you're in, not both.
      if (event.key === 'Escape') {
        if (panelRef.current?.contains(document.activeElement)) setOpen(false);
        return;
      }
      if (isDesktop) return;
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.getClientRects().length > 0,
      );
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

  // `askDuma(prompt)` from any screen: open, with the question typed and the caret after it.
  useEffect(() => {
    const onAsk = (event: Event) => {
      const prompt = (event as CustomEvent<AskDumaDetail>).detail?.prompt?.trim();
      if (!prompt) return;
      if (document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
      setDraft(prompt);
      setOpen(true);
      setMinimized(false);
      window.setTimeout(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }, 120);
    };
    window.addEventListener(ASK_DUMA_EVENT, onAsk);
    return () => window.removeEventListener(ASK_DUMA_EVENT, onAsk);
  }, []);

  // Ctrl/⌘+J opens and closes it from anywhere, as Linear and Microsoft Copilot do.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'j' || event.altKey) return;
      event.preventDefault();
      if (open && !minimized) {
        setOpen(false);
        return;
      }
      if (document.activeElement instanceof HTMLElement) openerRef.current = document.activeElement;
      setOpen(true);
      setMinimized(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [minimized, open]);

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
        generatedAt: result.generatedAt,
        live: false,
      },
    ]);
    setStreaming('');
    setPendingAction(result.pendingAction);
    setOutcome('delivered');
  }, []);

  /**
   * Answer a question about the model without asking a model.
   *
   * A capacity-exhausted provider cannot tell you it is exhausted, and the
   * answer here is a change to this browser's own setting — neither is
   * something a server-side turn could do. So this short-circuits ahead of the
   * request entirely: nothing is sent, and the scope guard and the provider
   * chain are never reached. `content` is omitted when the composer's own model
   * chip opened the picker, because nobody typed anything.
   */
  const answerModelQuestion = (intent: ModelIntent, content?: string) => {
    const reply = answerModelIntent(intent, availableModels, provider);
    if (reply.apply) setProvider(reply.apply);
    setMessages((current) => [
      ...current,
      ...(content ? ([{ role: 'user', content }] as AgentChatMessage[]) : []),
      { role: 'assistant', content: reply.message, modelPicker: true, live: true },
    ]);
    setDraft('');
    setError('');
    setSteps([]);
    setRefusal(undefined);
    setPendingAction(undefined);
    setOutcome('delivered');
  };

  const send = async (prompt = draft) => {
    const content = prompt.trim();
    if (!content || busy || historyLoading || abortRef.current) return;
    setHistoryOpen(false);
    setNotice('');

    // Before anything else: "which models can you use?" and "switch to
    // OpenRouter" are settled here, deterministically.
    const modelIntent = detectModelIntent(content);
    if (modelIntent) {
      answerModelQuestion(modelIntent, content);
      return;
    }

    followScrollRef.current = true;
    const nextMessages: AgentChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    setPendingAction(undefined);
    setError('');
    setSteps([]);
    setOutcome(undefined);
    setRefusal(undefined);
    takenRef.current = [];
    streamedRef.current = '';
    setStreaming('');
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;
    let answered = false;

    let activeConversation = conversationId;
    const requestId = crypto.randomUUID();
    try {
      if (!activeConversation) {
        try {
          const created = await createAgentConversation(content, tenantId, locationId);
          controller.signal.throwIfAborted();
          activeConversation = created.id;
          setConversationId(created.id);
        } catch {
          controller.signal.throwIfAborted();
          setNotice('This chat will save automatically when history is available again.');
        }
      }
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the recent turns as plain text. The panel keeps the full
        // transcript for display, but cards, shortcuts and evidence are already
        // spent — replaying them would only grow the request every turn.
        body: JSON.stringify({
          messages: (activeConversation ? nextMessages.slice(-1) : nextMessages.slice(-HISTORY_SENT)).map(({ role, content }) => ({
            role,
            content: content.slice(0, 4000),
          })),
          conversationId: activeConversation,
          requestId,
          context: { locationId, tenantId, page: pageId(pathname), provider },
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
          else if (event.type === 'delta') {
            streamedRef.current += event.text;
            setStreaming(visibleAnswer(streamedRef.current));
          } else if (event.type === 'delta-reset') {
            streamedRef.current = '';
            setStreaming('');
          } else if (event.type === 'notice') setNotice(event.message);
          else if (event.type === 'error') throw new Error(event.message);
          else if (event.type === 'result') {
            applyResponse(event.response, takenRef.current);
            answered = true;
            const turn = {
              requestId,
              question: content,
              answer:
                event.response.message +
                (event.response.pendingAction
                  ? '\n\nThis was an action draft. Ask DUMA to prepare it again if it has not been approved.'
                  : ''),
              model: event.response.model,
              evidence: event.response.evidence ?? [],
              presentation: {
                cards: event.response.cards,
                scope: event.response.scope,
                refused: event.response.refused,
                followUps: event.response.followUps,
                fallbackModel: event.response.fallbackModel,
                generatedAt: event.response.generatedAt,
              },
            };
            try {
              if (!activeConversation) throw new Error('Conversation is waiting to be created');
              await saveAgentTurn(activeConversation, turn);
              setNotice('');
            } catch {
              queueAgentTurn({
                groupId: historyGroupRef.current,
                conversationId: activeConversation,
                title: content.slice(0, 100),
                tenantId,
                locationId,
                turn,
              });
              setNotice('Saved on this device. Ask DUMA will add it to history automatically.');
            }
          }
        }
      }

      if (!answered) throw new Error('The answer stopped before it arrived. Try again.');
    } catch (caught) {
      streamedRef.current = '';
      setStreaming('');
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        if (!answered) {
          setOutcome('stopped');
          setMessages((current) => [...current, { role: 'assistant', content: 'Stopped. Ask again when you are ready.' }]);
        } else setNotice('The answer arrived, but saving it to history was interrupted.');
      } else {
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
    if (busy || historyLoading) return;
    setConversationId(undefined);
    historyGroupRef.current = `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setHistoryOpen(false);
    setNotice('');
    setMessages([]);
    streamedRef.current = '';
    setStreaming('');
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
    setSteps(['Checking your approval', 'Validating the details', 'Writing to DUMA']);
    /** Carried out of the try so the catch can tell a refusal from a failure. */
    let refused: AgentRefusal | undefined;
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedAction: submission, context: { locationId, tenantId, provider } }),
      });
      const result = (await response.json()) as AgentChatResponse;
      if (!response.ok) {
        refused = result.refused;
        throw new Error(result.message || 'The action could not be completed.');
      }
      setMessages((current) => [...current, { role: 'assistant', content: result.message, shortcuts: result.shortcuts, live: true }]);
      setPendingAction(undefined);
      setOutcome('completed');
      if (conversationId) {
        try {
          await saveAgentTurn(conversationId, {
            requestId: crypto.randomUUID(),
            question: `Approved: ${pendingAction?.title ?? 'the proposed action'}`,
            answer: result.message,
            model: result.model,
            evidence: result.evidence ?? [],
          });
        } catch {
          setNotice('The action completed, but its confirmation could not be saved to chat history.');
        }
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
      if (refused) setRefusal(refused);
    } finally {
      setBusy(false);
      setSteps([]);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const followUps = !busy && !pendingAction && lastMessage?.role === 'assistant' ? (lastMessage.followUps ?? []) : [];
  const retryPrompt = [...messages].reverse().find((message) => message.role === 'user')?.content;
  const currentPage = pageName(pathname);
  const welcome = PAGE_WELCOMES[pageId(pathname)?.split('/')[0] ?? ''] ?? DEFAULT_WELCOME;
  const permittedPrompts = welcome.prompts.filter((prompt) => {
    const required = PROMPT_CAPABILITIES[prompt.label];
    return !required || hasAllCapabilities(capabilities, ...required);
  });
  const visiblePrompts = permittedPrompts.length > 0 ? permittedPrompts : [DEFAULT_WELCOME.prompts[0]];
  // Beside an open drawer rather than over it: the drawer is modal and owns the right edge.
  const dockRight = drawerRect ? Math.max(0, window.innerWidth - drawerRect.left) : 0;
  const dockWidth = expanded ? Math.min(EXPANDED_PANEL_WIDTH, window.innerWidth - dockRight - WINDOW_MARGIN * 4) : DESKTOP_PANEL_WIDTH;
  const dockStyle = isDesktop ? { width: dockWidth, marginRight: dockRight } : undefined;
  const floatingStyle = isDesktop ? { right: dockRight + WINDOW_MARGIN, bottom: WINDOW_MARGIN } : undefined;

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
            ? streaming
              ? 'writing'
              : steps.length > 1
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
  const mood = useAgentMood(phase);

  /**
   * The mascot's pose in words.
   *
   * Not decoration: a pose is colour-and-shape, and the product's Two-Channel
   * Rule says no state may be carried by that alone. It is also the more useful
   * of the two channels mid-request — "Reading the order history" says something
   * the three pulsing dots cannot — so the live step wins over the mood's own
   * caption whenever there is one.
   */
  const status = historyLoading ? 'Loading history' : busy ? steps.at(-1) || mood.caption : mood.caption;

  return (
    <>
      <AgentLauncher mood={mood} busy={busy} open={open} onOpen={openPanel} />

      {mounted
        ? createPortal(
            <>
              {open && minimized && (
                <motion.div
                  initial={reducedMotion ? false : { opacity: 1, y: 8, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                  ref={panelRef}
                  role="dialog"
                  aria-labelledby="duma-agent-title"
                  tabIndex={-1}
                  style={floatingStyle}
                  className="fixed right-3 bottom-3 z-[70] flex h-14 w-[calc(100vw-1.5rem)] overflow-hidden rounded-lg border border-rule/60 bg-card shadow-2xl sm:w-80"
                >
                  <header className="flex h-full w-full items-center gap-2 bg-card px-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
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
                </motion.div>
              )}

              {/* Open, it is the app's own drawer — the same frame as every side panel — just not
                  modal: the page stays usable behind it, and nothing is locked or dimmed. */}
              {open && !minimized && (
                <Drawer
                  modal={false}
                  title="Ask DUMA"
                  description={status}
                  liveDescription
                  leading={<PanelMark mood={mood} />}
                  closeLabel="Close Ask DUMA"
                  onClose={() => setOpen(false)}
                  panelRef={panelRef}
                  bodyRef={scrollRef}
                  onBodyScroll={(event) => {
                    const el = event.currentTarget;
                    followScrollRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
                  }}
                  bodyClassName="px-5 py-5"
                  footerClassName="px-3 pt-3 pb-2.5"
                  style={dockStyle}
                  className="sm:max-w-none sm:transition-[width] sm:duration-200"
                  actions={
                    <>
                      {messages.length > 0 && (
                        <DrawerHeaderButton onClick={startFresh} label="Start a new chat" disabled={busy || historyLoading}>
                          <Plus size={15} aria-hidden="true" />
                        </DrawerHeaderButton>
                      )}
                      <DrawerHeaderButton
                        onClick={() => setHistoryOpen((value) => !value)}
                        label={historyOpen ? 'Back to conversation' : 'Conversation history'}
                        pressed={historyOpen}
                        disabled={busy || historyLoading}
                      >
                        <History size={15} aria-hidden="true" />
                      </DrawerHeaderButton>
                      {isDesktop && (
                        <DrawerHeaderButton
                          onClick={() => setExpanded((value) => !value)}
                          label={expanded ? 'Make Ask DUMA narrower' : 'Make Ask DUMA wider'}
                          pressed={expanded}
                        >
                          <ArrowLeftRight size={15} aria-hidden="true" />
                        </DrawerHeaderButton>
                      )}
                    </>
                  }
                  footer={
                    historyOpen ? undefined : (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          void send();
                        }}
                      >
                        {notice && (
                          <p
                            role="status"
                            className="mb-2 flex items-start gap-2 rounded-md border border-rule/55 bg-band/45 px-3 py-2 text-xs leading-5 text-muted-foreground"
                          >
                            <History size={13} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
                            <span>{notice}</span>
                          </p>
                        )}
                        <div className="flex items-end gap-2 rounded-md border border-input bg-control py-1.5 pr-1.5 pl-2 shadow-sm focus-within:border-measured focus-within:outline-2 focus-within:outline-measured">
                          <textarea
                            ref={inputRef}
                            value={draft}
                            onChange={(event) => {
                              setDraft(event.target.value);
                              event.target.style.height = 'auto';
                              event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                void send();
                              }
                            }}
                            rows={1}
                            maxLength={4_000}
                            placeholder="Ask about your workspace…"
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
                        {/* The composer's own status strip: which model will
                            answer on the left, what an approval means on the
                            right. The model belongs here rather than in the
                            header — it is a property of the message about to be
                            sent, and the header is already the mascot's. */}
                        <p className="mt-1.5 px-1 text-label text-muted-foreground">Ask DUMA can make mistakes</p>
                      </form>
                    )
                  }
                >
                  {historyOpen ? (
                    <ConversationHistory
                      userId={userId}
                      tenantId={tenantId}
                      locationId={locationId}
                      onWorking={setHistoryLoading}
                      onDeleted={(id) => {
                        if (id === conversationId) {
                          setConversationId(undefined);
                          setMessages([]);
                          setPendingAction(undefined);
                          setError('');
                        }
                      }}
                      onSelect={async (id) => {
                        setHistoryLoading(true);
                        try {
                          const saved = await getAgentConversation(id);
                          setMessages(
                            saved.turns.flatMap((turn): AgentChatMessage[] => [
                              { role: 'user', content: turn.question },
                              {
                                ...turn.presentation,
                                role: 'assistant',
                                content: turn.answer,
                                evidence: turn.evidence,
                                generatedAt: turn.presentation?.generatedAt ?? turn.createdAt,
                              },
                            ]),
                          );
                          setConversationId(id);
                          setPendingAction(undefined);
                          setError('');
                          setNotice('');
                          setHistoryOpen(false);
                        } finally {
                          setHistoryLoading(false);
                        }
                      }}
                    />
                  ) : messages.length === 0 ? (
                    /* Fills the scroller so the greeting can float in the
                             free space and the prompts sit against the composer,
                             where the hand already is. */
                    <div className="flex min-h-full flex-col duration-200 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
                      {/* What it can do and where it is looking — no hero: the header mark is the character. */}
                      <section className="flex flex-1 flex-col justify-end pb-2 text-left" aria-labelledby="duma-welcome-title">
                        {/* The one place the mascot is the character, not a badge: it waves on
                                  arrival and then watches the cursor, so an empty panel is someone waiting. */}
                        <Mascot size={112} {...mood} gesture="wave" follow label="DUMA's assistant" className="-ml-2" />
                        <h3 id="duma-welcome-title" className="mt-3 max-w-[26ch] text-xl font-semibold tracking-title text-foreground">
                          {welcome.title}
                        </h3>
                        <p className="mt-1.5 max-w-[46ch] text-sm leading-6 text-muted-foreground">{welcome.description}</p>
                        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-md border border-rule/60 bg-field px-2 py-1 text-xs text-muted-foreground">
                          <Eye size={12} aria-hidden="true" />
                          Looking at <span className="font-medium text-foreground">{currentPage}</span>
                        </p>
                      </section>

                      <p className="mt-6 shrink-0 px-1 text-label uppercase text-muted-foreground">Try asking</p>

                      {/* The settings page's row list: one bordered panel, a row per prompt. */}
                      <div className="mt-2 shrink-0 divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field">
                        {visiblePrompts.slice(0, 4).map(({ icon: Icon, label, prompt }, index) => (
                          <button
                            key={label}
                            ref={index === 0 ? firstSuggestionRef : undefined}
                            type="button"
                            onClick={() => void send(prompt)}
                            className="group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                          >
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
                              <Icon size={15} aria-hidden="true" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-foreground">{label}</span>
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
                    <div className="space-y-7">
                      {messages.map((message, index) => {
                        if (message.role === 'user')
                          return (
                            /* Only the question is boxed, and quietly. The
                                   answer is prose hanging off the mascot column, so
                                   a turn reads as one conversation with two sides
                                   rather than a stack of matching bubbles. */
                            <div key={`user-${index}`} className="flex justify-end">
                              <p className="max-w-[85%] rounded-lg border border-rule/55 bg-field px-3.5 py-2 text-sm leading-6 whitespace-pre-wrap text-foreground">
                                {message.content}
                              </p>
                            </div>
                          );

                        const priorityBrief = parsePriorityBrief(message.content);
                        const evidenceSteps = [...new Set([...(message.evidence ?? []), ...(message.steps ?? [])])];
                        return (
                          <div key={`assistant-${index}`} className="text-sm leading-7 text-foreground">
                            {priorityBrief ? (
                              <PriorityBrief brief={priorityBrief} />
                            ) : (
                              <>
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
                              </>
                            )}
                            {/* Live, not a snapshot: a picker left further
                                      up the transcript still shows — and sets —
                                      the model in use. */}
                            {message.modelPicker ? (
                              <div className="mt-3">
                                <ModelChoiceList compact enabled={open} />
                              </div>
                            ) : null}
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
                              {priorityBrief ? (
                                <PriorityEvidence cards={message.cards ?? []} steps={evidenceSteps} />
                              ) : (
                                <StepsTaken steps={evidenceSteps} />
                              )}
                              {message.content.trim() ? <CopyAnswer content={message.content} /> : null}
                            </div>
                          </div>
                        );
                      })}

                      {/* No spinner beside it: the mascot at the top of the
                                panel is the indicator, and a second animation down
                                here would be the same news told twice. What this
                                row owes the reader is the words — which step, how
                                long, what is already done. */}
                      {/* Once words start arriving they are the status:
                                the trail of steps has done its job and a
                                spinner beside a sentence being written is
                                noise. */}
                      {streaming ? (
                        <div className="text-sm leading-7 text-foreground">
                          <LiveMarkdown content={streaming} />
                        </div>
                      ) : (
                        busy && (
                          // The thinking pose beside the words for it — the same mood as the header mark.
                          <div className="flex items-start gap-3">
                            <Mascot size={36} {...mood} gesture={undefined} fps={30} className="-mt-0.5 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <ThinkingTrail steps={steps} caption={mood.caption} />
                            </div>
                          </div>
                        )
                      )}

                      {error && (
                        <section
                          className="rounded-lg border border-exception/35 bg-exception/6 px-3.5 py-3"
                          role="alert"
                          aria-label="Ask DUMA could not finish"
                        >
                          <div className="flex items-start gap-2.5">
                            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold text-foreground">I couldn’t finish that</p>
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{error}</p>
                            </div>
                          </div>
                          {retryPrompt && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="mt-3"
                              disabled={busy}
                              onClick={() => void send(retryPrompt)}
                            >
                              <RefreshCw size={13} aria-hidden="true" />
                              Try again
                            </Button>
                          )}
                        </section>
                      )}

                      {pendingAction && (
                        <ActionCard
                          action={pendingAction}
                          busy={busy}
                          onConfirm={(submission) => void confirmAction(submission)}
                          onCancel={() => setPendingAction(undefined)}
                        />
                      )}

                      {followUps.length > 0 && <FollowUpList items={followUps} onSelect={(followUp) => void send(followUp)} />}
                    </div>
                  )}
                </Drawer>
              )}
            </>,
            document.body,
          )
        : null}
    </>
  );
}
