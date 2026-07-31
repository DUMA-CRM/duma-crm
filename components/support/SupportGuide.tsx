'use client';

import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  BookMarked,
  BookOpen,
  Boxes,
  Building2,
  CalendarDays,
  ChefHat,
  ChevronDown,
  CircleHelp,
  ClipboardCheck,
  Clock3,
  FileText,
  GraduationCap,
  Headphones,
  HeartHandshake,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  type LucideIcon,
  Mail,
  MessageSquarePlus,
  Monitor,
  Package,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Users,
  UsersRound,
  UtensilsCrossed,
  WifiOff,
  Wrench,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { StatusLozenge, fmtAgo, isOpenStatus, ticketKey } from '@/components/helpdesk/shared';
import { EditorShell } from '@/components/shared/EditorShell';
import { SectionTabs, type SectionTab } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getMyTickets } from '@/lib/api/people-ops.service';
import type { StaffRole } from '@/lib/api/staff.service';
import { roleAtLeast } from '@/lib/api/staff.service';
import { ARTICLE_CATEGORIES, SUPPORT_ARTICLES, type SupportArticle } from '@/lib/content/support-articles';
import { cn } from '@/lib/utils/cn';

type GuideTab = 'overview' | 'guides' | 'service' | 'management' | 'people' | 'access' | 'fix' | 'glossary' | 'faq';

interface GuideTopic {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  linkLabel: string;
  access?: string;
  steps: string[];
  tips?: string[];
}

/** A problem someone actually hits, what causes it, and the way out. */
interface Playbook {
  symptom: string;
  cause: string;
  icon: LucideIcon;
  steps: string[];
  href?: string;
  linkLabel?: string;
}

interface AccessArea {
  area: string;
  detail: string;
  /** Roles that can open it, already written the way the nav rules resolve. */
  who: string[];
}

interface GlossaryEntry {
  term: string;
  definition: string;
  group: 'Workspace' | 'Service' | 'Stock' | 'People' | 'Customers';
}

const tabs: SectionTab<GuideTab>[] = [
  { value: 'overview', label: 'Start here', icon: BookOpen },
  { value: 'guides', label: 'In-depth guides', icon: FileText, count: SUPPORT_ARTICLES.length, countLabel: `${SUPPORT_ARTICLES.length} articles` },
  { value: 'service', label: 'Run service', icon: Monitor },
  { value: 'management', label: 'Manage the business', icon: BarChart3 },
  { value: 'people', label: 'People & account', icon: UsersRound },
  { value: 'access', label: 'Roles & access', icon: KeyRound },
  { value: 'fix', label: 'Fix a problem', icon: Wrench },
  { value: 'glossary', label: 'Glossary', icon: BookMarked },
  { value: 'faq', label: 'FAQs', icon: CircleHelp },
];

const serviceTopics: GuideTopic[] = [
  {
    title: 'Dashboard',
    description: 'Your starting point for the current location, service activity, alerts, and the work that needs attention.',
    icon: LayoutDashboard,
    href: '/dashboard',
    linkLabel: 'Open dashboard',
    steps: [
      'Confirm the active location in the top bar before reviewing any figures.',
      'Use the operational cards to spot current service and stock activity.',
      'Follow the links on each card to open the relevant workspace and take action.',
    ],
    tips: ['The information shown changes with your role and selected location.'],
  },
  {
    title: 'POS terminal',
    description: 'Build an order, apply options, identify a customer, and complete checkout from a counter or tablet.',
    icon: Monitor,
    href: '/pos',
    linkLabel: 'Open POS',
    steps: [
      'Select a menu item and choose any required size, milk, extras, or other modifiers.',
      'Add or scan a customer before payment when they want to earn or use loyalty benefits.',
      'Review the basket, choose checkout, then confirm the payment method and completion.',
      'If Wi-Fi drops, keep serving: eligible orders are queued on the device and sync when the connection returns.',
    ],
    tips: ['Check Settings → POS before service to choose a camera or external loyalty-code scanner.'],
  },
  {
    title: 'Kitchen display',
    description: 'Move incoming tickets through preparation and keep the hand-off queue clear.',
    icon: ChefHat,
    href: '/kds',
    linkLabel: 'Open KDS',
    steps: [
      'Keep DUMA on the KDS screen during service so new orders appear in the queue.',
      'Open a ticket to review items and modifiers, then move it into preparation.',
      'Mark the order ready when every item is complete, and clear it after collection.',
    ],
    tips: ['KDS sound and display preferences are stored per device in Settings.'],
  },
  {
    title: 'Orders',
    description: 'Review order history, payment context, fulfilment state, and individual order details.',
    icon: ShoppingBag,
    href: '/orders',
    linkLabel: 'View orders',
    access: 'Manager access',
    steps: [
      'Search or filter the order list to narrow down a customer, date, or order state.',
      'Open an order to inspect its items, totals, source, staff member, and status history.',
      'Use the recorded timeline when investigating a missing, delayed, or cancelled order.',
    ],
  },
  {
    title: 'Customers & loyalty',
    description: 'Find customer records, review visits and orders, and manage loyalty points.',
    icon: Users,
    href: '/customers',
    linkLabel: 'Open customers',
    access: 'Manager access',
    steps: [
      'Search by customer details, then open the customer record.',
      'Review loyalty progress, visit history, recent orders, and past communications.',
      'Use the points adjustment action only when a correction is needed, and include a clear reason.',
    ],
    tips: ['At the till, use the customer QR code or phone search instead of creating a duplicate record.'],
  },
];

