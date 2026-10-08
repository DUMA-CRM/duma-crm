'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { StatusLozenge, fmtAgo, isOpenStatus, ticketKey } from '@/components/helpdesk/shared';
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
  Headphones,
  HeartHandshake,
  type IconComponent,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
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
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import { ARTICLE_CATEGORIES, SUPPORT_ARTICLES, type SupportArticle } from '@/lib/content/support-articles';
import type { StaffRole } from '@/lib/modules/identity/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { getMyTickets } from '@/lib/modules/support/client';

type GuideTab = 'overview' | 'guides' | 'service' | 'management' | 'people' | 'access' | 'fix' | 'glossary' | 'faq';

interface GuideTopic {
  title: string;
  description: string;
  icon: IconComponent;
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
  icon: IconComponent;
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
  // No count: a tab badge is for what is waiting on you, not a library's size.
  { value: 'guides', label: 'In-depth guides', icon: FileText },
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
    description: 'Your starting point: today’s trading for the selected location, what needs you, and your own workday.',
    icon: LayoutDashboard,
    href: '/dashboard',
    linkLabel: 'Open dashboard',
    steps: [
      'Confirm the location picker at the bottom of the sidebar before reading any figures.',
      'Work through Needs you — each item has a button that opens the page to fix it.',
      'Choose which panels you see, and their order, in Settings → Configuration → Dashboard.',
    ],
    tips: ['Managers see Today’s trading; everyone else sees My workday with their shift and rota.'],
  },
  {
    title: 'Till',
    description: 'Clock in, build a ticket, add a loyalty customer, hold tickets and take cash or card payment.',
    icon: Monitor,
    href: '/pos',
    linkLabel: 'Open the till',
    access: 'Take orders',
    steps: [
      'Slide to clock in — the till only sells while you are on shift.',
      'Tap items (or search the menu), make the required choices and add a note for the kitchen if needed.',
      'Add the customer before charging: search by name, phone or email, or scan their loyalty code. Apply any ready rewards.',
      'Charge, then take cash, send the amount to a card reader, or confirm a card-machine payment.',
      'Use Hold to park a ticket and Held to pick it up again on the same till.',
    ],
    tips: [
      'Offline, cash and card-machine sales save on the till and send when the connection returns.',
      'Layout, favourites and the loyalty scanner are set per device in Settings → Configuration → Till.',
    ],
  },
  {
    title: 'Cash up',
    description:
      'Open and close the trading day from the till: count the float, count the drawer, enter the card total and explain any difference.',
    icon: Boxes,
    href: '/pos?cashup=open',
    linkLabel: 'Cash up on the till',
    access: 'Cash-up permission',
    steps: [
      'Use Cash up in the till’s header. It reads Open the day, Cash up, Close yesterday or Day closed.',
      'To open, count the float into the drawer and confirm it. The till starts from the last float you used.',
      'To close, check held tickets and unsent offline sales, count the drawer by notes and coins, then enter the card terminal’s end-of-day total.',
      'The till shows what it expected only after you have counted. A difference of 1.00 or more needs a note before the day closes.',
    ],
    tips: ['A closed day can’t be reopened. Past days are in Reports → End of day.'],
  },
  {
    title: 'Kitchen',
    description: 'Move paid tickets through New, Preparing and Ready, and keep the hand-off clear.',
    icon: ChefHat,
    href: '/kds',
    linkLabel: 'Open the kitchen screen',
    access: 'Update order status',
    steps: [
      'Keep the Kitchen screen open on the kitchen tablet, on the right location, and tap it once so the chime can play.',
      'Tap Start to begin a ticket, Ready when it is made, and Collected when it is handed over.',
      'Use Undo on the toast, or Recall in the toolbar, if a ticket was moved by mistake.',
      'Tickets show Nearly late from 2 minutes in a stage and Late from 5.',
    ],
    tips: ['Layout, text size, tap-to-strike and the order chime are set per device in Settings → Configuration → Kitchen screen.'],
  },
  {
    title: 'Orders',
    description: 'Order history, cash waiting for approval, refunds and the full timeline of each order.',
    icon: ShoppingBag,
    href: '/orders',
    linkLabel: 'View orders',
    access: 'Read orders',
    steps: [
      'Filter by status, channel, payment, dates or who took it, or search by customer phone or ID.',
      'Approve QR cash orders with Cash received only once the customer has paid.',
      'Open an order to see its items, progress, payment, receipt and activity.',
      'Refund a completed order in full or by item — with refund permission — and choose whether to put items back in stock.',
    ],
  },
  {
    title: 'Customers & loyalty',
    description: 'Find customer records, read what to know before serving, and manage loyalty points, stamps and rewards.',
    icon: Users,
    href: '/customers',
    linkLabel: 'Open customers',
    access: 'Read customers',
    steps: [
      'Search by name, email or phone, then open the record.',
      'Check Before you serve for allergies and alerts, then loyalty cards, points and the timeline.',
      'Save a filter you reuse as a segment with Segments → Save current filters….',
      'Adjust points or stamps only to correct a real error, and choose a reason.',
    ],
    tips: ['Loyalty programmes are set up under Loyalty rules on the Customers page.'],
  },
  {
    title: 'Customer duplicates',
    description: 'Review likely duplicate customer records and merge only when the evidence is strong enough.',
    icon: Users,
    href: '/customers/duplicates',
    linkLabel: 'Review duplicates',
    access: 'Merge customers',
    steps: [
      'Compare the matching email or name on both records.',
      'Open each record when the evidence is unclear; use Not the same person to skip a pair.',
      'Use Review & merge, choose the record to keep, and check what will move before confirming.',
    ],
    tips: ['Points are added together and marketing consent is not transferred. A merge can be undone with Separate.'],
  },
];

