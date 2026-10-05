'use client';

import type { ReactNode } from 'react';

import {
  BarChart3,
  Beer,
  Boxes,
  Building2,
  CalendarDays,
  Clock,
  Coffee,
  CreditCard,
  Croissant,
  FileText,
  Gift,
  Globe,
  Landmark,
  LifeBuoy,
  Mail,
  Monitor,
  Package,
  PackageCheck,
  Phone,
  QrCode,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  Truck,
  User,
  UserRound,
  Users,
  UsersRound,
  UtensilsCrossed,
  Wallet,
  X,
} from '@/components/icons';
import { Input } from '@/components/ui/input';

import {
  type BusinessType,
  type CustomerNeed,
  type Extra,
  type ExtraChannel,
  type Fulfilment,
  MIN_PASSWORD_LENGTH,
  type OnboardingDraft,
  type PaymentMethod,
  type StepId,
  type TeamNeed,
  hasPremises,
  sellsOnline,
} from '@/lib/onboarding/flow';

import { type Choice, ChoiceGrid } from './ChoiceGrid';
import { LocationCounter } from './LocationCounter';

export interface QuestionContext {
  draft: OnboardingDraft;
  password: string;
  update: (patch: Partial<OnboardingDraft>) => void;
  /** Record a single-choice answer and move on. */
  choose: (patch: Partial<OnboardingDraft>) => void;
  setPassword: (password: string) => void;
}

export interface Question {
  title: ReactNode;
  hint?: string;
  body: ReactNode;
}

const toggle = <T,>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);

const yesNo = (yes: Choice<'yes'>, no: Choice<'no'>): Choice<'yes' | 'no'>[] => [yes, no];
const asYesNo = (value: boolean | undefined) => (value === undefined ? [] : ([value ? 'yes' : 'no'] as const));

const FOOD_KINDS: Choice<BusinessType>[] = [
  { value: 'cafe', label: 'Café or coffee shop', detail: 'Drinks, pastries and light food.', icon: Coffee },
  { value: 'restaurant', label: 'Restaurant', detail: 'Table service or counter, with a kitchen.', icon: UtensilsCrossed },
  { value: 'bar', label: 'Bar or pub', detail: 'Drinks first, with or without food.', icon: Beer },
  { value: 'bakery', label: 'Bakery', detail: 'Baked on site, sold over the counter.', icon: Croissant },
  { value: 'food_truck', label: 'Food truck or stall', detail: 'Mobile, markets and events.', icon: Truck },
  { value: 'other', label: 'Something else', detail: 'Catering, dark kitchen, deli…', icon: Sparkles },
];

const OTHER_KINDS: Choice<BusinessType>[] = [
  { value: 'retail', label: 'Shop', detail: 'Products sold from a physical store.', icon: Store },
  { value: 'online_retail', label: 'Online store', detail: 'Products sold and shipped online.', icon: ShoppingBag },
  { value: 'services', label: 'Services', detail: 'Salon, studio, repairs, appointments.', icon: Scissors },
  { value: 'other', label: 'Something else', detail: 'We’ll build from your answers.', icon: Sparkles },
];

function fulfilmentChoices(draft: OnboardingDraft): Choice<Fulfilment>[] {
  const choices: Choice<Fulfilment>[] = [];
  if (hasPremises(draft) && draft.servesFood) {
    choices.push({
      value: 'table_service',
      label: 'Served at the table',
      detail: 'Staff bring orders to seated guests.',
      icon: UtensilsCrossed,
    });
  }
  if (hasPremises(draft)) {
    choices.push({
      value: 'collection',
      label: 'Collected',
      detail: draft.servesFood ? 'Takeaway or click and collect.' : 'Click and collect in store.',
      icon: Store,
    });
  }
  choices.push({ value: 'delivery', label: 'Delivered locally', detail: 'Your own drivers or a courier.', icon: Truck });
  if (!draft.servesFood || sellsOnline(draft)) {
    choices.push({ value: 'pick_pack', label: 'Packed and shipped', detail: 'Picked, packed and posted.', icon: Package });
  }
  return choices;
}

