'use client';

import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="px-[20px] py-[24px_40px]" style={{ borderTop: '1px solid var(--border)', marginTop: 'auto' }}>
      <div className="flex gap-[6px] mb-[16px] flex-wrap">
        <Link href="/about" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 13px', borderRadius: 20, border: '1px solid var(--border)', textDecoration: 'none' }}>
          About
        </Link>
        <Link href="/contact" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 13px', borderRadius: 20, border: '1px solid var(--border)', textDecoration: 'none' }}>
          Contact
        </Link>
        <Link href="/disclaimer" style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-3)', padding: '6px 13px', borderRadius: 20, border: '1px solid var(--border)', textDecoration: 'none' }}>
          Disclaimer
        </Link>
      </div>
      <div style={{ fontSize: 11, color: 'var(--ink-4)', lineHeight: 1.65, padding: '12px 14px', background: 'var(--bg-2)', borderRadius: 8, marginBottom: 14 }}>
        Trading gold carries significant financial risk. XauTracker predictions are algorithmic estimates, not financial advice. Consult a licensed professional before trading.
      </div>
      <div style={{ fontSize: 10, color: 'var(--ink-4)', letterSpacing: '0.03em' }}>
        &copy; 2026 XauTracker.com &nbsp;·&nbsp; Powered by TwelveData
      </div>
    </footer>
  );
}
