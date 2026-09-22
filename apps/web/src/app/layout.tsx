import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { serverEnv } from '@/lib/env.ts';
import { Providers } from './providers.tsx';
import './globals.css';

const DESCRIPTION =
  'Tack is a free, realtime, keyboard-first task manager for teams: issues, boards, sprints, projects, and docs that sync instantly for everyone. No pricing, no paid tiers, ever.';

const OG_IMAGE = {
  url: '/og.png',
  width: 2400,
  height: 1260,
  alt: 'Tack: issue tracking at the speed of typing.',
};

export const metadata: Metadata = {
  metadataBase: new URL(serverEnv().NEXT_PUBLIC_APP_URL),
  title: {
    default: 'Tack: the free, realtime, keyboard-first task manager',
    template: '%s · Tack',
  },
  description: DESCRIPTION,
  applicationName: 'Tack',
  keywords: [
    'task manager',
    'issue tracking',
    'project management',
    'realtime',
    'keyboard-first',
    'cycles',
    'sprints',
    'kanban',
    'docs',
    'GitHub integration',
    'MCP',
    'free',
    'open source',
  ],
  authors: [{ name: 'Tack' }],
  creator: 'Tack',
  publisher: 'Tack',
  appleWebApp: { capable: true, title: 'Tack', statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
  openGraph: {
    type: 'website',
    siteName: 'Tack',
    title: 'Tack: the free, realtime, keyboard-first task manager',
    description: DESCRIPTION,
    locale: 'en_US',
    images: [OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Tack: the free, realtime, keyboard-first task manager',
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4f5f7' },
    { media: '(prefers-color-scheme: dark)', color: '#060607' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
