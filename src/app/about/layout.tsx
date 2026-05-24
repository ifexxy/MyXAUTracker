import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

const meta = pageMeta['/about'];

export const metadata: Metadata = {
  title: meta.title,
  description: meta.description,
  openGraph: {
    title: meta.ogTitle ?? meta.title,
    description: meta.ogDescription ?? meta.description,
    url: meta.canonical,
    siteName: 'XAU Tracker',
  },
  alternates: { canonical: meta.canonical },
  robots: meta.robots ?? 'index, follow',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