const managementTopics: GuideTopic[] = [
  {
    title: 'Menu, recipes & modifiers',
    description: 'Maintain what can be sold and connect menu choices to consistent recipes.',
    icon: UtensilsCrossed,
    href: '/menu',
    linkLabel: 'Manage menu',
    access: 'Store manager+',
    steps: [
      'Create or edit menu items with the correct name, price, availability, and category.',
      'Build modifier groups for choices such as size, milk, temperature, and extras.',
      'Attach recipes and quantities so sales can drive accurate ingredient usage.',
      'Review the POS after a menu change to confirm the item and its choices appear as expected.',
    ],
  },
  {
    title: 'Inventory',
    description: 'Track on-hand quantities, low-stock risk, stock units, expiry dates, and forecasted cover.',
    icon: Package,
    href: '/inventory',
    linkLabel: 'Open inventory',
    access: 'Store manager+',
    steps: [
      'Select the correct location and review items marked low, critical, out, or expiring.',
      'Open an item to inspect its stock units, thresholds, usage, and current availability.',
      'Record new units and expiry information when stock arrives.',
      'Use forecasts as an early warning, then check actual stock before ordering.',
    ],
  },
  {
    title: 'Purchasing & restocks',
    description: 'Maintain suppliers, raise purchase orders, and process requests for more stock.',
    icon: Truck,
    href: '/inventory/purchasing',
    linkLabel: 'Open purchasing',
    access: 'Store manager+',
    steps: [
      'Keep supplier details and the items they provide up to date.',
      'Create a purchase order with the expected quantities, costs, and delivery details.',
      'Review restock requests and approve, decline, or fulfil them with a clear audit trail.',
      'Record received stock so inventory reflects what physically arrived.',
    ],
  },
  {
    title: 'Stocktakes & transfers',
    description: 'Count physical stock, resolve differences, and move stock between locations.',
    icon: ClipboardCheck,
    href: '/inventory/stocktakes',
    linkLabel: 'Open stocktakes',
    access: 'Store manager+',
    steps: [
      'Start a stocktake for the correct location and count the physical quantity of every listed item.',
      'Review variances before finalising; correct counting errors rather than accepting a known mismatch.',
      'Use transfers when stock physically moves between locations so both balances remain accurate.',
    ],
    tips: ['Avoid receiving deliveries or making transfers during an active count where possible.'],
  },
  {
    title: 'Reports',
    description: 'Understand performance through headline metrics, report library, comparisons, and top-item analysis.',
    icon: BarChart3,
    href: '/reports',
    linkLabel: 'View reports',
    access: 'Store manager+',
    steps: [
      'Set the reporting period and location scope before interpreting a result.',
      'Use the report library for a focused metric or top-items view.',
      'Use Compare to place periods or locations side by side on a consistent basis.',
      'Check operational context before acting on a single change in a chart.',
    ],
  },
  {
    title: 'Customer communications',
    description: 'Connect email, build reusable templates, automate messages, and review delivery history.',
    icon: Mail,
    href: '/communications',
    linkLabel: 'Open communications',
    access: 'Owner, manager, or marketing',
    steps: [
      'Complete the email connection checklist before trying to send a campaign or automation.',
      'Create a template and use supported customer variables for personalisation.',
      'Preview the final email before enabling an automation.',
      'Review History for sent, failed, or pending messages and resolve repeated delivery problems.',
    ],
  },
  {
    title: 'Workspaces & locations',
    description: 'Structure the organisation, create locations, and control where teams operate.',
    icon: Building2,
    href: '/workspaces',
    linkLabel: 'Manage workspaces',
    access: 'Franchise owner+',
    steps: [
      'Use a workspace for the business or franchise and add each operating site as a location.',
      'Complete each location record so staff, stock, reporting, and service data are scoped correctly.',
      'Assign staff only to the locations they need, then verify their access after changes.',
    ],
  },
  {
    title: 'Audit log',
    description: 'A record of who changed what, used when a figure, price, or permission needs explaining.',
    icon: ClipboardCheck,
    href: '/audit-log',
    linkLabel: 'Open audit log',
    access: 'Franchise owner and above',
    steps: [
      'Narrow the log to the period you are investigating before reading individual entries.',
      'Match the entry to the record it changed — an order, a price, a stock figure, or an account.',
      'Use the actor and timestamp to follow up with the person who made the change.',
    ],
    tips: ['Check here first when two people disagree about what a figure used to be.'],
  },
];

const peopleTopics: GuideTopic[] = [
  {
    title: 'My rota',
    description: 'See your own scheduled shifts and upcoming working pattern.',
    icon: CalendarDays,
    href: '/scheduling',
    linkLabel: 'View my rota',
    steps: [
      'Check the date range and location for every upcoming shift.',
      'Open My HR if you need to request leave or raise an attendance correction.',
      'Contact your manager promptly when a shift or location looks incorrect.',
    ],
  },
  {
    title: 'My HR',
    description: 'Your personal home for leave, attendance, learning, documents, and private helpdesk requests.',
    icon: HeartHandshake,
    href: '/my-hr',
    linkLabel: 'Open My HR',
    steps: [
      'Use Overview to check open actions and your recent people information.',
      'Submit leave with the correct dates and explain anything the approver needs to know.',
      'Review attendance before requesting a correction to a missed or incorrect clock event.',
      'Use Helpdesk for a private HR request and continue the conversation on the same ticket.',
    ],
  },
  {
    title: 'Staff, rota & payroll',
    description: 'Manage employee records, team cover, leave, attendance, HR tickets, and payroll runs.',
    icon: UsersRound,
    href: '/staff',
    linkLabel: 'Open staff workspace',
    access: 'People manager access',
    steps: [
      'Keep each employee record, role, scope, and assigned locations current.',
      'Build the team rota and use coverage information to find gaps before publishing.',
      'Review leave and helpdesk requests from their dedicated tabs.',
      'Check payroll inputs and exceptions carefully before finalising or exporting a run.',
    ],
  },
  {
    title: 'Training & compliance',
    description: 'Complete assigned learning, maintain courses, and monitor required training.',
    icon: GraduationCap,
    href: '/training',
    linkLabel: 'Open training',
    steps: [
      'Open your assigned course, work through each lesson, and complete the required content.',
      'Managers can create courses and organise lessons from the Courses area.',
      'Use Compliance to identify overdue, incomplete, or soon-to-expire requirements.',
    ],
  },
  {
    title: 'Settings & security',
    description: 'Personalise DUMA, configure this device, install the app, and protect your account.',
    icon: Settings,
    href: '/settings',
    linkLabel: 'Open settings',
    steps: [
      'Choose light, dark, or system appearance and adjust page chrome preferences.',
      'Configure device-specific POS scanner and KDS sound options before putting a device into service.',
      'Install DUMA from the App section when the browser offers it.',
      'Review signed-in sessions and revoke devices you no longer recognise or use.',
    ],
    tips: ['Shared terminals should use the appropriate staff account and be signed out when no longer supervised.'],
  },
  {
    title: 'Helpdesk requests',
    description: 'Raise a tracked request for HR, payroll, scheduling, workplace, or IT help, and follow the reply.',
    icon: Headphones,
    href: '/my-hr?tab=helpdesk',
    linkLabel: 'Open helpdesk',
    steps: [
      'Choose the category that matches your problem so it reaches the right person.',
      'Set the priority honestly — urgent is for work that cannot continue.',
      'Describe what you expected, what happened, and the time it happened.',
      'Reply on the same request rather than raising a second one for the same issue.',
    ],
    tips: ['A request keeps its history, so anyone picking it up later can see the full conversation.'],
  },
];

