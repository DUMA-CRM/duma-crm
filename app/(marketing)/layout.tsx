import { Caveat } from 'next/font/google';

import { JsonLd } from '@/components/marketing/JsonLd';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { MarketingHeader } from '@/components/marketing/MarketingHeader';
import { RevealObserver } from '@/components/marketing/RevealObserver';
import { SignUpShortcut } from '@/components/marketing/SignUpShortcut';

import { organizationSchema, websiteSchema } from '@/lib/marketing/schema';

import './marketing.css';

// The handwritten voice for margin notes and the founder's signature. Loaded
// here, not in the root layout, so the app never downloads it.
const hand = Caveat({ subsets: ['latin'], variable: '--font-hand', display: 'swap' });

/**
 * The public marketing site: home, features, solutions, comparisons, pricing
 * and the blog. Server-rendered with no app shell, query client or session —
 * what a crawler reads is the whole page.
 *
 * Its sections are public through MARKETING_PATHS in lib/utils/public-paths.ts;
 * its pages, nav and sitemap through lib/marketing/site.ts. The legal pages
 * and the /welcome front door keep their own frames.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`mkt ${hand.variable} flex min-h-dvh flex-col`}>
      <JsonLd data={organizationSchema()} />
      <JsonLd data={websiteSchema()} />
      <MarketingHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <MarketingFooter />
      <RevealObserver />
      <SignUpShortcut />
    </div>
  );
}
