// Long-form support articles, authored in Markdown and rendered by
// `components/shared/Markdown` so they get the app's own typography, tables and
// images rather than a separate content stack.
//
// Everything here describes behaviour that exists in the app today. When a
// workflow changes, update the article and its `updated` date together.
//
// Ask DUMA answers from these articles (`lib/ai/support-search.ts` scores title
// ×8, summary ×4, body ×1), so keep titles and summaries keyword-rich and only
// suggest Ask DUMA prompts for things its tools can actually do.

export type ArticleCategory = 'Service' | 'Stock' | 'Customers' | 'People' | 'Reporting' | 'Workspace';

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
    slug: 'take-orders-on-the-till',
    title: 'Take orders on the till (POS), including offline sales',
    summary:
      'Clock in to unlock the till, build a ticket with modifiers and notes, add a loyalty customer, hold tickets, take cash or card payment, and keep selling offline until saved sales finish sending.',
    category: 'Service',
    readMinutes: 8,
    updated: '2026-10-05',
    body: `The **Till** in the sidebar is the point of sale (POS). It is built for a landscape tablet at the counter, and it sells for the **location** shown in the location picker at the bottom of the sidebar. You need permission to create orders to see it.

## Unlock the till by clocking in

The till only sells while you are on shift. If you are not clocked in it shows **Clock in to start selling** — drag **Slide to clock in** and the till unlocks (“Clocked in — the till is unlocked.”). If DUMA cannot check your shift it says **Your shift couldn’t be checked**; use **Try again** once the connection is back.

If it says **No location selected**, choose the site you are standing in from the location picker first. Clocking in is recorded against that location.

## Build the ticket

1. Find the item: tap a category tab (or **Favourites**, if this till has them), or use **Search the menu**.
2. Items with options open a customiser. Make every required choice (the button reads **Choose …** until you do), set **Quantity**, add a **Note for the kitchen** if needed, then **Add to ticket**.
3. Tap a line on the ticket to change the quantity (**One more** / **One fewer**) or add a note. Removing a line shows **Undo** for five seconds.
4. Use **Order note** for something about the whole order, such as the name for the cup.
5. The bin clears the whole ticket — tap it twice to confirm.

There is no eat-in/takeaway choice, table number or manual discount on the till. Items marked **Low** or **Out** are showing a stock warning, if this till has stock warnings turned on.

> How the sell screen looks — categories or items first, favourites, photo or compact tiles, the search bar — is set per device in **Settings → Configuration → Till**.

## Add the customer before you charge

Tap **Add a customer** on the ticket, then:

- **Name, phone or email** — search for an existing customer. Always search before creating one; a duplicate splits their history and points.
- **Scan loyalty code** — scan the QR code in their app or on their card. Whether this till uses the camera or a USB scanner is set in **Settings → Configuration → Till → Loyalty scanner**.
- **New customer** — first name, last name and phone (email optional), then **Create and add to ticket**.

Once added, the ticket header shows the customer and their points balance.

## Use loyalty rewards

When a customer has an active loyalty programme at this location, **Customer rewards** appears on the ticket. It shows each programme’s progress (“N to go” or “N ready”). Choose how many ready rewards to apply; the ticket shows the saving and “N reward(s) applied”. If you reduce the item the reward covers, the reward shrinks with it.

Points and stamps are earned on the order automatically once it is completed.

## Hold a ticket

Use **Hold** (next to Charge) to park a ticket and serve the next customer. It is named after the customer, the order note, or the time (“Ticket · 14:05”). Open **Held** to pick it up again — the current ticket must be empty first.

- Held tickets are kept **on this till only**, for this location. Anyone signed in on the same till can resume them.
- Up to 12 tickets can be on hold at once.
- Applied rewards are not kept on a held ticket; apply them again when you resume it.
- A held ticket is not a sale. Charge it or discard it before you cash up.

## Take payment

Tap **Charge £…**, then choose how the customer pays under **Take payment**:

| Method | What happens |
| --- | --- |
| **Cash** | Enter the cash received (or **Exact**), then **Take cash**. The till shows the change to give. |
| A connected card reader | The amount is **Sent to the reader**. Wait for Approved or Declined; **Use another method** if it fails. |
| **Card machine** | Key the amount into your standalone card machine, then confirm the result on the till. |

When it is done, use **Print receipt** or **New sale**. Split payments are not supported, and refunds are made from **Orders**, not the till.

Card readers are added per location in **Settings → Connectors → Card payments**.

## When the internet drops

Keep serving. The till shows **Offline — cash and card-machine sales save on this till … and send when the connection returns.**

- Only **Cash** and **Card machine** sales can be taken offline. Connected card readers need a connection.
- Saved sales send automatically when the connection returns, and are retried regularly.
- If you were signed out, sending pauses until the same person signs in again — the sale is kept.
- A sale the server refuses stays on the till marked for a manager, with **Retry**. It is never deleted automatically.
- After reconnecting, **Recently sent from this till** lists what went through.

Never re-enter a sale you think was lost. Check Orders first — re-entering creates a second order, a second stock movement and a second set of points.

## Cash up from the till

Opening and closing the trading day also happens on the till, from the **Cash up** button in its header. See [Cash up and close the day from the till](/support/cash-up-and-reconcile).`,
  },
  {
    slug: 'run-a-shift',
    title: 'Run a shift from open to close',
    summary:
      'The order to do things in on a trading day — clock in, open the day, serve, log waste, close the till — and the checks that stop end-of-day surprises.',
    category: 'Service',
    readMinutes: 6,
    updated: '2026-10-05',
    body: `A shift goes wrong in small ways long before anyone notices a number is off. This is the sequence that keeps the day clean, and the checks worth doing even when you are busy.

## Before you open

1. Confirm the **location picker** at the bottom of the sidebar shows the site you are standing in. Orders, clock-ins, stock and cash-up all follow it.
2. **Clock in** — slide to clock in on **My rota**, or on the till itself, which stays locked until you are on shift.
3. On the till, use **Cash up → Open the day** and count the float into the drawer.
4. Read **Needs you** on the Dashboard. Late orders, rota gaps and stock running out are cheaper to deal with now than mid-rush.
5. Put the **Kitchen** screen on the kitchen tablet and tap it once so the order chime can play.
6. Check each till’s loyalty scanner choice in **Settings → Configuration → Till** if a device has changed.

> If the location is wrong, orders, stock movements and reports are all recorded against the wrong site. It is the single most common cause of “the numbers look wrong”.

## During service

Build the ticket, then add the customer *before* you charge if they are collecting points or using a reward.

- Scan their loyalty code, or search by name, phone or email.
- Search before creating: a duplicate record splits someone’s history and their tier progress.
- Let the Kitchen screen drive the hand-off: **Start**, **Ready**, **Collected**.
- Approve QR cash orders in **Orders** with **Cash received** only once the customer has paid.

### If the internet drops

Keep serving cash and card-machine sales. The till saves them on the device and sends them when the connection returns.

| Do | Don't |
| --- | --- |
| Keep DUMA open on that till until the saved sales send | Clear the browser data or reset the tablet |
| Check Orders after reconnecting | Re-enter a sale you think was lost |
| Sign in again as the same person if prompted | Assume a paused sale is gone |

## Waste as it happens

Use **Log waste** on the stock item at the moment a breakage, spill or expiry happens, with the reason. On-hand is the sum of the containers you actually hold, so unrecorded waste turns into a variance later that nobody can explain.

## Closing checks

1. **Held tickets** — charge or discard them; a held ticket is not a sale.
2. **Orders and Kitchen** — is anything still New, Preparing or Ready that should be collected or cancelled?
3. **Cash up** — on the till, **Close the day**: count the drawer, enter the card terminal total, explain any difference.
4. **Stock** — anything running out or expiring that tomorrow needs? Use **Request more** now.
5. **Clock out** on My rota.

Five minutes at close saves the argument at the end of the week.`,
  },
  {
    slug: 'cash-up-and-reconcile',
    title: 'Cash up and close the day from the till',
    summary:
      'Open the trading day with a float, then close it at the till with a blind cash count, the card terminal total and a note for any cash or card variance.',
    category: 'Service',
    readMinutes: 6,
    updated: '2026-10-05',
    body: `Cash-up happens on the **till**, standing at the drawer. Each cash-up belongs to one **location** and one trading day, so check the location picker before you start. You need cash-up permission as well as permission to use the till; the old Cash-up page now opens the till’s cash-up for you.

## The Cash up button

The button in the till’s header tells you where the day stands:

| Button | Meaning |
| --- | --- |
| **Open the day** | Today has not been opened yet |
| **Cash up** | The day is open — use it to close |
| **Close yesterday** | An earlier day was left open. Close it before opening today |
| **Day closed** | Today is already closed |

## Open the day

1. Tap **Open the day**.
2. Enter the **Opening float** — it starts from the last float you used. You can also count it by notes and coins.
3. Confirm with **Open with £…**.

Only enter what is physically in the drawer. Do not copy yesterday’s float unless it is really there.

## Close the day

Closing is four steps: **Check**, **Count cash**, **Card total**, **Review**.

1. **Check** — the till warns about held tickets (“a held ticket isn’t a sale yet”) and sales still waiting to send from offline. Neither blocks you, but unsent sales are missing from what the till expects, so the count will look over. Wait for them if you can.
2. **Count cash** — count everything in the drawer, float included. Type a total or use the notes-and-coins counter.
3. **Card total** — enter the total from the card terminal’s end-of-day (Z) print.
4. **Review** — only now does the till show what it expected. This is a **blind count**: you count first so the figure stays honest.

The result is **Balanced**, **Over** or **Short**, for cash and for card. If either is out by **1.00 or more**, a note is required before the day closes. Add anything the next shift should know, then close.

> A closed day can’t be reopened. Check the figures before you confirm.

## Investigating a variance

| Result | Next check |
| --- | --- |
| Cash over or short | Recount notes and coins; check refunds, paid-outs and the float |
| Card over or short | Check the terminal batch, declined or retried payments, and the location |
| Both differ | Confirm the trading day, and that no sale was still waiting to send |

A variance should keep its explanation, not be edited until it disappears.

## History

Every closed day is in **Reports → End of day**: expected against counted, cash and card variance, the opening float and takings by tender. Use the **History** link on the closed-day summary to get there. An open day there shows **Close it at the till**.

Ask DUMA: “Has today been cashed up?” reads the cash-up status for the selected location.`,
  },
  {
    slug: 'run-the-kitchen-screen',
    title: 'Run the kitchen screen (KDS)',
    summary:
      'How tickets move through New, Preparing and Ready on the Kitchen display, what Late means, recall and undo, the order chime, and setting up the kitchen screen per device.',
    category: 'Service',
    readMinutes: 5,
    updated: '2026-10-05',
    body: `**Kitchen** in the sidebar is the kitchen display system (KDS). It shows paid orders for the selected location, oldest first, and is the shared source of truth between counter and kitchen. You need permission to update order status to open it.

## The three stages

| Lane | What it means | Button on the ticket |
| --- | --- | --- |
| **New** | Paid and released to the kitchen | **Start** |
| **Preparing** | Being made | **Ready** |
| **Ready** | Waiting for the customer | **Collected** |

Tap the ticket’s button to move it on. After each move a toast offers **Undo** for 10 seconds. **Recall** in the toolbar lists the last 10 moves on this screen with **Back to …**; a collected order cannot be reopened.

If another screen already moved the ticket, DUMA tells you where it is now rather than moving it twice.

## Reading a ticket

- The name is the customer’s, or a short order code.
- The channel shows **Counter**, **QR** or **Mobile**. Scheduled QR orders only appear when it is time to start them, and show **Collect HH:MM**.
- An **Allergens** banner, order notes and item notes are shown in full. Removals (“No…”, “Without…”) are always shown in red.
- The timer counts time in the current stage. From 2 minutes the ticket shows **Nearly late**; from 5 minutes it turns red and shows **Late**.
- With **Tap an item to mark it done** on, tapping an item strikes it through on this screen while the rest is made. It is not saved anywhere else.

## Toolbar

- **Live / Reconnecting / Offline** — the connection state. The screen refreshes every 10 seconds.
- **All day** — a side rail totalling every item still to make across New and Preparing.
- **Sound on / Sound off** — the order chime. Browsers only allow sound after the screen has been tapped once.
- **Full screen**.

When the screen is offline, tickets stay visible but buttons do nothing until it reconnects.

## Set up the kitchen screen

Open **Settings → Configuration → Kitchen screen** on the kitchen device. Choices are saved on that device and apply straight away:

- **Layout** — Lanes (New, Preparing and Ready side by side) or Tiles (one grid with stage tabs).
- **Ticket size** and **Text size** — larger text fits fewer tickets.
- **Tap an item to mark it done**, **Show modifiers**, **All-day count**.
- **Show the toolbar** and **Keep the screen awake**.
- **Order chime** — on or off, and the sound. Use **Preview** to test it.

## Counter-service locations

Each location has an **Order workflow** in **Settings → Workspace → Locations**. **Kitchen workflow** keeps paid tickets on the kitchen screen until they are made. **Counter service** completes a sale the moment it is paid, so stock and loyalty update at once.`,
  },
  {
    slug: 'set-up-qr-ordering',
    title: 'Set up QR ordering for collection',
    summary:
      'Turn on QR orders for a location, choose card or cash payment, set pickup times, publish the guest menu, print the QR code, then check why ordering is open or blocked.',
    category: 'Service',
    readMinutes: 8,
    updated: '2026-10-05',
    body: `QR ordering belongs to one **location**. Customers scan that location’s code, browse the same menu items and modifiers as the till, choose a pickup time, enter their name and pay. Paid orders follow the normal Orders and Kitchen workflow.

## Before you turn it on

1. **Menu** — items, prices, categories and modifiers are correct and on the menu.
2. **Location** — the timezone and opening hours in **Settings → Workspace → Locations** match the shop. Checkout uses the location clock, not the customer’s phone.
3. **Card payment** — add **Online checkout (Stripe)** in **Settings → Connectors → Card payments** if guests will pay by card.
4. **Cash** — decide whether staff will take cash at the counter. Cash orders stay out of the kitchen until approved.

## Configure the guest page

Open **Settings → QR ordering**. It configures the location selected in the location picker. Then set:

- **Take orders** — the main switch for this location.
- **Card payments** and **Cash at the counter** — at least one must be on. Cash is for ASAP orders only.
- **Pause new orders** — guests can browse, but checkout is closed.
- **Minimum order** — optional.
- **Welcome page** — headline, optional cover photo, and collection instructions.
- **Pickup times** — **Ready in** (how long you need), **A pickup every** (minutes between pickup times), **Orders per pickup** and **Book ahead** (up to 30 days).
- **Menu** — show or hide individual items on the QR menu without taking them off the till.

**Save draft** keeps your changes without showing guests. **Publish** saves and makes them live. The switches take effect when saved; the welcome page and item visibility reach guests when published. The header tells you whether ordering is live, paused or off, and whether there are changes not published yet.

## Print and test the code

Use **Download to print** for the QR code, **Copy link** to share it, or **Open the guest page**.

1. Scan the code on a phone that is not signed in to DUMA.
2. Add an item with its required choices to the basket.
3. Check the pickup times and both payment methods.
4. Place a small card order and confirm it appears in **Orders**, then on the Kitchen screen.
5. If cash is on, place a cash order and approve it in **Orders** with **Cash received** only once you are paid.
6. Check that a 6-digit email code links a known customer so the order earns loyalty points.

## Why a customer cannot order now

Ask DUMA: **“Why can’t a customer order here now?”** It checks the selected location and states the first real blocker:

| What DUMA reports | What to fix |
| --- | --- |
| QR ordering is disabled | Turn on Take orders and save |
| QR menu is not published | Publish |
| New orders are paused | Turn off Pause new orders and save |
| Store is closed | Correct the location hours, or wait until it opens |
| Trading hours are missing | Add hours in Settings → Workspace → Locations |
| Stripe Online is not connected | Add Online checkout (Stripe) in Settings → Connectors |
| No working payment method | Turn on cash or set up card payment |

Customers can still browse while the store is closed or ordering is paused, but checkout stays unavailable.

## Use Ask DUMA to manage it

- “Is QR ordering available at this location right now?”
- “Pause QR orders here.”
- “Allow cash orders and set the minimum order to £8.”
- “Set pickups every 15 minutes with six orders per pickup.”
- “Hide the iced latte from the QR menu, then publish it.”

Ask DUMA reads the current setup first and shows an editable approval card. Nothing is saved until an authorised person confirms it, and publishing is a separate approval.

## Orders, customers and loyalty

QR orders show the channel **QR table** in Orders and **QR** on the Kitchen screen. A customer can verify their email with a one-time code; if it matches a customer record, the order links to it and earns points. QR checkout does not spend points or rewards.

A basket is reserved for ten minutes while payment is completed or approved. Card orders reach the kitchen only after Stripe confirms payment; cash orders only after staff approve them. Unpaid orders expire and show as **Expired**.`,
  },
  {
    slug: 'receive-a-delivery',
    title: 'Receive a delivery without breaking your stock',
    summary:
      'Why a purchase order does not update stock until you receive the delivery, and how restock requests, containers, lots, expiry dates and invoice matching fit together.',
    category: 'Stock',
    readMinutes: 7,
    updated: '2026-10-05',
    body: `Stock in DUMA is physical. An item is not one number: it is a set of **containers**, each with its own remaining balance, lot number and expiry date. On-hand is their sum. Understanding that makes the rest of this obvious.

## The chain

A restock request becomes a purchase order, and a purchase order becomes stock only when the delivery is received against it. Everything lives under **Inventory**, on the **Restock demand** and **Purchase orders** tabs.

| Stage | What it means | Stock moved |
| --- | --- | --- |
| Restock request — Waiting for review | Someone used **Request more** on an item | No |
| Restock request — Approved | A manager agreed to buy it | No |
| Restock request — Ordered | It is on a purchase order | No |
| Purchase order — Draft | Written, not sent to the supplier | No |
| Purchase order — Awaiting delivery | Marked as sent to the supplier | No |
| Purchase order — Part delivered | Some lines arrived | Yes, what arrived |
| Purchase order — Received | Everything arrived | Yes, in full |

To order, use **Create purchase order** on one approved request, or — on the Approved filter — order all approved requests for one location together. A draft PO is the one people forget: until you use **Mark as sent to supplier**, nothing is on its way.

## Receiving what actually turned up

Open the purchase order and use **Receive delivery**. Enter quantities per line against what is physically in front of you, not what the paperwork says, then **Record delivery**.

1. **Received** — the quantity for each line.
2. **Containers** — the number of bags, bottles or boxes, if it differs from the default pack.
3. **Expiry** — required for perishable lines. It drives the expiry warnings and the order stock is used in.
4. **Lot** — add it when the supplier prints one. It is what a recall is traced by.

Part deliveries are normal. Receive what came; the rest stays outstanding and the order shows **Part delivered**.

## Use-first order

Containers are used open-first, then earliest expiry, so the oldest usable stock goes first. This only works if expiry dates go in at receipt.

## Matching the invoice

In the order’s **Invoice** section, enter the **Invoice number** and **Amount**. DUMA tells you whether it matches the order total or by how much it differs. Turn on **Invoice matched** once it is checked against the delivery, then **Save invoice**. A mismatch is usually a price change, a short delivery or a substituted product — all worth knowing before you pay.

> Never fix a difference by editing a stock total. Record what happened — waste, a part delivery, a stocktake difference — so the reason survives.

## What good looks like

- No purchase orders sitting in Draft.
- No perishable container without an expiry date.
- Every difference between the invoice and the order explained.

Ask DUMA can draft a restock request or a purchase order for you to approve, for example “Draft a purchase order for oat milk from our usual supplier.”`,
  },
  {
    slug: 'stocktake-and-variance',
    title: 'Count stock and read the stocktake variance',
    summary: 'How to run a stocktake that produces a number you can act on, apply it, and read what each difference is telling you.',
    category: 'Stock',
    readMinutes: 5,
    updated: '2026-10-05',
    body: `A stocktake compares what you counted against what DUMA expected. The gap is the **variance** (shown as differences), and it is the most useful number in inventory — provided the count is honest.

## Before counting

- Count when nothing is moving. Mid-service counts are wrong by the time you finish.
- **Log waste** for anything outstanding first. Unrecorded losses show up as variance and hide the real problem.
- Receive any delivery that has physically arrived. Stock on the shelf but not received reads as a surplus.

## Counting

Open **Inventory → Stocktakes** and use **Start stocktake** for the selected location. Count containers, not guesses: a half-used bag is a container with a remaining balance.

1. Work through the list in a fixed order, shelf by shelf, so nothing is counted twice.
2. Enter what you find, including zero. A skipped line is not the same as a zero.
3. Use **Save counts** to keep progress. Turn on **Blind count** to hide expected figures while you count.
4. When finished, use **Review & apply**. The review shows Counted, Matched and Differences, and flags any **Large difference**. **Keep counting** takes you back.

Applying the count corrects stock and the stocktake shows as **Applied**.

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

- Adjust the recipe under **Menu → Recipe & cost** if usage is systematically wrong.
- Retrain on portioning if one item drifts on one shift pattern.
- Check the receiving process if surpluses keep appearing.

Then re-count that item next week and see whether the change worked. The **Stock usage** and **Waste & loss** reports show the movement between counts.`,
  },
  {
    slug: 'customer-loyalty-and-records',
    title: 'Customer records, loyalty points, stamps and rewards',
    summary:
      'Find and create customers, read the customer record, set up loyalty programmes (points, stamp cards, reward vouchers), understand tiers, adjust points and merge duplicates.',
    category: 'Customers',
    readMinutes: 8,
    updated: '2026-10-05',
    body: `**Customers** holds one record per guest: their contact details, what to know before serving them, their orders, loyalty and marketing consent. You need permission to read customers to open it; creating, editing, adjusting points and merging each need their own permission.

## Find a customer

Search by **name, email or phone**. Narrow the list by tier, last visit (for example “Not seen in 60 days”), and under **More filters** by birthday, marketing consent, lifetime spend, visits, allergies or dietary needs. Switch between card and list view.

Save a filter you use often with **Segments → Save current filters…**. A segment is a live audience: it re-runs the filters each time.

**New customer** creates a record: name, phone, optional email and date of birth, allergies and dietary needs, alerts (Note, Warning or Critical) and marketing email consent. At the till, search first — a duplicate splits someone’s history.

## The customer record

The record has three tabs:

- **Guest** — the **Before you serve** block (allergies, alerts, dietary, seating), lifetime spend and visits, **Points**, **Loyalty cards** and the visit pattern.
- **Timeline** — orders, points, emails, consent changes and privacy events, filterable.
- **Compliance** — marketing consent and this customer’s privacy requests.

From **Actions** you can **Send email**, **Adjust points**, **Give birthday reward** and **Edit details**. **Start an order** opens the till with this customer already on the ticket. The **Loyalty card** panel shows their member QR code to scan.

## Tiers

Tiers come from the points balance and are fixed: **Bronze** from 0, **Silver** from 100, **Gold** from 300 and **VIP** from 800 points. They are not set per programme.

## Loyalty programmes

Use **Loyalty rules** on the Customers page to open **Loyalty programmes**, then **New programme**:

1. **Programme details** — name, the unit name (for example stamp/stamps) and status. **Draft** is hidden from customers and the till; **Active** issues benefits; **Paused** stops them.
2. **What customers earn** — Rewards, Points, or Points and rewards.
3. **How customers receive it** — on purchases (every product, selected categories or selected products, and units per item) or as a **Birthday benefit**.
4. **What customers can claim** — a free item, a free modifier or a percentage off, after a number of units (for example 9 stamps), with an optional maximum value and an expiry.
5. **Where it applies** — all locations or chosen ones.

Earned rewards appear on the record under **Loyalty cards** as **Reward ready**, with their expiry. Staff apply them at the till under **Customer rewards**; QR checkout does not spend rewards.

## Correcting points or stamps

Use **Adjust points** (or **Adjust stamps** on a stamp card). Choose add or remove, the amount, and a reason — **Missed scan**, **Service recovery**, **Goodwill gesture** or **Correction**. A reason is required for stamps and recommended for points. The balance cannot go below zero.

Before adjusting, check the customer’s recent orders, an offline sale still waiting to send, and whether they have a duplicate record.

Ask DUMA can prepare a points adjustment for you to approve: “Add 20 points to Sam Patel for a missed scan.”

## Duplicate records

**Find duplicates** opens **Duplicate customers**, which pairs records with the same email or the same name. Choose **Review & merge**, then pick the record to keep:

- Orders, emails and history are combined; points balances are added together.
- Allergies and dietary needs are kept from both; the kept record’s contact details stay, with blanks filled from the other.
- Marketing consent is **not** transferred.

A merge can be undone from the merged record with **Separate**. Do not merge on a similar name alone — open both records when unsure, and use **Not the same person** to skip a pair.

## Marketing consent

The **Compliance** tab shows email consent as **Opted in**, **Opted out** (receipts and confirmations still go) or **Suppressed** (nothing may be sent). Record changes with **Record opt-in** or **Record opt-out**, noting how it was given. Every change is kept in the history.`,
  },
  {
    slug: 'email-that-sends',
    title: 'Set up customer email that actually sends',
    summary:
      'The four things that must all be true before a customer receives an email — connection, template, automation, consent — and how to read a failed delivery in History.',
    category: 'Customers',
    readMinutes: 6,
    updated: '2026-10-05',
    body: `Customer email needs four things to line up. If any one is missing, nothing arrives and nothing looks broken.

## The four requirements

1. **A connected mailbox.** Email is sent from your own address — Gmail/Google Workspace, Microsoft 365 or another provider (SMTP) — connected in **Settings → Connectors → Email**.
2. **A template.** The email itself: subject and body, with variables filled in when it sends.
3. **An automation.** The rule that decides *when* the template goes out.
4. **Someone who may receive it.** A customer with an email address, who has opted in for marketing and is not suppressed. Receipts and order updates still go to opted-out customers.

The Communications header shows **Email connected**, **Email not verified** or **Email not set up**.

## Templates

Start from a ready-made template and change the wording rather than writing from scratch. Variables such as the customer’s name and order details are replaced at send time — write around them and preview before saving.

Deleting a template stops any automation step that uses it. Emails already sent stay in History.

## Automations

An automation is a trigger plus one or more send steps. Triggers include an order being placed, ready for collection, completed or cancelled; a new customer; a birthday; a customer not visiting for a while; a customer entering a segment; and staff events such as onboarding, approved leave or a document nearing expiry.

Switch it on only once the template reads the way you want, because it starts sending immediately.

> Test with a real order on a quiet shift before switching on anything customer-facing. History shows exactly what was sent.

## Reading History

Every message lands in **History**, and the tab counts failures:

| Status | Meaning | What to do |
| --- | --- | --- |
| Waiting | Queued to send | Nothing — check back shortly |
| Sending | In progress | Nothing |
| Sent | Handed to the mail server | Done. Inbox delivery is the provider’s job |
| Failed | Could not be sent | Read the error, fix the cause, then **Try again** |
| Cancelled | Stopped before sending | Check why — often an erased or suppressed address |

Authentication errors point at the connection; a rejected address points at the customer record.

## Suppressions

**Suppressions** lists addresses that must not receive marketing and lifecycle email: unsubscribes, bounces, complaints, privacy erasures and addresses added by hand. Receipts and order updates still go out unless the customer is fully suppressed on their record.

## A working setup

- Mailbox connected and verified.
- One template per thing you actually want to say.
- Automations on, each pointing at a template that exists.
- No failed deliveries older than a day sitting unread.

Ask DUMA: “Is customer email working?” reads the connection and recent delivery status.`,
  },
  {
    slug: 'handle-privacy-requests',
    title: 'Handle customer and staff privacy requests (GDPR)',
    summary:
      'Record a data access, erasure, correction or portability request on the Compliance page, track the one-month deadline, download data, erase and complete it.',
    category: 'Customers',
    readMinutes: 6,
    updated: '2026-10-05',
    body: `Privacy requests — someone asking for a copy of their data, to correct it or to delete it — are handled on the **Compliance** page, under Reports in the sidebar. You need privacy permission to see it; recording and working requests, downloading data and erasing each need their own permission.

## Record the request

Use **Record request** and fill in:

1. **Who asked?** — a customer or a member of staff, found by search.
2. **What are they asking for?** — one of:
   - **A copy of their data** (access request)
   - **Delete their data** (erasure)
   - **Correct their data** (rectification)
   - **Their data to take elsewhere** (portability)
   - **Pause using their data** (restriction)
   - **Stop one use of their data** (objection)
3. **How did it reach you?** — in person, email, phone, website or noted by staff.
4. **In their words** — optional, but useful later.

The deadline is set to **one calendar month** from the day you record it.

## Work the queue

The page shows **Open**, **Due this week**, **Overdue** and **Closed in 30 days**. Each request shows how long is left (“Due in 5 days”, “Due today”, “2 days overdue”).

Keep the status current: **New**, **Working on it**, **Waiting for ID**, then **Completed** or **Declined**. Confirm who the person is before you hand over or change anything — set **Waiting for ID** while you wait.

## Finish the request

- **Download their data** — for access and portability requests.
- **Complete** — say what you did in **What did you do?**, including how you confirmed their identity.
- **Erase and complete** — for erasure. You must type ERASE. Name, phone, email and date of birth are overwritten; preferences, alerts and notes are cleared; sent emails are redacted and unsent ones cancelled. Orders and payments are kept against an anonymous record.
- **Decline** — give the reason. Tell the person, and that they can complain to the ICO.

Corrections are made on the customer or staff record itself; there is no separate correct action.

## Keep it safe

- Never paste exported data, passwords or card details into Ask DUMA or a support request.
- Use the **Audit log** to confirm who changed what, and when.
- A customer’s open requests also show on the **Compliance** tab of their record.

Ask DUMA: “Which privacy requests are overdue?” lists requests and their deadlines.`,
  },
  {
    slug: 'onboard-a-starter',
    title: 'Onboard a new starter properly',
    summary:
      'Add a team member from Staff → Team, set their role, locations, contract and pay, send their sign-in link, and close the gaps that stop payroll being run.',
    category: 'People',
    readMinutes: 6,
    updated: '2026-10-05',
    body: `Onboarding creates two things at once: an **account** they sign in with, and an **employment record** that holds their terms. Both matter, and a record with only one of them causes problems later.

## Start in the right place

Use **Onboard** on **Staff → Team** (you need onboarding permission). The **New team member** flow has four sections, then a review:

1. **Account** — name, email, role and access. DUMA emails them a single-use sign-in link; nobody can join a workspace without an invitation.
2. **Personal** — birthday, address and emergency contact (all optional now, but needed later).
3. **Job & pay** — job title and department; contract (**Full time**, **Part time**, **Zero hours** or **Contractor**); start date; pay type (**Hourly** or **Salaried**) with the rate or salary; and the unpaid break rule.
4. **Tax & bank** — National Insurance number, tax code and bank details (optional now).

Optional steps can be skipped with **Skip for now**. Finish with **Add [name]** and the new record opens.

Getting these right at the start saves rework:

- **Role** — decides which areas of DUMA they can open at all.
- **Access** — **At chosen locations**, **Across their franchise** or **Everywhere**. Someone with no location cannot open any.
- **Start date** — a future date is fine.

## Finish the record

The record flags what is still missing: no bank details, no National Insurance number, no rate set, no department, no work pattern, nobody to call, no location. Anything affecting pay matters most, because payroll run on an incomplete record is the expensive kind of mistake.

The **Before their first shift** checklist covers right to work, the written statement, the HMRC starter checklist or P45, pension and work pattern.

> Pay, bank and statutory details need sensitive HR permission. By default HR managers, franchise owners and super admins hold it; a store manager can run the team and the rota without seeing pay.

## First week

- Plan their shifts in **Staff → Rota & shifts** and publish them, so they appear in **My rota**. Drafts are visible only to managers.
- Point them at **My HR** for leave, attendance queries, documents and payslips.

## Someone leaving

Use **Offboard** on their record. They can no longer sign in, but their record, hours and documents are kept, and **Reactivate account** brings them back if they return.`,
  },
  {
    slug: 'use-my-rota-and-clock-in',
    title: 'Use My rota: shifts, clocking in and out',
    summary:
      'See your week of shifts and leave, slide to clock in, clock out at the end of a shift, check worked hours and estimated pay, and spot new or changed shifts.',
    category: 'People',
    readMinutes: 5,
    updated: '2026-10-05',
    body: `**My rota** in the sidebar shows your own shifts and is where you clock in and out. Everyone can open it.

## Your week

The calendar shows one week. Use **Previous week**, **This week** and **Next week** (or the ← and → keys), or **Go to a date** to jump to any week.

- Each shift shows its time and location. Empty days show **Off**.
- Approved leave shows as a solid card and leave awaiting approval as a dashed one. Request leave in **My HR → Time off**.
- **New** and **Changed** badges mark shifts that are new or moved since you last looked on this device.

Tap a shift to open its details: when and where, your role, the break, paid time, estimated pay, any **Note from your manager**, and **On the clock** — the clock-ins recorded against it.

Above the calendar, four facts summarise the week: **Next shift** (looking up to five weeks ahead — tap it to jump there), **Scheduled**, **Worked**, and **Est. pay** for hourly staff (before deductions) or **Breaks** for everyone else.

## Clock in

1. Check the location picker at the bottom of the sidebar shows where you are working.
2. Drag **Slide to clock in**.

You can clock in from an hour before a shift starts; it links to that shift. Clocking in without a planned shift still records your time, and your manager can turn it into a rota shift later. The till also has a **Slide to clock in** gate, so clocking in there works too.

While you are on shift, the panel shows when you started, time against the plan, the location and your break. If you run over it says how far past your finish you are.

## Clock out

Use **Clock out**, then confirm in **End of Shift**. Breaks are not started or stopped — they are an unpaid break rule your manager sets, taken off your paid time automatically.

## If something is wrong

- **A shift you worked shows Not clocked** — tell your manager, or open the day in **My HR → Attendance** and use **Query this day**.
- **A shift or location looks wrong** — ask your manager; they change the rota in Staff.
- There is no shift swap in DUMA yet — arrange swaps with your manager.

Ask DUMA: “When is my next shift?” or “What hours have I worked this week?”`,
  },
  {
    slug: 'use-my-hr',
    title: 'Use My HR for your own work details and payslips',
    summary:
      'Update your address, emergency contact and bank details, request time off, check attendance, read payslips and documents, and ask HR privately. Expense claims are not handled in DUMA.',
    category: 'People',
    readMinutes: 5,
    updated: '2026-10-05',
    body: `**My HR** is the self-service workspace for information about **you**. Everyone can open it. It has five tabs: **Overview**, **Time off**, **Attendance**, **Documents** and **Requests**.

## Overview

**Needs you** comes first: a missing address, emergency contact or National Insurance number, expiring documents, and HR replies waiting for you. Below it are your employment facts, hours worked this month and your latest payslip.

Use **Edit your details** to update your **Home address**, **Emergency contact** and **Pay details** (account holder, sort code, account number and National Insurance number). Changes go straight to your HR record. Stored bank details are never shown back to you — leave them blank to keep what is on file. Pay rates and employment terms are set by authorised HR staff.

## Time off

Shows your balances for the leave year, upcoming leave and history. **Request time off** asks for the type of leave (with what is left), the first and last day, the day length (full days or a half day at either end) and an optional note. Your manager decides in Staff → Leave, and approved leave appears on My rota.

## Attendance

A month calendar compares what you worked with your rota: **Worked**, **Short**, **Missed**, **Leave**, **Rostered** or **No shift**. Open a day to see the detail. If it is wrong, use **Query this day** — it raises an attendance correction request with the day attached. **Report a problem** does the same for anything not tied to one day.

## Documents and payslips

Documents lists what HR holds for you and when anything expires. **Payslips** shows each issued payslip — gross pay, deductions and take-home pay — once payroll has issued it. **Request a document** asks HR for something, and **Request your data** asks for a copy of the data DUMA holds about you.

## Requests

**Ask HR** opens a private request. Pick a topic — HR, Payroll, Scheduling, Leave, Workplace, IT or Something else — then the subject, urgency (Normal, High or Urgent) and details. Replies stay on the same request, so reply there rather than raising a new one.

## Expenses

DUMA does not handle expense claims. Ask your manager or HR how expenses work in your business.

## Ask DUMA

Ask DUMA can read your own profile, attendance and notices, and can prepare a leave request, an HR request or a change to your details for you to confirm. Try “What needs my attention?”, “Book Friday off” or “Update my emergency contact”.

> Your personal HR information follows the same access rules as My HR. Other employees cannot use Ask DUMA to read it.`,
  },
  {
    slug: 'read-your-reports',
    title: 'Read your reports: sales, profit, labour and end of day',
    summary:
      'How the Reports home, report library, date ranges, comparisons, targets and prime cost work, what net sales counts, and where to find the End of day cash-up report.',
    category: 'Reporting',
    readMinutes: 8,
    updated: '2026-10-05',
    body: `Most reporting disputes are not about the data. They are about two people looking at different dates, different locations, or a metric that does not mean what they assumed.

## Always check three things first

The filters sit in the page header (under it on a phone) and carry across every report:

1. **Dates** — a preset such as **Today**, **This week**, **Last 30 days** (the default), **This month** or **This year**, or a custom range. Weeks start on Monday.
2. **Comparison** — **vs previous period** (the same number of days immediately before), **vs same days last year**, or no comparison. Last year compares weekday to weekday (364 days back), except whole calendar months, which compare month to month.
3. **Location** — all locations or one site.

That is where nearly every “these numbers are wrong” conversation ends. Today is incomplete until it ends, so compare it with care.

## The Reports home

- **Net sales** — net sales for the range with its change, gross sales, and a chart by day, week or month, with the comparison as a dashed line. Below it: **Orders**, **Average order**, **Refunds** and **Average a day**.
- **Target** — when a location has a **Daily revenue target**, a bar shows progress against it for the days so far, and the chart draws the target line. Set it in **Settings → Workspace → Locations**, or with **Set a target** on the Dashboard.
- **Worth knowing** — best day, days on target, peak hour, best seller and leading channel, each linking to its report.
- **Profit** — prime cost: food and labour as a share of sales without VAT, with food cost, labour and gross profit. It says when it is an estimate because not every item has a costed recipe.

## The report library

**All reports** lists every report you can open, grouped by category. Search it (“VAT”, “waste”, “Z report”) and star ★ the ones you use to pin them under **Favourites** on this device.

| Category | Reports |
| --- | --- |
| Sales | Sales summary, Sales by hour, Sales by channel, Sales by location |
| Profit | Prime cost |
| Payments & tax | Payment methods, VAT |
| Menu | Item & category sales, Menu engineering |
| Refunds & exceptions | Refunds, Discounts & voids |
| Labour | Labour vs sales, Staff hours |
| Customers | Customer retention |
| Inventory | Stock usage, Waste & loss, Purchasing |
| Cash & end of day | End of day |

Each report has headline figures with change, a chart and a sortable table with totals. Click a row to open its detail or the orders behind it. Use **Export CSV** or print from the header.

## What the main figures count

| Figure | Counts | Watch out for |
| --- | --- | --- |
| Net sales | Gross sales after refunds | Refunds change the past |
| Orders | Order count, not items | A large order counts once |
| Average order | Net sales ÷ orders | Moves when either side moves |
| Prime cost % | (Food cost + labour) ÷ sales without VAT | Only as good as your recipe costs |
| Labour % | Estimated labour cost ÷ net sales | Estimated from pay rates |
| Sales per labour hour | Net sales ÷ paid hours | Unplanned or uncorrected hours skew it |

Read the costing note on Prime cost and Menu engineering. A recipe missing an ingredient cost makes a margin look better than it is.

## End of day

**End of day** shows each day’s cash-up: expected against counted cash, cash and card over/short, and days that did not balance. Click a day for the opening float, open and close times and takings by tender. Days are opened and closed on the till under **Cash up** — see [Cash up and close the day from the till](/support/cash-up-and-reconcile).

## Who sees what

Most reports need analytics permission. Refunds, Waste & loss, Purchasing and End of day each have their own permission, so someone can see End of day without seeing sales. Only reports you can open are listed.

## Three traps

- **Comparing a part period to a whole one.** Today is incomplete until it ends.
- **Reading a rate on tiny volumes.** One cancellation out of four orders is 25%.
- **Assuming stock value equals cost of goods.** Waste and stocktake differences sit between them.

Ask DUMA: “How did sales compare with last week?” reads the same sales figures for the selected location.`,
  },
  {
    slug: 'set-up-your-dashboard',
    title: 'Set up your dashboard layout and daily target',
    summary:
      'Choose which dashboard panels you see and their order, use quick layouts, reset to the default, and set the daily sales target the dashboard and reports track.',
    category: 'Reporting',
    readMinutes: 4,
    updated: '2026-10-05',
    body: `The **Dashboard** is the first page in the sidebar. What it shows depends on your access and your layout.

## What you see

- Owners and managers with analytics access see **Today**: the current trading day for the selected location, or every location you can access.
- Everyone else sees **My workday**: your shift, your rota this week and the way into the till.

The panels available to managers are:

| Panel | What it shows |
| --- | --- |
| What needs attention | **Needs you** — late orders, staff clocked in off the rota, unassigned shifts or no-shows, stock running out and urgent restocks, each with a button to fix it |
| Taken today | Net takings so far against a typical day for this weekday, a projected close and the daily target |
| Live service | Orders waiting, preparing, ready and late, and who is clocked in |
| Today in numbers | Orders, average order, labour % and refunds paid |
| Orders by hour | Today’s orders hour by hour |
| Top items today | Best sellers by quantity, net of refunds |

## Choose your panels

Open **Settings → Configuration → Dashboard**. Only panels your access allows are listed.

- Use the eye toggle to show or hide a panel, and **Move up** / **Move down** to reorder.
- **Quick layouts** apply a preset: **Balanced** (the default overview), **Service first** (live work before figures), **Essentials** (a quieter daily view) or **Numbers first** (performance at the top).
- Changes save automatically to your account, so your layout follows you to any device. The **Preview** shows the result.
- The badge reads **Personal view** once you have changed it. **Reset layout to default** returns to the workspace layout.

## Set the daily target

On **Taken today**, use **Set a target** (or **Target £…**) to enter the net takings this location aims for in a day. The same target can be set per location in **Settings → Workspace → Locations** as **Daily revenue target**. Reports use it for the target bar, the target line and days on target.

Leave it empty for no target.`,
  },
  {
    slug: 'set-up-your-workspace',
    title: 'Set up your workspace: sign-up, modules, readiness and inviting staff',
    summary:
      'Create a DUMA workspace, choose modules, add locations and opening hours, work through the readiness checklist, invite staff and reset a password.',
    category: 'Workspace',
    readMinutes: 7,
    updated: '2026-10-05',
    body: `A **workspace** is your business in DUMA. It holds one or more **locations**, the people who work there, and the **modules** — the tools — you use.

## Create a workspace

Use **Create a workspace** on the sign-in page. The set-up asks about your business in four short sections — **Business**, **Operations**, **Team & customers** and **Account** — and your answers are saved on the device, so you can come back to it.

1. Tell DUMA what you sell, whether you serve food or drink, your business type and how many locations you have.
2. Answer how you take and fulfil orders: kitchen screen, QR table ordering, card and cash, stock tracking, suppliers.
3. Choose the team and customer tools you need, such as rotas, clocking in, leave, payroll and loyalty.
4. Review **Your proposal** — the modules DUMA will switch on, and optional ones worth adding. **Looks right** accepts it.
5. Enter your name, work email, a password (at least 12 characters) and your first location, then **Create workspace**.

When it is done, **Continue setup** takes you to **Settings → Workspace**.

## Modules

**Settings → Modules** shows **Your tools** — which modules are on. Sign-in, roles and workspace settings are always on. **Review my setup** re-runs the questions and proposes changes, which you apply with **Switch them on**.

Before a module is switched off, DUMA previews what changes: which pages leave the sidebar, which dashboard panels go, and which modules depend on it. Your data is kept — nothing is deleted. A module that is off hides its pages from everyone, whatever their role.

## Locations

In **Settings → Workspace → Locations**, add each site with its address, **Timezone**, opening hours, **Order workflow** and optional **Daily revenue target**. The timezone and hours drive QR ordering, cash-up trading days and hourly reports.

## The readiness checklist

**Settings → Workspace** shows a readiness checklist until the workspace is confirmed ready (it also appears as the **Workspace readiness** dashboard panel). **Check readiness** reads the modules you use and lists what is left before service, each with a **Fix** link. Nothing is ticked by hand. When it reads **Ready for service**, use **Confirm ready**. The checklist comes back if a later change breaks something.

A good order to work in: trading details and VAT (**Trading & tax**), locations and hours, the menu, card payments and email (**Connectors**), then your team.

## Invite your team

DUMA is invite-only — staff cannot sign themselves up. Add each person with **Onboard** on **Staff → Team**. They receive a single-use link by email to set a password and activate their account. See [Onboard a new starter properly](/support/onboard-a-starter).

## Passwords and signing in

- Passwords need at least 12 characters. A password manager is best.
- **Forgot password?** on the sign-in page emails a single-use reset link.
- Change your password in **Settings → Security**; it signs your other devices out.

## Install DUMA on a device

Use **Settings → Profile → Install the app**. On iPad or iPhone, use the browser’s Share menu and **Add to Home Screen**. Installing is worth it for dedicated till and kitchen tablets.`,
  },
  {
    slug: 'admin-security-and-compliance',
    title: 'Administer DUMA safely: settings, access and security',
    summary:
      'A map of the Settings tabs — Workspace, Roles & access, Modules, Trading & tax, Connectors, Security — plus audit log, compliance and where each admin job lives.',
    category: 'Workspace',
    readMinutes: 7,
    updated: '2026-10-05',
    body: `Administrative work is split so everyday managers can run service without automatically seeing payroll, private HR data or business-wide settings. Access comes from **permissions** attached to each role, not from a ranking of roles.

## Where each job lives

| Job | Page |
| --- | --- |
| Your theme, brand colour, installing the app | Settings → Profile |
| Your email, password and signed-in devices | Settings → Security |
| Till, Kitchen screen and Dashboard layout | Settings → Configuration |
| Business name, locations, opening hours, order workflow, daily targets | Settings → Workspace |
| Roles and what each one may do | Settings → Roles & access |
| Which tools the workspace uses | Settings → Modules |
| Receipt details, VAT and menu prices | Settings → Trading & tax |
| Email mailbox, card readers and online card checkout | Settings → Connectors |
| QR ordering for a location | Settings → QR ordering |
| Payroll schedule | Staff → Payroll → Payroll settings |
| Customer and staff data requests | Compliance |
| Who changed a record and when | Audit log |
| Possible duplicate customer records | Customers → Find duplicates |

If a tab or page is absent, your role does not hold the permission it needs, or its module is switched off. Changing location does not grant a missing permission.

## Locations

In **Settings → Workspace → Locations**, each location has a name, phone, address, **Timezone**, **Order workflow** (Kitchen workflow or Counter service), opening hours per weekday, a **Daily revenue target** and **Open for trading**. The timezone and hours drive QR ordering, cash-up trading days and hourly reports, so get them right first.

## Roles & access

Roles are listed as **Built in** or **Custom**. Built-in roles cannot be edited. A custom role can be named, described and given exactly the permissions it needs. Saving a role makes the people on it sign in again so the change applies. Reassign people before deleting a role.

Pay, bank and statutory details sit behind their own sensitive HR permission, so a role can manage the team and the rota without seeing pay.

## Security

**Settings → Security** lets you change your email and password — changing the password signs your other devices out — and lists your signed-in **Devices**, each with **Sign out**. Check it if you were signed out unexpectedly or use a shared tablet.

## Connections and secrets

Set up payment and email connections only in **Settings → Connectors**. Test with the intended location and device before service. Ask DUMA and support may explain connection state, but secrets belong only in the connection form — never paste keys or passwords into a chat or support request.

## Audit evidence

The **Audit log** records who did what and when. Search people, records and details, and narrow it with **Who** and **What** (the kind of record). It does not by itself explain why — match the entry to the order, customer, staff member or setting, then follow up with the person.`,
  },
];

export const ARTICLE_CATEGORIES: ArticleCategory[] = ['Service', 'Stock', 'Customers', 'People', 'Reporting', 'Workspace'];

export function getSupportArticle(slug: string): SupportArticle | undefined {
  return SUPPORT_ARTICLES.find((article) => article.slug === slug);
}
