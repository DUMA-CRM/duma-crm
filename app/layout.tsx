import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Archivo, Chivo_Mono } from 'next/font/google';
import Script from 'next/script';

import { QueryProvider } from '@/components/providers/QueryProvider';

import './globals.css';

// Archivo is a grotesque with genuine weights and real tabular figures. It
// replaces Questrial, which shipped a single 400 weight while the interface
// asked for semibold 408 times and bold 334 times — every one of those was
// browser-synthesised faux bold, thickening strokes unevenly at exactly the
// small sizes this system does its most important work at.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
});

// Chivo Mono is Archivo's monospaced sibling: same skeleton, so a label and the
// figure beside it agree. Every number, timestamp and readout is set in it.
const chivoMono = Chivo_Mono({
  subsets: ['latin'],
  variable: '--font-chivo-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'https://duma-coffee.vercel.app'),
  title: 'DUMA — Your coffee business, clearly',
  description: 'Run sales, customers, inventory, staffing, and day-to-day coffee operations from one connected workspace.',
  // Every mark here is the logo in public/logo.svg. The SVG is what modern
  // browsers pick. app/favicon.ico (16/32/48/256, rasterised from the same
  // file) is not listed because Next emits its own link for that file
  // convention — declaring it again only duplicates the tag; it covers older
  // browsers and the crawlers and unfurlers that request /favicon.ico directly
  // and never read these tags at all. iOS ignores an SVG apple-touch-icon, so
  // that one has to be a PNG — the maskable variant, whose ground bleeds to the
  // edges under the home screen's own mask.
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'DUMA — Your coffee business, clearly',
    description: 'One connected operating system for modern coffee businesses.',
    type: 'website',
    images: [{ url: '/og.png', width: 1731, height: 909, alt: 'DUMA coffee business dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DUMA — Your coffee business, clearly',
    description: 'One connected operating system for modern coffee businesses.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${archivo.variable} ${chivoMono.variable}`}>
      <body className="font-sans" suppressHydrationWarning>
        {/* The direction contract has to survive the production build so it can be
            audited, and a JSX comment is stripped at compile time — hence a real
            HTML comment emitted as the first thing in <body>. Grep the built
            output for the seed key. */}
        <div
          hidden
          dangerouslySetInnerHTML={{
            __html: `<!--
  DUMA — direction contract
  THESIS: a role-shaped service board that makes the next useful action obvious; refuses the
    graphite instrument panel and the floating KPI dashboard.
  OWN-WORLD: warm oat canvas, forest navigation, apricot / periwinkle / saffron / green
    domain lanes, 6–8px corners, magnetic labels, soft one-pixel edges, and restrained lift.
  STORY: an operator opens their role workspace, reads the shift dependencies, and acts;
    specialist pages inherit the same friendly, practical system.
  FIRST VIEWPORT: forest sidebar, warm top bar, Today at Bridge Street, attached Now / This
    shift / This week tabs, coloured shift lanes, and a stable right context workbench.
  FORM: Service Board / Shift Lanes — candidate 5; seed key 8cad44db.
  FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
-->`,
          }}
        />
        {/* Chrome fires beforeinstallprompt as soon as install criteria are met —
            on repeat visits that's BEFORE React hydrates, so a listener attached
            in an effect misses it. Capture it pre-hydration on window instead. */}
        <Script id="pwa-prompt-capture" strategy="beforeInteractive">
          {`window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event('pwa:prompt-captured'))});window.addEventListener('appinstalled',function(){window.__pwaPrompt=null;window.__pwaInstalled=true;window.dispatchEvent(new Event('pwa:installed'))});`}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