function paymentChoices(draft: OnboardingDraft): Choice<PaymentMethod>[] {
  return [
    { value: 'card', label: 'Card', detail: 'Contactless, chip and online.', icon: CreditCard },
    ...(hasPremises(draft) ? [{ value: 'cash' as const, label: 'Cash', detail: 'Taken at the till, cashed up daily.', icon: Wallet }] : []),
    { value: 'invoice', label: 'Invoice', detail: 'Bill business customers later.', icon: FileText },
  ];
}

export function questionFor(step: StepId, ctx: QuestionContext): Question | null {
  const { draft, update, choose } = ctx;
  const name = draft.businessName.trim() || 'your business';

  switch (step) {
    case 'name':
      return {
        title: 'What’s your business called?',
        hint: 'The name customers know you by. You can change it later.',
        body: (
          <BigInput
            label="Business name"
            name="organization"
            autoComplete="organization"
            placeholder="North Street Coffee"
            value={draft.businessName}
            onChange={(value) => update({ businessName: value })}
          />
        ),
      };

    case 'presence':
      return {
        title: (
          <>
            Where does <Em>{name}</Em> sell?
          </>
        ),
        body: (
          <ChoiceGrid
            label="Where you sell"
            selected={draft.presence ? [draft.presence] : []}
            onChange={(presence) => choose({ presence })}
            choices={[
              { value: 'in_person', label: 'In person', detail: 'A shop, café, stall or venue.', icon: Store },
              { value: 'online', label: 'Online', detail: 'A website or app only.', icon: Globe },
              { value: 'both', label: 'Both', detail: 'A place to visit and an online store.', icon: Building2, wide: true },
            ]}
          />
        ),
      };

    case 'food':
      return {
        title: 'Do you serve food or drink?',
        hint: 'This decides whether we set you up with recipes, a kitchen screen and allergen tracking.',
        body: (
          <ChoiceGrid
            label="Food or drink"
            selected={asYesNo(draft.servesFood)}
            onChange={(value) => {
              const servesFood = value === 'yes';
              // Switching sides of the food line invalidates the business type picked on the other side.
              const kinds = servesFood ? FOOD_KINDS : OTHER_KINDS;
              const keepType = draft.businessType && kinds.some((kind) => kind.value === draft.businessType);
              choose({
                servesFood,
                businessType: keepType ? draft.businessType : !servesFood && draft.presence === 'online' ? 'online_retail' : undefined,
              });
            }}
            choices={yesNo(
              { value: 'yes', label: 'Yes', detail: 'Café, restaurant, bar, bakery…', icon: Coffee },
              { value: 'no', label: 'No', detail: 'Products or services.', icon: Tags },
            )}
          />
        ),
      };

    case 'kind':
      return {
        title: draft.servesFood ? 'What kind of place is it?' : 'What do you sell?',
        body: (
          <ChoiceGrid
            label="Business type"
            selected={draft.businessType ? [draft.businessType] : []}
            onChange={(businessType) => choose({ businessType })}
            choices={draft.servesFood ? FOOD_KINDS : OTHER_KINDS}
          />
        ),
      };

    case 'locations':
      return {
        title: 'How many locations do you run?',
        hint: 'Count every site that takes orders. We’ll set up the first one now and the rest after.',
        body: <LocationCounter value={draft.locationCount} onChange={(locationCount) => update({ locationCount })} />,
      };

    case 'channels':
      return {
        title: 'Do you take orders anywhere else?',
        hint: 'Choose any that apply, or skip if none do.',
        body: (
          <ChoiceGrid<ExtraChannel>
            label="Other order channels"
            multiple
            selected={draft.extraChannels}
            onChange={(value) => update({ extraChannels: toggle(draft.extraChannels, value) })}
            choices={[
              { value: 'phone', label: 'By phone', detail: 'Orders or bookings taken on a call.', icon: Phone },
              {
                value: 'marketplace',
                label: 'Through a marketplace',
                detail: draft.servesFood ? 'Deliveroo, Uber Eats, Just Eat…' : 'Amazon, Etsy, eBay…',
                icon: Globe,
              },
            ]}
          />
        ),
      };

    case 'fulfilment':
      return {
        title: 'How do customers get their order?',
        hint: 'Choose all that apply.',
        body: (
          <ChoiceGrid<Fulfilment>
            label="Fulfilment"
            multiple
            selected={draft.fulfilment}
            onChange={(value) => update({ fulfilment: toggle(draft.fulfilment, value) })}
            choices={fulfilmentChoices(draft)}
          />
        ),
      };

    case 'kitchen':
      return {
        title: 'Should orders appear on a screen in the kitchen or at the bar?',
        hint: 'Tickets arrive the moment an order is placed and are bumped when they’re ready.',
        body: (
          <ChoiceGrid
            label="Kitchen screen"
            selected={asYesNo(draft.kitchenScreen)}
            onChange={(value) => choose({ kitchenScreen: value === 'yes' })}
            choices={yesNo(
              { value: 'yes', label: 'Yes, a kitchen screen', detail: 'Live tickets with prep timers.', icon: Monitor },
              { value: 'no', label: 'Not needed', detail: 'Orders are made where they’re taken.', icon: X },
            )}
          />
        ),
      };

    case 'qr':
      return {
        title: 'Should guests be able to order from their table?',
        hint: 'Guests scan a QR code, order and pay on their phone. No app to install.',
        body: (
          <ChoiceGrid
            label="Table ordering"
            selected={asYesNo(draft.qrOrdering)}
            onChange={(value) => choose({ qrOrdering: value === 'yes' })}
            choices={yesNo(
              { value: 'yes', label: 'Yes, QR ordering', detail: 'A code on every table.', icon: QrCode },
              { value: 'no', label: 'Not for now', detail: 'You can switch it on later.', icon: X },
            )}
          />
        ),
      };

    case 'payments':
      return {
        title: 'How do customers pay?',
        hint: 'Choose all that apply.',
        body: (
          <ChoiceGrid<PaymentMethod>
            label="Payment methods"
            multiple
            selected={draft.paymentMethods}
            onChange={(value) => update({ paymentMethods: toggle(draft.paymentMethods, value) })}
            choices={paymentChoices(draft)}
          />
        ),
      };

    case 'stock':
      return {
        title: 'How closely do you track stock?',
        body: (
          <ChoiceGrid
            label="Stock tracking"
            selected={draft.stockTracking ? [draft.stockTracking] : []}
            onChange={(stockTracking) => choose({ stockTracking })}
            choices={[
              { value: 'none', label: 'We don’t', detail: 'No stock counts for now.', icon: X },
              { value: 'simple', label: 'Counts on hand', detail: 'How many of each item we have.', icon: Boxes },
              draft.servesFood
                ? { value: 'batch_expiry', label: 'Batches and use-by dates', detail: 'Rotate stock and cut waste.', icon: CalendarDays }
                : { value: 'serial', label: 'Serial numbers', detail: 'Individual items, warranties, returns.', icon: Tags },
            ]}
          />
        ),
      };

    case 'consumption':
      return {
        title: draft.servesFood ? 'Should each sale use up its ingredients automatically?' : 'Should each sale reduce stock automatically?',
        hint: draft.servesFood
          ? 'Sell a flat white and its milk and beans come off the count, using the recipes you add.'
          : 'Stock levels stay current without a manual count after every sale.',
        body: (
          <ChoiceGrid
            label="Automatic stock"
            selected={asYesNo(draft.automaticConsumption)}
            onChange={(value) => choose({ automaticConsumption: value === 'yes' })}
            choices={yesNo(
              { value: 'yes', label: 'Yes, automatically', detail: 'Recommended.', icon: PackageCheck },
              { value: 'no', label: 'We’ll count by hand', detail: 'Stocktakes only.', icon: Boxes },
            )}
          />
        ),
      };

    case 'suppliers':
      return {
        title: 'Do you order stock from suppliers?',
        body: (
          <ChoiceGrid
            label="Supplier purchasing"
            selected={asYesNo(draft.purchasing)}
            onChange={(value) => choose({ purchasing: value === 'yes' })}
            choices={yesNo(
              { value: 'yes', label: 'Yes', detail: 'Raise purchase orders and check deliveries in.', icon: Truck },
              { value: 'no', label: 'No', detail: 'Not through DUMA.', icon: X },
            )}
          />
        ),
      };

    case 'team':
      return {
        title: 'Who works in the business?',
        body: (
          <ChoiceGrid
            label="Team size"
            selected={draft.teamSize ? [draft.teamSize] : []}
            onChange={(teamSize) => choose({ teamSize })}
            choices={[
              { value: 'solo', label: 'Just me', detail: 'No staff for now.', icon: User },
              { value: 'small', label: '2–10 people', detail: 'A small team.', icon: UserRound },
              { value: 'medium', label: '11–50 people', detail: 'Several shifts or sites.', icon: Users },
              { value: 'large', label: 'More than 50', detail: 'A larger operation.', icon: UsersRound },
            ]}
          />
        ),
      };

    case 'teamNeeds':
      return {
        title: 'What do you want to run for your team?',
        hint: 'Choose any that apply. Each can be switched on later.',
        body: (
          <ChoiceGrid<TeamNeed>
            label="Team tools"
            multiple
            selected={draft.teamNeeds}
            onChange={(value) => update({ teamNeeds: toggle(draft.teamNeeds, value) })}
            choices={[
              { value: 'scheduling', label: 'Rotas', detail: 'Plan and publish shifts.', icon: CalendarDays },
              { value: 'attendance', label: 'Clock in and out', detail: 'Actual hours against the rota.', icon: Clock },
              { value: 'leave', label: 'Holiday and leave', detail: 'Allowances and requests.', icon: Landmark },
              { value: 'payroll', label: 'Payroll', detail: 'Prepare pay runs from hours worked.', icon: Wallet },
              { value: 'peopleRecords', label: 'Employee records', detail: 'Contracts, documents, right to work.', icon: FileText },
            ]}
          />
        ),
      };

    case 'customers':
      return {
        title: 'How do you want to keep customers coming back?',
        hint: 'Choose any that apply, or skip for now.',
        body: (
          <ChoiceGrid<CustomerNeed>
            label="Customer tools"
            multiple
            selected={draft.customerNeeds}
            onChange={(value) => update({ customerNeeds: toggle(draft.customerNeeds, value) })}
            choices={[
              { value: 'customers', label: 'Know your regulars', detail: 'Customer records and history.', icon: UserRound },
              { value: 'loyalty', label: 'Loyalty points', detail: 'Earn on every visit, redeem later.', icon: Gift },
              { value: 'communications', label: 'Email updates', detail: 'Offers and news to your list.', icon: Mail },
            ]}
          />
        ),
      };

    case 'extras':
      return {
        title: 'Anything else that would help?',
        hint: 'Choose any that apply.',
        body: (
          <ChoiceGrid<Extra>
            label="Extras"
            multiple
            selected={draft.extras}
            onChange={(value) => update({ extras: toggle(draft.extras, value) })}
            choices={[
              { value: 'analytics', label: 'Reports', detail: 'Sales, margin and labour trends.', icon: BarChart3 },
              { value: 'agent', label: 'Ask DUMA', detail: 'An assistant that knows your numbers.', icon: Sparkles },
              { value: 'support', label: 'Help centre', detail: 'Guides and a helpdesk for staff.', icon: LifeBuoy },
              { value: 'compliance', label: 'Privacy requests', detail: 'Manage GDPR and personal-data requests.', icon: ShieldCheck },
            ]}
          />
        ),
      };

    case 'owner':
      return {
        title: 'Now your account. What’s your name?',
        hint: 'You’ll be the owner of the workspace.',
        body: (
          <BigInput
            label="Your name"
            name="name"
            autoComplete="name"
            placeholder="Alex Morgan"
            value={draft.ownerName}
            onChange={(value) => update({ ownerName: value })}
          />
        ),
      };

    case 'email':
      return {
        title: (
          <>
            Thanks, <Em>{draft.ownerName.trim().split(/\s+/)[0] || 'there'}</Em>. What’s your work email?
          </>
        ),
        hint: 'You’ll sign in with it.',
        body: (
          <BigInput
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            placeholder="alex@example.com"
            value={draft.email}
            onChange={(value) => update({ email: value })}
          />
        ),
      };

    case 'password':
      return {
        title: 'Choose a password.',
        hint: `At least ${MIN_PASSWORD_LENGTH} characters. A password manager is best.`,
        body: (
          <BigInput
            label="Password"
            type="password"
            name="new-password"
            autoComplete="new-password"
            value={ctx.password}
            onChange={ctx.setPassword}
            maxLength={128}
            meter={Math.min(1, ctx.password.length / MIN_PASSWORD_LENGTH)}
          />
        ),
      };

    case 'location':
      return {
        title: hasPremises(draft) ? 'Where’s your first location?' : 'Where is the business based?',
        hint: hasPremises(draft) ? 'You can add the others once you’re in.' : 'Used on receipts and invoices.',
        body: (
          <div className="grid gap-4">
            <Input
              label={hasPremises(draft) ? 'Location name' : 'Name'}
              name="locationName"
              autoComplete="off"
              placeholder={hasPremises(draft) ? 'North Street' : 'Head office'}
              value={draft.locationName}
              onChange={(event) => update({ locationName: event.target.value })}
              autoFocus
            />
            <Input
              label="Address"
              name="locationAddress"
              autoComplete="street-address"
              placeholder="12 North Street, London"
              value={draft.locationAddress}
              onChange={(event) => update({ locationAddress: event.target.value })}
            />
          </div>
        ),
      };

    default:
      return null;
  }
}

