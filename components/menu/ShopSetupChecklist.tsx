'use client';

import Link from 'next/link';

import { Code, ImageIcon, Tag, UploadCloud } from '@/components/icons';
import { Button } from '@/components/ui/button';

/**
 * What an online shop sees on an empty products page, in place of the café's
 * "ingredients, modifiers, menu item": the three things between signing up
 * and taking an order on its own website.
 */
export function ShopSetupChecklist({ onImport }: { onImport: () => void }) {
  const steps = [
    {
      icon: Tag,
      title: 'Add your products',
      body: 'Import your catalogue from a sheet — your own or a Shopify export — or add products one by one.',
      action: (
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" className="gap-1.5" onClick={onImport}>
            <UploadCloud size={13} aria-hidden="true" /> Import
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href="/menu/items/new">New product</Link>
          </Button>
        </div>
      ),
    },
    {
      icon: ImageIcon,
      title: 'Give them sizes and photos',
      body: 'On each product: Sizes & stock turns S M L × Black White into SKUs with their own stock; Photos adds the gallery.',
      action: null,
    },
    {
      icon: Code,
      title: 'Connect your website',
      body: 'Create the keys your site uses to show products and record paid orders.',
      action: (
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/settings/developers">Get keys</Link>
        </Button>
      ),
    },
  ];

  return (
    <section className="overflow-hidden rounded-lg border border-rule/60 bg-control">
      <div className="flex items-baseline justify-between gap-3 border-b border-rule/50 px-4 py-3 md:px-5">
        <h2 className="text-sm font-semibold text-foreground">Set up your shop</h2>
        <p className="text-label text-muted-foreground">Three steps to your first online order</p>
      </div>
      <ol>
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="flex flex-wrap items-center gap-3 border-b border-rule/45 px-4 py-3.5 last:border-0 md:px-5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
                <Icon size={14} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">
                  <span className="mr-1.5 tabular-nums text-muted-foreground">{index + 1}.</span>
                  {step.title}
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">{step.body}</p>
              </div>
              {step.action}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