const managementTopics: GuideTopic[] = [
  {
    title: 'Menu, recipes & modifiers',
    description: 'Maintain what can be sold and connect each item to a costed recipe.',
    icon: UtensilsCrossed,
    href: '/menu',
    linkLabel: 'Manage menu',
    access: 'Menu or recipe permission',
    steps: [
      'Create or edit items with the right name, price and category; use On the menu to take one off the till.',
      'Build modifier groups for choices such as size, milk and extras.',
      'Add recipes under Recipe & cost so sales use stock and margins are accurate.',
      'Check the till after a change to confirm the item and its choices appear as expected.',
    ],
  },
  {
    title: 'Inventory',
    description: 'Track on-hand stock, items below par, containers, expiry dates and days of cover.',
    icon: Package,
    href: '/inventory',
    linkLabel: 'Open inventory',
    access: 'Read stock',
    steps: [
      'Select the location, then review items below par, running out within a week or expiring this week.',
      'Open an item to read its containers, ledger, losses and transfers.',
      'Use Log waste when something is spilt, damaged or expires, and Request more when it runs low.',
      'Use Transfer when stock physically moves between locations.',
    ],
  },
  {
    title: 'Restock demand & purchase orders',
    description: 'Approve requests for more stock, raise purchase orders and receive deliveries.',
    icon: Truck,
    href: '/inventory?tab=orders',
    linkLabel: 'Open purchase orders',
    access: 'Purchasing permission',
    steps: [
      'Approve or reject requests on Restock demand.',
      'Create a purchase order from one request, or order every approved request for a location together.',
      'Use Mark as sent to supplier, then Receive delivery and record what physically arrived, with expiry dates.',
      'Enter the invoice number and amount to check it against the order.',
    ],
  },
  {
    title: 'Stocktakes',
    description: 'Count physical stock, review the differences and apply the count.',
    icon: ClipboardCheck,
    href: '/inventory?tab=stocktakes',
    linkLabel: 'Open stocktakes',
    access: 'Stocktake permission',
    steps: [
      'Use Start stocktake for the selected location and count every listed item, including zeros.',
      'Save counts as you go; turn on Blind count to hide expected figures.',
      'Use Review & apply, check large differences, and correct counting errors before applying.',
    ],
    tips: ['Avoid receiving deliveries or making transfers during an active count.'],
  },
  {
    title: 'Reports',
    description: 'Net sales, targets, prime cost and a library of reports with one set of filters.',
    icon: BarChart3,
    href: '/reports',
    linkLabel: 'View reports',
    access: 'Analytics permission',
    steps: [
      'Set the dates, comparison and location in the header before reading a figure.',
      'Use the home for net sales, progress against the daily target, what stood out and prime cost.',
      'Search All reports or star the ones you use; click a row to see the detail or the orders behind it.',
      'Export CSV or print from any report.',
    ],
    tips: ['End of day, Refunds, Waste & loss and Purchasing have their own permissions.'],
  },
  {
    title: 'Customer communications',
    description: 'Connect email, write templates, automate messages and review delivery history.',
    icon: Mail,
    href: '/communications',
    linkLabel: 'Open communications',
    access: 'Email permission',
    steps: [
      'Connect a mailbox in Settings → Connectors → Email before building anything.',
      'Create a template and preview it with real customer variables.',
      'Build an automation from a trigger and a template, then switch it on.',
      'Check History for failed messages and use Try again once the cause is fixed.',
    ],
  },
  {
    title: 'Workspace & locations',
    description: 'Your business details, locations, opening hours, order workflow and daily targets.',
    icon: Building2,
    href: '/settings/workspaces',
    linkLabel: 'Open workspace settings',
    access: 'Settings permission',
    steps: [
      'Add each site as a location with its timezone and opening hours.',
      'Choose each location’s order workflow: Kitchen workflow or Counter service.',
      'Work through the readiness checklist until it reads Ready for service.',
      'Assign staff only to the locations they need, then check their access.',
    ],
  },
  {
    title: 'Modules, roles & connectors',
    description: 'Choose the tools your workspace uses, decide what each role may do, and connect payments and email.',
    icon: Settings,
    href: '/settings/modules',
    linkLabel: 'Open modules',
    access: 'Settings permission',
    steps: [
      'Use Settings → Modules to review which tools are on; a module that is off hides its pages for everyone.',
      'Use Settings → Roles & access to create custom roles with exactly the permissions they need.',
      'Set receipt details and VAT in Settings → Trading & tax.',
      'Add card readers, online card checkout and your email mailbox in Settings → Connectors.',
    ],
    tips: ['Never paste secret keys into support messages or Ask DUMA.'],
  },
  {
    title: 'Compliance & privacy requests',
    description: 'Record data requests, track the one-month deadline, download data and erase records.',
    icon: ShieldCheck,
    href: '/compliance',
    linkLabel: 'Open compliance',
    access: 'Privacy permission',
    steps: [
      'Use Record request: who asked, what they want, and how it reached you.',
      'Confirm their identity before handing over or changing data; use Waiting for ID meanwhile.',
      'Keep the status current and watch Due this week and Overdue.',
      'Finish with Download their data, Complete, Erase and complete, or Decline with a reason.',
    ],
    tips: ['Never copy personal data into support requests or Ask DUMA.'],
  },
  {
    title: 'Audit log',
    description: 'A record of who changed what, used when a figure, price or permission needs explaining.',
    icon: ClipboardCheck,
    href: '/audit-log',
    linkLabel: 'Open audit log',
    access: 'Audit permission',
    steps: [
      'Search people, records or details, or narrow by who and what kind of record.',
      'Match the entry to the record it changed — an order, a price, a stock figure or an account.',
      'Use the person and time to follow up with whoever made the change.',
    ],
    tips: ['Check here first when two people disagree about what a figure used to be.'],
  },
];