const accessAreas: AccessArea[] = [
  { area: 'Dashboard, POS, KDS', detail: 'Serving customers and seeing today’s activity.', who: ['Everyone'] },
  { area: 'My HR, My Rota, Training', detail: 'Your own leave, attendance, shifts, documents and learning.', who: ['Everyone'] },
  { area: 'Support', detail: 'This help centre and the request form.', who: ['Everyone'] },
  {
    area: 'Orders, Customers, Menu, Inventory, Reports',
    detail: 'Trading history, customer records, the menu, stock and analysis.',
    who: ['Store manager', 'Franchise owner', 'Super admin'],
  },
  {
    area: 'Communications',
    detail: 'Customer email templates, automations and delivery history.',
    who: ['Marketing manager', 'Store manager', 'Franchise owner', 'Super admin'],
  },
  {
    area: 'Staff — team, rota, shifts',
    detail: 'Employee records, team cover and shift management.',
    who: ['Store manager', 'HR manager', 'Franchise owner', 'Super admin'],
  },
  {
    area: 'Staff — leave, helpdesk, payroll',
    detail: 'Approving leave, triaging HR requests and running payroll.',
    who: ['HR manager', 'Franchise owner', 'Super admin'],
  },
  {
    area: 'Pay, bank details, payslips',
    detail: 'Money held on an employee record, wherever it appears.',
    who: ['HR manager', 'Franchise owner', 'Super admin'],
  },
  {
    area: 'Workspaces & locations, Audit log',
    detail: 'Creating locations, staff access and reviewing who changed what.',
    who: ['Franchise owner', 'Super admin'],
  },
];

const playbooks: Playbook[] = [
  {
    symptom: 'The POS is offline mid-service',
    cause: 'The device lost its connection. DUMA keeps serving and queues eligible orders on that device.',
    icon: WifiOff,
    steps: [
      'Carry on taking orders — the offline indicator shows the app is queueing rather than failing.',
      'Leave the DUMA tab open. Closing the browser stops queued orders from syncing.',
      'When the connection returns, wait for the queue to clear rather than re-entering orders.',
      'Confirm each order appears in Orders before assuming it was lost.',
    ],
    href: '/orders',
    linkLabel: 'Check orders',
  },
  {
    symptom: 'A queued offline order will not sync',
    cause: 'The sync stopped because the session expired, or the order needs a decision.',
    icon: RefreshCw,
    steps: [
      'Sign in again if you were signed out — syncing pauses rather than discarding the order.',
      'Read the status shown against the queued order: some need attention rather than another retry.',
      'If it still fails, note the customer, items and time before contacting support.',
    ],
  },
  {
    symptom: 'I was signed out unexpectedly',
    cause: 'The session expired or was revoked on another device.',
    icon: ShieldCheck,
    steps: [
      'Sign in again — you are returned to the page you were on.',
      'Check Settings for sessions you do not recognise and revoke them.',
      'On a shared terminal, sign in with the account that should be recorded against the orders.',
    ],
    href: '/settings',
    linkLabel: 'Open settings',
  },
  {
    symptom: 'A page in this guide is missing for me',
    cause: 'Pages follow your role and your assigned locations.',
    icon: KeyRound,
    steps: [
      'Check the Roles & access tab to see who can open that area.',
      'Confirm the correct location is selected in the top bar.',
      'Ask a manager to review your role and location assignment if it should be available.',
    ],
  },
  {
    symptom: 'A menu item is missing from the POS',
    cause: 'Items are enabled per location, and an item can be hidden or out of stock.',
    icon: UtensilsCrossed,
    steps: [
      'Confirm the POS is on the right location.',
      'Open Menu and check the item is active for that location.',
      'Check the linked stock item is available — an ingredient at zero can take an item off sale.',
    ],
    href: '/menu',
    linkLabel: 'Open menu',
  },
  {
    symptom: 'Stock figures do not match the shelf',
    cause: 'On-hand is the sum of open containers, so unrecorded waste or deliveries show up as a gap.',
    icon: Boxes,
    steps: [
      'Open the item and read its containers — each one carries its own remaining balance.',
      'Record any waste or breakage as a loss so the reason is kept with the movement.',
      'Receive deliveries as containers rather than adjusting a total by hand.',
      'Use a stocktake to correct the count, then read the variance to see what was missed.',
    ],
    href: '/inventory',
    linkLabel: 'Open inventory',
  },
  {
    symptom: 'A delivery arrived but stock did not increase',
    cause: 'A purchase order only moves stock when the delivery is received against it.',
    icon: Truck,
    steps: [
      'Open the purchase order and check its status — submitted means nothing has arrived yet.',
      'Use Receive goods and enter what physically turned up, per line.',
      'Enter expiry dates for perishable lines; they drive the expiry warnings later.',
      'Part deliveries are normal: receive what came and the rest stays outstanding.',
    ],
    href: '/inventory/purchasing',
    linkLabel: 'Open purchasing',
  },
  {
    symptom: 'Customer emails are not arriving',
    cause: 'Email needs a connected mail account, an active template and an enabled automation.',
    icon: Mail,
    steps: [
      'Check the connection state in Communications — the header shows whether email is set up.',
      'Confirm the template is in use and the automation is switched on.',
      'Open History and read the status against the message: failed entries show the reason.',
      'Use Try again on a failed delivery once the cause is fixed.',
    ],
    href: '/communications',
    linkLabel: 'Open communications',
  },
  {
    symptom: 'A loyalty code will not scan',
    cause: 'The camera or scanner is not set up on that device, or the customer has no record yet.',
    icon: Users,
    steps: [
      'Check the scanner and camera choice in Settings for that device.',
      'Search the customer by phone number or name instead of scanning.',
      'Create a record only after searching, so you do not end up with duplicates.',
    ],
    href: '/customers',
    linkLabel: 'Open customers',
  },
  {
    symptom: 'Loyalty points look wrong',
    cause: 'Points move with orders, and a manual adjustment is a deliberate correction.',
    icon: Sparkles,
    steps: [
      'Open the customer and read their recent orders and points balance together.',
      'Adjust points only to correct a real error, and write the reason.',
      'Remember tier progress is measured against the points thresholds, not spend alone.',
    ],
    href: '/customers',
    linkLabel: 'Open customers',
  },
  {
    symptom: 'The KDS is not showing new orders',
    cause: 'The screen needs DUMA open and on the right location.',
    icon: ChefHat,
    steps: [
      'Confirm the KDS device is on the location taking the orders.',
      'Keep the KDS page open during service rather than switching tabs.',
      'Check the device is online — the offline indicator appears when it is not.',
    ],
    href: '/kds',
    linkLabel: 'Open KDS',
  },
  {
    symptom: 'My hours or leave balance look wrong',
    cause: 'Hours come from clock events and leave from your entitlement, so both are corrected by a person.',
    icon: CalendarDays,
    steps: [
      'Check Attendance in My HR for the day in question.',
      'Raise an attendance correction from that day rather than emailing separately.',
      'For a balance, check the entitlement year shown before reporting a difference.',
    ],
    href: '/my-hr',
    linkLabel: 'Open My HR',
  },
  {
    symptom: 'I want DUMA to open like an app',
    cause: 'DUMA installs to the home screen or desktop from the browser.',
    icon: Monitor,
    steps: [
      'Open Settings and use the install option when the browser offers it.',
      'On iPad or iPhone, use Share then Add to Home Screen.',
      'Sign in once installed so the account is available for offline use on that device.',
    ],
    href: '/settings',
    linkLabel: 'Open settings',
  },
];

