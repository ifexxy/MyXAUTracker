'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useGoldPrice } from '@/contexts/GoldPriceContext';
import { useTheme } from '@/contexts/ThemeContext';
import { fmtPrice, fmtChange } from '@/lib/api';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserData } from '@/types';

/* ══════════════════════════════════════════════════════════════
   MARKET SESSION
══════════════════════════════════════════════════════════════ */
function getSessionInfo() {
  const h = new Date().getUTCHours();
  const asian = h >= 0 && h < 8;
  const london = h >= 7 && h < 16;
  const ny = h >= 13 && h < 21;
  const overlap = london && ny;
  let sessionMultiplier = 0.55, volLabel = 'MINIMAL', sessionLabel = 'Off-Hours';
  if (overlap)      { sessionMultiplier = 1.35; volLabel = 'PEAK';   sessionLabel = 'London + NY Overlap'; }
  else if (ny)      { sessionMultiplier = 1.20; volLabel = 'HIGH';   sessionLabel = 'New York'; }
  else if (london)  { sessionMultiplier = 1.10; volLabel = 'MEDIUM'; sessionLabel = 'London'; }
  else if (asian)   { sessionMultiplier = 0.70; volLabel = 'LOW';    sessionLabel = 'Asian'; }
  return { asian, london, ny, overlap, sessionMultiplier, volLabel, sessionLabel };
}

/* ══════════════════════════════════════════════════════════════
   ATR ESTIMATOR
══════════════════════════════════════════════════════════════ */
function estimateATR(high: number, low: number, price: number, chp: number) {
  const intradayRange = high - low;
  const changeRange = Math.abs(chp / 100 * price) * 2;
  return Math.min(Math.max(Math.max(intradayRange, changeRange), 10), 80);
}

/* ══════════════════════════════════════════════════════════════
   TYPES
══════════════════════════════════════════════════════════════ */
interface SessionInfo {
  asian: boolean; london: boolean; ny: boolean; overlap: boolean;
  sessionMultiplier: number; volLabel: string; sessionLabel: string;
}

interface Forecast {
  target: number; bandLow: number; bandHigh: number; conf: number; sigma: number;
}

interface Predictions {
  atr: number; session: SessionInfo; mrStrength: number; effectiveDrift: number;
  f1h: Forecast; f6h: Forecast; f24h: Forecast;
}

interface EntrySignal {
  sig: string; dir: string; reason: string; conf: number;
  badgeTxt: string; badgeCls: 'bull' | 'bear' | 'flat' | 'wait';
}

interface EntrySignals {
  e10m: EntrySignal; e1h: EntrySignal; e4h: EntrySignal; e24h: EntrySignal;
}

interface PopupData {
  kicker: string; signal: string; dir: string; dirColor: string;
  reason: string; conf: string; range: string | null;
}

/* ══════════════════════════════════════════════════════════════
   CORE PREDICTION ENGINE
══════════════════════════════════════════════════════════════ */
function buildPredictions(price: number, chp: number, high: number, low: number): Predictions {
  const atr = estimateATR(high, low, price, chp);
  const session = getSessionInfo();
  const dailyMomentumDollar = (chp / 100) * price;
  const hourlyDrift = dailyMomentumDollar / 24;
  const movePct = Math.abs(chp);
  const mrStrength = Math.min(movePct / 3.0, 0.80);
  const effectiveDrift = hourlyDrift * (1 - mrStrength * 0.6);

  function sigma(minutes: number) {
    return atr * Math.sqrt(minutes / 1440) * session.sessionMultiplier;
  }

  function forecast(minutes: number): Forecast {
    const s = sigma(minutes);
    const drift = effectiveDrift * (minutes / 60);
    const noise = s * (Math.random() * 0.5 - 0.25);
    const target = parseFloat((price + drift + noise).toFixed(2));
    const bandLow = parseFloat((target - s).toFixed(2));
    const bandHigh = parseFloat((target + s).toFixed(2));
    const baseConf = Math.max(30, 96 - (minutes / 1440) * 55);
    const volPenalty = Math.min((atr - 20) / 2, 15);
    const conf = Math.round(Math.max(28, baseConf - volPenalty));
    return { target, bandLow, bandHigh, conf, sigma: s };
  }

  return {
    atr, session, mrStrength, effectiveDrift,
    f1h: forecast(60), f6h: forecast(360), f24h: forecast(1440),
  };
}

