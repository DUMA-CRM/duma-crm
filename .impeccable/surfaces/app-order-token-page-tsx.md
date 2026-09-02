---
version: 1
slug: "app-order-token-page-tsx"
primary_target: "app/order/[token]/page.tsx"
related_targets: ["components/ordering/QrOrderExperience.tsx"]
---

Mode: Operate.

Audience: a café customer standing near the counter or ordering on the way to collect. Their task is to browse the location menu, make valid modifier choices, keep a clear running order, identify the collection name and time, optionally link an existing loyalty profile by email code, pay or request counter approval, and track the kitchen handoff.

Direction: a calm counter handoff. Categories read as an attached shelf rail; menu items stay spacious; the order docket remains visible on desktop and becomes a fixed bottom action plus sheet on mobile. The menu, checkout and tracking views inherit DUMA's warm oat ground, porcelain work surfaces, forest masthead and compact magnetic controls without importing the staff application shell.

Memorable moment: the order becomes a live collection docket after checkout. Its ten-minute payment or counter-approval clock gives way to the same pending, preparing, ready and collected stages the staff see. A paid scheduled order remains visibly held until its stated kitchen release time instead of pretending preparation has begun.

Truth and state contract: creating an order is not success. Card orders become accepted only after a verified Stripe webhook; cash orders become accepted only after explicit staff approval. Until then, the docket shows the approval path and the remaining time. Unpaid or unapproved orders expire after ten minutes and never enter KDS. Accepted ASAP orders track pending → preparing → ready → collected; accepted scheduled orders disclose their kitchen release time and remain on hold until then. Failed, cancelled, expired and refunded outcomes stay explicit and offer an honest recovery path.

Constraints: published data only; browse while closed or paused; scheduled collection is card-only; GBP and en-GB; arbitrary manager-supplied menu images; generous phone touch targets; email identity is optional and customer existence is revealed only after code verification.