const glossary: GlossaryEntry[] = [
  {
    term: 'Workspace',
    definition: 'The business DUMA holds your data under. Everything you see belongs to one workspace.',
    group: 'Workspace',
  },
  {
    term: 'Location',
    definition: 'A single site. The location picker in the top bar decides which site you are working in.',
    group: 'Workspace',
  },
  { term: 'Role', definition: 'What your account may do. Roles rank, so a higher role generally sees more.', group: 'Workspace' },
  {
    term: 'Scope',
    definition: 'How far a role reaches — one location, a franchise, or everything in the workspace.',
    group: 'Workspace',
  },
  { term: 'Audit entry', definition: 'A record of a change: who made it, what changed, and when.', group: 'Workspace' },
  { term: 'Source', definition: 'Where an order came from, such as the POS or a mobile order.', group: 'Service' },
  {
    term: 'Order status',
    definition: 'Pending, preparing, ready, done or cancelled — the fulfilment stage of an order.',
    group: 'Service',
  },
  {
    term: 'Modifier',
    definition: 'A choice attached to a menu item, like a size or a milk. Modifiers can change the price.',
    group: 'Service',
  },
  { term: 'Recipe', definition: 'The ingredients behind a menu item, used to consume stock and estimate cost.', group: 'Service' },
  {
    term: 'Offline queue',
    definition: 'Orders held on a device while it has no connection, sent automatically once it returns.',
    group: 'Service',
  },
  { term: 'Stock item', definition: 'Something you hold, defined once for the workspace with its unit of measure.', group: 'Stock' },
  {
    term: 'Container (stock unit)',
    definition: 'One physical unit of a stock item — a bag, bottle or box — with its own remaining balance, lot and expiry.',
    group: 'Stock',
  },
  { term: 'On hand', definition: 'The total left across a location’s open containers of an item.', group: 'Stock' },
  {
    term: 'FEFO',
    definition: 'First expired, first out: containers are consumed in expiry order so the oldest stock goes first.',
    group: 'Stock',
  },
  { term: 'Reorder threshold', definition: 'The level at which an item is treated as low and needs ordering.', group: 'Stock' },
  {
    term: 'Restock request',
    definition: 'A request to buy more of an item. It moves from pending to approved, then to ordered once it is on a purchase order.',
    group: 'Stock',
  },
  {
    term: 'Purchase order',
    definition: 'An order to a supplier. Draft, submitted, part received, received or cancelled.',
    group: 'Stock',
  },
  { term: 'Loss', definition: 'Stock written off with a reason: waste, expiry, damage or theft.', group: 'Stock' },
  { term: 'Stocktake variance', definition: 'The difference between the counted quantity and what DUMA expected.', group: 'Stock' },
  { term: 'Transfer', definition: 'Stock moved between locations. It leaves one and arrives at the other when completed.', group: 'Stock' },
  { term: 'Employment type', definition: 'Full time, part time, contractor or zero hours, held on the employee record.', group: 'People' },
  { term: 'Entitlement', definition: 'The leave days available to someone for a given year.', group: 'People' },
  {
    term: 'Attendance status',
    definition: 'How a shift was worked: full, partial, missed, approved leave, or no shift scheduled.',
    group: 'People',
  },
  {
    term: 'Practical sign-off',
    definition: 'Training that a manager must observe and approve rather than something you can mark complete yourself.',
    group: 'People',
  },
  {
    term: 'Helpdesk request',
    definition: 'A tracked conversation with HR or support, with a status and a full history.',
    group: 'People',
  },
  { term: 'Loyalty points', definition: 'The balance a customer can earn and spend. Adjustments are manual corrections.', group: 'Customers' },
  { term: 'Tier', definition: 'Bronze, silver, gold or VIP, reached at set points thresholds.', group: 'Customers' },
  {
    term: 'Delivery status',
    definition: 'What happened to an email: queued, sending, sent, failed or cancelled.',
    group: 'Customers',
  },
  { term: 'Automation', definition: 'A rule that sends a template when something happens, such as an order being ready.', group: 'Customers' },
];