/* ══════════════════════════════════════════════════════════════
   ENTRY SIGNAL ENGINE
══════════════════════════════════════════════════════════════ */
function computeEntrySignals(
  price: number, chp: number, high: number, low: number,
  atr: number, sess: SessionInfo
): EntrySignals {
  const isUp = chp >= 0;
  const absMom = Math.abs(chp);
  const rangePos = (price - low) / Math.max(high - low, 0.01);
  const pseudoRSI = rangePos * 100;
  const momStrong = absMom >= 0.5;
  const momMod = absMom >= 0.2 && absMom < 0.5;
  const overbought = pseudoRSI > 72;
  const oversold = pseudoRSI < 28;
  const neutral = !overbought && !oversold;
  const highVol = atr > 35;
  const poorSess = !(sess.overlap || sess.ny || sess.london);

  function mk(sig: string, dir: string, reason: string, conf: number, bTxt: string): EntrySignal {
    const badgeCls: EntrySignal['badgeCls'] =
      bTxt === 'LONG'  ? 'bull' :
      bTxt === 'SHORT' ? 'bear' :
      bTxt === 'FLAT'  ? 'flat' : 'wait';
    return { sig, dir, reason, conf, badgeTxt: bTxt, badgeCls };
  }

  let e10m: EntrySignal;
  if (poorSess)
    e10m = mk('WAIT', 'Low liquidity', `Asian/off-hours session. Poor conditions. ATR: $${atr.toFixed(2)}`, 35, 'WAIT');
  else if (momStrong && isUp && !overbought)
    e10m = mk('ENTER LONG', `Bullish · +${absMom.toFixed(2)}% momentum`, `Strong momentum, not overbought (RSI≈${pseudoRSI.toFixed(0)}). 10m long scalp setup.`, highVol ? 65 : 74, 'LONG');
  else if (momStrong && !isUp && !oversold)
    e10m = mk('ENTER SHORT', `Bearish · ${chp.toFixed(2)}% momentum`, `Strong downward momentum, not oversold (RSI≈${pseudoRSI.toFixed(0)}). 10m short scalp setup.`, highVol ? 65 : 74, 'SHORT');
  else if (overbought && isUp)
    e10m = mk('CAUTION', 'Overbought — scalp risk high', `Price at day high (RSI≈${pseudoRSI.toFixed(0)}). 10m longs risk a sharp reversal.`, 45, 'WAIT');
  else if (oversold && !isUp)
    e10m = mk('CAUTION', 'Oversold — scalp risk high', `Price at day low (RSI≈${pseudoRSI.toFixed(0)}). 10m shorts risk a snap-back.`, 45, 'WAIT');
  else if (momMod && neutral)
    e10m = mk(isUp ? 'ENTER LONG' : 'ENTER SHORT', `Mild ${isUp ? 'bullish' : 'bearish'} · ${isUp ? '+' : ''}${chp.toFixed(2)}%`, `Moderate momentum, neutral range. Acceptable 10m scalp.`, 58, isUp ? 'LONG' : 'SHORT');
  else
    e10m = mk('NO SIGNAL', 'Momentum too weak', 'Insufficient conviction for a 10m trade.', 36, 'SKIP');

  let e1h: EntrySignal;
  if (poorSess)
    e1h = mk('WAIT', 'Low liquidity — avoid 1h entries', `Asian/off-hours reduces follow-through. ATR: $${atr.toFixed(2)}`, 38, 'WAIT');
  else if (momStrong && isUp && !overbought)
    e1h = mk('ENTER LONG', `Bullish · +${absMom.toFixed(2)}% confirmed`, `Strong upward momentum, not overbought (RSI≈${pseudoRSI.toFixed(0)}). Good 1h long setup.`, highVol ? 70 : 78, 'LONG');
  else if (momStrong && !isUp && !oversold)
    e1h = mk('ENTER SHORT', `Bearish · ${chp.toFixed(2)}% confirmed`, `Strong downward momentum, not oversold (RSI≈${pseudoRSI.toFixed(0)}). Good 1h short setup.`, highVol ? 70 : 78, 'SHORT');
  else if (momStrong && isUp && overbought)
    e1h = mk('CAUTION', 'Bullish but overbought', `Price near day high (RSI≈${pseudoRSI.toFixed(0)}). Wait for pullback before 1h long.`, 52, 'WAIT');
  else if (momStrong && !isUp && oversold)
    e1h = mk('CAUTION', 'Bearish but oversold', `Price near day low (RSI≈${pseudoRSI.toFixed(0)}). Risk of snap-back on 1h.`, 52, 'WAIT');
  else if (momMod && isUp && neutral)
    e1h = mk('ENTER LONG', `Mild bullish · +${absMom.toFixed(2)}% · neutral RSI`, `Moderate upward move, neutral range. Acceptable 1h long.`, 62, 'LONG');
  else if (momMod && !isUp && neutral)
    e1h = mk('ENTER SHORT', `Mild bearish · ${chp.toFixed(2)}% · neutral RSI`, `Moderate downward move, neutral range. Acceptable 1h short.`, 62, 'SHORT');
  else
    e1h = mk('NO SIGNAL', 'Momentum too weak for 1h trade', 'Weak momentum or conflicting signals.', 40, 'SKIP');

  const strongBull4h = absMom >= 0.4 && isUp && !overbought;
  const strongBear4h = absMom >= 0.4 && !isUp && !oversold;
  let e4h: EntrySignal;
  if (strongBull4h)
    e4h = mk('ENTER LONG', `Bullish · +${absMom.toFixed(2)}% · room to run`, `Momentum strong for 4h trade. Not overbought (RSI≈${pseudoRSI.toFixed(0)}).`, sess.overlap ? 82 : sess.ny ? 78 : 70, 'LONG');
  else if (strongBear4h)
    e4h = mk('ENTER SHORT', `Bearish · ${chp.toFixed(2)}% · room to fall`, `Momentum strong for 4h trade. Not oversold (RSI≈${pseudoRSI.toFixed(0)}).`, sess.overlap ? 82 : sess.ny ? 78 : 70, 'SHORT');
  else if (oversold && absMom < 0.6)
    e4h = mk('REVERSAL LONG', `Oversold bounce · RSI≈${pseudoRSI.toFixed(0)}`, 'Price near day low, declining momentum. Counter-trend 4h long possible. High risk.', 58, 'LONG');
  else if (overbought && absMom < 0.6)
    e4h = mk('REVERSAL SHORT', `Overbought fade · RSI≈${pseudoRSI.toFixed(0)}`, 'Price near day high, weakening momentum. Counter-trend 4h short possible. High risk.', 58, 'SHORT');
  else if (absMom >= 0.4 && isUp && overbought)
    e4h = mk('WAIT', 'Bullish but overextended', `+${absMom.toFixed(2)}% already baked in. RSI≈${pseudoRSI.toFixed(0)}. Wait for 4h pullback.`, 48, 'WAIT');
  else if (absMom >= 0.4 && !isUp && oversold)
    e4h = mk('WAIT', 'Bearish but oversold', `${chp.toFixed(2)}% drop extended. RSI≈${pseudoRSI.toFixed(0)}. Risk of snap-back.`, 48, 'WAIT');
  else
    e4h = mk('NO SIGNAL', 'Insufficient momentum for 4h trade', 'No clear 4h entry setup.', 35, 'SKIP');

  const trendBull = absMom >= 0.6 && isUp && rangePos > 0.45 && rangePos < 0.88;
  const trendBear = absMom >= 0.6 && !isUp && rangePos < 0.55 && rangePos > 0.12;
  let e24h: EntrySignal;
  if (trendBull)
    e24h = mk('ENTER LONG', `Strong bullish trend · +${absMom.toFixed(2)}%`, 'Strong momentum in mid-range. Good daily long setup.', highVol ? 72 : 80, 'LONG');
  else if (trendBear)
    e24h = mk('ENTER SHORT', `Strong bearish trend · ${chp.toFixed(2)}%`, 'Strong momentum in mid-range. Good daily short setup.', highVol ? 72 : 80, 'SHORT');
  else if (pseudoRSI < 20 && absMom < 1.0)
    e24h = mk('LONG (REVERSAL)', `Extreme oversold · RSI≈${pseudoRSI.toFixed(0)}`, 'Price at extreme low. Mean reversion setup for daily long.', 60, 'LONG');
  else if (pseudoRSI > 80 && absMom < 1.0)
    e24h = mk('SHORT (REVERSAL)', `Extreme overbought · RSI≈${pseudoRSI.toFixed(0)}`, 'Price at extreme high. Mean reversion setup for daily short.', 60, 'SHORT');
  else if (absMom >= 0.6 && isUp && overbought)
    e24h = mk('WAIT', 'Bullish but 24h overextended', 'Move already extended. Wait for a healthier entry.', 45, 'WAIT');
  else if (absMom >= 0.6 && !isUp && oversold)
    e24h = mk('WAIT', 'Bearish but 24h overextended', 'Drop already extended. Risk of reversal.', 45, 'WAIT');
  else
    e24h = mk('NO SIGNAL', 'No clear daily trend', 'Insufficient conviction for a 24h trade.', 32, 'SKIP');

  return { e10m, e1h, e4h, e24h };
}

