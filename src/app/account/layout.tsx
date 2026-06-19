import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'My Account · XauTracker',
  description: 'Manage your XauTracker account and access your forecast dashboards.',
  robots: 'noindex, nofollow',
};

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  return children;
}
