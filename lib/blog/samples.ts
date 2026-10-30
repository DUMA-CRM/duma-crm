import type { BlogPost } from '@/lib/blog/posts';
import { readingMinutes, wordCount } from '@/lib/utils/blog';

/**
 * Sample posts for a local dev server with DUMA_BLOG_SAMPLES=true, so the blog
 * pages can be designed and checked before real posts exist. listPosts and
 * getPost return them only when NODE_ENV is development — production never
 * shows them — and every page marks them "Sample".
 */

const MARGIN_BODY = `Most cafés price their menu by looking at what the café down the road charges. That works until milk, butter and coffee go up and the prices on the board don't.

## What gross margin actually means

Gross margin is what you keep from a sale after paying for the ingredients — and, if you're VAT-registered, after taking out the VAT that was never yours.

| Item | Price | Ingredients | VAT (20%) | You keep |
| --- | ---: | ---: | ---: | ---: |
| Oat flat white | £3.60 | £0.75 | £0.60 | **£2.25** |
| Almond croissant | £3.20 | £0.95 | £0.53 | **£1.72** |

> [!TIP]
> Bread is zero-rated for VAT in the UK, so a loaf keeps more of its price than a cake at the same price.

## How to work it out

1. List every ingredient in the recipe, with the quantity you actually use.
2. Price each one from your latest supplier invoice.
3. Take VAT out of the selling price if you're registered.
4. Subtract the ingredient cost. What's left is your margin.

### Doing it in DUMA

Add a recipe to each item once, and DUMA works this out for every dish — on the menu, in the reports and on every sale.

![The DUMA till with an order in progress](/marketing/screenshots/pos.png "Every sale updates the margin report.")

## What a good margin looks like

There's no single right number. Drinks usually carry more margin than food, and a few low-margin favourites can be worth keeping if they bring people in. The point is to know the number, so the decision is yours.`;

const ROTA_BODY = `A rota in a group chat works for a team of three. By ten, shifts get missed, swaps get lost and nobody can see what the week will cost.

## Start from the trade, not the team

Look at when you're actually busy. Most cafés have two peaks and a long quiet middle — staff the peaks, not the whole day.

## Put the rota where people already look

Your team checks their phone, not the back-office wall. Publish the rota there, and let people ask for leave in the same place.

> [!NOTE]
> Keep staff cost next to takings. Labour as a share of sales is the quickest sign the rota and the trade are out of step.

## Plan cover before you need it

Agree who covers what before someone calls in sick at 6am. A shared list of who can work which shifts saves the morning.`;

const POS_BODY = `When the Wi-Fi drops mid-rush, the worst thing a till can do is stop taking money.

## What "works offline" should mean

- Orders keep going through while the connection is down.
- They're saved on the device, not lost when the page reloads.
- They send themselves when the connection is back.
- A sale that can't be sent is kept for someone to check — never quietly deleted.

## Questions to ask before you choose a till

Ask what happens to a card payment taken offline, how long orders can wait on the device, and how you'll know if one didn't send.`;

function sample(post: Omit<BlogPost, 'readingMinutes' | 'wordCount' | 'sample' | 'seo' | 'cover'> & { seo?: BlogPost['seo'] }): BlogPost {
  return { cover: null, seo: {}, ...post, readingMinutes: readingMinutes(post.body), wordCount: wordCount(post.body), sample: true };
}

export const SAMPLE_POSTS: BlogPost[] = [
  sample({
    id: 'sample-margin',
    slug: 'how-to-work-out-menu-margin',
    title: 'How to Work Out the Margin on Every Dish',
    excerpt: 'Gross margin explained for cafés and restaurants: what to include, how VAT changes it, and a worked example you can copy.',
    category: 'Cafés and restaurants',
    categorySlug: 'cafes-and-restaurants',
    tldr: 'Margin is the price minus VAT (if you’re registered) minus the ingredients. An oat flat white at £3.60 with £0.75 of ingredients keeps £2.25 — 75%. Cost every recipe once and the number stays right as prices change.',
    body: MARGIN_BODY,
    faq: [
      { question: 'What is a good gross margin for a café?', answer: 'It varies by item: drinks usually carry more than food. What matters is knowing each item’s number, so you can reprice or drop the ones that don’t earn their place.' },
      { question: 'Should VAT be included when working out margin?', answer: 'Take it out if you’re VAT-registered — it was never yours to keep. If you’re not registered, there’s no VAT to remove.' },
    ],
    publishedAt: '2026-10-20T09:00:00.000Z',
    updatedAt: '2026-10-27T15:30:00.000Z',
  }),
  sample({
    id: 'sample-rota',
    slug: 'how-to-write-a-staff-rota',
    title: 'How to Write a Staff Rota That People Actually Follow',
    excerpt: 'Move the rota out of the group chat: staff the peaks, publish where your team looks, and keep staff cost next to takings.',
    category: 'Guides',
    categorySlug: 'guides',
    tldr: 'Staff the busy hours, not the whole day. Publish the rota on your team’s phones, take leave requests in the same place, and watch staff cost as a share of takings.',
    body: ROTA_BODY,
    faq: [],
    publishedAt: '2026-10-12T09:00:00.000Z',
    updatedAt: '2026-10-12T09:00:00.000Z',
  }),
  sample({
    id: 'sample-pos',
    slug: 'what-offline-pos-should-mean',
    title: 'What an Offline Till Should Actually Do',
    excerpt: 'A till that “works offline” should keep selling, keep every sale and tell you about the ones it couldn’t send. Here’s what to check.',
    category: 'Pricing and comparisons',
    categorySlug: 'pricing-and-comparisons',
    tldr: null,
    body: POS_BODY,
    faq: [],
    publishedAt: '2026-10-02T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
  }),
];