const faqs = [
  {
    question: 'Why can’t I see a page mentioned in this guide?',
    answer:
      'DUMA shows tools according to your role and assigned locations. For example, customer, order, inventory, and reporting tools need manager access, while workspace administration needs franchise-owner access. Ask your manager to check your role and location assignment.',
  },
  {
    question: 'How do I change the location I am working in?',
    answer:
      'Use the location picker in the top bar. Always confirm it before taking orders, counting stock, receiving deliveries, or reading location-specific reports. If the location is missing, your staff assignment may need updating.',
  },
  {
    question: 'What happens if the POS loses its internet connection?',
    answer:
      'DUMA displays its offline state and can queue eligible orders on that device. Keep the app open and reconnect as soon as possible; queued orders will attempt to sync automatically. Confirm that the order appears in Orders after the connection returns before re-entering it.',
  },
  {
    question: 'Why is a menu item missing from the POS?',
    answer:
      'Check that the correct location is active, the item is available, and its menu setup is complete. Review its modifier requirements and recipe, then reload the POS. A user without menu access should ask a store manager to make these checks.',
  },
  {
    question: 'Why do the KDS and POS show different information?',
    answer:
      'First confirm both devices are using the same location and are online. Refresh the KDS, then inspect the order in Orders for its recorded status. If the mismatch remains, email support with the order number, location, approximate time, and screenshots from both devices.',
  },
  {
    question: 'How should I correct loyalty points?',
    answer:
      'Open the customer record, use the points adjustment action, enter only the amount needed to correct the balance, and record a useful reason. Check for duplicate customer records or an unsynced order before making a manual adjustment.',
  },
  {
    question: 'Why do stock figures look wrong?',
    answer:
      'Check the selected location, recent deliveries, transfers, stocktakes, and recipe quantities. Confirm physical stock and review the item’s units and usage before changing a balance. If several items shifted together, look for an unfinished stocktake or transfer.',
  },
  {
    question: 'Can I install DUMA on a tablet or desktop?',
    answer:
      'Yes. Open Settings → App and use Install DUMA when available. On iPhone or iPad, use the browser Share menu and choose Add to Home Screen. Installation is especially useful for dedicated POS and KDS devices.',
  },
  {
    question: 'How do I report a leave or attendance problem?',
    answer:
      'Open My HR. Use Leave for a new request and Attendance for a clocking correction. For a private or more complex issue, raise a Helpdesk ticket and keep replies in that ticket so the history stays together.',
  },
  {
    question: 'What should I include when contacting support?',
    answer:
      'Include your name, workspace and location, the page you were using, what you expected, what happened instead, the approximate time, and any order or customer reference. Add a screenshot of the full page when possible, but never include passwords or payment-card details.',
  },
  {
    question: 'Should I email support or raise a request?',
    answer:
      'Raise a request for anything about your work — HR, payroll, scheduling, workplace or IT. It keeps a status and a history, and the reply stays on the same request. Email support when DUMA itself is not working and you cannot get far enough into the app to raise a request.',
  },
  {
    question: 'Why does the same figure differ between two pages?',
    answer:
      'Almost always the location or the date range differs. Check the location picker in the top bar and the period control on the page. Reports compare the period you choose against the equivalent period immediately before it, so the comparison figure changes when the period does.',
  },
  {
    question: 'What is a container, and why not just edit the total?',
    answer:
      'A container is one physical bag, bottle or box with its own remaining balance, lot and expiry. On-hand is the sum of them, which is what makes expiry warnings and first-expired-first-out consumption possible. Receiving deliveries and recording losses keeps that structure intact; editing a total by hand does not.',
  },
  {
    question: 'How do approved restock requests become a purchase order?',
    answer:
      'From Purchasing, open the approved list and create a purchase order from one request, or combine every approved request for one location into a single order. Requests move to ordered once the order is created. A purchase order only changes stock when the delivery is received against it.',
  },
  {
    question: 'Who can see pay, bank details and payslips?',
    answer:
      'Only HR managers, franchise owners and super admins, wherever that information appears. A store manager can manage the team and the rota without seeing pay. This is deliberate and is not something a manager can grant locally.',
  },
  {
    question: 'Can I use DUMA on more than one device at a time?',
    answer:
      'Yes. Each device keeps its own settings — scanner choice, KDS sound, appearance — while your data stays shared. Review the signed-in sessions in Settings occasionally and revoke any device you no longer use.',
  },
  {
    question: 'Does DUMA work with no internet at all?',
    answer:
      'Partly. Pages you have already opened stay available on that device and the POS can queue eligible orders. Anything that needs fresh data from the server — reports, history, most management pages — needs a connection. Keep the app open until the queue clears.',
  },
  {
    question: 'How do I get a new starter set up?',
    answer:
      'Onboard them from the Staff workspace, which creates the account and the employment record together. The team list shows what is still missing on each record, and pay-affecting gaps are flagged so payroll is not run on an incomplete record.',
  },
];

const allTopics = [...serviceTopics, ...managementTopics, ...peopleTopics];

const roleLabels: Record<StaffRole, string> = {
  super_admin: 'Super admin',
  franchise_owner: 'Franchise owner',
  store_manager: 'Store manager',
  barista: 'Team member',
  hr_manager: 'HR manager',
  marketing_manager: 'Marketing manager',
  auditor: 'Auditor',
};

