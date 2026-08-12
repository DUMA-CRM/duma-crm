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
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarDays,
  Check,
  ChefHat,
  ChevronRight,
  ClipboardCheck,
  Copy,
  CreditCard,
  CursorMove,
  type IconComponent,
  Loader2,
  Mail,
  MapPin,
  Maximize,
  Minus,
  Package,
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
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';

import type {
  AgentActionSubmission,
  AgentChatMessage,
  AgentChatResponse,
  AgentPendingAction,
  AgentShortcut,
  AgentStreamEvent,
} from '@/lib/ai/agent-types';
import { type Capability, hasAllCapabilities } from '@/lib/auth/capabilities';
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
  icon: IconComponent;
  prompts: StarterPrompt[];
}

const DEFAULT_WELCOME: PageWelcome = {
  title: 'What should we work on?',
  description: 'Ask about live operations, compare performance, or describe a task for DUMA to prepare.',
  icon: Zap,
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
    icon: BarChart3,
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
    icon: Receipt,
    prompts: [
      { icon: ShoppingCart, label: 'Review active orders', prompt: 'Show me the orders that are still pending, preparing, or ready.' },
      { icon: Search, label: 'Investigate an order', prompt: 'Help me find and explain a specific order.' },
      { icon: Receipt, label: 'Check cancellations', prompt: 'Summarise recent cancelled orders and any patterns in their reasons.' },
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
    icon: Package,
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
    icon: BarChart3,
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
    icon: Users,
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
    icon: Mail,
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
    icon: Users,
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
    icon: CalendarDays,
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
    icon: Users,
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
    icon: ShoppingCart,
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
    icon: CreditCard,
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
    icon: ChefHat,
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
    icon: CreditCard,
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
    icon: ShieldCheck,
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
    icon: ClipboardCheck,
    prompts: [
      { icon: ClipboardCheck, label: 'Review recent changes', prompt: 'Summarise the most recent audit activity.' },
      { icon: Search, label: 'Investigate a record', prompt: 'Help me find audit events for a specific order, customer, or stock item.' },
      { icon: Users, label: 'Review an actor', prompt: 'Show recent changes made by a specific team member.' },
      { icon: ShieldCheck, label: 'Check sensitive changes', prompt: 'Show recent privacy, access, or customer-data changes.' },
    ],
  },
  settings: {
    title: 'What do you want to configure?',
    description: 'Get guidance for locations, security, trading details, devices, payments, and external connections.',
    icon: Settings,
    prompts: [
      { icon: Settings, label: 'Configure a location', prompt: 'Guide me through updating a location and its trading hours.' },
      { icon: ShieldCheck, label: 'Review security', prompt: 'Guide me through reviewing sessions and securing the account.' },
      { icon: CreditCard, label: 'Set up payments', prompt: 'Guide me through connecting and testing a payment provider.' },
      { icon: Mail, label: 'Connect customer email', prompt: 'Guide me through setting up and testing the email connection.' },
    ],
  },
  support: {
    title: 'What do you need help with?',
    description: 'Describe the task or problem and DUMA will find the closest guide or walk through it with you.',
    icon: BookOpen,
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
function ThinkingTrail({ steps }: { steps: string[] }) {
  const visible = steps.slice(-4);
  return (
    <div className="mt-5 border-l border-reference pl-3" role="status" aria-live="polite">
      <ul className="space-y-1.5">
        {visible.map((step, index) => {
          const current = index === visible.length - 1;
          return (
            <li key={`${step}-${index}`} className="flex items-center gap-2">
              {current ? (
                <Loader2 size={13} className="shrink-0 animate-spin text-reference" aria-hidden="true" />
              ) : (
                <Check size={13} className="shrink-0 text-reference/60" aria-hidden="true" />
              )}
              <span className={cn('text-sm', current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {step}
                {current ? '…' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgentMark({ nonce, busy, size = 36 }: { nonce: number; busy: boolean; size?: number }) {
  return (
    <span className={cn('relative shrink-0', busy && 'animate-pulse')} style={{ width: size, height: size }}>
      <Logo key={nonce} size={size} variant="onDark" className="animate-in fade-in zoom-in-75 duration-500 motion-reduce:animate-none" />
      {busy ? <span className="absolute -right-0.5 -top-0.5 size-2 rounded-full bg-stock ring-2 ring-sidebar" aria-hidden="true" /> : null}
    </span>
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
    <section className="mt-3 border-t border-reference/25 pt-3" aria-label="Open in DUMA">
      <p className="text-label font-semibold uppercase tracking-wide text-reference">Open in DUMA</p>
      <div className="mt-1.5 space-y-1">
        {shortcuts.map((shortcut) => {
          const key = shortcutKey(shortcut);
          const opening = openingKey === key;
          const Icon = shortcut.kind === 'support' ? BookOpen : shortcut.locationId ? MapPin : ArrowRight;
          const progressLabel = shortcut.locationId
            ? 'Switching active location…'
            : shortcut.kind === 'support'
              ? 'Opening guide…'
              : 'Opening page…';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpen(shortcut)}
              disabled={Boolean(openingKey)}
              className="group flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left transition-colors hover:bg-reference/8 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
            >
              {opening ? (
                <Loader2 size={14} className="shrink-0 animate-spin text-reference" aria-hidden="true" />
              ) : (
                <Icon size={14} className="shrink-0 text-reference" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">{shortcut.label}</span>
                {opening || shortcut.description ? (
                  <span className="mt-0.5 block text-label leading-4 text-muted-foreground">
                    {opening ? progressLabel : shortcut.description}
                  </span>
                ) : null}
              </span>
              {!opening ? (
                <ArrowRight
                  size={13}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
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
  const [logoNonce, setLogoNonce] = useState(0);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction>();
  const [testMode, setTestMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
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
    setLogoNonce(Date.now());
  };

  const applyResponse = useCallback((result: AgentChatResponse) => {
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: result.message,
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
            setSteps((current) => (current[current.length - 1] === event.label ? current : [...current, event.label]));
          else if (event.type === 'error') throw new Error(event.message);
          else if (event.type === 'result') {
            await waitForMinimum(startedAt);
            applyResponse(event.response);
            answered = true;
          }
        }
      }

      if (!answered) throw new Error('The answer stopped before it arrived. Try again.');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
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
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedAction: submission, context: { locationId, tenantId } }),
      });
      const result = (await response.json()) as AgentChatResponse;
      await waitForMinimum(startedAt);
      if (!response.ok) throw new Error(result.message || 'The action could not be completed.');
      setMessages((current) => [...current, { role: 'assistant', content: result.message, shortcuts: result.shortcuts, live: true }]);
      setPendingAction(undefined);
      setTestMode(result.testMode);
    } catch (caught) {
      await waitForMinimum(startedAt);
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
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
  const WelcomeIcon = welcome.icon;
  const floatingStyle = isDesktop && position ? { left: position.x, top: position.y } : undefined;
  const dragHandleProps = {
    onPointerDown: startDrag,
    onPointerMove: moveDrag,
    onPointerUp: stopDrag,
    onPointerCancel: stopDrag,
    onKeyDown: moveWithKeyboard,
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(event) => openPanel(event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Ask DUMA"
        className={open ? 'bg-band text-primary' : undefined}
      >
        <Logo size={22} />
      </Button>

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
                    <header className="flex h-full w-full items-center gap-2 bg-sidebar px-2.5 text-sidebar-foreground">
                      <div
                        {...dragHandleProps}
                        role={isDesktop ? 'group' : undefined}
                        tabIndex={isDesktop ? 0 : -1}
                        aria-label={isDesktop ? 'Drag Ask DUMA. Hold Alt and use arrow keys to move it.' : undefined}
                        title={isDesktop ? 'Drag Ask DUMA' : undefined}
                        className={cn(
                          'flex min-w-0 flex-1 touch-none items-center gap-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sidebar-ring sm:cursor-grab',
                          dragging && 'sm:cursor-grabbing',
                        )}
                      >
                        <CursorMove size={14} className="hidden shrink-0 text-sidebar-foreground/55 sm:block" aria-hidden="true" />
                        <AgentMark nonce={logoNonce} busy={busy} size={34} />
                        <div className="min-w-0 flex-1">
                          <h2 id="duma-agent-title" className="truncate text-sm font-semibold">
                            Ask DUMA
                          </h2>
                          <p className="truncate text-label text-sidebar-foreground/70">
                            {busy ? `${steps[steps.length - 1] ?? 'Working'}…` : `Following ${currentPage}`}
                          </p>
                        </div>
                      </div>
                      <Button
                        ref={restoreRef}
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMinimized(false)}
                        aria-label="Restore Ask DUMA"
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <Maximize aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setOpen(false)}
                        aria-label="Close Ask DUMA"
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </header>
                  ) : (
                    <>
                      <header className="flex items-center gap-2 bg-sidebar px-3 py-2.5 text-sidebar-foreground">
                        <div
                          {...dragHandleProps}
                          role={isDesktop ? 'group' : undefined}
                          tabIndex={isDesktop ? 0 : -1}
                          aria-label={isDesktop ? 'Drag Ask DUMA. Hold Alt and use arrow keys to move it.' : undefined}
                          title={isDesktop ? 'Drag Ask DUMA' : undefined}
                          onDoubleClick={() => isDesktop && setMinimized(true)}
                          className={cn(
                            'flex min-w-0 flex-1 touch-none items-center gap-2 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sidebar-ring sm:cursor-grab',
                            dragging && 'sm:cursor-grabbing',
                          )}
                        >
                          <CursorMove size={14} className="hidden shrink-0 text-sidebar-foreground/55 sm:block" aria-hidden="true" />
                          <AgentMark nonce={logoNonce} busy={busy} />
                          <div className="min-w-0 flex-1">
                            <h2 id="duma-agent-title" className="truncate text-base font-semibold">
                              Ask DUMA
                            </h2>
                            <p className="truncate text-label text-sidebar-foreground/70">Works alongside the page you are on</p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setMinimized(true)}
                          aria-label="Minimize Ask DUMA"
                          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        >
                          <Minus aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setOpen(false)}
                          aria-label="Close Ask DUMA"
                          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                        >
                          <X aria-hidden="true" />
                        </Button>
                      </header>

                      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
                        {messages.length === 0 ? (
                          <div className="animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none">
                            <section className="rounded-md bg-band/65 px-4 py-4" aria-labelledby="duma-welcome-title">
                              <div className="flex items-start gap-3">
                                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-card text-primary shadow-sm">
                                  <WelcomeIcon size={17} aria-hidden="true" />
                                </span>
                                <div className="min-w-0">
                                  <h3 id="duma-welcome-title" className="text-lg font-semibold tracking-tight text-foreground">
                                    {welcome.title}
                                  </h3>
                                  <p className="mt-1 max-w-[39ch] text-sm leading-6 text-muted-foreground">{welcome.description}</p>
                                </div>
                              </div>
                            </section>

                            <div className="mt-5">
                              <h4 className="text-sm font-semibold text-foreground">Suggested for {currentPage}</h4>
                              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                                Choose one to start, or write your own request below.
                              </p>
                            </div>

                            <div className="mt-2 overflow-hidden rounded-md border border-rule bg-field divide-y divide-divider">
                              {visiblePrompts.map(({ icon: Icon, label, prompt }, index) => (
                                <button
                                  key={label}
                                  ref={index === 0 ? firstSuggestionRef : undefined}
                                  type="button"
                                  onClick={() => void send(prompt)}
                                  className="group flex w-full items-center gap-3 px-3 py-3 text-left transition-colors duration-150 hover:bg-band/55 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
                                >
                                  <span className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-band text-primary transition-colors group-hover:bg-card">
                                    <Icon size={15} aria-hidden="true" />
                                  </span>
                                  <span className="min-w-0">
                                    <span className="block text-sm font-semibold text-foreground">{label}</span>
                                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{prompt}</span>
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
                            {messages.map((message, index) => (
                              <div
                                key={`${message.role}-${index}`}
                                className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
                              >
                                <div
                                  className={cn(
                                    'text-sm leading-6',
                                    message.role === 'user'
                                      ? 'max-w-[88%] whitespace-pre-wrap rounded-md bg-foreground px-3 py-2 text-background'
                                      : 'w-full border-l border-reference pl-3 text-foreground',
                                  )}
                                >
                                  {message.role === 'assistant' ? (
                                    <LiveMarkdown
                                      content={message.content}
                                      active={message.live}
                                      onDone={() =>
                                        setMessages((current) =>
                                          current.map((item, itemIndex) => (itemIndex === index ? { ...item, live: false } : item)),
                                        )
                                      }
                                    />
                                  ) : (
                                    message.content
                                  )}
                                  {message.role === 'assistant' &&
                                    message.cards?.map((card, cardIndex) => <AgentMetrics key={cardIndex} card={card} />)}
                                  {message.role === 'assistant' && message.shortcuts?.length ? (
                                    <ShortcutList shortcuts={message.shortcuts} openingKey={openingShortcut} onOpen={openShortcut} />
                                  ) : null}
                                  {message.role === 'assistant' && message.fallbackModel ? (
                                    <p className="mt-1.5 flex items-center gap-1.5 text-label text-muted-foreground">
                                      <Zap size={11} className="shrink-0 text-stock" aria-hidden="true" />
                                      Primary model was at its limit — answered by {message.fallbackModel}
                                    </p>
                                  ) : null}
                                  {message.role === 'assistant' ? (
                                    <div className="mt-1 flex justify-end">
                                      <CopyAnswer content={message.content} />
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {busy && steps.length > 0 ? <ThinkingTrail steps={steps} /> : null}
                        {error && (
                          <p className="mt-4 rounded-sm border border-exception/50 bg-exception/5 p-3 text-sm text-exception" role="alert">
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
                          <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
                            {followUps.map((followUp) => (
                              <button
                                key={followUp}
                                type="button"
                                onClick={() => void send(followUp)}
                                className="rounded-sm border border-rule bg-field px-2 py-1 text-xs text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                              >
                                {followUp}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <form
                        className="shrink-0 border-t border-divider bg-band/55 p-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          void send();
                        }}
                      >
                        <div className="flex items-end gap-2 rounded-md border border-input bg-field p-2 shadow-sm focus-within:outline-2 focus-within:outline-measured">
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
                            rows={2}
                            maxLength={4_000}
                            placeholder="Ask about the business or request guidance…"
                            aria-label="Message Ask DUMA"
                            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-1 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
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
                        <div className="mt-2 flex items-center justify-between gap-3 px-1 text-label text-muted-foreground">
                          <span>{testMode ? 'Test mode · writes are simulated' : 'Live mode · writes need approval'}</span>
                          {messages.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setMessages([]);
                                setPendingAction(undefined);
                                setError('');
                              }}
                              className="font-semibold text-foreground hover:underline"
                            >
                              Clear
                            </button>
                          )}
                        </div>
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