const peopleTopics: GuideTopic[] = [
  {
    title: 'My rota',
    description: 'Your week of shifts and leave, and where you clock in and out.',
    icon: CalendarDays,
    href: '/scheduling',
    linkLabel: 'Open my rota',
    steps: [
      'Check the location picker, then Slide to clock in. You can clock in from an hour before a shift.',
      'Tap a shift for its times, break, paid time, estimated pay and any note from your manager.',
      'Look for New and Changed badges on shifts that moved since you last looked.',
      'Use Clock out at the end of your shift.',
    ],
    tips: ['Breaks are an unpaid rule your manager sets — there is nothing to start or stop.'],
  },
  {
    title: 'My HR',
    description: 'Your own details, time off, attendance, documents, payslips and private HR requests.',
    icon: HeartHandshake,
    href: '/my-hr',
    linkLabel: 'Open My HR',
    steps: [
      'Use Edit your details for your address, emergency contact and bank details.',
      'Use Request time off on the Time off tab, with the dates and day length.',
      'Open a day on the Attendance tab and use Query this day if it is wrong.',
      'Read payslips under Documents, and use Ask HR for a private request.',
    ],
  },
  {
    title: 'Staff, rota & payroll',
    description: 'Employee records, onboarding, the team rota, worked hours, leave, helpdesk and payroll runs.',
    icon: UsersRound,
    href: '/staff',
    linkLabel: 'Open staff workspace',
    access: 'Staff permission',
    steps: [
      'Use Onboard on the Team tab to add someone and send their sign-in link.',
      'Plan shifts on Rota & shifts and publish the drafts so the team can see them.',
      'Correct worked hours, and turn unplanned work into a matching rota shift.',
      'Decide leave on the Leave tab; run payroll, freeze it, enter deductions and issue payslips on Payroll.',
    ],
    tips: ['Each tab needs its own permission, and pay details need sensitive HR permission.'],
  },
  {
    title: 'Settings & security',
    description: 'Personalise DUMA, set up this device, install the app and protect your account.',
    icon: Settings,
    href: '/settings',
    linkLabel: 'Open settings',
    steps: [
      'Choose a colour theme in Settings → Profile; the workspace brand colour and timezone are in Settings → Workspace.',
      'Set up a till or kitchen tablet in Settings → Configuration before putting it into service.',
      'Install DUMA from Settings → Profile → Install the app.',
      'Change your password and sign out devices you no longer use in Settings → Security.',
    ],
    tips: ['On a shared terminal, make sure the person clocked in is the one signed in.'],
  },
  {
    title: 'Helpdesk requests',
    description: 'Raise a tracked request for HR, payroll, scheduling, leave, workplace or IT help, and follow the reply.',
    icon: Headphones,
    href: '/my-hr?tab=requests',
    linkLabel: 'Open requests',
    steps: [
      'Use Ask HR and pick the topic that matches your problem so it reaches the right person.',
      'Set the urgency honestly — Urgent is for work that cannot continue.',
      'Describe what you expected, what happened and when it happened.',
      'Reply on the same request rather than raising a second one.',
    ],
    tips: ['A request keeps its history, so anyone picking it up later can see the full conversation.'],
  },
];

const accessAreas: AccessArea[] = [
  { area: 'Dashboard, My rota, My HR', detail: 'Today’s activity, your own shifts, leave, attendance and payslips.', who: ['Everyone'] },
  {
    area: 'Settings: Profile, Security, Configuration',
    detail: 'Your appearance, password, devices and device screens.',
    who: ['Everyone'],
  },
  { area: 'Support', detail: 'This help centre and the request form.', who: ['Everyone'] },
  { area: 'Till', detail: 'Taking orders and payment.', who: ['Create orders'] },
  { area: 'Cash up on the till', detail: 'Opening and closing the trading day.', who: ['Cash-up write and create orders'] },
  { area: 'Kitchen', detail: 'Moving tickets through the kitchen.', who: ['Update order status'] },
  {
    area: 'Orders, Customers, Menu, Inventory',
    detail: 'Order history, customer records, the menu and stock.',
    who: ['Area-specific read or write permission'],
  },
  {
    area: 'Reports',
    detail: 'Sales, profit and labour reports. End of day, Refunds, Waste & loss and Purchasing have their own.',
    who: ['Analytics, or the report’s own permission'],
  },
  { area: 'Communications', detail: 'Email templates, automations and delivery history.', who: ['Email read permission'] },
  {
    area: 'Staff — team, rota & shifts',
    detail: 'Employee records, onboarding, the team rota and worked hours.',
    who: ['Staff, scheduling or shifts permission'],
  },
  {
    area: 'Staff — leave, helpdesk, payroll',
    detail: 'Deciding leave, triaging HR requests and running payroll.',
    who: ['Leave review, helpdesk or payroll permission'],
  },
  {
    area: 'Pay, bank and statutory details',
    detail: 'Money held on someone else’s record, wherever it appears. Your own are managed in My HR.',
    who: ['Sensitive HR permission'],
  },
  {
    area: 'Settings: Workspace, Modules, Trading & tax',
    detail: 'Business details, locations, the tools in use, VAT and receipts.',
    who: ['Settings write permission'],
  },
  { area: 'Settings: Roles & access', detail: 'Creating roles and choosing their permissions.', who: ['Staff access permission'] },
  { area: 'Compliance', detail: 'Customer and staff privacy requests.', who: ['Privacy permission'] },
  { area: 'Audit log', detail: 'Reviewing who changed what.', who: ['Audit read permission'] },
];

