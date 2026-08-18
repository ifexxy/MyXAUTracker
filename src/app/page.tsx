'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import Footer from '@/components/Footer';

export default function HomePage() {
  const { user, loading, signOut } = useAuth();
  const [authInner, setAuthInner] = useState<React.ReactNode>(null);
  
{/* Bullet lines */}
const phrases = ['Built on Real Math.', 'Based on ATR.', '70% Winrate.', 'Easy to Use'];
const [phraseIndex, setPhraseIndex] = useState(0);
const [displayed, setDisplayed] = useState('');
const [isDeleting, setIsDeleting] = useState(false);

useEffect(() => {
  const current = phrases[phraseIndex];
  let timeout: ReturnType<typeof setTimeout>;

  if (!isDeleting && displayed.length < current.length) {
    // Typing
    timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length + 1)), 60);
  } else if (!isDeleting && displayed.length === current.length) {
    // Pause at full word
    timeout = setTimeout(() => setIsDeleting(true), 1800);
  } else if (isDeleting && displayed.length > 0) {
    // Deleting
    timeout = setTimeout(() => setDisplayed(current.slice(0, displayed.length - 1)), 35);
  } else if (isDeleting && displayed.length === 0) {
    // Move to next phrase
    setIsDeleting(false);
    setPhraseIndex((prev) => (prev + 1) % phrases.length);
  }

  return () => clearTimeout(timeout);
}, [displayed, isDeleting, phraseIndex]);

  useEffect(() => {
    if (loading) {
      setAuthInner(<div className="auth-skel" style={{ height: 46, borderRadius: 8, background: 'linear-gradient(90deg, var(--bg-3) 25%, var(--bg-2) 50%, var(--bg-3) 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.4s infinite' }} />);
    } else if (user) {
      setAuthInner(
        <>
          <div className="flex items-center gap-[10px] p-[10px_12px] mb-[12px] rounded-[8px]" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
            <div className="w-[32px] h-[32px] rounded-full flex items-center justify-center text-[13px]" style={{ background: 'var(--bg-3)', color: 'var(--ink-3)', flexShrink: 0 }}>
              <i className="fa-solid fa-user" />
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase" style={{ letterSpacing: '0.1em', color: 'var(--green)', marginBottom: 2 }}>Signed In</div>
              <div className="text-[12px] font-semibold" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 185 }}>{user.email}</div>
            </div>
          </div>
          <Link href="/account" className="flex items-center justify-center gap-[8px] w-full py-[14px] text-[14px] font-bold rounded-[8px] no-underline mb-[8px]" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
            Account Dashboard
          </Link>
          <button onClick={signOut} className="flex items-center justify-center gap-[8px] w-full py-[12px] text-[13px] font-semibold rounded-[10px] cursor-pointer" style={{ background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-right-from-bracket" /> Sign Out
          </button>
        </>
      );
    } else {
      setAuthInner(
        <>
          <div className="inline-flex items-center gap-[5px] text-[10px] font-bold px-[9px] py-[4px] rounded-full mb-[10px]" style={{ color: 'var(--green)', background: 'var(--green-bg)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Get 3 days trial. Pay 25 USDT/month after trial ends!
          </div>
          <p className="text-[13px] mb-[14px]" style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--ink)' }}>Two steps</strong> to get started, just email and password. Full forecast dashboard free for 3 days.
          </p>
          <Link href="/signup" className="flex items-center justify-center gap-[8px] w-full py-[14px] text-[14px] font-bold rounded-[8px] no-underline mb-[8px]" style={{ background: 'var(--ink)', color: 'var(--bg)' }}>
            <i className="fa-solid fa-rocket" style={{ fontSize: 12 }} /> Create Free Account
          </Link>
          <Link href="/login" className="flex items-center justify-center w-full py-[13px] text-[14px] font-semibold rounded-[8px] no-underline" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            Sign In
          </Link>
        </>
      );
    }
  }, [user, loading, signOut]);

  return (
    <>
      {/* Feature cards */}
{/* HERO */}
<section style={{ padding: '52px 20px 0', textAlign: 'center' }}>



  {/* H1 */}
<h1 style={{ fontSize: 36, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.18, letterSpacing: -1, marginBottom: 14 }}>
  Gold Forecasts.<br />
  <span style={{ color: '#5B5BD6' }}>
    {displayed}
    <span style={{
      display: 'inline-block',
      width: 2,
      height: '0.85em',
      background: '#5B5BD6',
      marginLeft: 2,
      verticalAlign: 'middle',
      animation: 'blink 0.8s step-end infinite',
    }} />
  </span>
</h1>

  {/* Sub */}
  <p style={{ fontSize: 20, color: 'var(--ink-3)', lineHeight: 1.65, maxWidth: 300, margin: '0 auto 26px' }}>
    Whether you're a pro trader or a newbie, we have the right tools to supercharge your trading experience. 
  </p>

  {/* CTA */}
<Link
  href={user ? '/account' : '/signup'}
  className="inline-flex items-center justify-center gap-[8px] text-[14px] font-bold rounded-[14px] no-underline mb-[10px]"
  style={{
    background: '#5B5BD6',
    color: '#ffffff',
    padding: '14px 36px',
    display: 'inline-flex',
    width: 'auto',
    maxWidth: 'none',
    letterSpacing: 0.1,
  }}
>
  <i className="fa-solid fa-arrow-right" style={{ fontSize: 20 }} />
  {user ? 'Account Dashboard' : 'Start Free Trial'}
</Link>

  {/* Secondary */}
  {!user && (
    <div style={{ marginBottom: 36 }}>
      <Link href="/login" style={{ fontSize: 12, color: 'var(--ink-4)', textDecoration: 'none' }}>
        Already have an account? <span style={{ color: 'var(--ink-3)', borderBottom: '1px solid var(--border)' }}>Sign in</span>
      </Link>
    </div>
  )}

  {/* Marquee Removed */}

</section>
<br />


      {/* CTA */}
      <section style={{ padding: '26px 20px', borderBottom: '1px solid var(--border)' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.25, letterSpacing: -0.4, marginBottom: 8 }}>
          Trade Gold/Bitcoin<br />like a Pro.
        </h1>
        <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 20 }}>
 Join traders who rely on XauTracker every day to make profit with minimal loss.
        </p>

        <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'var(--bg-2)', marginBottom: 14 }}>
          {authInner}
        </div>

        <div className="grid grid-cols-2 gap-[8px]">
          <a href="https://wa.me/2348131560586" target="_blank" rel="noopener" className="flex items-center justify-center gap-[7px] py-[12px] text-[12px] font-bold rounded-[8px] no-underline" style={{ background: '#25D366', color: '#000' }}>
            <i className="fa-brands fa-whatsapp" /> WhatsApp
          </a>
          <Link href="/contact" className="flex items-center justify-center gap-[7px] py-[12px] text-[12px] font-semibold rounded-[8px] no-underline" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            <i className="fa-solid fa-envelope" /> Email Us
          </Link>
        </div>
      </section>

      {/* How it Works */}
      <section style={{ padding: '26px 20px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-4)', marginBottom: 18 }}>
          How it Works
        </div>
        {[
          { num: '01', title: 'Live Price Feed', body: 'Real-time XAU/USD spot prices from TwelveData, refreshed every 60 seconds.' },
          { num: '02', title: 'ATR Volatility Model', body: 'Uses <code>ATR × √(t/1440)</code> — the square-root-of-time formula — for realistic price bands.' },
          { num: '03', title: 'Session Awareness', body: 'Adjusts for Asian, London and New York sessions. Peak overlap gets a higher volatility multiplier.' },
          { num: '04', title: 'Momentum & Reversion', body: 'Drift weighted by today\'s momentum and dampened by mean-reversion pressure.' },
        ].map((s, i) => (
          <div key={i} className="flex gap-[14px] py-[13px]" style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-4)', width: 22, flexShrink: 0, paddingTop: 1 }}>{s.num}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }} dangerouslySetInnerHTML={{ __html: s.body }} />
            </div>
          </div>
        ))}
      </section>

      <Footer />
    </>
  );
}
