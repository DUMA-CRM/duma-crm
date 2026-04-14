import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
})
export const metadata: Metadata = {
  title: 'DUMA — Premium Coffee CRM',
  description: 'Manage orders, customers, and roast profiles.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${geist.variable} ${geistMono.variable}`}>
      <body className="font-body">{children}</body>
    </html>
  );
}