function TopicCard({ topic }: { topic: GuideTopic }) {
  const Icon = topic.icon;

  return (
    <article className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{topic.title}</h3>
            {topic.access && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {topic.access}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{topic.description}</p>
        </div>
      </div>

      <ol className="mt-5 space-y-3">
        {topic.steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-5 text-foreground">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-[10px] font-bold text-muted-foreground">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {topic.tips?.map((tip) => (
        <p key={tip} className="mt-4 rounded-xl bg-info-highlight px-3 py-2.5 text-xs leading-5 text-info">
          <span className="font-semibold">Good to know:</span> {tip}
        </p>
      ))}

      <Link href={topic.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        {topic.linkLabel}
        <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </article>
  );
}

function GuideGrid({ topics }: { topics: GuideTopic[] }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      {topics.map((topic) => (
        <TopicCard key={topic.title} topic={topic} />
      ))}
    </div>
  );
}

/**
 * Requests the viewer has already raised. Without this, someone coming back to
 * check on a problem has no way in from here — only another way to report it.
 */
function OpenRequests() {
  const { data: tickets = [] } = useQuery({ queryKey: ['helpdesk-my'], queryFn: getMyTickets });
  const open = tickets.filter((ticket) => isOpenStatus(ticket.status));
  if (open.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-foreground">Your open requests</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Already with the team — pick one up where you left off.</p>
        </div>
        <Link href="/my-hr?tab=helpdesk" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          Open helpdesk
        </Link>
      </div>
      <ul className="divide-y divide-border/60">
        {open.slice(0, 4).map((ticket) => (
          <li key={ticket.id}>
            <Link href="/my-hr?tab=helpdesk" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-offset/50">
              <span className="font-mono text-[11px] font-bold text-muted-foreground">{ticketKey(ticket)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{ticket.subject}</span>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">{fmtAgo(ticket.updatedAt)}</span>
              <StatusLozenge status={ticket.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TAB_VALUES = tabs.map((tab) => tab.value);

export function SupportGuide({ role }: { role: StaffRole | null }) {
  // `?tab=guides` lets an article return to the section it was opened from.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<GuideTab>(
    TAB_VALUES.includes(requestedTab as GuideTab) ? (requestedTab as GuideTab) : 'overview',
  );
  const [query, setQuery] = useState('');
  const normalisedQuery = query.trim().toLowerCase();
  const isManager = roleAtLeast(role, 'store_manager');
  const isOwner = roleAtLeast(role, 'franchise_owner');

  const searchResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return allTopics.filter((topic) =>
      [topic.title, topic.description, topic.access, ...topic.steps, ...(topic.tips ?? [])]
        .join(' ')
        .toLowerCase()
        .includes(normalisedQuery),
    );
  }, [normalisedQuery]);

  const faqResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return faqs.filter((item) => `${item.question} ${item.answer}`.toLowerCase().includes(normalisedQuery));
  }, [normalisedQuery]);

  // Search reaches the fixes and the glossary too, so a symptom or a term finds them.
  const playbookResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return playbooks.filter((item) => `${item.symptom} ${item.cause} ${item.steps.join(' ')}`.toLowerCase().includes(normalisedQuery));
  }, [normalisedQuery]);

  const glossaryResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return glossary.filter((item) => `${item.term} ${item.definition}`.toLowerCase().includes(normalisedQuery));
  }, [normalisedQuery]);

  // Articles match on their body too, so a phrase inside a guide still finds it.
  const articleResults = useMemo(() => {
    if (!normalisedQuery) return [];
    return SUPPORT_ARTICLES.filter((item) =>
      `${item.title} ${item.summary} ${item.category} ${item.body}`.toLowerCase().includes(normalisedQuery),
    );
  }, [normalisedQuery]);

  const resultCount =
    searchResults.length + faqResults.length + playbookResults.length + glossaryResults.length + articleResults.length;

  const supportHref =
    'mailto:support@duma.coffee?subject=DUMA%20support%20request&body=Name%3A%0AWorkspace%20and%20location%3A%0APage%20or%20feature%3A%0AWhat%20I%20was%20trying%20to%20do%3A%0AWhat%20happened%3A%0AApproximate%20time%3A%0AOrder%20or%20customer%20reference%20(if%20relevant)%3A%0A%0APlease%20attach%20a%20screenshot%20if%20it%20is%20safe%20to%20do%20so.';

  return (
    <EditorShell
      eyebrow="DUMA help centre"
      title="Support"
      icon={<LifeBuoy size={20} aria-hidden="true" />}
      meta={
        <span className="text-xs text-muted-foreground">
          Guides, feature reference and quick answers
          {role && ` · tailored for your ${roleLabels[role].toLowerCase()} account`}
        </span>
      }
      actions={
        <>
          <Button asChild variant="outline" className="h-10 gap-1.5">
            <a href={supportHref}>
              <Mail size={15} aria-hidden="true" />
              <span className="hidden md:inline">Email support</span>
            </a>
          </Button>
          {/* The app's own ticket queue — a tracked request beats an untracked email. */}
          <Button asChild className="h-10 gap-1.5">
            <Link href="/my-hr?tab=helpdesk">
              <MessageSquarePlus size={15} aria-hidden="true" />
              <span className="hidden md:inline">Raise a request</span>
            </Link>
          </Button>
        </>
      }
      subheader={
        <SectionTabs
          tabs={tabs}
          value={normalisedQuery ? ('search' as GuideTab) : activeTab}
          onChange={(next) => {
            setQuery('');
            setActiveTab(next);
          }}
          ariaLabel="Help centre sections"
        />
      }
    >
      {/* No inner max width — the shell body already centres and pads the content. */}
      <div>
        {/* Search across every guide and FAQ, whichever section you are in */}
        <div className="mb-6 max-w-2xl">
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            leftIcon={<Search size={15} />}
            placeholder="Search guides, features, and common questions…"
            aria-label="Search the help centre"
            rightAction={
              query ? (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              ) : undefined
            }
          />
        </div>

        {normalisedQuery ? (
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search results</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground">
              {resultCount ? `${resultCount} result${resultCount === 1 ? '' : 's'} for “${query.trim()}”` : `No results for “${query.trim()}”`}
            </h2>
            {articleResults.length > 0 && (
              <div className="mt-5 grid items-start gap-4 md:grid-cols-2">
                {articleResults.map((item) => (
                  <ArticleCard key={item.slug} article={item} />
                ))}
              </div>
            )}
            {searchResults.length > 0 && (
              <div className="mt-6">
                <GuideGrid topics={searchResults} />
              </div>
            )}
            {playbookResults.length > 0 && (
              <div className="mt-6 grid items-start gap-4 lg:grid-cols-2">
                {playbookResults.map((item) => (
                  <PlaybookCard key={item.symptom} playbook={item} />
                ))}
              </div>
            )}
            {glossaryResults.length > 0 && (
              <div className="mt-6">
                <GlossaryGrid entries={glossaryResults} />
              </div>
            )}
            {faqResults.length > 0 && (
              <div className="mt-6 space-y-3">
                {faqResults.map((item) => (
                  <FaqItem key={item.question} {...item} />
                ))}
              </div>
            )}
            {resultCount === 0 && (
              <div className="mt-5 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                <CircleHelp className="mx-auto text-muted-foreground" size={24} aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Try a feature name such as “POS”, “stock”, “rota”, or “password”.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  You can also email support and the message will open with a useful checklist.
                </p>
              </div>
            )}
          </section>
        ) : (
          <>
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <OpenRequests />
                <section>
                  <div className="flex items-center gap-2">
                    <Sparkles size={17} className="text-primary" aria-hidden="true" />
                    <h2 className="text-xl font-semibold text-foreground">A good place to begin</h2>
                  </div>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                    DUMA keeps work organised by workspace, location, and staff role. Start every task by checking the active location; the
                    pages and actions you can see then reflect your access.
                  </p>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <OverviewCard
                      number="01"
                      icon={Building2}
                      title="Check your location"
                      description="The location picker controls which service, stock, and reporting data you are working with."
                    />
                    <OverviewCard
                      number="02"
                      icon={LayoutDashboard}
                      title="Use the dashboard"
                      description="Start here to understand the current situation and follow alerts into the right workspace."
                    />
                    <OverviewCard
                      number="03"
                      icon={ShieldCheck}
                      title="Know your access"
                      description="If a tool is missing, your role or location assignment may not include it."
                    />
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-5 md:p-7">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Recommended next step</p>
                      <h2 className="mt-1 text-lg font-semibold text-foreground">
                        {isOwner
                          ? 'Set up and review your locations'
                          : isManager
                            ? 'Review today’s operations'
                            : 'Get ready for your shift'}
                      </h2>
                      <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                        {isOwner
                          ? 'Confirm workspace locations and staff access before moving into menu, stock, and reporting.'
                          : isManager
                            ? 'Check service activity and alerts, then make sure the menu, stock, rota, and terminals are ready.'
                            : 'Check your rota and dashboard, then open the POS or KDS assigned to your station.'}
                      </p>
                    </div>
                    <Link
                      href={isOwner ? '/workspaces' : '/dashboard'}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      {isOwner ? 'Open workspaces' : 'Open dashboard'}
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </div>
                </section>

                <section>
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground">Start with a walkthrough</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        The workflows that cause the most confusion, explained end to end.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('guides')}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      All {SUPPORT_ARTICLES.length} guides
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {SUPPORT_ARTICLES.slice(0, 3).map((article) => (
                      <ArticleCard key={article.slug} article={article} />
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="text-xl font-semibold text-foreground">Choose what you need</h2>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <BrowseCard
                      icon={Monitor}
                      title="Run service"
                      description="POS, KDS, orders, and customers"
                      onClick={() => setActiveTab('service')}
                    />
                    <BrowseCard
                      icon={Boxes}
                      title="Manage the business"
                      description="Menu, stock, purchasing, reports, and locations"
                      onClick={() => setActiveTab('management')}
                    />
                    <BrowseCard
                      icon={UsersRound}
                      title="People & account"
                      description="Rota, HR, training, settings, and security"
                      onClick={() => setActiveTab('people')}
                    />
                    <BrowseCard
                      icon={FileText}
                      title="In-depth guides"
                      description="Full walkthroughs of the trickier workflows"
                      onClick={() => setActiveTab('guides')}
                    />
                    <BrowseCard
                      icon={KeyRound}
                      title="Roles & access"
                      description="Who can open what, and why something is missing"
                      onClick={() => setActiveTab('access')}
                    />
                    <BrowseCard
                      icon={Wrench}
                      title="Fix a problem"
                      description="Offline orders, stock gaps, emails, scanning"
                      onClick={() => setActiveTab('fix')}
                    />
                    <BrowseCard
                      icon={BookMarked}
                      title="Glossary"
                      description="Containers, FEFO, tiers, entitlements"
                      onClick={() => setActiveTab('glossary')}
                    />
                    <BrowseCard
                      icon={CircleHelp}
                      title="Common questions"
                      description="Quick answers to what gets asked most"
                      onClick={() => setActiveTab('faq')}
                    />
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center gap-2">
                      <WifiOff size={17} className="text-warning" aria-hidden="true" />
                      <h2 className="font-semibold text-foreground">If something goes wrong</h2>
                    </div>
                    <ol className="mt-4 space-y-2.5 text-sm leading-5 text-muted-foreground">
                      <li>1. Confirm the device is online and the correct location is selected.</li>
                      <li>2. Refresh the page once and check whether the action was already recorded.</li>
                      <li>3. Note the time and any order, customer, or stock reference.</li>
                      <li>4. Take a safe screenshot, then contact support if the problem remains.</li>
                    </ol>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <div className="flex items-center gap-2">
                      <Headphones size={17} className="text-primary" aria-hidden="true" />
                      <h2 className="font-semibold text-foreground">Support checklist</h2>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Tell us who you are, your location, what you were doing, what happened, and when. Never send a password or full
                      payment-card details.
                    </p>
                    <a
                      href={supportHref}
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                    >
                      Start a support email
                      <ArrowRight size={14} aria-hidden="true" />
                    </a>
                  </div>
                </section>
              </div>
            )}

            {activeTab === 'service' && (
              <GuideSection
                eyebrow="Daily operations"
                title="Run a smooth service"
                description="The tools used before, during, and immediately after serving customers."
              >
                <GuideGrid topics={serviceTopics} />
              </GuideSection>
            )}

            {activeTab === 'management' && (
              <GuideSection
                eyebrow="Management guide"
                title="Keep the business accurate and ready"
                description="Manage the menu, purchasing, inventory, communications, reporting, and organisation structure."
              >
                <GuideGrid topics={managementTopics} />
              </GuideSection>
            )}

            {activeTab === 'people' && (
              <GuideSection
                eyebrow="People & account"
                title="Work, learning, and personal settings"
                description="Everything from an individual rota to staff operations, training, device setup, and account security."
              >
                <GuideGrid topics={peopleTopics} />
              </GuideSection>
            )}

            {activeTab === 'guides' && (
              <GuideSection
                eyebrow="In-depth guides"
                title="Walkthroughs worth reading once"
                description="Longer articles on the workflows that cause the most confusion. Open one for the full explanation."
              >
                <div className="space-y-7">
                  {ARTICLE_CATEGORIES.map((category) => {
                    const articles = SUPPORT_ARTICLES.filter((article) => article.category === category);
                    if (articles.length === 0) return null;
                    return (
                      <section key={category}>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">{category}</h3>
                        <div className="mt-3 grid items-start gap-4 md:grid-cols-2">
                          {articles.map((article) => (
                            <ArticleCard key={article.slug} article={article} />
                          ))}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </GuideSection>
            )}

            {activeTab === 'access' && (
              <GuideSection
                eyebrow="Roles & access"
                title="Who can open what"
                description="Access follows your role and your assigned locations. If an area is missing for you, this is why."
              >
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-2xl border border-border bg-card">
                    <div className="hidden border-b border-border bg-muted/60 px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:gap-4">
                      <span>Area</span>
                      <span>Who can open it</span>
                    </div>
                    <ul className="divide-y divide-border/60">
                      {accessAreas.map((entry) => (
                        <li key={entry.area} className="grid gap-2 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground">{entry.area}</p>
                            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{entry.detail}</p>
                          </div>
                          <div className="flex flex-wrap items-start gap-1.5">
                            {entry.who.map((who) => (
                              <span
                                key={who}
                                className={cn(
                                  'inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-semibold',
                                  role && who === roleLabels[role]
                                    ? 'border-primary/40 bg-primary/10 text-primary'
                                    : 'border-border bg-background text-muted-foreground',
                                )}
                              >
                                {who}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={17} className="text-primary" aria-hidden="true" />
                        <h3 className="font-semibold text-foreground">Two things decide what you see</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Your <span className="font-semibold text-foreground">role</span> decides which areas exist for you. Your{' '}
                        <span className="font-semibold text-foreground">assigned locations</span> decide whose data you see inside them. A
                        missing figure is often the location picker rather than a permission.
                      </p>
                      {role && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          You are signed in as <span className="font-semibold text-foreground">{roleLabels[role]}</span>, highlighted above.
                        </p>
                      )}
                    </div>
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                      <div className="flex items-center gap-2">
                        <KeyRound size={17} className="text-primary" aria-hidden="true" />
                        <h3 className="font-semibold text-foreground">Need more access?</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Ask a manager or owner to change your role or add a location — it is not something you can grant yourself. Pay and
                        bank details are restricted by design and stay restricted even for a store manager.
                      </p>
                      <Link href="/my-hr?tab=helpdesk" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
                        Raise an access request
                        <ArrowRight size={14} aria-hidden="true" />
                      </Link>
                    </div>
                  </div>
                </div>
              </GuideSection>
            )}

            {activeTab === 'fix' && (
              <GuideSection
                eyebrow="Troubleshooting"
                title="Fix a problem"
                description="The things that go wrong most often, what is actually happening, and the order to work through."
              >
                <div className="grid items-start gap-4 lg:grid-cols-2">
                  {playbooks.map((item) => (
                    <PlaybookCard key={item.symptom} playbook={item} />
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-warning/25 bg-warning/5 p-5">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={17} className="text-warning" aria-hidden="true" />
                    <h3 className="font-semibold text-foreground">Before you re-enter anything</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Check whether the action was already recorded. Re-entering an order, a delivery or a points adjustment is far harder to
                    unpick than waiting a moment and refreshing.
                  </p>
                </div>
              </GuideSection>
            )}

            {activeTab === 'glossary' && (
              <GuideSection
                eyebrow="Glossary"
                title="What the words mean"
                description="Plain definitions for the terms DUMA uses on screen, grouped by where you meet them."
              >
                <div className="space-y-7">
                  {(['Workspace', 'Service', 'Stock', 'People', 'Customers'] as const).map((group) => {
                    const entries = glossary.filter((entry) => entry.group === group);
                    if (entries.length === 0) return null;
                    return (
                      <section key={group}>
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-primary">{group}</h3>
                        <div className="mt-3">
                          <GlossaryGrid entries={entries} />
                        </div>
                      </section>
                    );
                  })}
                </div>
              </GuideSection>
            )}

            {activeTab === 'faq' && (
              <GuideSection
                eyebrow="Questions & answers"
                title="Quick answers to common questions"
                description="Open a question for a concise explanation. Search above when you need a specific feature."
              >
                <div className="space-y-3">
                  {faqs.map((item) => (
                    <FaqItem key={item.question} {...item} />
                  ))}
                </div>
                <div className="mt-6 rounded-2xl border border-primary/20 bg-primary/5 p-5 md:flex md:items-center md:justify-between md:gap-5">
                  <div>
                    <h3 className="font-semibold text-foreground">Didn’t find your answer?</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Send the support team the details. The email button opens a ready-made checklist so the right context is easy to
                      include.
                    </p>
                  </div>
                  <a
                    href={supportHref}
                    className="mt-4 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover md:mt-0"
                  >
                    <Mail size={15} aria-hidden="true" />
                    Email support
                  </a>
                </div>
              </GuideSection>
            )}
          </>
        )}
      </div>
    </EditorShell>
  );
}

function GuideSection({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mb-6 mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}

function OverviewCard({
  number,
  icon: Icon,
  title,
  description,
}: {
  number: string;
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-card p-5">
      <span className="absolute right-4 top-3 text-3xl font-semibold text-muted/80" aria-hidden="true">
        {number}
      </span>
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={17} aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

function BrowseCard({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-9 items-center justify-center rounded-xl bg-muted text-foreground group-hover:bg-primary/10 group-hover:text-primary">
          <Icon size={17} aria-hidden="true" />
        </span>
        <ArrowRight
          size={15}
          className="mt-2 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden="true"
        />
      </div>
      <h3 className="mt-3 text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
    </button>
  );
}

/** Link into a full article. Kept card-shaped so guides and articles sit together. */
function ArticleCard({ article }: { article: SupportArticle }) {
  return (
    <Link
      href={`/support/${article.slug}`}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/35 hover:bg-surface"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <FileText size={18} aria-hidden="true" />
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {article.category}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{article.title}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{article.summary}</p>
      <span className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
        <Clock3 size={13} aria-hidden="true" />
        {article.readMinutes} min read
        <span className="ml-auto inline-flex items-center gap-1 font-semibold text-primary">
          Read guide
          <ArrowRight size={13} aria-hidden="true" className="transition-transform group-hover:translate-x-0.5" />
        </span>
      </span>
    </Link>
  );
}

function PlaybookCard({ playbook }: { playbook: Playbook }) {
  const Icon = playbook.icon;
  return (
    <article className="rounded-2xl border border-border bg-card p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">{playbook.symptom}</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{playbook.cause}</p>
        </div>
      </div>
      <ol className="mt-4 space-y-2.5">
        {playbook.steps.map((step, index) => (
          <li key={step} className="flex gap-3 text-sm leading-6 text-muted-foreground">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
              {index + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
      {playbook.href && playbook.linkLabel && (
        <Link href={playbook.href} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          {playbook.linkLabel}
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

function GlossaryGrid({ entries }: { entries: GlossaryEntry[] }) {
  return (
    <dl className="grid gap-3 md:grid-cols-2">
      {entries.map((entry) => (
        <div key={entry.term} className="rounded-2xl border border-border bg-card p-4">
          <dt className="text-sm font-semibold text-foreground">{entry.term}</dt>
          <dd className="mt-1 text-sm leading-6 text-muted-foreground">{entry.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-2xl border border-border bg-card">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-foreground md:px-6">
        {question}
        <ChevronDown size={17} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-border px-5 py-4 text-sm leading-6 text-muted-foreground md:px-6">{answer}</div>
    </details>
  );
}
