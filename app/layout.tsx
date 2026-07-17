import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';

import { QueryProvider } from '@/components/providers/QueryProvider';

import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DUMA — Premium Coffee CRM',
  description: 'Manage orders, customers, and roast profiles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-body" suppressHydrationWarning>
        {/* Chrome fires beforeinstallprompt as soon as install criteria are met —
            on repeat visits that's BEFORE React hydrates, so a listener attached
            in an effect misses it. Capture it pre-hydration on window instead. */}
        <Script id="pwa-prompt-capture" strategy="beforeInteractive">
          {`window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__pwaPrompt=e;window.dispatchEvent(new Event('pwa:prompt-captured'))});window.addEventListener('appinstalled',function(){window.__pwaPrompt=null;window.__pwaInstalled=true;window.dispatchEvent(new Event('pwa:installed'))});`}
        </Script>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
