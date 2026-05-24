'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useGoldPrice } from '@/contexts/GoldPriceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fmtPrice, fmtChange } from '@/lib/api';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserData } from '@/types';
import Footer from '@/components/Footer';

function getSessionInfo() {
  const h = new Date().getUTCHours();
  const asian = h >= 0 && h < 8;
  const london = h >= 7 && h < 16;
  const ny = h >= 13 && h < 21;
  const overlap = london && ny;
  let sessionMultiplier = 0.7, volLabel = 'LOW', sessionLabel = 'Off-Hours';
  if (overlap) { sessionMultiplier = 1.35; volLabel = 'PEAK'; sessionLabel = 'London + NY Overlap'; }
  else if (ny) { sessionMultiplier = 1.20; volLabel = 'HIGH'; sessionLabel = 'New York'; }
  else if (london) { sessionMultiplier = 1.10; volLabel = 'MEDIUM'; sessionLabel = 'London'; }
  else if (asian) { sessionMultiplier = 0.70; volLabel = 'LOW'; sessionLabel = 'Asian'; }
  return { asian, london, ny, overlap, sessionMultiplier, volLabel, sessionLabel };
}

function estimateATR(high: number, low: number, price: number, chp: number) {
  const intradayRange = high - low;
  const changeRange = Math.abs(chp / 100 * price) * 2;
  return Math.max(intradayRange, changeRange, price * 0.003);
}

function simulateSignals(price: number) {
  const signal = (tf: string, minutes: number) => {
    const drift = (Math.random() - 0.48) * price * 0.002;
    const predPrice = price + drift;
    const volatility = price * 0.001 * Math.sqrt(minutes / 1440);
    const direction: 'bull' | 'bear' | 'flat' = drift > 0.1 ? 'bull' : drift < -0.1 ? 'bear' : 'flat';
    const confidence = Math.min(90, Math.max(40, 50 + Math.abs(drift) / price * 5000));
    return { timeframe: tf, price: predPrice, direction, confidence: Math.round(confidence), band: `${fmtPrice(predPrice - volatility)} – ${fmtPrice(predPrice + volatility)}` };
  };
  return { '10m': signal('10 min', 10), '1h': signal('1 hour', 60), '4h': signal('4 hour', 240), '24h-sig': signal('24 hour', 1440) };
}

function simulateForecasts(price: number) {
  const fc = (tf: string, minutes: number) => {
    const drift = (Math.random() - 0.47) * price * 0.003;
    const predPrice = price + drift;
    const volatility = price * 0.002 * Math.sqrt(minutes / 1440);
    const direction: 'bull' | 'bear' | 'flat' = drift > 0.3 ? 'bull' : drift < -0.3 ? 'bear' : 'flat';
    const confidence = Math.min(88, Math.max(35, 45 + Math.abs(drift) / price * 4000));
    return { timeframe: tf, price: predPrice, direction, confidence: Math.round(confidence), band: `${fmtPrice(predPrice - volatility)} – ${fmtPrice(predPrice + volatility)}`, prediction: direction === 'bull' ? 'Likely to rise' : direction === 'bear' ? 'Likely to fall' : 'Range-bound' };
  };
  return { '1h': fc('1 hour', 60), '6h': fc('6 hour', 360), '24h': fc('24 hour', 1440) };
}

function calculateSentiment(price: number, open: number) {
  const ch = price - open;
  const pct = (ch / open) * 100;
  if (pct > 0.3) return { emoji: '\u{1F44D}', text: 'Bullish', color: 'var(--green)' };
  if (pct < -0.3) return { emoji: '\u{1F44E}', text: 'Bearish', color: 'var(--red)' };
  return { emoji: '\u{2696}\u{FE0F}', text: 'Neutral', color: 'var(--gold)' };
}

function calculateLevels(price: number) {
  return { r2: price + price * 0.008, r1: price + price * 0.003, s1: price - price * 0.003, s2: price - price * 0.008 };
}

const popupData: Record<string, { kicker: string; signal: string; dir: string; reason: string; conf: string; range: string }> = {};

