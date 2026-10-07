'use client';

import { useState } from 'react';

import { copyText } from '@/components/cms/shared';
import { Sparkles } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { CopyButton } from '@/components/ui/action-button';

import { cn } from '@/lib/utils/cn';
import { ERRORS, ORDER_EXAMPLE, PRODUCT_EXAMPLE, buildStorefrontPrompt } from '@/lib/utils/storefront-docs';
import { toast } from '@/stores/toastStore';

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:7777';

const copy = async (text: string) => {
  const ok = await copyText(text);
  if (!ok) toast('error', 'Copy failed — select the text instead.');
  return ok;
};

type Topic = 'products' | 'orders' | 'newsletter' | 'errors';

const TOPICS: Array<{ value: Topic; label: string }> = [
  { value: 'products', label: 'Show products' },
  { value: 'orders', label: 'Record an order' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'errors', label: 'Errors' },
];

/** How a website uses the keys above: each call with a real example, and a brief for an AI assistant. */
export function StorefrontDocs({ shopName }: { shopName?: string }) {
  const [topic, setTopic] = useState<Topic>('products');
  const prompt = buildStorefrontPrompt(API_ORIGIN, shopName);
  return (
    <SettingsSection
      title="Build your shop"
      description="What your website sends and gets back. Everything is JSON; money is a decimal string."
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
          <Sparkles size={16} className="shrink-0 text-primary" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">Building it with AI?</span> Copy a complete brief — every call, the order rules,
            the errors — into Claude, Cursor or Copilot. No keys inside.
          </p>
          <CopyButton variant="default" className="shrink-0" label="Copy prompt for AI" copiedLabel="Copied" onCopy={() => copy(prompt)} />
        </div>

        <div role="tablist" aria-label="Storefront calls" className="flex flex-wrap gap-1">
          {TOPICS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={topic === entry.value}
              onClick={() => setTopic(entry.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                topic === entry.value ? 'bg-band text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {topic === 'products' && (
          <div className="space-y-3">
            <Call
              method="GET"
              path="/products/oversized-hoodie"
              note="Publishable or secret key. The list, GET /products, takes category, q, limit and page."
            />
            <Code text={JSON.stringify(PRODUCT_EXAMPLE, null, 2)} />
            <Tip>
              Show a size as sold out when <C>available</C> is false. A photo with an <C>option</C> belongs to that colour. Use{' '}
              <C>srcset</C> and <C>focalPoint</C> (as object-position) on images.
            </Tip>
          </div>
        )}
        {topic === 'orders' && (
          <div className="space-y-3">
            <Call method="POST" path="/orders" note="Secret key, from your server — after your checkout has taken the payment." />
            <Code text={JSON.stringify(ORDER_EXAMPLE, null, 2)} />
            <Tip>
              Send products and sizes, never prices — DUMA prices every line. Sending the same <C>externalReference</C> again returns the
              same order, so a retry is safe. Stock comes off at once; a size that ran out fails the whole order with{' '}
              <C>409 out_of_stock</C> and nothing is recorded.
            </Tip>
          </div>
        )}
        {topic === 'newsletter' && (
          <div className="space-y-3">
            <Call method="POST" path="/newsletter" note="Secret key, from your server — when someone signs up." />
            <Code text={JSON.stringify({ email: 'sam@example.com', firstName: 'Sam' }, null, 2)} />
            <Tip>
              The subscriber becomes a customer who has opted in to marketing email. <C>POST /newsletter/unsubscribe</C> with the email
              takes them off; emails DUMA sends carry their own unsubscribe link.
            </Tip>
          </div>
        )}
        {topic === 'errors' && (
          <ul className="divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-control">
            {ERRORS.map((entry) => (
              <li key={entry.code} className="flex gap-3 px-3.5 py-2.5 text-sm">
                <span className="w-10 shrink-0 font-mono text-xs font-semibold tabular-nums text-foreground">{entry.status}</span>
                <span className="min-w-0">
                  <code className="font-mono text-xs text-foreground">{entry.code}</code>
                  <span className="block text-xs leading-relaxed text-muted-foreground">{entry.when}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SettingsSection>
  );
}

function Call({ method, path, note }: { method: 'GET' | 'POST'; path: string; note: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className={cn(
          'rounded-sm px-1.5 py-0.5 font-mono text-[0.6875rem] font-semibold',
          method === 'GET' ? 'bg-reference/12 text-reference' : 'bg-momentum/12 text-momentum',
        )}
      >
        {method}
      </span>
      <code className="font-mono text-xs font-medium text-foreground">{path}</code>
      <span className="text-xs text-muted-foreground">{note}</span>
    </div>
  );
}

function Code({ text }: { text: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-rule/60 bg-control">
      <div className="absolute right-1.5 top-1.5">
        <CopyButton iconOnly label="Copy" copiedLabel="Copied" onCopy={() => copy(text)} />
      </div>
      <pre className="max-h-80 overflow-auto p-4 pr-12 font-mono text-xs leading-5 text-foreground">{text}</pre>
    </div>
  );
}

const C = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-sm bg-band/70 px-1 py-0.5 font-mono text-[0.6875rem] text-foreground">{children}</code>
);

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border border-rule/50 bg-band/35 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">{children}</p>
  );
}