export function Em({ children }: { children: ReactNode }) {
  return <span className="text-primary">{children}</span>;
}

interface BigInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  /** 0–1: a quiet length meter under the field. */
  meter?: number;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'email';
  /** Sits before the value, in the same type — a currency symbol. */
  prefix?: string;
}

/** A single large answer field ruled underneath, for the one-question text steps. */
export function BigInput({ label, onChange, type = 'text', meter, prefix, ...props }: BigInputProps) {
  return (
    <div>
      <label className="sr-only" htmlFor={`onboarding-${props.name}`}>
        {label}
      </label>
      <div className="flex items-baseline gap-2 border-b border-rule transition-colors focus-within:border-primary">
        {prefix && (
          <span aria-hidden="true" className="text-2xl font-semibold tracking-headline text-muted-foreground">
            {prefix}
          </span>
        )}
        <input
          id={`onboarding-${props.name}`}
          type={type}
          autoFocus
          spellCheck={type === 'text' ? undefined : false}
          onChange={(event) => onChange(event.target.value)}
          className="w-full border-0 bg-transparent pb-3 text-2xl font-semibold tracking-headline text-foreground outline-none placeholder:text-muted-foreground/40"
          {...props}
        />
      </div>
      {meter !== undefined && (
        <div className="mt-3 h-0.5 overflow-hidden rounded-full bg-band" aria-hidden="true">
          <div
            className={meter >= 1 ? 'h-full bg-success transition-[width] duration-300' : 'h-full bg-rule transition-[width] duration-300'}
            style={{ width: `${meter * 100}%` }}
          />
        </div>
      )}
    </div>
  );
}