const playbooks: Playbook[] = [
  {
    symptom: 'The till is offline mid-service',
    cause: 'The device lost its connection. Cash and card-machine sales save on the till; connected card readers need a connection.',
    icon: WifiOff,
    steps: [
      'Carry on with cash or the card machine — the offline banner shows sales are being saved on this till.',
      'Keep DUMA on that till. Saved sales send automatically when the connection returns.',
      'Wait for them to send rather than re-entering them.',
      'Check Orders before assuming a sale was lost.',
    ],
    href: '/orders',
    linkLabel: 'Check orders',
  },
  {
    symptom: 'A saved offline sale will not send',
    cause: 'Sending paused because the cashier was signed out, or the server refused the sale and it needs a manager.',
    icon: RefreshCw,
    steps: [
      'Sign in again as the person who took the sale — sending resumes and nothing is discarded.',
      'Read the reason shown against a sale marked for a manager, fix it, then use Retry.',
      'If it still fails, note the customer, items and time before contacting support. Never delete or re-enter it.',
    ],
    href: '/pos',
    linkLabel: 'Open the till',
  },
  {
    symptom: 'The till says Clock in to start selling',
    cause: 'The till only sells while you are on shift at the selected location.',
    icon: Clock3,
    steps: [
      'Check the location picker shows where you are working.',
      'Drag Slide to clock in on the till, or clock in on My rota.',
      'If it says Your shift couldn’t be checked, check the connection and use Try again.',
    ],
    href: '/scheduling',
    linkLabel: 'Open my rota',
  },
  {
    symptom: 'I was signed out unexpectedly',
    cause: 'The session expired, your password was changed, or your role was updated.',
    icon: ShieldCheck,
    steps: [
      'Sign in again — use Forgot password? if you need a new one.',
      'Check Settings → Security for devices you do not recognise and sign them out.',
      'On a shared terminal, sign in with the account that should be recorded against the orders.',
    ],
    href: '/settings/security',
    linkLabel: 'Open security',
  },
  {
    symptom: 'A page in this guide is missing for me',
    cause: 'Pages follow your permissions and the modules your workspace uses.',
    icon: KeyRound,
    steps: [
      'Check the Roles & access tab to see which permission that area needs.',
      'Confirm the correct location is selected in the location picker.',
      'Ask an owner or administrator to review your role, or whether the module is switched on.',
    ],
  },
  {
    symptom: 'A menu item is missing from the till',
    cause: 'The item is off the menu, has not loaded, or the till is filtered to another category.',
    icon: UtensilsCrossed,
    steps: [
      'Search the menu on the till, or open the Everything tab.',
      'Open Menu and check the item’s On the menu switch.',
      'Reload the till after a menu change so it fetches the latest menu.',
    ],
    href: '/menu',
    linkLabel: 'Open menu',
  },
  {
    symptom: 'Stock figures do not match the shelf',
    cause: 'On-hand is the sum of containers, so unrecorded waste or deliveries show up as a gap.',
    icon: Boxes,
    steps: [
      'Open the item and read its containers — each one carries its own remaining balance.',
      'Use Log waste for any spill, breakage or expiry so the reason is kept.',
      'Receive deliveries against the purchase order rather than adjusting a total by hand.',
      'Run a stocktake to correct the count, then read the differences to see what was missed.',
    ],
    href: '/inventory',
    linkLabel: 'Open inventory',
  },
  {
    symptom: 'A delivery arrived but stock did not increase',
    cause: 'A purchase order only moves stock when the delivery is received against it.',
    icon: Truck,
    steps: [
      'Open the purchase order — Awaiting delivery means nothing has been received yet.',
      'Use Receive delivery and enter what physically turned up, per line.',
      'Enter expiry dates for perishable lines; they drive the expiry warnings later.',
      'Part deliveries are normal: receive what came and the rest stays outstanding.',
    ],
    href: '/inventory?tab=orders',
    linkLabel: 'Open purchase orders',
  },
  {
    symptom: 'Customer emails are not arriving',
    cause: 'Email needs a connected mailbox, a template, an automation that is on, and a customer who may receive it.',
    icon: Mail,
    steps: [
      'Check the Communications header reads Email connected.',
      'Confirm the automation is on and its template still exists.',
      'Check the customer has opted in and is not suppressed.',
      'Open History, read the status and error, and use Try again once the cause is fixed.',
    ],
    href: '/communications',
    linkLabel: 'Open communications',
  },
  {
    symptom: 'A loyalty code will not scan',
    cause: 'This till is set to the wrong scanner, the camera is blocked, or the code is not a DUMA loyalty code.',
    icon: Users,
    steps: [
      'Check Settings → Configuration → Till → Loyalty scanner on that device: Camera or USB scanner.',
      'If the camera is blocked, allow camera access for DUMA in the browser.',
      'Search the customer by name, phone or email instead.',
      'Create a new customer only after searching, so you do not make a duplicate.',
    ],
    href: '/settings/configuration/pos',
    linkLabel: 'Open till settings',
  },
  {
    symptom: 'Loyalty points look wrong',
    cause: 'Points move with completed orders; a manual adjustment is a deliberate correction.',
    icon: Sparkles,
    steps: [
      'Open the customer and read the Points entries on the Timeline.',
      'Check for an offline sale still waiting to send, or a duplicate record.',
      'Use Adjust points only to correct a real error, and choose a reason.',
    ],
    href: '/customers',
    linkLabel: 'Open customers',
  },
  {
    symptom: 'The kitchen screen is not showing new orders',
    cause: 'The screen is on another location, offline, or the order is not paid or released yet.',
    icon: ChefHat,
    steps: [
      'Confirm the kitchen device is on the location taking the orders.',
      'Check the toolbar reads Live, not Offline or Reconnecting.',
      'Check Orders: unpaid QR orders and cash orders awaiting approval stay out of the kitchen, and scheduled orders appear when it is time to start them.',
    ],
    href: '/kds',
    linkLabel: 'Open the kitchen screen',
  },
  {
    symptom: 'The cash-up does not balance',
    cause: 'A count error, a refund or float issue, or sales still waiting to send from offline.',
    icon: Boxes,
    steps: [
      'Recount the drawer by notes and coins, including the float.',
      'Check the card total matches the terminal’s end-of-day (Z) print for this location.',
      'Wait for unsent offline sales before closing if you can.',
      'Write a note explaining any difference of 1.00 or more — a closed day can’t be reopened.',
    ],
    href: '/reports/end-of-day',
    linkLabel: 'Open End of day',
  },
  {
    symptom: 'My hours or leave balance look wrong',
    cause: 'Hours come from clock-ins and leave from your entitlement, so both are corrected by a person.',
    icon: CalendarDays,
    steps: [
      'Open the day on the Attendance tab in My HR.',
      'Use Query this day rather than emailing separately.',
      'For a balance, check the leave year shown on Time off before reporting a difference.',
    ],
    href: '/my-hr',
    linkLabel: 'Open My HR',
  },
  {
    symptom: 'I want DUMA to open like an app',
    cause: 'DUMA installs to the home screen or desktop from the browser.',
    icon: Monitor,
    steps: [
      'Open Settings → Profile and use Install the app.',
      'On iPad or iPhone, use Share then Add to Home Screen.',
      'Sign in once installed so the account is ready on that device.',
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
    definition: 'A single site. The location picker at the bottom of the sidebar decides which site you are working in.',
    group: 'Workspace',
  },
  {
    term: 'Role',
    definition:
      'A named set of permissions given to an account. Roles do not rank — what you can open depends on the permissions the role holds.',
    group: 'Workspace',
  },
  {
    term: 'Permission',
    definition: 'One action an account may take, such as reading orders or writing stock. DUMA checks permissions on every request.',
    group: 'Workspace',
  },
  {
    term: 'Module',
    definition: 'A tool the workspace uses, such as the Till, Stock or Payroll. A module that is off hides its pages from everyone.',
    group: 'Workspace',
  },
  {
    term: 'Access scope',
    definition: 'How far someone reaches — chosen locations, their franchise, or everywhere in the workspace.',
    group: 'Workspace',
  },
  { term: 'Audit entry', definition: 'A record of a change: who made it, what changed, and when.', group: 'Workspace' },
  {
    term: 'Channel',
    definition: 'Where an order came from: Counter (the till), QR table or Mobile.',
    group: 'Service',
  },
  {
    term: 'Order status',
    definition: 'New, Preparing, Ready, Done or Cancelled — the fulfilment stage. Unpaid QR orders can also be Expired.',
    group: 'Service',
  },
  {
    term: 'Order workflow',
    definition:
      'A location setting: Kitchen workflow keeps paid tickets on the kitchen screen until made; Counter service completes the sale when paid.',
    group: 'Service',
  },
  {
    term: 'Modifier',
    definition: 'A choice attached to a menu item, like a size or a milk. Modifiers can change the price.',
    group: 'Service',
  },
  { term: 'Recipe', definition: 'The ingredients behind a menu item, used to consume stock and cost the plate.', group: 'Service' },
  {
    term: 'Held ticket',
    definition: 'A ticket parked on one till to serve someone else. It is not a sale until charged.',
    group: 'Service',
  },
  {
    term: 'Offline sale',
    definition: 'A cash or card-machine sale saved on a till without a connection, sent automatically once it returns.',
    group: 'Service',
  },
  {
    term: 'Cash-up',
    definition: 'Opening the trading day with a float and closing it with a blind count of the drawer and the card total, on the till.',
    group: 'Service',
  },
  {
    term: 'Blind count',
    definition: 'Counting before DUMA shows what it expected, so the count stays honest. Used in cash-up and stocktakes.',
    group: 'Service',
  },
  { term: 'Stock item', definition: 'Something you hold, defined once for the workspace with its unit of measure.', group: 'Stock' },
  {
    term: 'Container',
    definition: 'One physical unit of a stock item — a bag, bottle or box — with its own remaining balance, lot and expiry.',
    group: 'Stock',
  },
  { term: 'On hand', definition: 'The total left across a location’s containers of an item.', group: 'Stock' },
  {
    term: 'Use-first order',
    definition: 'Open containers are used first, then the earliest expiry, so the oldest usable stock goes first.',
    group: 'Stock',
  },
  { term: 'Par', definition: 'The level at which an item counts as low and needs ordering, with its reorder quantity.', group: 'Stock' },
  {
    term: 'Restock request',
    definition: 'A request to buy more of an item: Waiting for review, Approved or Rejected, then Ordered once it is on a purchase order.',
    group: 'Stock',
  },
  {
    term: 'Purchase order',
    definition: 'An order to a supplier: Draft, Awaiting delivery, Part delivered, Received or Cancelled.',
    group: 'Stock',
  },
  { term: 'Waste', definition: 'Stock written off with a reason, such as expired, damaged or theft, using Log waste.', group: 'Stock' },
  { term: 'Stocktake difference', definition: 'The gap between the counted quantity and what DUMA expected.', group: 'Stock' },
  { term: 'Transfer', definition: 'Stock moved between locations: Waiting, then Moved once it arrives, or Cancelled.', group: 'Stock' },
  { term: 'Contract', definition: 'Full time, part time, zero hours or contractor, held on the employee record.', group: 'People' },
  { term: 'Entitlement', definition: 'The leave days available to someone in a leave year.', group: 'People' },
  {
    term: 'Attendance',
    definition: 'How a day was worked against the rota: Worked, Short, Missed, Leave, Rostered or No shift.',
    group: 'People',
  },
  { term: 'Draft shift', definition: 'A planned shift only managers can see until it is published to the team.', group: 'People' },
  {
    term: 'Payroll run',
    definition: 'A pay period frozen, given deductions and issued as payslips that staff read in My HR.',
    group: 'People',
  },
  {
    term: 'Helpdesk request',
    definition: 'A tracked conversation with HR, with a status and a full history.',
    group: 'People',
  },
  {
    term: 'Loyalty points',
    definition: 'The balance a customer earns on completed orders. Adjustments are deliberate corrections with a reason.',
    group: 'Customers',
  },
  {
    term: 'Stamp card',
    definition: 'A loyalty programme that counts units, such as one stamp per coffee, and issues a reward after a set number.',
    group: 'Customers',
  },
  {
    term: 'Reward',
    definition: 'A free item, free modifier or percentage off a customer has earned, applied at the till under Customer rewards.',
    group: 'Customers',
  },
  { term: 'Tier', definition: 'Bronze from 0, Silver from 100, Gold from 300 and VIP from 800 points.', group: 'Customers' },
  {
    term: 'Segment',
    definition: 'A saved set of customer filters that re-runs each time, used as a live audience.',
    group: 'Customers',
  },
  {
    term: 'Suppression',
    definition: 'An address that must not receive marketing email — an unsubscribe, bounce, complaint or erasure.',
    group: 'Customers',
  },
  {
    term: 'Delivery status',
    definition: 'What happened to an email: Waiting, Sending, Sent, Failed or Cancelled.',
    group: 'Customers',
  },
  {
    term: 'Automation',
    definition: 'A rule that sends a template when something happens, such as an order being ready for collection.',
    group: 'Customers',
  },
  {
    term: 'Privacy request',
    definition: 'A request to access, correct, erase or move personal data, due one calendar month after it is recorded.',
    group: 'Customers',
  },
];

const faqs = [
  {
    question: 'Why can’t I see a page mentioned in this guide?',
    answer:
      'DUMA shows pages according to the permissions your role holds and the modules your workspace uses — roles do not simply rank. For example, Customers needs customer read permission and Settings → Workspace needs settings permission. Ask an owner or administrator to check your role, or whether the module is switched on.',
  },
  {
    question: 'How do I change the location I am working in?',
    answer:
      'Use the location picker at the bottom of the sidebar. Always confirm it before clocking in, taking orders, cashing up, counting stock or reading location reports. If a location is missing, your access may need updating.',
  },
  {
    question: 'Why won’t the till let me take orders?',
    answer:
      'The till only sells while you are clocked in at the selected location. Drag Slide to clock in on the till or on My rota. If it says No location selected, choose one in the location picker first.',
  },
  {
    question: 'What happens if the till loses its internet connection?',
    answer:
      'Cash and card-machine sales save on that till and send automatically when the connection returns. Connected card readers need a connection. Keep DUMA on the till, and check Orders before re-entering anything — a saved sale is never deleted automatically.',
  },
  {
    question: 'Where do I cash up now?',
    answer:
      'On the till. Use the Cash up button in the till’s header to open the day with a float and close it with a blind count and the card total. Past days are in Reports → End of day.',
  },
  {
    question: 'Why is a menu item missing from the till?',
    answer:
      'Search for it on the till first. Then check in Menu that the item is On the menu, and reload the till. Someone without menu permission should ask a manager to check.',
  },
  {
    question: 'Why do the kitchen screen and the till show different things?',
    answer:
      'The kitchen screen only shows paid orders released to the kitchen, for its selected location. Check both devices are on the same location and online, then check the order’s status in Orders. Cash QR orders stay out of the kitchen until approved with Cash received.',
  },
  {
    question: 'How should I correct loyalty points?',
    answer:
      'Open the customer, use Adjust points (or Adjust stamps), enter only the amount needed and choose a reason. Check for a duplicate record or an offline sale still waiting to send first.',
  },
  {
    question: 'How do tiers work?',
    answer:
      'Tiers come from the points balance and are the same for every customer: Bronze from 0, Silver from 100, Gold from 300 and VIP from 800 points.',
  },
  {
    question: 'Why do stock figures look wrong?',
    answer:
      'Check the selected location, recent deliveries, transfers, stocktakes and recipe quantities. Read the item’s containers and ledger before changing anything. If several items shifted together, look for an unfinished stocktake or transfer.',
  },
  {
    question: 'Can I install DUMA on a tablet or desktop?',
    answer:
      'Yes. Open Settings → Profile and use Install the app. On iPhone or iPad, use the browser Share menu and choose Add to Home Screen. It is especially useful for dedicated till and kitchen tablets.',
  },
  {
    question: 'How do I set up a till or kitchen tablet?',
    answer:
      'On that device, open Settings → Configuration. Till sets the layout, favourites, stock warnings and loyalty scanner; Kitchen screen sets the layout, text size and order chime. These choices stay on the device.',
  },
  {
    question: 'How do I report a leave or attendance problem?',
    answer:
      'Open My HR. Use Request time off on the Time off tab for leave. For hours, open the day on the Attendance tab and use Query this day. For anything else, use Ask HR and keep replies on that request.',
  },
  {
    question: 'Where are my payslips?',
    answer: 'In My HR → Documents, under Payslips, once payroll has issued them. Your latest payslip also shows on the Overview.',
  },
  {
    question: 'Can I claim expenses in DUMA?',
    answer: 'No. DUMA does not handle expense claims. Ask your manager or HR how expenses are handled in your business.',
  },
  {
    question: 'What should I include when contacting support?',
    answer:
      'Include your name, workspace and location, the page you were using, what you expected, what happened instead, the approximate time, and any order or customer reference. Add a screenshot when it is safe, but never include passwords or payment-card details.',
  },
  {
    question: 'Should I email support or raise a request?',
    answer:
      'Raise a request in My HR for anything about your work — HR, payroll, scheduling, leave, workplace or IT. It keeps a status and a history. Email support when DUMA itself is not working and you cannot get far enough into the app to raise a request.',
  },
  {
    question: 'Why does the same figure differ between two pages?',
    answer:
      'Almost always the location or the dates differ. The Dashboard shows today only; Reports use the dates in their header. Reports compare against the previous period or the same days last year, so the comparison changes when the dates do.',
  },
  {
    question: 'What is a container, and why not just edit the total?',
    answer:
      'A container is one physical bag, bottle or box with its own remaining balance, lot and expiry. On-hand is the sum of them, which is what makes expiry warnings and use-first order possible. Receiving deliveries and logging waste keep that intact; editing a total does not.',
  },
  {
    question: 'How do approved restock requests become a purchase order?',
    answer:
      'On Inventory → Restock demand, use Create purchase order on one approved request, or on the Approved filter order every approved request for one location together. Requests then show as Ordered. A purchase order only changes stock when the delivery is received against it.',
  },
  {
    question: 'Who can see pay, bank details and payslips?',
    answer:
      'Other people’s pay, bank and statutory details need sensitive HR permission. By default HR managers, franchise owners and super admins hold it, so a store manager can manage the team and the rota without seeing pay. Your own payslips are always in My HR, and you can update your bank details and National Insurance number there — stored bank details are never shown back, even to you.',
  },
  {
    question: 'Can I use DUMA on more than one device at a time?',
    answer:
      'Yes. Each device keeps its own till, kitchen screen and appearance settings, while your data and dashboard layout follow your account. Review your signed-in devices in Settings → Security and sign out any you no longer use.',
  },
  {
    question: 'Does DUMA work with no internet at all?',
    answer:
      'Partly. The till can save cash and card-machine sales, and the kitchen screen keeps its tickets on screen. Anything that needs fresh data — reports, history, most management pages — needs a connection.',
  },
  {
    question: 'How do I get a new starter set up?',
    answer:
      'Use Onboard on Staff → Team. It creates the account and the employment record together and emails them a single-use link to set a password. The record then flags anything still missing, such as bank details or a pay rate.',
  },
  {
    question: 'I forgot my password. What do I do?',
    answer: 'Use Forgot password? on the sign-in page. DUMA emails a single-use link to choose a new password of at least 12 characters.',
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
    <article className="rounded-sm border border-rule bg-card shadow-sm p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-band text-primary">
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">{topic.title}</h3>
            {topic.access && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
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
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-micro font-semibold text-muted-foreground">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      {topic.tips?.map((tip) => (
        <p key={tip} className="mt-4 rounded-sm bg-info-highlight px-3 py-2.5 text-xs leading-5 text-info">
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
  const { data: tickets = [] } = useQuery({ queryKey: moduleQueryKeys.support.key('helpdesk-my'), queryFn: getMyTickets });
  const open = tickets.filter((ticket) => isOpenStatus(ticket.status));
  if (open.length === 0) return null;

  return (
    <section className="rounded-sm border border-rule bg-card shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3.5">
        <div>
          <h2 className="font-semibold text-foreground">Your open requests</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Already with the team — pick one up where you left off.</p>
        </div>
        <Link href="/my-hr?tab=requests" className="shrink-0 text-xs font-semibold text-primary hover:underline">
          Open helpdesk
        </Link>
      </div>
      <ul className="divide-y divide-border/60">
        {open.slice(0, 4).map((ticket) => (
          <li key={ticket.id}>
            <Link href="/my-hr?tab=requests" className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-band">
              <span className="font-mono text-label font-semibold text-muted-foreground">{ticketKey(ticket)}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{ticket.subject}</span>
              <span className="hidden text-label text-muted-foreground sm:inline">{fmtAgo(ticket.updatedAt)}</span>
              {/* The word, not a glyph: it is the one thing this row tells you. */}
              <StatusLozenge status={ticket.status} />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TAB_VALUES = tabs.map((tab) => tab.value);

export function SupportGuide({ role, capabilities }: { role: StaffRole | null; capabilities: readonly string[] }) {
  // `?tab=guides` lets an article return to the section it was opened from.
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [activeTab, setActiveTab] = useState<GuideTab>(
    TAB_VALUES.includes(requestedTab as GuideTab) ? (requestedTab as GuideTab) : 'overview',
  );
  const [query, setQuery] = useState('');
  const normalisedQuery = query.trim().toLowerCase();
  // Which guidance is relevant, keyed off what the reader can actually do.
  const isManager = hasCapability(capabilities, 'analytics:read');
  const isOwner = hasCapability(capabilities, 'settings:write');

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

  const resultCount = searchResults.length + faqResults.length + playbookResults.length + glossaryResults.length + articleResults.length;

  const supportHref =
    'mailto:support@duma.coffee?subject=DUMA%20support%20request&body=Name%3A%0AWorkspace%20and%20location%3A%0APage%20or%20feature%3A%0AWhat%20I%20was%20trying%20to%20do%3A%0AWhat%20happened%3A%0AApproximate%20time%3A%0AOrder%20or%20customer%20reference%20(if%20relevant)%3A%0A%0APlease%20attach%20a%20screenshot%20if%20it%20is%20safe%20to%20do%20so.';

  return (
    <EditorShell
      eyebrow="DUMA help centre"
      title="Support"
      icon={<LifeBuoy size={20} aria-hidden="true" />}
      actions={
        <>
          <Button asChild variant="outline" className="h-9 gap-1.5">
            <a href={supportHref}>
              <Mail size={15} aria-hidden="true" />
              <span className="hidden md:inline">Email support</span>
            </a>
          </Button>
          {/* The app's own ticket queue — a tracked request beats an untracked email. */}
          <Button asChild className="h-9 gap-1.5">
            <Link href="/my-hr?tab=requests">
              <MessageSquarePlus size={15} aria-hidden="true" />
              <span className="hidden md:inline">Raise a request</span>
            </Link>
          </Button>
        </>
      }
      subheader={
        <SectionTabs
          tabs={tabs}
          value={activeTab}
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
          <section aria-label="Help centre search results">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Search results</p>
            <h2 className="mt-1 text-xl font-semibold text-foreground" aria-live="polite" aria-atomic="true">
              {resultCount
                ? `${resultCount} result${resultCount === 1 ? '' : 's'} for “${query.trim()}”`
                : `No results for “${query.trim()}”`}
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
              <div className="mt-5 rounded-sm border border-dashed border-rule bg-card p-8 text-center">
                <CircleHelp className="mx-auto text-muted-foreground" size={24} aria-hidden="true" />
                <p className="mt-3 text-sm font-medium text-foreground">
                  Try a feature name such as “till”, “stock”, “rota”, or “password”.
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
                  <p className="mt-2 max-w-[70ch] text-base leading-7 text-muted-foreground">
                    DUMA keeps work organised by workspace, location, and the permissions your role holds. Start every task by checking the
                    active location; the pages and actions you can see then reflect your access.
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
                      description="If a tool is missing, your role may not hold its permission, or its module may be switched off."
                    />
                  </div>
                </section>

                <section className="rounded-sm border border-rule bg-card shadow-sm p-5 md:p-7">
                  <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-micro font-semibold uppercase tracking-micro text-primary">Recommended next step</p>
                      <h2 className="mt-1 text-lg font-semibold text-foreground">
                        {isOwner
                          ? 'Set up and review your locations'
                          : isManager
                            ? 'Review today’s operations'
                            : 'Get ready for your shift'}
                      </h2>
                      <p className="mt-1 max-w-[70ch] text-base leading-7 text-muted-foreground">
                        {isOwner
                          ? 'Confirm workspace locations and staff access before moving into menu, stock, and reporting.'
                          : isManager
                            ? 'Check service activity and alerts, then make sure the menu, stock, rota, and terminals are ready.'
                            : 'Clock in, check your rota and dashboard, then open the till or kitchen screen at your station.'}
                      </p>
                    </div>
                    <Link
                      href={isOwner ? '/settings/workspaces' : '/dashboard'}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm border border-rule bg-background px-4 text-sm font-semibold text-foreground hover:bg-muted"
                    >
                      {isOwner ? 'Open workspace settings' : 'Open dashboard'}
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
                      All guides
                      <ArrowRight size={13} aria-hidden="true" />
                    </button>
                  </div>
                  <div className="mt-4 grid items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {SUPPORT_ARTICLES.slice(0, 3).map((article) => (
                      <ArticleCard key={article.slug} article={article} />
                    ))}
                  </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-sm border border-rule bg-card shadow-sm p-5">
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
                  <div className="rounded-sm border border-primary/20 bg-band p-5">
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
                title="Work and personal settings"
                description="Everything from an individual rota to staff operations, device setup, and account security."
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
                        <h3 className="text-micro font-semibold uppercase tracking-micro text-primary">{category}</h3>
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
                description="Your role supplies your permissions, and DUMA checks them on every request. Modules your workspace has switched off are hidden for everyone."
              >
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-sm border border-rule bg-card shadow-sm">
                    <div className="hidden border-b border-rule bg-muted/60 px-5 py-2.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] md:gap-4">
                      <span>Area</span>
                      <span>Required access</span>
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
                                className="inline-flex items-center rounded-sm border border-rule bg-background px-2 py-0.5 text-label font-semibold text-muted-foreground"
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
                    <div className="rounded-sm border border-rule bg-card shadow-sm p-5">
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={17} className="text-primary" aria-hidden="true" />
                        <h3 className="font-semibold text-foreground">Two things decide what you see</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Your <span className="font-semibold text-foreground">effective permissions</span> decide which areas exist for you.
                        Your <span className="font-semibold text-foreground">assigned locations</span> decide whose data you see inside
                        them. A missing figure is often the location picker rather than a permission.
                      </p>
                      {role && (
                        <p className="mt-3 text-sm text-muted-foreground">
                          You are signed in as <span className="font-semibold text-foreground">{roleLabels[role] ?? role}</span>. DUMA
                          checks the live permissions attached to that account on every request.
                        </p>
                      )}
                    </div>
                    <div className="rounded-sm border border-primary/20 bg-band p-5">
                      <div className="flex items-center gap-2">
                        <KeyRound size={17} className="text-primary" aria-hidden="true" />
                        <h3 className="font-semibold text-foreground">Need more access?</h3>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        Ask a manager or owner to change your role or add a location — it is not something you can grant yourself. Pay and
                        bank details are restricted by design and stay restricted even for a store manager.
                      </p>
                      <Link
                        href="/my-hr?tab=requests"
                        className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                      >
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
                <div className="mt-6 rounded-sm border border-warning/25 bg-warning/5 p-5">
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
                        <h3 className="text-micro font-semibold uppercase tracking-micro text-primary">{group}</h3>
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
                <div className="mt-6 rounded-sm border border-primary/20 bg-band p-5 md:flex md:items-center md:justify-between md:gap-5">
                  <div>
                    <h3 className="font-semibold text-foreground">Didn’t find your answer?</h3>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Send the support team the details. The email button opens a ready-made checklist so the right context is easy to
                      include.
                    </p>
                  </div>
                  <a
                    href={supportHref}
                    className="mt-4 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-sm bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover md:mt-0"
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
      <p className="text-micro font-semibold uppercase tracking-micro text-primary">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold text-foreground">{title}</h2>
      <p className="mb-6 mt-2 max-w-[70ch] text-base leading-7 text-muted-foreground">{description}</p>
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
  icon: IconComponent;
  title: string;
  description: string;
}) {
  return (
    <article className="relative overflow-hidden rounded-sm border border-rule bg-card shadow-sm p-5">
      <span className="absolute right-4 top-3 text-3xl font-semibold text-muted/80" aria-hidden="true">
        {number}
      </span>
      <span className="flex size-9 items-center justify-center rounded-sm bg-band text-primary">
        <Icon size={17} aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold text-foreground">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
    </article>
  );
}

/** Link into a full article. Kept card-shaped so guides and articles sit together. */
function ArticleCard({ article }: { article: SupportArticle }) {
  return (
    <Link
      href={`/support/${article.slug}`}
      className="group flex h-full flex-col rounded-sm border border-rule bg-card shadow-sm p-5 transition-colors hover:border-primary/35 hover:bg-surface"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-band text-primary">
          <FileText size={18} aria-hidden="true" />
        </span>
        <span className="rounded-full bg-muted px-2 py-1 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
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
    <article className="rounded-sm border border-rule bg-card shadow-sm p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-warning/6 text-warning">
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
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-label font-semibold text-foreground">
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
        <div key={entry.term} className="rounded-sm border border-rule bg-card shadow-sm p-4">
          <dt className="text-sm font-semibold text-foreground">{entry.term}</dt>
          <dd className="mt-1 text-sm leading-6 text-muted-foreground">{entry.definition}</dd>
        </div>
      ))}
    </dl>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <details className="group rounded-sm border border-rule bg-card shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-sm font-semibold text-foreground md:px-6">
        {question}
        <ChevronDown size={17} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-rule px-5 py-4 text-sm leading-6 text-muted-foreground md:px-6">{answer}</div>
    </details>
  );
}
