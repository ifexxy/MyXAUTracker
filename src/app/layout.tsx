import type { Metadata } from 'next';
import Script from 'next/script';
import RootLayoutClient from '@/components/RootLayoutClient';
import { pageMeta } from '@/lib/seo';
import './globals.css';

const meta = pageMeta['/'];

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.ogTitle ?? meta.title,
    description: meta.ogDescription ?? meta.description,
    url: meta.canonical,
    siteName: 'XAU Tracker',
    type: 'website',
  },
  alternates: { canonical: meta.canonical },
  robots: meta.robots ?? 'index, follow',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
        <meta name="theme-color" content="#ffffff" />
        <meta property="og:image" content="https://www.xautracker.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="XAU Tracker" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-1T072J6769" />
                <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('xau-theme')||'light';document.documentElement.setAttribute('data-theme',t);})()` }} />
        <script dangerouslySetInnerHTML={{ __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-1T072J6769');
try { var t=localStorage.getItem('xau-theme')||'light'; document.documentElement.setAttribute('data-theme',t); } catch(e){}
` }} />
      </head>
      <body>
        <RootLayoutClient>{children}</RootLayoutClient>
      </body>
    </html>
  );
}
