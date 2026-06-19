import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Welcome · XauTracker',
  description: 'Welcome to XauTracker. Your account is ready.',
  robots: 'noindex, nofollow',
};

export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
