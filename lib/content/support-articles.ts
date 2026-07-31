// Long-form support articles, authored in Markdown and rendered by
// `components/shared/Markdown` so they get the app's own typography, tables and
// images rather than a separate content stack.
//
// Everything here describes behaviour that exists in the app today. When a
// workflow changes, update the article and its `updated` date together.

export type ArticleCategory = 'Service' | 'Stock' | 'Customers' | 'People' | 'Reporting';

export interface SupportArticle {
  slug: string;
  title: string;
  summary: string;
  category: ArticleCategory;
  readMinutes: number;
  /** Absolute date — shown to readers so they can judge how current it is. */
  updated: string;
  /** Markdown body. Headings become anchors for the contents list. */
  body: string;
}

export const SUPPORT_ARTICLES: SupportArticle[] = [
  {
    slug: 'run-a-shift',
    title: 'Run a shift from open to close',
    summary: 'The order to do things in on a normal trading day, and the three checks that stop most end-of-day surprises.',
    category: 'Service',
    readMinutes: 6,
    updated: '2026-07-30',
    body: `
A shift goes wrong in small ways long before anyone notices a number is off. This is the sequence that keeps the day clean, and the checks worth doing even when you are busy.

## Before you open

1. Confirm the **location picker** in the top bar shows the site you are standing in. Everything else on this page follows from it.
2. Open the **Dashboard** and read the alert cards. Low stock and pending requests are cheaper to deal with now than mid-rush.
3. Put the KDS device on the kitchen screen and leave DUMA open on it.
4. On each till, check the scanner and camera choice in **Settings → Devices**.

> If the location is wrong, orders, stock movements and reports are all recorded against the wrong site. It is the single most common cause of "the numbers look wrong".

## During service

Take the order, then identify the customer *before* payment if they are collecting or spending loyalty points. Adding them afterwards does not move the points.

- Scan the customer's QR code, or search by phone number.
- Search before creating: a duplicate record splits someone's history and their tier progress.
- Send the ticket to the kitchen and let the KDS drive the hand-off. It is the shared source of truth between counter and kitchen.

### If the internet drops

Keep serving. The POS shows an offline indicator and queues eligible orders on that device.

| Do | Don't |
| --- | --- |
| Keep the DUMA tab open until the queue clears | Close the browser or reboot the tablet |
| Wait for orders to appear in Orders after reconnecting | Re-enter an order you think was lost |
| Sign in again if you are prompted | Assume a paused sync means the order is gone |

A queued order that needs a decision says so. Re-entering is the expensive mistake: two orders, two stock movements, two sets of points.

## Waste as it happens

Record breakages, spills and expired stock as a **loss** at the moment they happen, with the reason. On-hand is the sum of the containers you actually hold, so unrecorded waste turns into a variance later that nobody can explain.

## Closing checks

1. **Orders** — is anything still sitting in preparing or ready that should be done or cancelled?
2. **Inventory** — anything critical or out that tomorrow's service needs? Raise a restock request now.
3. **Expiry** — anything expiring tonight or tomorrow? Deal with it before it becomes waste you find later.

Three minutes at close saves the argument at the end of the week.`,
  },
  {
    slug: 'receive-a-delivery',
    title: 'Receive a delivery without breaking your stock',
    summary: 'Why a purchase order does not move stock on its own, and how containers, lots and expiry dates fit together.',
    category: 'Stock',
    readMinutes: 7,
    updated: '2026-07-30',
    body: `Stock in DUMA is physical. An item is not one number: it is a set of **containers**, each with its own remaining balance, lot number and expiry date. On-hand is their sum. Understanding that makes the rest of this obvious.

## The chain

A restock request becomes a purchase order, and a purchase order becomes stock only when the delivery is received against it.

| Stage | What it means | Stock moved |
| --- | --- | --- |
| Restock request — pending | Someone asked for more of an item | No |
| Restock request — approved | A manager agreed to buy it | No |
| Purchase order — draft | Written, not sent to the supplier | No |
| Purchase order — submitted | With the supplier, awaiting delivery | No |
| Purchase order — part received | Some lines arrived | Yes, what arrived |
| Purchase order — received | Everything arrived | Yes, in full |

A draft PO is the one people forget. It looks like an order has been placed, but nothing is on its way.

## Receiving what actually turned up

Open the purchase order and use **Receive goods**. Enter quantities per line, against what is physically in front of you — not what the paperwork says.

1. Enter the received quantity for each line.
2. Enter the number of containers if it differs from the default pack size.
3. Enter the **expiry date** for perishable lines. This is not optional bookkeeping: it drives the expiry warnings and the order stock is consumed in.
4. Add the lot number when the supplier prints one. It is what a recall is traced by.

Part deliveries are normal. Receive what came; the remainder stays outstanding on the order and the PO shows as part received.

## First expired, first out

Containers are consumed in expiry order, so the oldest usable stock goes first. This only works if expiry dates go in at receipt. Skip them and DUMA cannot tell a fresh container from one that expires tomorrow.

## Matching the invoice

Record the invoice number and amount against the order. DUMA compares it with the order total and tells you the difference. A mismatch is usually a price change, a short delivery, or a substituted product — all worth knowing before you pay.

> Never fix a difference by editing a stock total. Record what happened — a loss, a part delivery, a variance — so the reason survives.

## What good looks like

- No purchase orders sitting in draft.
- No perishable container without an expiry date.
- Every difference between the invoice and the order explained.`,
  },
  {
    slug: 'stocktake-and-variance',
    title: 'Count stock and read the variance',
    summary: 'How to run a count that produces a number you can act on, and what a variance is actually telling you.',
    category: 'Stock',
    readMinutes: 5,
    updated: '2026-07-30',
    body: `A stocktake compares what you counted against what DUMA expected. The gap is the **variance**, and it is the most useful number in inventory — provided the count is honest.

## Before counting

- Count when nothing is moving. Mid-service counts are wrong by the time you finish.
- Record outstanding waste **first**. Unrecorded losses show up as variance and hide the real problem.
- Receive any delivery that has physically arrived. Stock on the shelf but not received reads as a surplus.

## Counting

Count containers, not guesses. A half-used bag is a container with a remaining balance, and that is what you are checking.

1. Work through the list in a fixed order, shelf by shelf, so nothing is counted twice.
2. Enter what you find, including zero. A skipped line is not the same as a zero.
3. Submit the count and read the variance immediately, while you still remember the shelf.

## Reading the variance

| Variance | Usually means |
| --- | --- |
| Small and both directions | Normal measurement noise on loose items |
| Consistently negative on one item | Unrecorded waste, over-portioning, or theft |
| Consistently positive on one item | Deliveries received short, or recipe usage set too high |
| One large negative | A specific event — a spill or a breakage nobody logged |

A pattern matters more than a single figure. One bad week on one item is noise; the same item drifting every week is a process problem.

## After the count

Fix the cause, not just the number:

- Adjust the recipe if usage is systematically wrong.
- Retrain on portioning if one item drifts on one shift pattern.
- Check the receiving process if surpluses keep appearing.

Then re-count that item next week and see whether the change worked.`,
  },
  {
    slug: 'email-that-sends',
    title: 'Set up customer email that actually sends',
    summary: 'The four things that must all be true before a customer receives anything, and how to read a failed delivery.',
    category: 'Customers',
    readMinutes: 6,
    updated: '2026-07-30',
    body: `Customer email needs four things to line up. If any one is missing, nothing arrives and nothing looks broken.

## The four requirements

1. **A connected mail account.** Email is sent through your own provider, set up once for the business by an owner or admin.
2. **An active template.** The email itself — subject and body, with variables filled in when it sends.
3. **An enabled automation.** The rule that decides *when* the template goes out.
4. **Someone to send to.** A customer record with an email address.

The Communications header tells you whether email is connected. The tab counts tell you how many templates exist and how many automations are actually sending.

## Templates

Start from a ready-made template and change the wording rather than writing from scratch. Variables such as the customer's name and the order details are replaced at send time — write around them, and preview before saving.

Archiving a template does not delete it, but an automation pointing at an archived template sends nothing. The automation list flags that.

## Automations

An automation is a trigger plus a template. Switch it on only once the template reads the way you want, because it starts sending immediately.

> Test with a real order on a quiet shift before switching on anything customer-facing. History shows you exactly what was sent.

## Reading History

Every message lands in History with a status:

| Status | Meaning | What to do |
| --- | --- | --- |
| Queued | Waiting to be sent | Nothing — check back shortly |
| Sending | In progress right now | Nothing |
| Sent | Handed to the mail server | Done. Delivery to the inbox is the provider's job |
| Failed | Could not be sent | Read the error, fix the cause, then use Try again |
| Cancelled | Stopped before sending | Check why it was stopped |

Failed entries carry the reason. Authentication errors point at the connection; a rejected address points at the customer record.

## A working setup

- Connection tested and enabled.
- One active template per thing you actually want to say.
- Automations on, each pointing at a template that is in use.
- No failed deliveries older than a day sitting unread.`,
  },
  {
    slug: 'onboard-a-starter',
    title: 'Onboard a new starter properly',
    summary: 'What onboarding creates, what is still missing afterwards, and the gaps that stop payroll being run.',
    category: 'People',
    readMinutes: 6,
    updated: '2026-07-30',
    body: `Onboarding from the Staff workspace creates two things at once: an **account** they sign in with, and an **employment record** that holds their terms. Both matter, and a record with only one of them causes problems later.

## Start in the right place

Use **Onboard** on the Staff team tab. It sets up the account and the employment record together, then drops you on the new record so you can finish it.

Getting these right at the start saves rework:

- **Role** — decides which areas of DUMA they can open at all.
- **Assigned locations** — decides whose data they see inside those areas.
- **Employment type** — full time, part time, contractor or zero hours.
- **Start date** — a future date is fine; they show as a future starter until it arrives.

## Finish the record

The team list shows what is still outstanding on each record. Anything affecting pay is flagged separately, because payroll run on an incomplete record is the expensive kind of mistake.

Work through:

1. Personal details and an emergency contact.
2. Pay type and rate. Only HR managers, franchise owners and super admins can see or set this.
3. Bank details, entered by them in My HR or by HR on their behalf.
4. Documents HR needs to hold, with expiry dates where they apply.
5. Leave entitlement for the current year.
6. Their work pattern, which is what leave days are measured against.

> A store manager can manage the team and the rota without seeing pay or bank details. That restriction is deliberate and cannot be granted locally.

## First week

- Assign required **training**. Practical skills need a manager to observe and sign them off — they cannot self-complete those.
- Put them on the **rota** so they can see their shifts in My Rota.
- Point them at My HR for leave, attendance corrections and private HR requests.

## Someone leaving

Offboard from their record. Their history is retained and the account is marked inactive, so past orders and payroll stay intact and they can be re-onboarded later if they come back.`,
  },
  {
    slug: 'read-your-reports',
    title: 'Read your reports without being misled',
    summary: 'What each headline metric counts, what the comparison is against, and the three traps that make figures look wrong.',
    category: 'Reporting',
    readMinutes: 7,
    updated: '2026-07-30',
    body: `Most reporting disputes are not about the data. They are about two people looking at different periods, different locations, or a metric that does not mean what they assumed.

## Always check three things first

1. **Location** — the picker in the top bar. Reports for "all accessible locations" and one site are different reports.
2. **Period** — the 7/30/90 day control on the page.
3. **What it is compared against** — the immediately preceding period of the same length. Change the period and the comparison changes with it.

That is where nearly every "these numbers are wrong" conversation ends.

## What the headline metrics count

| Metric | Counts | Watch out for |
| --- | --- | --- |
| Net revenue | Recorded, non-cancelled order value | Refunds and cancellations change history |
| Orders | Order count, not items | A large order counts once |
| Average order value | Net revenue ÷ orders | Moves when either side moves |
| Repeat rate | Known customers ordering more than once | Anonymous sales are not in it |
| Completion rate | Orders reaching done | A queue left uncleared drags it down |
| Cancellation rate | Cancelled share of orders | Training issues show up here first |

Channel figures are reported before the headline cancellation adjustment, because status and source are not cross-broken-down. Use them for mix, not for a precise total.

## Comparing properly

The **Compare** tab exists so you do not have to eyeball two screenshots. Pick the metrics, pick two periods or two locations, and read the difference. Export the comparison as CSV when it needs to go in a pack.

Like-for-like matters: a 30-day period containing a bank holiday against one that does not will differ for reasons no report can explain.

## The deeper reports

The **Library** tab holds the operational reports:

- **Labour** — scheduled against worked time, and sales per labour hour.
- **Inventory** — consumption, days of cover, waste and stockout risk.
- **Purchasing** — spend, price variance and receiving performance.
- **Profitability** — sales against current recipe costs, with completeness warnings.

Read the completeness warnings on profitability. A recipe missing an ingredient cost makes a margin look better than it is.

## Three traps

- **Comparing a part period to a whole one.** Today is incomplete until it ends.
- **Reading a rate on tiny volumes.** One cancellation out of four orders is 25%.
- **Assuming stock value equals cost of goods.** Waste and variance sit between them.`,
  },
];

export const ARTICLE_CATEGORIES: ArticleCategory[] = ['Service', 'Stock', 'Customers', 'People', 'Reporting'];

export function getSupportArticle(slug: string): SupportArticle | undefined {
  return SUPPORT_ARTICLES.find((article) => article.slug === slug);
}
