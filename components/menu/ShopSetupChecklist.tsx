'use client';

import Link from 'next/link';

import { Code, ImageIcon, Tag, UploadCloud } from '@/components/icons';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Button } from '@/components/ui/button';

/**
 * What an online shop's Overview shows before it has any products, in place of the café's
 * "ingredients, modifiers, menu item": the three things between signing up
 * and taking an order on its own website.
 */
export function ShopSetupChecklist({ onImport }: { onImport: () => void }) {
  const steps = [
    {
      icon: Tag,
      title: 'Add your products',
      body: 'From a sheet — yours or a Shopify export — or one by one.',
      action: (
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={onImport}>
            <UploadCloud aria-hidden="true" /> Import
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
      body: 'On each product: Sizes & stock makes the SKUs; Photos adds the gallery.',
      action: null,
    },
    {
      icon: Code,
      title: 'Connect your website',
      body: 'Keys your site uses to show products and record paid orders.',
      action: (
        <Button asChild size="sm" variant="outline">
          <Link href="/settings/developers">Get keys</Link>
        </Button>
      ),
    },
  ];

  return (
    <RecordGroup id="shop-setup" title="Set up your shop" footnote="Three steps to your first online order.">
      <ListRowGroup aria-label="Set up your shop">
        {steps.map((step, index) => (
          <ListRow
            key={step.title}
            icon={step.icon}
            tone="muted"
            title={
              <>
                <span className="mr-1.5 tabular-nums text-muted-foreground">{index + 1}.</span>
                {step.title}
              </>
            }
            meta={step.body}
            control={step.action ?? undefined}
          />
        ))}
      </ListRowGroup>
    </RecordGroup>
  );
}