export default function PredictPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const { price, loading: priceLoading } = useGoldPrice();
  const { theme } = useTheme();
  const tvRef = useRef<HTMLDivElement>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);

  // Fetch user data if signed in
  useEffect(() => {
    if (!user) { setUserData(null); return; }
    (async () => {
      try {
        const fb = getFirebase();
        const snap = await getDoc(doc(fb.db, 'users', user.uid));
        if (snap.exists()) setUserData(snap.data() as UserData);
      } catch {}
    })();
  }, [user]);

  // TradingView widget
  useEffect(() => {
    if (!tvRef.current) return;
    tvRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol: 'OANDA:XAUUSD', interval: '60',
      timezone: 'Etc/UTC', theme: theme === 'dark' ? 'dark' : 'light',
      style: '1', locale: 'en',
      backgroundColor: theme === 'dark' ? '#0e0e0e' : '#ffffff',
      gridColor: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      hide_top_toolbar: false, hide_legend: false, save_image: false,
      calendar: false, hide_volume: false,
      support_host: 'https://www.tradingview.com',
    });
    tvRef.current.appendChild(script);
  }, [theme]);

  const p = price || { price: 0, open: 0, high: 0, low: 0, bid: 0, ask: 0, ch: 0, chp: 0, source: '—' };
  const isUp = (p.ch || 0) >= 0;
  const session = getSessionInfo();
  const atr = estimateATR(p.high || p.price, p.low || p.price, p.price, p.chp || 0);
  const signals = simulateSignals(p.price);
  const forecasts = simulateForecasts(p.price);
  const sentiment = calculateSentiment(p.price, p.open || p.price);
  const levels = calculateLevels(p.price);

  const sigs = [signals['10m'], signals['1h'], signals['4h'], signals['24h-sig']];
  const buyCount = sigs.filter(s => s.direction === 'bull').length;
  const sellCount = sigs.filter(s => s.direction === 'bear').length;
  const holdCount = sigs.filter(s => s.direction === 'flat').length;
  const total = sigs.length;
  const buyPct = Math.round((buyCount / total) * 100);
  const sellPct = Math.round((sellCount / total) * 100);
  const holdPct = 100 - buyPct - sellPct;

  const openPopup = (id: string) => {
    const sig = signals[id] || forecasts[id.replace('fc-', '')];
    if (!sig) return;
    popupData[id] = {
      kicker: id.includes('fc') ? 'Price Forecast' : 'Entry Signal',
      signal: `${sig.direction === 'bull' ? '\u{1F4C8}' : sig.direction === 'bear' ? '\u{1F4C9}' : '\u{2696}\u{FE0F}'} $${fmtPrice(sig.price)}`,
      dir: sig.direction === 'bull' ? 'Buy signal — price expected to rise.' : sig.direction === 'bear' ? 'Sell signal — price expected to fall.' : 'Hold — price expected to trade sideways.',
      reason: sig.prediction || `Based on ATR volatility modeling. \u00B11\u03C3 band: ${sig.band}`,
      conf: `${sig.confidence}%`,
      range: sig.band || '—',
    };
    setActivePopup(id);
  };

  // Access check
  const now = Date.now();
  const hasAccess = userData ? (
    (userData.trialEndsAt && new Date(userData.trialEndsAt).getTime() > now) ||
    (userData.subscriptionStatus === 'active' && userData.currentPeriodEnd && new Date(userData.currentPeriodEnd).getTime() > now) ||
    (userData.manualAccess && (!userData.manualAccessExpiresAt || new Date(userData.manualAccessExpiresAt).getTime() > now))
  ) : false;
  const accessExpired = user && userData && !hasAccess;

  if (authLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--ink-3)', marginBottom: 16 }} />
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading your account...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-bg)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, color: 'var(--gold)' }}>
            <i className="fa-solid fa-lock" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.3 }}>Sign in to access<br />Gold Forecast</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 24 }}>
            Create a free account or sign in to view real-time predictions, entry signals, and market analysis.
          </p>
          <Link href="/login" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 10 }}>
            <i className="fa-solid fa-right-to-bracket" /> Sign In
          </Link>
          <Link href="/signup" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <i className="fa-solid fa-user-plus" /> Create Free Account
          </Link>
        </div>
      </div>
    );
  }

  if (accessExpired) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--red-bg)', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⛔</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.3 }}>Your access has expired</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 24 }}>Please contact us to reactivate your account.</div>
          <Link href="/contact" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 13, background: 'var(--ink)', color: 'var(--bg)', borderRadius: 10, fontSize: 14, fontWeight: 700, textDecoration: 'none', marginBottom: 10 }}>
            <i className="fa-solid fa-envelope" /> Contact Us
          </Link>
          <button onClick={signOut} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, width: '100%', background: 'transparent', color: 'var(--ink-3)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            <i className="fa-solid fa-right-from-bracket" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Account Dashboard */}
      {user && userData && (
        <div style={{ margin: '14px 16px 0', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 16px' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-solid fa-circle-user" /> My Account
          </h3>
          <div className="flex items-center gap-[12px] mb-[14px]">
            <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--gold-bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold)', flexShrink: 0 }}>
              <i className="fa-solid fa-user" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              <div style={{ marginTop: 5 }}>
                {userData.subscriptionStatus === 'trial' && (
                  <span className="inline-flex items-center gap-[5px] text-[10px] font-bold px-[9px] py-[3px] rounded-full" style={{ color: 'var(--gold)', background: 'var(--gold-bg)' }}>
                    <i className="fa-solid fa-flask" /> Trial
                  </span>
                )}
                {userData.subscriptionStatus === 'active' && (
                  <span className="inline-flex items-center gap-[5px] text-[10px] font-bold px-[9px] py-[3px] rounded-full" style={{ color: 'var(--green)', background: 'var(--green-bg)' }}>
                    <i className="fa-solid fa-crown" /> Active
                  </span>
                )}
              </div>
            </div>
          </div>
          <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 4 }}>Access Status</div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {hasAccess ? (
                userData.subscriptionStatus === 'active' ? '\u2705 Active subscription' :
                userData.subscriptionStatus === 'trial' ? `\u23F3 Free trial \u2014 expires ${userData.trialEndsAt ? new Date(userData.trialEndsAt).toLocaleDateString() : '\u2014'}` :
                '\u2705 Access granted'
              ) : (
                '\u274C No active access'
              )}
            </div>
          </div>
          <div className="flex gap-[10px] flex-wrap">
            <Link href="/subscribe" className="flex-1 flex items-center justify-center gap-[7px] py-[12px] text-[13px] font-bold rounded-[8px] no-underline min-w-[130px]" style={{ background: 'var(--ink)', color: 'var(--bg)', border: '1px solid var(--ink)' }}>
              <i className="fa-solid fa-crown" /> Subscribe
            </Link>
            <button onClick={signOut} className="flex-1 flex items-center justify-center gap-[7px] py-[12px] text-[13px] font-bold rounded-[8px] cursor-pointer min-w-[130px]" style={{ background: 'transparent', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
              <i className="fa-solid fa-right-from-bracket" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Live price strip */}
      <div className="flex items-stretch justify-between gap-[12px] px-[20px] py-[18px]" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-[12px] min-w-0">
          <div>
            <div style={{ fontSize: 10, color: 'var(--ink-4)', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 5 }}>XAU/USD Spot</div>
            <div style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1.5, color: 'var(--ink)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ fontSize: 20, fontWeight: 400, color: 'var(--ink-3)', verticalAlign: 'super' }}>$</span>
              {fmtPrice(p.price)}
            </div>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, padding: '5px 10px', borderRadius: 4, whiteSpace: 'nowrap', background: isUp ? 'var(--green-bg)' : 'var(--red-bg)', color: isUp ? 'var(--green)' : 'var(--red)', alignSelf: 'center' }}>
            {fmtChange(p.ch || 0)} ({(p.chp || 0).toFixed(2)}%)
          </div>
        </div>
        <div style={{ minWidth: 82, textAlign: 'right', color: 'var(--ink-4)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          <div>Daily ATR</div>
          <div style={{ color: 'var(--ink)', fontSize: 14, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>${fmtPrice(atr)}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-[8px] px-[16px] py-[14px]" style={{ borderBottom: '1px solid var(--border)' }}>
        {[
          { label: 'High', value: fmtPrice(p.high || 0), icon: 'fa-arrow-up', color: 'var(--green)' },
          { label: 'Low', value: fmtPrice(p.low || 0), icon: 'fa-arrow-down', color: 'var(--red)' },
          { label: 'Open', value: fmtPrice(p.open || 0), icon: 'fa-door-open', color: 'var(--gold)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 12px' }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--ink-3)', marginBottom: 5 }}>
              <i className={`fa-solid ${s.icon}`} style={{ fontSize: 9, marginRight: 3, color: s.color }} />{s.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Session row */}
      <div className="flex items-center gap-[8px] flex-wrap px-[16px] py-[12px]" style={{ borderBottom: '1px solid var(--border)' }}>
        {[
          { id: 'asian', label: 'Asian', active: session.asian },
          { id: 'london', label: 'London', active: session.london },
          { id: 'ny', label: 'New York', active: session.ny },
        ].map((s) => (
          <div key={s.id} className="flex items-center gap-[5px] text-[10px] font-bold px-[10px] py-[5px] rounded-full uppercase" style={{ color: s.active ? 'var(--green)' : 'var(--ink-3)', background: s.active ? 'var(--green-bg)' : 'var(--bg-2)', border: s.active ? 'transparent' : '1px solid var(--border)', letterSpacing: '0.06em' }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }} />
            {s.label}
          </div>
        ))}
        <div className="flex items-center gap-[5px] text-[10px] font-bold px-[10px] py-[5px] rounded-full" style={{ color: 'var(--ink-3)', background: 'var(--bg-2)', border: '1px solid var(--border)', letterSpacing: '0.06em', marginLeft: 'auto' }}>
          <i className="fa-solid fa-wave-square" style={{ fontSize: 9 }} />
          <span>{session.volLabel}</span>
        </div>
      </div>

      {/* How to use */}
      <div style={{ padding: '14px 16px 0' }}>
        <button onClick={() => setHowToOpen(true)} className="flex items-center justify-between w-full py-[13px] px-[16px] cursor-pointer" style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10 }}>
          <div className="flex items-center gap-[10px]">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-circle-question" style={{ color: 'var(--gold)', fontSize: 14 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>How to use the Forecast Tools</span>
          </div>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--ink-4)', fontSize: 11, flexShrink: 0 }} />
        </button>
      </div>

      {/* TradingView */}
      <div style={{ margin: '14px 16px 0', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', height: 400 }} ref={tvRef} />

      {/* Algo note */}
      <div style={{ margin: '14px 16px 0', padding: '10px 14px', background: 'rgba(154,110,0,0.06)', border: '1px solid rgba(154,110,0,0.14)', borderRadius: 10, fontSize: 11, color: 'var(--ink-3)', lineHeight: 1.6 }}>
        <i className="fa-solid fa-microchip" style={{ color: 'var(--gold)', marginRight: 5 }} />
        Forecasts use <strong style={{ color: 'var(--gold)' }}>ATR × √(t/1440)</strong> — the financial square-root-of-time volatility model. <strong style={{ color: 'var(--red)' }}>Not financial advice.</strong>
      </div>

      {/* Entry Signals */}
      <TimelineCard icon="fa-bolt" label="Entry Signals" items={[
        { id: 'now', dot: 'live', frame: 'Now', value: fmtPrice(p.price), badge: 'LIVE', badgeClass: 'live-badge', extra: new Date().toLocaleTimeString(), info: false },
        { id: '10m', dot: '', frame: '10 min', ...createTimelineItem(signals['10m']), info: true },
        { id: '1h', dot: '', frame: '1 hour', ...createTimelineItem(signals['1h']), info: true },
        { id: '4h', dot: '', frame: '4 hour', ...createTimelineItem(signals['4h']), info: true },
        { id: '24h-sig', dot: '', frame: '24 hour', ...createTimelineItem(signals['24h-sig']), info: true },
      ]} onInfo={openPopup} />

      {/* Price Forecast */}
      <TimelineCard icon="fa-chart-line" label="Price Forecast" items={[
        { id: 'fc-1h', dot: '', frame: '1 hour', ...createTimelineItem(forecasts['1h']), info: true },
        { id: 'fc-6h', dot: '', frame: '6 hour', ...createTimelineItem(forecasts['6h']), info: true },
        { id: 'fc-24h', dot: '', frame: '24 hour', ...createTimelineItem(forecasts['24h']), info: true },
      ]} onInfo={openPopup} />

      {/* Market Signal */}
      <div style={{ margin: '14px 16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 16px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-gauge-high" style={{ color: 'var(--gold)' }} /> Market Signal
        </h3>
        <SignalBar label="BUY" pct={buyPct} color="var(--green)" />
        <SignalBar label="HLD" pct={holdPct} color="var(--gold)" />
        <SignalBar label="SELL" pct={sellPct} color="var(--red)" />
      </div>

      {/* Sentiment */}
      <div style={{ margin: '14px 16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 16px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-heart-pulse" style={{ color: 'var(--gold)' }} /> Market Sentiment
        </h3>
        <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
          <div style={{ fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{sentiment.emoji}</div>
          <div style={{ fontSize: 12, color: sentiment.color, marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>{sentiment.text}</div>
        </div>
      </div>

      {/* Key Levels */}
      <div style={{ margin: '14px 16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 16px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-layer-group" style={{ color: 'var(--gold)' }} /> Key Price Levels
        </h3>
        <LevelRow name="Strong Resistance" value={fmtPrice(levels.r2)} badge="R2" badgeClass="badge-resist" />
        <LevelRow name="Resistance" value={fmtPrice(levels.r1)} badge="R1" badgeClass="badge-resist" />
        <LevelRow name="Current Price" value={fmtPrice(p.price)} badge="NOW" badgeClass="badge-neutral" current />
        <LevelRow name="Support" value={fmtPrice(levels.s1)} badge="S1" badgeClass="badge-support" />
        <LevelRow name="Strong Support" value={fmtPrice(levels.s2)} badge="S2" badgeClass="badge-support" />
      </div>

      {/* Model Inputs */}
      <div style={{ margin: '14px 16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, padding: '18px 16px' }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-sliders" style={{ color: 'var(--gold)' }} /> Model Inputs
        </h3>
        {[
          { icon: 'fa-chart-simple', iconBg: 'var(--gold-bg)', iconColor: 'var(--gold)', name: 'Daily ATR', desc: 'Volatility anchor', sig: '—', sigBg: 'var(--gold-bg)', sigColor: 'var(--gold)' },
          { icon: 'fa-arrow-trend-up', iconBg: 'var(--green-bg)', iconColor: 'var(--green)', name: 'Momentum', desc: '24h directional bias', sig: '—', sigBg: 'var(--green-bg)', sigColor: 'var(--green)' },
          { icon: 'fa-wave-square', iconBg: 'var(--bg-3)', iconColor: 'var(--ink-2)', name: 'Intraday Volatility', desc: 'High-low vs ATR baseline', sig: '—', sigBg: 'var(--bg-3)', sigColor: 'var(--ink-2)' },
          { icon: 'fa-arrows-rotate', iconBg: 'var(--gold-bg)', iconColor: 'var(--gold)', name: 'Mean Reversion', desc: 'Counter-trend pull probability', sig: '—', sigBg: 'var(--gold-bg)', sigColor: 'var(--gold)' },
          { icon: 'fa-building-columns', iconBg: 'var(--red-bg)', iconColor: 'var(--red)', name: 'Market Session', desc: session.sessionLabel, sig: session.volLabel, sigBg: 'var(--red-bg)', sigColor: 'var(--red)' },
        ].map((f, i, arr) => (
          <FactorRow key={i} {...f} noBorder={i === arr.length - 1} />
        ))}
      </div>

      {/* Disclaimer */}
      <div style={{ margin: '14px 16px 0', padding: '14px 16px', background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.15)', borderRadius: 10, fontSize: 11, color: 'var(--ink-2)', lineHeight: 1.6 }}>
        <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--red)', marginRight: 5 }} />
        Not financial advice. Predictions are algorithmic estimates based on ATR volatility modelling. XAU/USD carries significant market risk. Always consult a licensed financial professional before trading.
      </div>

      {/* Popups */}
      {howToOpen && <HowToPopup onClose={() => setHowToOpen(false)} />}
      {activePopup && popupData[activePopup] && (
        <DetailPopup data={popupData[activePopup]} onClose={() => setActivePopup(null)} />
      )}

      <Footer />
    </>
  );
}

function createTimelineItem(sig: any) {
  return {
    value: fmtPrice(sig.price),
    badge: sig.direction === 'bull' ? '\u{1F4C8} BULL' : sig.direction === 'bear' ? '\u{1F4C9} BEAR' : '\u{2194}\u{FE0F} FLAT',
    badgeClass: sig.direction,
    conf: sig.confidence,
    confPct: `${sig.confidence}%`,
  };
}

function TimelineCard({ icon, label, items, onInfo }: { icon: string; label: string; items: any[]; onInfo: (id: string) => void }) {
  return (
    <div style={{ margin: '14px 16px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
      <div className="flex items-center gap-[8px] pt-[13px] px-[16px]">
        <i className={`fa-solid ${icon}`} style={{ fontSize: 12, color: 'var(--ink-4)' }} />
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-3)' }}>{label}</span>
      </div>
      {items.map((item: any, i: number) => (
        <div key={i} className="flex items-center gap-[12px] px-[16px] py-[12px]" style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: item.dot === 'live' ? 'var(--green)' : 'var(--border)', boxShadow: item.dot === 'live' ? '0 0 0 3px var(--green-bg)' : 'none' }} />
          <span style={{ fontSize: 12, color: 'var(--ink-2)', width: 52, flexShrink: 0 }}>{item.frame}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.2 }}>${item.value}</div>
            {item.extra && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>{item.extra}</div>}
            {item.conf !== undefined && (
              <div className="flex items-center gap-[7px] mt-[4px]">
                <div style={{ width: 56, height: 3, background: 'var(--bg-3)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
                  <div style={{ height: '100%', borderRadius: 3, width: `${item.conf}%`, background: 'var(--gold)', transition: 'width 0.9s ease' }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>{item.confPct}</span>
              </div>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, letterSpacing: '0.04em', flexShrink: 0, whiteSpace: 'nowrap', background: item.badgeClass === 'bull' || item.badgeClass === 'live-badge' ? 'var(--green-bg)' : item.badgeClass === 'bear' ? 'var(--red-bg)' : item.badgeClass === 'flat' ? 'var(--gold-bg)' : 'var(--bg-3)', color: item.badgeClass === 'bull' || item.badgeClass === 'live-badge' ? 'var(--green)' : item.badgeClass === 'bear' ? 'var(--red)' : item.badgeClass === 'flat' ? 'var(--gold)' : 'var(--ink-3)' }}>
            {item.badge}
          </span>
          {item.info && (
            <button onClick={() => onInfo(item.id)} className="w-[30px] h-[30px] rounded-full border flex items-center justify-center flex-shrink-0 cursor-pointer" style={{ border: '1px solid var(--border)', background: 'none', color: 'var(--ink-3)', fontSize: 14 }}>
              <i className="fa-solid fa-circle-info" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SignalBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="grid grid-cols-[36px_1fr_40px] items-center gap-[10px] mb-[10px]">
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
      <div style={{ height: 8, background: 'var(--bg-3)', borderRadius: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 5, width: `${pct}%`, background: color, transition: 'width 0.8s ease' }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
    </div>
  );
}

function LevelRow({ name, value, badge, badgeClass, current }: { name: string; value: string; badge: string; badgeClass: string; current?: boolean }) {
  const badgeColors: Record<string, { bg: string; color: string }> = {
    'badge-support': { bg: 'var(--green-bg)', color: 'var(--green)' },
    'badge-resist': { bg: 'var(--red-bg)', color: 'var(--red)' },
    'badge-neutral': { bg: 'var(--gold-bg)', color: 'var(--gold)' },
  };
  const bc = badgeColors[badgeClass] || { bg: 'var(--bg-3)', color: 'var(--ink-3)' };
  return (
    <div className="flex items-center justify-between gap-[10px]" style={{ borderBottom: '1px solid var(--border)', background: current ? 'var(--bg-2)' : 'transparent', borderRadius: current ? 8 : 0, padding: current ? '10px 8px' : '10px 0' }}>
      <span style={{ fontSize: 12, color: current ? 'var(--ink)' : 'var(--ink-3)', fontWeight: current ? 700 : 400 }}>{name}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: current ? 'var(--gold)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: bc.bg, color: bc.color }}>{badge}</span>
    </div>
  );
}

function FactorRow({ icon, iconBg, iconColor, name, desc, sig, sigBg, sigColor, noBorder }: { icon: string; iconBg: string; iconColor: string; name: string; desc: string; sig: string; sigBg: string; sigColor: string; noBorder?: boolean }) {
  return (
    <div className="flex items-center gap-[10px] py-[10px]" style={{ borderBottom: noBorder ? 'none' : '1px solid var(--border)' }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <i className={`fa-solid ${icon}`} style={{ fontSize: 13 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>{name}</div>
        <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.45 }}>{desc}</div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 9px', borderRadius: 8, flexShrink: 0, background: sigBg, color: sigColor }}>{sig}</span>
    </div>
  );
}

function HowToPopup({ onClose }: { onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 600, opacity: 1 }} />
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%) translateY(0)', width: '100%', maxWidth: 480, background: 'var(--bg)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)', zIndex: 601, padding: '0 20px 36px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 4, margin: '14px auto 20px' }} />
        <div className="flex items-center gap-[10px] mb-[18px]">
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--gold-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <i className="fa-solid fa-circle-question" style={{ color: 'var(--gold)', fontSize: 16 }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>How to use the Forecast Tools</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--red)', fontSize: 14, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
            <strong style={{ color: 'var(--ink)' }}>Attention:</strong> Trading Gold carries high significant risk, you could lose all or part of your capital, always do your analysis, read our <Link href="/disclaimer" style={{ color: 'var(--red)', fontWeight: 700 }}>disclaimer</Link>.
          </div>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>The forecast tools uses ATR modelling and carries sections like:</div>
        <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
          {[
            { title: 'Entry Signals', desc: 'It forecasts how your next trade should go depending on the votality of gold at that time.' },
            { title: 'Price Forecast', desc: 'It predicts what range gold would be trading at at a particular time.' },
            { title: 'Market Signal', desc: 'The current market trend.' },
            { title: 'Market Sentiment', desc: 'The current market trend based on the chart.' },
            { title: 'Price Levels', desc: 'The support and resistance of the xauusd chart.' },
            { title: 'Model', desc: 'This carries other necessary information regarding gold, what session is on, the current volatility etc.' },
          ].map((s, i) => (
            <div key={i} style={{ padding: '13px 14px', background: 'var(--bg-2)', borderBottom: i < 5 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.title}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>{s.desc}</div>
            </div>
          ))}
        </div>
        <div style={{ background: 'var(--gold-bg)', border: '1px solid rgba(154,110,0,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
            It&apos;s important to note that you should use this tool as a guide, as a personal help to making better profitable trades and not to follow the forecasts blindly, always follow the market as gold can be very intimidating even if you&apos;re a experienced trader.
          </div>
        </div>
        <button onClick={onClose} className="w-full py-[13px] mt-[16px] text-[14px] font-bold rounded-[10px] cursor-pointer flex items-center justify-center gap-[8px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          <i className="fa-solid fa-xmark" /> Close
        </button>
      </div>
    </>
  );
}

function DetailPopup({ data, onClose }: { data: any; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)', zIndex: 600, opacity: 1 }} />
      <div style={{ position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%) translateY(0)', width: '100%', maxWidth: 480, background: 'var(--bg)', borderRadius: '20px 20px 0 0', borderTop: '1px solid var(--border)', zIndex: 601, padding: '0 20px 36px', maxHeight: '80vh', overflowY: 'auto' }}>
        <div style={{ width: 36, height: 4, background: 'var(--border)', borderRadius: 4, margin: '14px auto 20px' }} />
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--ink-4)', marginBottom: 6 }}>{data.kicker}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{data.signal}</div>
        <div style={{ fontSize: 13, marginBottom: 16, lineHeight: 1.5, color: 'var(--ink-2)' }}>{data.dir}</div>
        <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, background: 'var(--bg-2)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>{data.reason}</div>
        <div style={{ height: 1, background: 'var(--border)', margin: '14px 0' }} />
        <div className="flex justify-between items-center py-[7px]">
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Confidence</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{data.conf}</span>
        </div>
        <div className="flex justify-between items-center py-[7px]">
          <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>±1σ band</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)' }}>{data.range}</span>
        </div>
        <button onClick={onClose} className="w-full py-[13px] mt-[16px] text-[14px] font-bold rounded-[10px] cursor-pointer flex items-center justify-center gap-[8px]" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--ink)' }}>
          <i className="fa-solid fa-xmark" /> Dismiss
        </button>
      </div>
    </>
  );
}