/* ══════════════════════════════════════════════════════════════
   MARKET SIGNAL
══════════════════════════════════════════════════════════════ */
function computeMarketSignal(chp: number, isUp: boolean) {
  const extendedMove = Math.abs(chp) > 1.5;
  const rng = 0.3 + Math.random() * 0.4;
  let buy: number, hold: number, sell: number;
  if (extendedMove) {
    if (isUp) { buy = Math.round(30 + rng * 15); sell = Math.round(20 + rng * 15); }
    else       { sell = Math.round(30 + rng * 15); buy = Math.round(20 + rng * 15); }
    hold = 100 - buy - sell;
  } else {
    if (isUp) { buy = Math.round(45 + rng * 20); hold = Math.round((100 - buy) * 0.55); sell = 100 - buy - hold; }
    else       { sell = Math.round(45 + rng * 20); hold = Math.round((100 - sell) * 0.55); buy = 100 - sell - hold; }
  }
  buy = Math.max(buy, 5); sell = Math.max(sell, 5); hold = Math.max(100 - buy - sell, 5);
  return { buy, hold, sell };
}

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */
function fmtD(v: number) { return (v >= 0 ? '+' : '') + v.toFixed(2); }
function fmtP(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
export default function PredictPage() {
  /* ── mounted guard — nothing browser-specific runs on the server ── */
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { user, loading: authLoading, signOut } = useAuth();
  const { price, loading: priceLoading } = useGoldPrice();
  const { theme } = useTheme();
  const tvRef = useRef<HTMLDivElement>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [popupStore, setPopupStore] = useState<Record<string, PopupData>>({});

  /* ── Notifications ── */
  const [notifEnabled, setNotifEnabled] = useState(false);
  const prevSignalsRef = useRef<Record<string, string>>({});

  /* Restore saved notification preference */
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem('xau-notif');
      if (saved === 'true' && 'Notification' in window && Notification.permission === 'granted') {
        setNotifEnabled(true);
      }
    } catch {}
  }, [mounted]);

  /* Save notification preference */
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem('xau-notif', String(notifEnabled));
    } catch {}
  }, [notifEnabled, mounted]);

  /* User data */
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

  /* TradingView widget */
  useEffect(() => {
    if (!mounted || !tvRef.current) return;
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
  }, [theme, mounted]);

  /* ── Derived values ── */
  const p = price || { price: 0, open: 0, high: 0, low: 0, bid: 0, ask: 0, ch: 0, chp: 0, source: '—' };
  const isUp = (p.ch || 0) >= 0;
  const session = getSessionInfo();

  const pred = p.price > 0
    ? buildPredictions(p.price, p.chp || 0, p.high || p.price, p.low || p.price)
    : null;

  const atr = pred?.atr ?? 0;
  const mrStrength = pred?.mrStrength ?? 0;

  const sigs = pred
    ? computeEntrySignals(p.price, p.chp || 0, p.high || p.price, p.low || p.price, atr, session)
    : null;

  const marketSignal = p.price > 0
    ? computeMarketSignal(p.chp || 0, isUp)
    : { buy: 0, hold: 0, sell: 0 };

  const score = marketSignal.buy - marketSignal.sell;
  const [sentimentEmoji, sentimentText] =
    score > 25  ? ['🟢', 'BULLISH'] :
    score > 10  ? ['🔼', 'MILDLY BULLISH'] :
    score > -10 ? ['⚖️', 'NEUTRAL'] :
    score > -25 ? ['🔽', 'MILDLY BEARISH'] :
                  ['🔴', 'BEARISH'];

  const pivot = ((p.high || p.price) + (p.low || p.price) + p.price) / 3;
  const r1 = 2 * pivot - (p.low || p.price);
  const r2 = pivot + ((p.high || p.price) - (p.low || p.price));
  const s1 = 2 * pivot - (p.high || p.price);
  const s2 = pivot - ((p.high || p.price) - (p.low || p.price));

  const atrCat = atr < 20 ? 'LOW' : atr < 35 ? 'NORMAL' : 'HIGH';
  const intradayRange = (p.high || 0) - (p.low || 0);
  const intradayRangePct = atr > 0 ? ((intradayRange / atr) * 100).toFixed(0) : '0';
  const volCat = Number(intradayRangePct) < 40 ? 'QUIET' : Number(intradayRangePct) < 80 ? 'NORMAL' : 'WIDE';
  const mrLabel = mrStrength < 0.2 ? 'LOW' : mrStrength < 0.5 ? 'MODERATE' : 'HIGH';

  const now = Date.now();
  const hasAccess = userData ? (
    (userData.trialEndsAt && new Date(userData.trialEndsAt).getTime() > now) ||
    (userData.subscriptionStatus === 'active' && userData.currentPeriodEnd && new Date(userData.currentPeriodEnd).getTime() > now) ||
    (userData.manualAccess && (!userData.manualAccessExpiresAt || new Date(userData.manualAccessExpiresAt).getTime() > now))
  ) : false;
  const accessExpired = user && userData && !hasAccess;

  /* ── Signal change notifications ── */
  useEffect(() => {
    if (!mounted || !sigs || !notifEnabled) return;

    const current: Record<string, string> = {
      '10m': sigs.e10m.sig,
      '1h':  sigs.e1h.sig,
      '4h':  sigs.e4h.sig,
      '24h': sigs.e24h.sig,
    };

    const prev = prevSignalsRef.current;

    const isActionable = (s: string) =>
      s.includes('LONG') || s.includes('SHORT') ||
      s.includes('ENTER') || s.includes('NO SIGNAL');

    Object.entries(current).forEach(([frame, sig]) => {
      if (!prev[frame] || prev[frame] === sig) return;
      if (isActionable(sig) || isActionable(prev[frame])) {
        try {
          new Notification(`XAU/USD ${frame} Signal Changed`, {
            body: `${prev[frame]} → ${sig}`,
            icon: '/favicon.ico',
            tag: `xau-signal-${frame}`,
          });
        } catch {}
      }
    });

    prevSignalsRef.current = current;
  }, [sigs, notifEnabled, mounted]);

  /* ── Notification permission request ── */
  async function requestNotifPermission() {
    if (!mounted || !('Notification' in window)) {
      alert('Your browser does not support notifications.');
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setNotifEnabled(perm === 'granted');
    } catch {}
  }

  /* ── Popup helpers ── */
  function buildSignalPopup(frameLabel: string, sig: EntrySignal): PopupData {
    return {
      kicker: frameLabel + ' entry signal',
      signal: sig.sig,
      dir: sig.dir,
      dirColor: sig.badgeCls === 'bull' ? 'var(--green)' : sig.badgeCls === 'bear' ? 'var(--red)' : 'var(--gold)',
      reason: sig.reason,
      conf: sig.conf + '%',
      range: null,
    };
  }

  function buildFcPopup(frameLabel: string, fc: Forecast, basePrice: number): PopupData {
    const diff = fc.target - basePrice;
    const pct = (diff / basePrice) * 100;
    return {
      kicker: frameLabel + ' price forecast',
      signal: '$' + fmtP(fc.target),
      dir: (diff >= 0 ? '+' : '') + fmtD(diff) + '  (' + (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%)',
      dirColor: diff >= 0 ? 'var(--green)' : 'var(--red)',
      reason: 'ATR-based σ(t) = ATR × √(t / 1440) forecast. The ±1σ band shows the 68% probability range for this timeframe.',
      conf: fc.conf + '%',
      range: '$' + fmtP(fc.bandLow) + ' – $' + fmtP(fc.bandHigh),
    };
  }

  function openPopup(key: string) {
    if (!pred || !sigs) return;
    let data: PopupData | null = null;
    if      (key === '10m')     data = buildSignalPopup('10 min', sigs.e10m);
    else if (key === '1h')      data = buildSignalPopup('1 hour', sigs.e1h);
    else if (key === '4h')      data = buildSignalPopup('4 hour', sigs.e4h);
    else if (key === '24h-sig') data = buildSignalPopup('24 hour', sigs.e24h);
    else if (key === 'fc-1h')   data = buildFcPopup('1 hour', pred.f1h, p.price);
    else if (key === 'fc-6h')   data = buildFcPopup('6 hour', pred.f6h, p.price);
    else if (key === 'fc-24h')  data = buildFcPopup('24 hour', pred.f24h, p.price);
    if (data) {
      setPopupStore(prev => ({ ...prev, [key]: data as PopupData }));
      setActivePopup(key);
    }
  }

  /* ── Confidence colour ── */
  const tlConfColor = (c: number) => c >= 75 ? 'var(--green)' : c >= 55 ? 'var(--gold)' : 'var(--red)';

  /* ══════════════════════════════════════════════════════════════
     RENDER GUARDS
  ══════════════════════════════════════════════════════════════ */

  /* Server / pre-hydration — render nothing except a spinner */
  if (!mounted) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100dvh' }}>
        <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--ink-3)' }} />
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', padding: 40 }}>
        <div style={{ textAlign: 'center' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: 28, color: 'var(--ink-3)', marginBottom: 16 }} />
          <div style={{ fontSize: 13, color: 'var(--ink-3)' }}>Loading your account...</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--gold-bg)', border: '1px solid var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 24, color: 'var(--gold)' }}>
            <i className="fa-solid fa-lock" />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.3 }}>Sign in to access<br />Gold Forecast</h2>
          <p style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 24 }}>
            Create a free account or sign in to view real-time predictions, entry signals, and market analysis.
          </p>
          <Link href="/login" className="btn-primary no-underline" style={{ textDecoration: 'none', marginBottom: 10 }}>
            <i className="fa-solid fa-right-to-bracket" /> Sign In
          </Link>
          <Link href="/signup" className="btn-outline" style={{ textDecoration: 'none' }}>
            <i className="fa-solid fa-user-plus" /> Create Free Account
          </Link>
        </div>
      </div>
    );
  }

  if (accessExpired) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: '100dvh', padding: 24 }}>
        <div style={{ textAlign: 'center', maxWidth: 320 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'var(--red-bg)', border: '1px solid var(--red)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>⛔</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.3 }}>Your access has expired</div>
          <div style={{ fontSize: 13, color: 'var(--ink-3)', lineHeight: 1.65, marginBottom: 24 }}>Please contact us to reactivate your account.</div>
          <Link href="/contact" className="btn-primary no-underline" style={{ textDecoration: 'none', marginBottom: 10 }}>
            <i className="fa-solid fa-envelope" /> Contact Us
          </Link>
          <button onClick={signOut} className="btn-ghost" style={{ cursor: 'pointer', minWidth: 0 }}>
            <i className="fa-solid fa-right-from-bracket" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     MAIN RENDER
  ══════════════════════════════════════════════════════════════ */
  return (
    <>
      {/* Account Dashboard */}
      {user && userData && (
        <div className="predict-card" id="account-dashboard" style={{ marginTop: 14, background: 'var(--bg-2)' }}>
          <h3><i className="fa-solid fa-circle-user" />My Account</h3>
          <div className="account-shell">
            <div className="account-avatar"><i className="fa-solid fa-user" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div id="dash-email" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.email}</div>
              <div id="dash-status-badge" style={{ marginTop: 5 }}>
                {userData.subscriptionStatus === 'trial' && (
                  <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 10, background: 'var(--gold-bg)', color: 'var(--gold)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa-solid fa-clock" style={{ fontSize: 6 }} />TRIAL
                  </span>
                )}
                {userData.subscriptionStatus === 'active' && (
                  <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa-solid fa-circle" style={{ fontSize: 6 }} />ACTIVE
                  </span>
                )}
                {userData.manualAccess && (
                  <span style={{ fontSize: 10, padding: '2px 10px', borderRadius: 10, background: 'var(--green-bg)', color: 'var(--green)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    <i className="fa-solid fa-key" style={{ fontSize: 6 }} />GRANTED
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="account-info">
            <div className="account-label">Access Status</div>
            <div id="dash-access-text" style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.6 }}>
              {hasAccess ? (
                userData.subscriptionStatus === 'active'
                  ? `Subscription renews ${userData.currentPeriodEnd ? new Date(userData.currentPeriodEnd).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`
                  : userData.subscriptionStatus === 'trial'
                    ? `Free trial — expires ${userData.trialEndsAt ? new Date(userData.trialEndsAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`
                    : `Access granted${userData.manualAccessExpiresAt ? ` · Expires ${new Date(userData.manualAccessExpiresAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}` : ' · Permanent'}`
              ) : 'No active access'}
            </div>
          </div>
          <div id="dash-actions" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {userData.subscriptionStatus !== 'active' ? (
              <Link href="/contact" className="btn-solid" style={{ textDecoration: 'none' }}>Contact Us</Link>
            ) : (
              <Link href="/subscribe" className="btn-solid" style={{ textDecoration: 'none', background: 'var(--gold)', color: '#000', borderColor: 'var(--gold)' }}>
                <i className="fa-solid fa-crown" /> Renew
              </Link>
            )}
            <button onClick={signOut} className="btn-ghost" style={{ cursor: 'pointer' }}>
              <i className="fa-solid fa-right-from-bracket" /> Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Live price strip */}
      <div className="live-strip">
        <div className="live-strip-left">
          <div>
            <div className="mini-label">XAU/USD Spot</div>
            <div className="live-price-big">
              <span className="sym">$</span>
              <span id="strip-price">{fmtPrice(p.price)}</span>
            </div>
          </div>
          <div className={`live-change ${isUp ? 'up' : 'down'}`}>
            {fmtChange(p.ch || 0)} ({(p.chp || 0).toFixed(2)}%)
          </div>
        </div>
        <div className="atr-badge">
          <div>Daily ATR</div>
          <div id="strip-atr">${atr.toFixed(2)}</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="stats-grid-3">
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-arrow-up stat-icon" style={{ color: 'var(--green)' }} />High</div>
          <div className="stat-val">{fmtPrice(p.high || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-arrow-down stat-icon" style={{ color: 'var(--red)' }} />Low</div>
          <div className="stat-val">{fmtPrice(p.low || 0)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-door-open stat-icon" style={{ color: 'var(--gold)' }} />Open</div>
          <div className="stat-val">{fmtPrice(p.open || 0)}</div>
        </div>
      </div>

      {/* Session row */}
      <div className="session-row" id="session-row">
        {[
          { id: 'sess-asian',  label: 'Asian',    active: session.asian && !session.london },
          { id: 'sess-london', label: 'London',   active: session.london },
          { id: 'sess-ny',     label: 'New York', active: session.ny },
        ].map(s => (
          <div key={s.id} className={`session-chip${s.active ? ' active' : ''}`} id={s.id}>
            <div className="dot" />{s.label}
          </div>
        ))}
        <div className="session-chip" id="sess-vol" style={{ marginLeft: 'auto' }}>
          <i className="fa-solid fa-wave-square" style={{ fontSize: 9 }} />
          <span id="sess-vol-label">{session.volLabel} VOL</span>
        </div>
      </div>

      {/* How to use */}
      <div style={{ padding: '14px 16px 0' }}>
        <button
          onClick={() => setHowToOpen(true)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '13px 16px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--gold-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <i className="fa-solid fa-circle-question" style={{ color: 'var(--gold)', fontSize: 14 }} />
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>How to use the Forecast Tools</span>
          </div>
          <i className="fa-solid fa-chevron-right" style={{ color: 'var(--ink-4)', fontSize: 11, flexShrink: 0 }} />
        </button>
      </div>

      {/* TradingView */}
      <div
        style={{ margin: '14px 16px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', height: 400 }}
        ref={tvRef}
      />

      {/* Algo note */}
      <div className="algo-note">
        <i className="fa-solid fa-microchip" />
        Forecasts use <strong style={{ color: 'var(--gold)' }}>ATR × √(t/1440)</strong> — the financial square-root-of-time volatility model.{' '}
        <strong style={{ color: 'var(--red)' }}>Not financial advice.</strong>
      </div>

      {/* ═══ Entry Signals Timeline ═══ */}
      <div className="tl-outer-card">
        <div className="tl-card-header">
          <i className="fa-solid fa-bolt" />
          <span className="tl-card-header-label">Entry Signals</span>
          <button
            onClick={notifEnabled ? () => setNotifEnabled(false) : requestNotifPermission}
            style={{
              marginLeft: 'auto',
              background: notifEnabled ? 'var(--green-bg)' : 'var(--bg-3)',
              border: `1px solid ${notifEnabled ? 'var(--green)' : 'var(--border)'}`,
              color: notifEnabled ? 'var(--green)' : 'var(--ink-3)',
              borderRadius: 8, padding: '4px 10px',
              fontSize: 11, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              fontFamily: 'inherit',
            }}
          >
            <i className={`fa-solid fa-bell${notifEnabled ? '' : '-slash'}`} />
            {notifEnabled ? 'Alerts ON' : 'Alerts'}
          </button>
        </div>

        {/* Now */}
        <div className="tl-row">
          <div className="tl-dot live" />
          <span className="tl-frame">Now</span>
          <div className="tl-main">
            <div className="tl-value">${fmtPrice(p.price)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <span className="tl-badge live-badge">LIVE</span>
          <div style={{ width: 30, flexShrink: 0 }} />
        </div>

        {/* Signal rows */}
        {sigs && [
          { key: '10m',     frame: '10 min',  sig: sigs.e10m },
          { key: '1h',      frame: '1 hour',  sig: sigs.e1h  },
          { key: '4h',      frame: '4 hour',  sig: sigs.e4h  },
          { key: '24h-sig', frame: '24 hour', sig: sigs.e24h },
        ].map(item => (
          <div key={item.key} className="tl-row">
            <div className="tl-dot" />
            <span className="tl-frame">{item.frame}</span>
            <div className="tl-main">
              <div className="tl-value">{item.sig.sig}</div>
              <div className="tl-conf-row">
                <div className="tl-conf-bar">
                  <div className="tl-conf-fill" style={{ width: `${item.sig.conf}%`, background: tlConfColor(item.sig.conf) }} />
                </div>
                <span className="tl-conf-pct">{item.sig.conf}%</span>
              </div>
            </div>
            <span className={`tl-badge ${item.sig.badgeCls}`}>{item.sig.badgeTxt}</span>
            <button className="tl-info-btn" onClick={() => openPopup(item.key)} aria-label={`${item.frame} details`}>
              <i className="fa-solid fa-circle-info" />
            </button>
          </div>
        ))}
      </div>

      {/* ═══ Price Forecast Timeline ═══ */}
      <div className="tl-outer-card" style={{ marginBottom: 14 }}>
        <div className="tl-card-header">
          <i className="fa-solid fa-chart-line" />
          <span className="tl-card-header-label">Price Forecast</span>
        </div>

        {pred && [
          { key: 'fc-1h',  frame: '1 hour',  fc: pred.f1h  },
          { key: 'fc-6h',  frame: '6 hour',  fc: pred.f6h  },
          { key: 'fc-24h', frame: '24 hour', fc: pred.f24h },
        ].map(item => {
          const diff = item.fc.target - p.price;
          const bType: 'bull' | 'bear' | 'flat' = diff > 1.5 ? 'bull' : diff < -1.5 ? 'bear' : 'flat';
          const bTxt = bType === 'bull' ? 'BULL' : bType === 'bear' ? 'BEAR' : 'FLAT';
          return (
            <div key={item.key} className="tl-row">
              <div className="tl-dot" />
              <span className="tl-frame">{item.frame}</span>
              <div className="tl-main">
                <div className="tl-value">${fmtPrice(item.fc.target)}</div>
                <div className="tl-conf-row">
                  <div className="tl-conf-bar">
                    <div className="tl-conf-fill" style={{ width: `${item.fc.conf}%`, background: tlConfColor(item.fc.conf) }} />
                  </div>
                  <span className="tl-conf-pct">{item.fc.conf}%</span>
                </div>
              </div>
              <span className={`tl-badge ${bType}`}>{bTxt}</span>
              <button className="tl-info-btn" onClick={() => openPopup(item.key)} aria-label={`${item.frame} forecast details`}>
                <i className="fa-solid fa-circle-info" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Market Signal */}
      <div className="predict-card">
        <h3><i className="fa-solid fa-gauge-high" />Market Signal</h3>
        <div className="signal-grid">
          {[
            { label: 'BUY',  color: 'var(--green)', cls: 'buy',  val: marketSignal.buy  },
            { label: 'HLD',  color: 'var(--gold)',  cls: 'hold', val: marketSignal.hold },
            { label: 'SELL', color: 'var(--red)',   cls: 'sell', val: marketSignal.sell },
          ].map(row => (
            <div key={row.label} className="sig-gauge-row">
              <span className="sig-name" style={{ color: row.color }}>{row.label}</span>
              <div className="sig-gauge-bar">
                <div className={`sig-gauge-fill ${row.cls}`} style={{ width: `${row.val}%` }} />
              </div>
              <span className="sig-pct" style={{ color: row.color }}>{row.val}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Market Sentiment */}
      <div className="predict-card">
        <h3><i className="fa-solid fa-heart-pulse" />Market Sentiment</h3>
        <div className="sentiment-arc">
          <div className="sentiment-big">{sentimentEmoji}</div>
          <div className="sentiment-lbl">{sentimentText}</div>
        </div>
      </div>

      {/* Key Price Levels */}
      <div className="predict-card">
        <h3><i className="fa-solid fa-layer-group" />Key Price Levels</h3>
        {[
          { label: 'Strong Resistance', val: r2, badge: 'R2', cls: 'badge-resist'  },
          { label: 'Resistance',        val: r1, badge: 'R1', cls: 'badge-resist'  },
          { label: 'Support',           val: s1, badge: 'S1', cls: 'badge-support' },
          { label: 'Strong Support',    val: s2, badge: 'S2', cls: 'badge-support' },
        ].map((lvl, i) => (
          <>
            {i === 2 && (
              <div key="now" className="level-row current-level">
                <span className="level-name" style={{ fontWeight: 700, color: 'var(--ink)' }}>Current Price</span>
                <span className="level-val" style={{ color: 'var(--gold)' }}>${fmtPrice(p.price)}</span>
                <span className="level-badge badge-neutral">NOW</span>
              </div>
            )}
            <div key={lvl.badge} className="level-row">
              <span className="level-name">{lvl.label}</span>
              <span className="level-val">${fmtPrice(lvl.val)}</span>
              <span className={`level-badge ${lvl.cls}`}>{lvl.badge}</span>
            </div>
          </>
        ))}
      </div>

      {/* Model Inputs */}
      <div className="predict-card">
        <h3><i className="fa-solid fa-sliders" />Model Inputs</h3>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}><i className="fa-solid fa-chart-simple" /></div>
          <div className="factor-text">
            <div className="factor-name">Daily ATR</div>
            <div className="factor-desc">Daily range ${atr.toFixed(2)} — {atrCat.toLowerCase()} volatility environment</div>
          </div>
          <div className="factor-sig" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}>${atr.toFixed(2)}</div>
        </div>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: isUp ? 'var(--green-bg)' : 'var(--red-bg)', color: isUp ? 'var(--green)' : 'var(--red)' }}><i className="fa-solid fa-arrow-trend-up" /></div>
          <div className="factor-text">
            <div className="factor-name">Momentum</div>
            <div className="factor-desc">{isUp ? 'Positive' : 'Negative'} {Math.abs(p.chp || 0).toFixed(2)}% move today</div>
          </div>
          <div className="factor-sig" style={{ background: isUp ? 'var(--green-bg)' : 'var(--red-bg)', color: isUp ? 'var(--green)' : 'var(--red)' }}>
            {(isUp ? '+' : '') + (p.chp || 0).toFixed(2)}%
          </div>
        </div>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}><i className="fa-solid fa-wave-square" /></div>
          <div className="factor-text">
            <div className="factor-name">Intraday Volatility</div>
            <div className="factor-desc">Today&apos;s range ${intradayRange.toFixed(2)} = {intradayRangePct}% of ATR</div>
          </div>
          <div className="factor-sig" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}>{volCat}</div>
        </div>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}><i className="fa-solid fa-arrows-rotate" /></div>
          <div className="factor-text">
            <div className="factor-name">Mean Reversion</div>
            <div className="factor-desc">Counter-trend pull probability</div>
          </div>
          <div className="factor-sig" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}>{mrLabel}</div>
        </div>

        <div className="factor-row">
          <div className="factor-icon" style={{
            background: session.sessionMultiplier >= 1.2 ? 'var(--red-bg)' : session.sessionMultiplier >= 1.0 ? 'var(--gold-bg)' : 'var(--bg-3)',
            color:      session.sessionMultiplier >= 1.2 ? 'var(--red)'    : session.sessionMultiplier >= 1.0 ? 'var(--gold)'    : 'var(--ink-3)',
          }}><i className="fa-solid fa-building-columns" /></div>
          <div className="factor-text">
            <div className="factor-name">Market Session</div>
            <div className="factor-desc">{session.sessionLabel} session &middot; {session.volLabel.toLowerCase()} activity</div>
          </div>
          <div className="factor-sig" style={{
            background: session.sessionMultiplier >= 1.2 ? 'var(--red-bg)' : session.sessionMultiplier >= 1.0 ? 'var(--gold-bg)' : 'var(--bg-3)',
            color:      session.sessionMultiplier >= 1.2 ? 'var(--red)'    : session.sessionMultiplier >= 1.0 ? 'var(--gold)'    : 'var(--ink-3)',
          }}>&times;{session.sessionMultiplier.toFixed(2)}</div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="disclaimer">
        <i className="fa-solid fa-circle-exclamation" />
        Not financial advice. Predictions are algorithmic estimates based on ATR volatility modelling. XAU/USD carries significant market risk. Always consult a licensed financial professional before trading.
      </div>

      {/* Footer */}
      <footer>
        <div className="footer-links">
          <Link className="footer-link" href="/about">About</Link>
          <Link className="footer-link" href="/contact">Contact</Link>
          <Link className="footer-link" href="/disclaimer">Disclaimer</Link>
        </div>
        <div className="footer-disc">Trading gold carries significant financial risk. XauTracker predictions are algorithmic estimates, not financial advice.</div>
        <div className="footer-copy">&copy; 2026 XauTracker.com &middot; Powered by TwelveData</div>
      </footer>

      {/* ── How To Popup ── */}
      {howToOpen && (
        <>
          <div className="tl-overlay open" onClick={() => setHowToOpen(false)} />
          <div className="tl-popup open" id="howto-popup">
            <div className="tl-popup-handle" />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: 'var(--gold-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <i className="fa-solid fa-circle-question" style={{ color: 'var(--gold)', fontSize: 16 }} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.2 }}>How to use the Forecast Tools</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'var(--red-bg)', border: '1px solid rgba(184,50,50,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--red)', fontSize: 14, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                <strong style={{ color: 'var(--ink)' }}>Attention:</strong> Trading Gold carries high significant risk. Always do your own analysis and read our{' '}
                <Link href="/disclaimer" style={{ color: 'var(--red)', fontWeight: 700 }}>disclaimer</Link>.
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>The forecast tools uses ATR modelling and carries sections like:</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { title: 'Entry Signals',    desc: 'It forecasts how your next trade should go depending on the volatility of gold at that time.' },
                { title: 'Price Forecast',   desc: 'It predicts what range gold would be trading at at a particular time.' },
                { title: 'Market Signal',    desc: 'The current market trend.' },
                { title: 'Market Sentiment', desc: 'The current market trend based on the chart.' },
                { title: 'Price Levels',     desc: 'The support and resistance of the XAU/USD chart.' },
                { title: 'Model',            desc: 'Carries other necessary information regarding gold, what session is on, the current volatility etc.' },
              ].map((s, i, arr) => (
                <div key={i} style={{ padding: '13px 14px', background: 'var(--bg-2)', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--gold-bg)', border: '1px solid rgba(154,110,0,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                Use this tool as a guide to making better trades. Do not follow forecasts blindly — always follow the market as gold can be very unpredictable.
              </div>
            </div>
            <button className="tl-popup-close" onClick={() => setHowToOpen(false)}>
              <i className="fa-solid fa-xmark" /> Close
            </button>
          </div>
        </>
      )}

      {/* ── Detail Popup ── */}
      {activePopup && popupStore[activePopup] && (
        <>
          <div className="tl-overlay open" onClick={() => setActivePopup(null)} />
          <div className="tl-popup open">
            <div className="tl-popup-handle" />
            <div className="tl-popup-kicker">{popupStore[activePopup].kicker}</div>
            <div className="tl-popup-signal">{popupStore[activePopup].signal}</div>
            <div className="tl-popup-dir" style={{ color: popupStore[activePopup].dirColor }}>{popupStore[activePopup].dir}</div>
            <div className="tl-popup-reason">{popupStore[activePopup].reason}</div>
            <div className="tl-popup-divider" />
            <div className="tl-popup-meta-row">
              <span className="tl-popup-meta-label">Confidence</span>
              <span className="tl-popup-meta-val">{popupStore[activePopup].conf}</span>
            </div>
            {popupStore[activePopup].range && (
              <div className="tl-popup-meta-row">
                <span className="tl-popup-meta-label">&plusmn;1&sigma; band</span>
                <span className="tl-popup-meta-val">{popupStore[activePopup].range}</span>
              </div>
            )}
            <button className="tl-popup-close" onClick={() => setActivePopup(null)}>
              <i className="fa-solid fa-xmark" /> Dismiss
            </button>
          </div>
        </>
      )}
    </>
  );
}
