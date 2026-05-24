import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';

const meta = pageMeta['/admin'];

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
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
