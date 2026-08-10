# DUMA dashboard — Service Board / Shift Lanes

Approved comp: `.impeccable/mocks/duma-service-board-c.webp`

## Strategy

Make daily operations feel like a warm, legible café service board rather than a technical monitoring console. The dashboard is task-led; reporting remains available without dominating the first view. The timeline is the dashboard signature and should not be forced onto forms, settings, or dense tables.

## Component grammar

- Warm oat page canvas with a deep forest navigation shell.
- White or lightly tinted work surfaces separated by soft 1px boundaries and restrained shadows.
- Small 6–8px corners; attached tabs and segmented controls, never floating pills.
- Archivo is the workhorse face. Titles are sentence case and compact; labels avoid theatrical tracking. Tabular figures use the mono companion sparingly.
- Apricot owns orders and the primary action; periwinkle owns kitchen/reference; saffron owns stock/warnings; green owns team/success; red remains exceptional.

## Visible ingredient inventory

| Ingredient | Commitment | Medium |
| --- | --- | --- |
| App shell | Forest sidebar, oat header/canvas, grouped navigation | Semantic HTML/CSS + existing icons |
| Page masthead | “Today at Bridge Street”, calm supporting copy, compact primary action | Semantic HTML/CSS |
| Time tabs | Attached Now / This shift / This week edge labels | Existing segmented control, restyled |
| Shift lanes | Four horizontal, domain-coloured operational lanes with real counts and destinations | React + semantic HTML/CSS |
| Context workbench | Stable attention panel for stock, restocks, delayed orders, and healthy state | React + existing live data |
| Supporting analytics | Revenue, orders, customer mix, demand and location sections below the fold | Existing components, restyled |
| Primary action | Solid apricot magnetic key with 7px corners and clear verb | Existing Button primitive |

## Compositional commitments

The first viewport has one dominant operational board and one narrower context panel. Headline scale is clear but not oversized. The colored lanes carry meaning and vary in length/density; they are not decorative stripes. Mobile stacks the context panel after the lanes, keeps tabs horizontally available, and preserves 44px touch targets.
