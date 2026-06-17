'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { getFirebase } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { UserData } from '@/types';

/* ══════════════════════════════════════════════════════════════
   FX FORMATTING — USD/CHF quoted to 5 decimals, 1 pip = 0.0001
══════════════════════════════════════════════════════════════ */
const PIP = 0.0001;

function fmtPrice(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}
function fmtChange(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(5);
}
function fmtD(v: number) {
  return (v >= 0 ? '+' : '') + v.toFixed(5);
}
function fmtP(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 5, maximumFractionDigits: 5 });
}
function fmtPips(v: number) {
  return (v / PIP).toFixed(1) + ' pips';
}

/* ══════════════════════════════════════════════════════════════
   PRICE DATA — self-contained polling hook
   (mirrors useGoldPrice's shape, hits /api/price-usdchf)
══════════════════════════════════════════════════════════════ */
interface PriceData {
  price: number; open: number; high: number; low: number;
  bid: number; ask: number; ch: number; chp: number; source: string;
}

function useUsdChfPrice() {
  const [price, setPrice] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const res = await fetch('/api/price-usdchf');
        const data = await res.json();
        if (active && !data.error) setPrice(data);
      } catch {
        /* keep last known price on transient failure */
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => { active = false; clearInterval(interval); };
  }, []);

  return { price, loading };
}

/* ══════════════════════════════════════════════════════════════
   MARKET SESSION — unchanged, FX sessions behave the same way
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
   ATR ESTIMATOR — rescaled for USD/CHF (≈25–150 pips vs gold's $10–80)
══════════════════════════════════════════════════════════════ */
function estimateATR(high: number, low: number, price: number, chp: number) {
  const intradayRange = high - low;
  const changeRange = Math.abs(chp / 100 * price) * 2;
  return Math.min(Math.max(Math.max(intradayRange, changeRange), 0.0020), 0.0150);
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
  entryPrice?: string; sl?: string; tp1?: string; tp2?: string;
}

/* ══════════════════════════════════════════════════════════════
   CORE PREDICTION ENGINE — same σ(t) = ATR × √(t/1440) model
══════════════════════════════════════════════════════════════ */
function buildPredictions(price: number, chp: number, high: number, low: number): Predictions {
  const atr = estimateATR(high, low, price, chp);
  const session = getSessionInfo();
  const dailyMomentumDollar = (chp / 100) * price;
  const hourlyDrift = dailyMomentumDollar / 24;
  const movePct = Math.abs(chp);
  const mrStrength = Math.min(movePct / 0.75, 0.80); // FX mean-reversion saturates at a smaller % move than gold
  const effectiveDrift = hourlyDrift * (1 - mrStrength * 0.6);

  function sigma(minutes: number) {
    return atr * Math.sqrt(minutes / 1440) * session.sessionMultiplier;
  }

  function forecast(minutes: number): Forecast {
    const s = sigma(minutes);
    const drift = effectiveDrift * (minutes / 60);
    const noise = s * (Math.random() * 0.5 - 0.25);
    const target = parseFloat((price + drift + noise).toFixed(5));
    const bandLow = parseFloat((target - s).toFixed(5));
    const bandHigh = parseFloat((target + s).toFixed(5));
    const baseConf = Math.max(30, 96 - (minutes / 1440) * 55);
    const volPenalty = Math.min((atr - 0.0050) / PIP / 2, 15); // ATR over ~50 pips erodes confidence
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
   Momentum thresholds scaled to ~1/4 of gold's, reflecting USD/CHF's
   typically smaller daily % swings (majors move less than gold in % terms)
══════════════════════════════════════════════════════════════ */
function computeEntrySignals(
  price: number, chp: number, high: number, low: number,
  atr: number, sess: SessionInfo
): EntrySignals {
  const isUp = chp >= 0;
  const absMom = Math.abs(chp);
  const rangePos = (price - low) / Math.max(high - low, 0.00001);
  const pseudoRSI = rangePos * 100;
  const momStrong = absMom >= 0.12;
  const momMod = absMom >= 0.05 && absMom < 0.12;
  const overbought = pseudoRSI > 72;
  const oversold = pseudoRSI < 28;
  const neutral = !overbought && !oversold;
  const highVol = atr > 0.0090;
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
    e10m = mk('WAIT', 'Low liquidity', `Asian/off-hours session. Poor conditions. ATR: ${fmtPips(atr)}`, 35, 'WAIT');
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
    e1h = mk('WAIT', 'Low liquidity — avoid 1h entries', `Asian/off-hours reduces follow-through. ATR: ${fmtPips(atr)}`, 38, 'WAIT');
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

  const strongBull4h = absMom >= 0.10 && isUp && !overbought;
  const strongBear4h = absMom >= 0.10 && !isUp && !oversold;
  let e4h: EntrySignal;
  if (strongBull4h)
    e4h = mk('ENTER LONG', `Bullish · +${absMom.toFixed(2)}% · room to run`, `Momentum strong for 4h trade. Not overbought (RSI≈${pseudoRSI.toFixed(0)}).`, sess.overlap ? 82 : sess.ny ? 78 : 70, 'LONG');
  else if (strongBear4h)
    e4h = mk('ENTER SHORT', `Bearish · ${chp.toFixed(2)}% · room to fall`, `Momentum strong for 4h trade. Not oversold (RSI≈${pseudoRSI.toFixed(0)}).`, sess.overlap ? 82 : sess.ny ? 78 : 70, 'SHORT');
  else if (oversold && absMom < 0.15)
    e4h = mk('REVERSAL LONG', `Oversold bounce · RSI≈${pseudoRSI.toFixed(0)}`, 'Price near day low, declining momentum. Counter-trend 4h long possible. High risk.', 58, 'LONG');
  else if (overbought && absMom < 0.15)
    e4h = mk('REVERSAL SHORT', `Overbought fade · RSI≈${pseudoRSI.toFixed(0)}`, 'Price near day high, weakening momentum. Counter-trend 4h short possible. High risk.', 58, 'SHORT');
  else if (absMom >= 0.10 && isUp && overbought)
    e4h = mk('WAIT', 'Bullish but overextended', `+${absMom.toFixed(2)}% already baked in. RSI≈${pseudoRSI.toFixed(0)}. Wait for 4h pullback.`, 48, 'WAIT');
  else if (absMom >= 0.10 && !isUp && oversold)
    e4h = mk('WAIT', 'Bearish but oversold', `${chp.toFixed(2)}% drop extended. RSI≈${pseudoRSI.toFixed(0)}. Risk of snap-back.`, 48, 'WAIT');
  else
    e4h = mk('NO SIGNAL', 'Insufficient momentum for 4h trade', 'No clear 4h entry setup.', 35, 'SKIP');

  const trendBull = absMom >= 0.15 && isUp && rangePos > 0.45 && rangePos < 0.88;
  const trendBear = absMom >= 0.15 && !isUp && rangePos < 0.55 && rangePos > 0.12;
  let e24h: EntrySignal;
  if (trendBull)
    e24h = mk('ENTER LONG', `Strong bullish trend · +${absMom.toFixed(2)}%`, 'Strong momentum in mid-range. Good daily long setup.', highVol ? 72 : 80, 'LONG');
  else if (trendBear)
    e24h = mk('ENTER SHORT', `Strong bearish trend · ${chp.toFixed(2)}%`, 'Strong momentum in mid-range. Good daily short setup.', highVol ? 72 : 80, 'SHORT');
  else if (pseudoRSI < 20 && absMom < 0.25)
    e24h = mk('LONG (REVERSAL)', `Extreme oversold · RSI≈${pseudoRSI.toFixed(0)}`, 'Price at extreme low. Mean reversion setup for daily long.', 60, 'LONG');
  else if (pseudoRSI > 80 && absMom < 0.25)
    e24h = mk('SHORT (REVERSAL)', `Extreme overbought · RSI≈${pseudoRSI.toFixed(0)}`, 'Price at extreme high. Mean reversion setup for daily short.', 60, 'SHORT');
  else if (absMom >= 0.15 && isUp && overbought)
    e24h = mk('WAIT', 'Bullish but 24h overextended', 'Move already extended. Wait for a healthier entry.', 45, 'WAIT');
  else if (absMom >= 0.15 && !isUp && oversold)
    e24h = mk('WAIT', 'Bearish but 24h overextended', 'Drop already extended. Risk of reversal.', 45, 'WAIT');
  else
    e24h = mk('NO SIGNAL', 'No clear daily trend', 'Insufficient conviction for a 24h trade.', 32, 'SKIP');

  return { e10m, e1h, e4h, e24h };
}

/* ══════════════════════════════════════════════════════════════
   MARKET SIGNAL — unchanged, percentage-driven so it's scale-free
══════════════════════════════════════════════════════════════ */
function computeMarketSignal(chp: number, isUp: boolean) {
  const extendedMove = Math.abs(chp) > 0.35; // rescaled from gold's 1.5%
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
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
const BANNER_HEIGHT = 56;

function GoldCrossSellBanner() {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  return (
    <div
      style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, height: BANNER_HEIGHT,
        background: dark ? '#111827' : '#f1f5f9',
        borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', zIndex: 99, cursor: 'pointer', userSelect: 'none',
      }}
      onClick={() => window.open('https://xautracker.com/predict', '_blank')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8,
          background: dark ? 'rgba(212,167,44,0.15)' : 'rgba(212,167,44,0.12)',
          border: '1px solid rgba(212,167,44,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, flexShrink: 0,
        }}>
          🪙
        </div>
        <span style={{ fontSize: 14, fontWeight: 700, color: dark ? '#ffffff' : '#0f172a' }}>
          Trade Gold?
        </span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
        color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.45)', flexShrink: 0,
      }}>
        Click to see Analysis
        <i className="fa-solid fa-arrow-right" style={{ fontSize: 11 }} />
      </div>
    </div>
  );
}

export default function UsdChfPredictPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const { user, loading: authLoading, signOut } = useAuth();
  const { price, loading: priceLoading } = useUsdChfPrice();
  const { theme } = useTheme();
  const tvRef = useRef<HTMLDivElement>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [activePopup, setActivePopup] = useState<string | null>(null);
  const [popupStore, setPopupStore] = useState<Record<string, PopupData>>({});
  const [copyDone, setCopyDone] = useState(false);

  const [notifEnabled, setNotifEnabled] = useState(false);
  const prevSignalsRef = useRef<Record<string, string>>({});
  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!mounted || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').then(reg => { swRegRef.current = reg; }).catch(() => {});
  }, [mounted]);

  async function showNotif(title: string, opts: NotificationOptions) {
    if (swRegRef.current) {
      try { swRegRef.current.showNotification(title, opts); return; } catch {}
    }
    try { new Notification(title, opts); } catch {}
  }

  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem('usdchf-notif');
      const granted = 'Notification' in window && Notification.permission === 'granted';
      if (saved === 'true' && granted) setNotifEnabled(true);
    } catch {}
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem('usdchf-notif', String(notifEnabled)); } catch {}
  }, [notifEnabled, mounted]);

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

  useEffect(() => {
    if (!mounted || !tvRef.current) return;
    tvRef.current.innerHTML = '';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true, symbol: 'OANDA:USDCHF', interval: '60',
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

  const atrCat = atr < 0.0050 ? 'LOW' : atr < 0.0090 ? 'NORMAL' : 'HIGH';
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

  const sig10m = sigs?.e10m.sig ?? '';
  const sig1h  = sigs?.e1h.sig  ?? '';
  const sig4h  = sigs?.e4h.sig  ?? '';
  const sig24h = sigs?.e24h.sig ?? '';

  useEffect(() => {
    if (!mounted || !notifEnabled || !sig10m) return;

    const current: Record<string, string> = {
      '10m': sig10m, '1h': sig1h, '4h': sig4h, '24h': sig24h,
    };

    const prev = prevSignalsRef.current;

    Object.entries(current).forEach(([frame, sig]) => {
      if (!prev[frame] || prev[frame] === sig) return;
      showNotif(`USD/CHF ${frame} Signal Changed`, {
        body: `${prev[frame]} → ${sig}`,
        icon: '/favicon.ico',
        tag: `usdchf-signal-${frame}`,
      });
    });

    prevSignalsRef.current = current;
  }, [sig10m, sig1h, sig4h, sig24h, notifEnabled, mounted]);

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

  function buildSignalPopup(frameLabel: string, sig: EntrySignal): PopupData {
    const isLong = sig.badgeCls === 'bull';
    const isShort = sig.badgeCls === 'bear';
    const entryP = p.price;
    const minMap: Record<string, number> = { '10 min': 10, '1 hour': 60, '4 hour': 240, '24 hour': 1440 };
    const minutes = minMap[frameLabel] || 60;
    const sigSigma = atr * Math.sqrt(minutes / 1440) * session.sessionMultiplier;
    let sl: string | undefined;
    let tp1: string | undefined;
    let tp2: string | undefined;
    if (isLong) {
      sl = fmtP(entryP - sigSigma);
      tp1 = fmtP(entryP + sigSigma * 0.5);
      tp2 = fmtP(entryP + sigSigma);
    } else if (isShort) {
      sl = fmtP(entryP + sigSigma);
      tp1 = fmtP(entryP - sigSigma * 0.5);
      tp2 = fmtP(entryP - sigSigma);
    }
    return {
      kicker: frameLabel + ' entry signal',
      signal: sig.sig,
      dir: sig.dir,
      dirColor: sig.badgeCls === 'bull' ? 'var(--green)' : sig.badgeCls === 'bear' ? 'var(--red)' : 'var(--gold)',
      reason: sig.reason,
      conf: sig.conf + '%',
      range: null,
      entryPrice: fmtP(entryP),
      sl, tp1, tp2,
    };
  }

  function buildFcPopup(frameLabel: string, fc: Forecast, basePrice: number): PopupData {
    const diff = fc.target - basePrice;
    const pct = (diff / basePrice) * 100;
    return {
      kicker: frameLabel + ' price forecast',
      signal: fmtP(fc.target),
      dir: (diff >= 0 ? '+' : '') + fmtD(diff) + '  (' + (pct >= 0 ? '+' : '') + pct.toFixed(3) + '%)',
      dirColor: diff >= 0 ? 'var(--green)' : 'var(--red)',
      reason: 'ATR-based σ(t) = ATR × √(t / 1440) forecast. The ±1σ band shows the 68% probability range for this timeframe.',
      conf: fc.conf + '%',
      range: fmtP(fc.bandLow) + ' – ' + fmtP(fc.bandHigh),
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

  const tlConfColor = (c: number) => c >= 75 ? 'var(--green)' : c >= 55 ? 'var(--gold)' : 'var(--red)';

  async function shareSignal(frameLabel: string, sig: EntrySignal) {
    const S = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext('2d')!;

    const sigColor =
      sig.badgeCls === 'bull' ? '#00d48f' :
      sig.badgeCls === 'bear' ? '#ff4561' : '#aaaaaa';
    const isBull = sig.badgeCls === 'bull';
    const isBear = sig.badgeCls === 'bear';

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, S, S);

    const NUM = 80;
    const prices: number[] = [];
    const vol = (atr || 0.0050) / 15;
    let px = p.price - (Math.random() * atr * 0.6);
    const raw: number[] = [px];
    for (let i = 1; i < NUM; i++) {
      const drift = isBull ? 0.52 : isBear ? 0.48 : 0.50;
      px += (Math.random() - (1 - drift)) * vol * 2.2;
      raw.push(px);
    }
    const diff = p.price - raw[NUM - 1];
    for (let i = 0; i < NUM; i++) prices.push(raw[i] + diff);

    const PAD_L = 40, PAD_R = 130, PAD_T = 210, PAD_B = 220;
    const CW = S - PAD_L - PAD_R;
    const CH = S - PAD_T - PAD_B;

    const minP = Math.min(...prices) - (atr || 0.0050) * 0.35;
    const maxP = Math.max(...prices) + (atr || 0.0050) * 0.35;
    const priceRange = maxP - minP;

    function ix(i: number) { return PAD_L + (i / (NUM - 1)) * CW; }
    function iy(price: number) { return PAD_T + CH - ((price - minP) / priceRange) * CH; }

    const GRID = 5;
    for (let i = 0; i <= GRID; i++) {
      const gp = minP + (priceRange / GRID) * i;
      const gy = iy(gp);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(PAD_L, gy); ctx.lineTo(S - PAD_R, gy); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.font = '400 18px "Helvetica Neue", Arial, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gp.toFixed(5), S - PAD_R + 10, gy + 7);
    }

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(ix(0), iy(prices[0]));
    for (let i = 1; i < NUM; i++) ctx.lineTo(ix(i), iy(prices[i]));
    ctx.lineTo(ix(NUM - 1), PAD_T + CH);
    ctx.lineTo(ix(0), PAD_T + CH);
    ctx.closePath();
    const areaGrad = ctx.createLinearGradient(0, PAD_T, 0, PAD_T + CH);
    areaGrad.addColorStop(0, sigColor + '28');
    areaGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = areaGrad;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.moveTo(ix(0), iy(prices[0]));
    for (let i = 1; i < NUM; i++) ctx.lineTo(ix(i), iy(prices[i]));
    ctx.strokeStyle = sigColor;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.lineJoin = 'round';
    ctx.stroke();

    const curY = iy(p.price);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(PAD_L, curY); ctx.lineTo(S - PAD_R, curY); ctx.stroke();
    ctx.setLineDash([]);

    const pillW = 120, pillH = 30;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(S - PAD_R + 6, curY - pillH / 2, pillW, pillH, 6);
    ctx.fill();
    ctx.fillStyle = '#0a0a0a';
    ctx.font = '700 16px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(p.price.toFixed(5), S - PAD_R + 6 + pillW / 2, curY + 6);

    const mx = ix(NUM - 1);
    const my = iy(prices[NUM - 1]);
    ctx.save();
    ctx.shadowColor = sigColor;
    ctx.shadowBlur = 22;
    ctx.fillStyle = sigColor;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    const aSz = 18, aOff = 30;
    ctx.fillStyle = sigColor;
    if (isBull) {
      ctx.beginPath();
      ctx.moveTo(mx,        my - aOff - aSz);
      ctx.lineTo(mx + aSz,  my - aOff + 4);
      ctx.lineTo(mx - aSz,  my - aOff + 4);
      ctx.closePath(); ctx.fill();
    } else if (isBear) {
      ctx.beginPath();
      ctx.moveTo(mx,        my + aOff + aSz);
      ctx.lineTo(mx + aSz,  my + aOff - 4);
      ctx.lineTo(mx - aSz,  my + aOff - 4);
      ctx.closePath(); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(mx, my, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.beginPath(); ctx.roundRect(PAD_L, 44, 360, 44, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '600 22px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(frameLabel.toUpperCase() + '  ·  ENTRY SIGNAL', PAD_L + 16, 72);

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 74px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText(sig.sig, PAD_L, 165);

    ctx.fillStyle = sigColor;
    ctx.font = '600 28px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(sig.dir, S - PAD_R, 165);

    const BOT = S - PAD_B + 28;
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '600 20px "Helvetica Neue", Arial, sans-serif';
    ctx.fillText('ANALYSIS', PAD_L, BOT);

    ctx.fillStyle = 'rgba(255,255,255,0.62)';
    ctx.font = '400 26px "Helvetica Neue", Arial, sans-serif';
    const maxTW = CW + PAD_R - 20;
    const words = sig.reason.split(' ');
    let line = '', ry = BOT + 38;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > maxTW && line) {
        ctx.fillText(line.trim(), PAD_L, ry);
        line = w + ' '; ry += 40;
      } else line = test;
    }
    if (line) ctx.fillText(line.trim(), PAD_L, ry);

    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('xautracker.com', PAD_L, S - 38);

    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.font = '400 20px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(new Date().toUTCString().slice(0, 22), S - PAD_R, S - 38);

    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `usdchf-${frameLabel}-signal.png`, { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `USD/CHF ${frameLabel}: ${sig.sig}` });
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `usdchf-${frameLabel}-signal.png`;
        a.click();
      }
    }, 'image/png');
  }

  /* ══════════════════════════════════════════════════════════════
     RENDER GUARDS
  ══════════════════════════════════════════════════════════════ */
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
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.3 }}>Sign in to access<br />USD/CHF Forecast</h2>
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

      <div className="live-strip">
        <div className="live-strip-left">
          <div>
            <div className="mini-label">USD/CHF Spot</div>
            <div className="live-price-big">
              <span id="strip-price">{fmtPrice(p.price)}</span>
            </div>
          </div>
          <div className={`live-change ${isUp ? 'up' : 'down'}`}>
            {fmtChange(p.ch || 0)} ({(p.chp || 0).toFixed(3)}%)
          </div>
        </div>
        <div className="atr-badge">
          <div>Daily ATR</div>
          <div id="strip-atr">{fmtPips(atr)}</div>
        </div>
      </div>

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

      <div
        style={{ margin: '14px 16px 0', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', height: 400 }}
        ref={tvRef}
      />

      <div className="algo-note">
        <i className="fa-solid fa-microchip" />
        Forecasts use <strong style={{ color: 'var(--gold)' }}>ATR × √(t/1440)</strong> — the financial square-root-of-time volatility model, recalibrated for USD/CHF&apos;s pip-scale daily range.{' '}
        <strong style={{ color: 'var(--red)' }}>Not financial advice.</strong>
      </div>

      {(() => {
        const CANDLES = 20;
        interface Candle { o: number; h: number; l: number; c: number; }

        function buildCandles(basePrice: number, atrVal: number, chpVal: number): Candle[] {
          const isUpTrend = chpVal >= 0;
          const drift = (chpVal / 100 * basePrice) / CANDLES * 0.35;
          const body  = atrVal * 0.13;
          const wick  = atrVal * 0.06;

          const candles: Candle[] = [];
          let prev = basePrice - drift * CANDLES * (isUpTrend ? 0.7 : 1.3);

          for (let i = 0; i < CANDLES; i++) {
            const noise = (Math.random() - 0.5) * body;
            const close = prev + drift + noise;
            const hi    = Math.max(prev, close) + wick + Math.random() * wick;
            const lo    = Math.min(prev, close) - wick - Math.random() * wick;
            candles.push({ o: prev, h: hi, l: lo, c: close });
            prev = close;
          }
          const gap = basePrice - candles[CANDLES - 1].c;
          return candles.map(c => ({ o: c.o + gap, h: c.h + gap, l: c.l + gap, c: c.c + gap }));
        }

        if (!p.price || p.price === 0) return null;

        const candles = buildCandles(p.price, atr || 0.0050, p.chp || 0);

        const swingHighs: { idx: number; price: number }[] = [];
        const swingLows:  { idx: number; price: number }[] = [];

        for (let i = 1; i < CANDLES - 1; i++) {
          if (candles[i].h > candles[i - 1].h && candles[i].h > candles[i + 1].h)
            swingHighs.push({ idx: i, price: candles[i].h });
          if (candles[i].l < candles[i - 1].l && candles[i].l < candles[i + 1].l)
            swingLows.push({ idx: i, price: candles[i].l });
        }

        let bullishStructure = false;
        let bearishStructure = false;

        if (swingHighs.length >= 2 && swingLows.length >= 2) {
          const lastH = swingHighs[swingHighs.length - 1].price;
          const prevH = swingHighs[swingHighs.length - 2].price;
          const lastL = swingLows[swingLows.length - 1].price;
          const prevL = swingLows[swingLows.length - 2].price;
          bullishStructure = lastH > prevH && lastL > prevL;
          bearishStructure = lastH < prevH && lastL < prevL;
        }

        const lastCandle = candles[CANDLES - 1];
        const recentLow  = swingLows.length  > 0 ? swingLows[swingLows.length   - 1].price : null;
        const recentHigh = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;

        const sweepTol = (atr || 0.0050) * 0.15;

        const buySweep  = recentLow  !== null
          && lastCandle.l < recentLow  - sweepTol
          && lastCandle.c > recentLow;

        const sellSweep = recentHigh !== null
          && lastCandle.h > recentHigh + sweepTol
          && lastCandle.c < recentHigh;

        const lastLH = swingHighs.length > 0 ? swingHighs[swingHighs.length - 1].price : null;
        const lastHL = swingLows.length  > 0 ? swingLows[swingLows.length   - 1].price : null;

        const buyBOS  = buySweep  && lastLH !== null && lastCandle.c > lastLH;
        const sellBOS = sellSweep && lastHL !== null && lastCandle.c < lastHL;

        type SwingSignal =
          | { type: 'BUY';     sweepLevel: number; bosLevel: number }
          | { type: 'SELL';    sweepLevel: number; bosLevel: number }
          | { type: 'WAIT';    reason: string }
          | { type: 'CAUTION'; reason: string };

        let swingSignal: SwingSignal;

        if (buyBOS && bullishStructure) {
          swingSignal = { type: 'BUY', sweepLevel: recentLow!, bosLevel: lastLH! };
        } else if (sellBOS && bearishStructure) {
          swingSignal = { type: 'SELL', sweepLevel: recentHigh!, bosLevel: lastHL! };
        } else if (buySweep && !buyBOS) {
          swingSignal = { type: 'CAUTION', reason: 'Low sweep detected — waiting for BOS confirmation (candle close above ' + fmtP(lastLH ?? p.price) + ')' };
        } else if (sellSweep && !sellBOS) {
          swingSignal = { type: 'CAUTION', reason: 'High sweep detected — waiting for BOS confirmation (candle close below ' + fmtP(lastHL ?? p.price) + ')' };
        } else if (!bullishStructure && !bearishStructure) {
          swingSignal = { type: 'WAIT', reason: 'No clear market structure on the 1H–4H frame. Price is ranging — stand aside.' };
        } else {
          swingSignal = { type: 'WAIT', reason: 'Structure confirmed but no liquidity sweep yet. Wait for price to grab a swing level before entry.' };
        }

        const sigColor =
          swingSignal.type === 'BUY'     ? 'var(--green)' :
          swingSignal.type === 'SELL'    ? 'var(--red)'   :
          swingSignal.type === 'CAUTION' ? 'var(--gold)'  : 'var(--ink-3)';

        const sigBg =
          swingSignal.type === 'BUY'     ? 'var(--green-bg)' :
          swingSignal.type === 'SELL'    ? 'var(--red-bg)'   :
          swingSignal.type === 'CAUTION' ? 'var(--gold-bg)'  : 'var(--bg-3)';

        const sigBorder =
          swingSignal.type === 'BUY'     ? 'rgba(0,212,143,0.25)'  :
          swingSignal.type === 'SELL'    ? 'rgba(255,69,97,0.25)'  :
          swingSignal.type === 'CAUTION' ? 'rgba(212,167,44,0.25)' : 'var(--border)';

        const sigIcon =
          swingSignal.type === 'BUY'     ? 'fa-arrow-trend-up'      :
          swingSignal.type === 'SELL'    ? 'fa-arrow-trend-down'     :
          swingSignal.type === 'CAUTION' ? 'fa-triangle-exclamation' : 'fa-clock';

        const sigLabel =
          swingSignal.type === 'BUY'     ? 'BUY — Long Entry'    :
          swingSignal.type === 'SELL'    ? 'SELL — Short Entry'   :
          swingSignal.type === 'CAUTION' ? 'Sweep Detected'       : 'No Trade';

        const swingATR   = (atr || 0.0050) * Math.sqrt(120 / 1440) * (session.sessionMultiplier || 1);
        const entryPrice = p.price;
        const buyTP      = entryPrice + swingATR * 0.75;
        const buySL      = entryPrice - swingATR * 0.45;
        const sellTP     = entryPrice - swingATR * 0.75;
        const sellSL     = entryPrice + swingATR * 0.45;

        const barMin  = Math.min(...candles.map(c => c.l));
        const barMax  = Math.max(...candles.map(c => c.h));
        const barRng  = barMax - barMin || 1;
        const CHART_H = 56;

        return (
          <div className="predict-card" style={{ marginBottom: 14 }}>
            <h3>
              <i className="fa-solid fa-crosshairs" />
              Technical Indicators for 1H – 4H Trading
            </h3>

            <div style={{
              display: 'flex', alignItems: 'flex-end', gap: 2,
              height: CHART_H, marginBottom: 14,
              padding: '0 2px', borderBottom: '1px solid var(--border)', paddingBottom: 6,
            }}>
              {candles.map((c, i) => {
                const isBullC = c.c >= c.o;
                const bodyTop = ((barMax - Math.max(c.o, c.c)) / barRng) * CHART_H;
                const bodyH   = Math.max(((Math.abs(c.c - c.o)) / barRng) * CHART_H, 1.5);
                const wickTop = ((barMax - c.h) / barRng) * CHART_H;
                const wickH   = ((c.h - c.l) / barRng) * CHART_H;
                const isLast  = i === CANDLES - 1;
                return (
                  <div key={i} style={{ flex: 1, position: 'relative', height: CHART_H, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', top: wickTop, width: 1, height: wickH, background: isBullC ? 'var(--green)' : 'var(--red)', opacity: 0.5 }} />
                    <div style={{ position: 'absolute', top: bodyTop, width: '60%', height: bodyH, background: isBullC ? 'var(--green)' : 'var(--red)', borderRadius: 1, opacity: isLast ? 1 : 0.65, boxShadow: isLast ? `0 0 6px ${isBullC ? 'var(--green)' : 'var(--red)'}` : 'none' }} />
                  </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: bullishStructure ? 'var(--green-bg)' : 'var(--bg-3)',
                border: `1px solid ${bullishStructure ? 'rgba(0,212,143,0.25)' : 'var(--border)'}`,
                fontSize: 11, fontWeight: 700,
                color: bullishStructure ? 'var(--green)' : 'var(--ink-4)',
              }}>
                <i className="fa-solid fa-arrow-up" style={{ fontSize: 9 }} />
                HH + HL — Bullish Structure
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: bearishStructure ? 'var(--red-bg)' : 'var(--bg-3)',
                border: `1px solid ${bearishStructure ? 'rgba(255,69,97,0.25)' : 'var(--border)'}`,
                fontSize: 11, fontWeight: 700,
                color: bearishStructure ? 'var(--red)' : 'var(--ink-4)',
              }}>
                <i className="fa-solid fa-arrow-down" style={{ fontSize: 9 }} />
                LH + LL — Bearish Structure
              </div>
            </div>

            <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Setup Checklist
              </div>
              {[
                {
                  label: 'Market structure identified',
                  ok: bullishStructure || bearishStructure,
                  detail: bullishStructure ? 'Bullish (HH + HL)' : bearishStructure ? 'Bearish (LH + LL)' : 'Choppy / unclear',
                },
                {
                  label: 'Liquidity sweep',
                  ok: buySweep || sellSweep,
                  detail: buySweep  ? `Low swept at ${fmtP(recentLow  ?? 0)} — rejection above` :
                          sellSweep ? `High swept at ${fmtP(recentHigh ?? 0)} — rejection below` :
                          'No sweep yet',
                },
                {
                  label: 'BOS confirmation',
                  ok: buyBOS || sellBOS,
                  detail: buyBOS  ? `BOS up — closed above ${fmtP(lastLH ?? 0)}` :
                          sellBOS ? `BOS down — closed below ${fmtP(lastHL ?? 0)}` :
                          'Waiting for candle close',
                },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: item.ok ? 'var(--green-bg)' : 'var(--bg-3)',
                    border: `1px solid ${item.ok ? 'rgba(0,212,143,0.3)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: item.ok ? 'var(--green)' : 'var(--ink-4)',
                  }}>
                    <i className={`fa-solid ${item.ok ? 'fa-check' : 'fa-xmark'}`} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 1 }}>{item.label}</div>
                    <div style={{ fontSize: 11, color: item.ok ? 'var(--ink-2)' : 'var(--ink-4)' }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{
              background: sigBg, border: `1px solid ${sigBorder}`, borderRadius: 12, padding: '16px',
              marginBottom: (swingSignal.type === 'BUY' || swingSignal.type === 'SELL') ? 12 : 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                  background: sigColor === 'var(--green)'  ? 'rgba(0,212,143,0.15)'  :
                              sigColor === 'var(--red)'    ? 'rgba(255,69,97,0.15)'  :
                              sigColor === 'var(--gold)'   ? 'rgba(212,167,44,0.15)' : 'var(--bg-3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, color: sigColor,
                }}>
                  <i className={`fa-solid ${sigIcon}`} />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: sigColor, lineHeight: 1.1 }}>{sigLabel}</div>
                  <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>1H – 4H Swing Trade</div>
                </div>
              </div>

              {(swingSignal.type === 'WAIT' || swingSignal.type === 'CAUTION') && (
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                  {swingSignal.reason}
                </div>
              )}

              {(swingSignal.type === 'BUY' || swingSignal.type === 'SELL') && (
                <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65 }}>
                  {swingSignal.type === 'BUY'
                    ? `Price swept liquidity below ${fmtP(swingSignal.sweepLevel)} and rejected. BOS confirmed with a close above ${fmtP(swingSignal.bosLevel)}. Bullish structure intact on the higher timeframe.`
                    : `Price swept liquidity above ${fmtP(swingSignal.sweepLevel)} and rejected. BOS confirmed with a close below ${fmtP(swingSignal.bosLevel)}. Bearish structure intact on the higher timeframe.`
                  }
                </div>
              )}
            </div>

            {(swingSignal.type === 'BUY' || swingSignal.type === 'SELL') && (
              <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                {[
                  { label: 'Entry',       val: fmtP(entryPrice),                                         color: sigColor          },
                  { label: 'Take Profit', val: fmtP(swingSignal.type === 'BUY' ? buyTP  : sellTP),       color: 'var(--green)'    },
                  { label: 'Stop Loss',   val: fmtP(swingSignal.type === 'BUY' ? buySL  : sellSL),       color: 'var(--red)'      },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{row.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', color: row.color }}>{row.val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

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

        <div className="tl-row">
          <div className="tl-dot live" />
          <span className="tl-frame">Now</span>
          <div className="tl-main">
            <div className="tl-value">{fmtPrice(p.price)}</div>
            <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 3 }}>
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
          </div>
          <span className="tl-badge live-badge">LIVE</span>
          <div style={{ width: 30, flexShrink: 0 }} />
        </div>

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
            <button
              className="tl-info-btn"
              onClick={() => shareSignal(item.frame, item.sig)}
              aria-label={`Share ${item.frame} signal`}
              title="Share as image"
            >
              <i className="fa-solid fa-share-nodes" />
            </button>
          </div>
        ))}
      </div>

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
          const bType: 'bull' | 'bear' | 'flat' = diff > 0.00050 ? 'bull' : diff < -0.00050 ? 'bear' : 'flat';
          const bTxt = bType === 'bull' ? 'BULL' : bType === 'bear' ? 'BEAR' : 'FLAT';
          return (
            <div key={item.key} className="tl-row">
              <div className="tl-dot" />
              <span className="tl-frame">{item.frame}</span>
              <div className="tl-main">
                <div className="tl-value">{fmtPrice(item.fc.target)}</div>
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

      <div className="predict-card">
        <h3><i className="fa-solid fa-heart-pulse" />Market Sentiment</h3>
        <div className="sentiment-arc">
          <div className="sentiment-big">{sentimentEmoji}</div>
          <div className="sentiment-lbl">{sentimentText}</div>
        </div>
      </div>

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
                <span className="level-val" style={{ color: 'var(--gold)' }}>{fmtPrice(p.price)}</span>
                <span className="level-badge badge-neutral">NOW</span>
              </div>
            )}
            <div key={lvl.badge} className="level-row">
              <span className="level-name">{lvl.label}</span>
              <span className="level-val">{fmtPrice(lvl.val)}</span>
              <span className={`level-badge ${lvl.cls}`}>{lvl.badge}</span>
            </div>
          </>
        ))}
      </div>

      <div className="predict-card">
        <h3><i className="fa-solid fa-sliders" />Model Inputs</h3>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}><i className="fa-solid fa-chart-simple" /></div>
          <div className="factor-text">
            <div className="factor-name">Daily ATR</div>
            <div className="factor-desc">Daily range {fmtPips(atr)} — {atrCat.toLowerCase()} volatility environment</div>
          </div>
          <div className="factor-sig" style={{ background: 'var(--gold-bg)', color: 'var(--gold)' }}>{fmtPips(atr)}</div>
        </div>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: isUp ? 'var(--green-bg)' : 'var(--red-bg)', color: isUp ? 'var(--green)' : 'var(--red)' }}><i className="fa-solid fa-arrow-trend-up" /></div>
          <div className="factor-text">
            <div className="factor-name">Momentum</div>
            <div className="factor-desc">{isUp ? 'Positive' : 'Negative'} {Math.abs(p.chp || 0).toFixed(3)}% move today</div>
          </div>
          <div className="factor-sig" style={{ background: isUp ? 'var(--green-bg)' : 'var(--red-bg)', color: isUp ? 'var(--green)' : 'var(--red)' }}>
            {(isUp ? '+' : '') + (p.chp || 0).toFixed(3)}%
          </div>
        </div>

        <div className="factor-row">
          <div className="factor-icon" style={{ background: 'var(--bg-3)', color: 'var(--ink-2)' }}><i className="fa-solid fa-wave-square" /></div>
          <div className="factor-text">
            <div className="factor-name">Intraday Volatility</div>
            <div className="factor-desc">Today&apos;s range {fmtPips(intradayRange)} = {intradayRangePct}% of ATR</div>
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

      <div className="disclaimer">
        <i className="fa-solid fa-circle-exclamation" />
        Not financial advice. Predictions are algorithmic estimates based on ATR volatility modelling. USD/CHF carries significant market risk. Always consult a licensed financial professional before trading.
      </div>

      <footer>
        <div className="footer-links">
          <Link className="footer-link" href="/about">About</Link>
          <Link className="footer-link" href="/contact">Contact</Link>
          <Link className="footer-link" href="/disclaimer">Disclaimer</Link>
        </div>
        <div className="footer-disc">Trading forex carries significant financial risk. XauTracker predictions are algorithmic estimates, not financial advice.</div>
        <div className="footer-copy">&copy; 2026 XauTracker.com &middot; Powered by TwelveData</div>
      </footer>

      <GoldCrossSellBanner />

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
                <strong style={{ color: 'var(--ink)' }}>Attention:</strong> Trading forex carries high significant risk. Always do your own analysis and read our{' '}
                <Link href="/disclaimer" style={{ color: 'var(--red)', fontWeight: 700 }}>disclaimer</Link>.
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>The forecast tools uses ATR modelling and carries sections like:</div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>
              {[
                { title: 'Entry Signals',    desc: 'It forecasts how your next trade should go depending on the volatility of USD/CHF at that time.' },
                { title: 'Price Forecast',   desc: 'It predicts what range USD/CHF would be trading at at a particular time.' },
                { title: 'Market Signal',    desc: 'The current market trend.' },
                { title: 'Market Sentiment', desc: 'The current market trend based on the chart.' },
                { title: 'Price Levels',     desc: 'The support and resistance of the USD/CHF chart.' },
                { title: 'Model',            desc: 'Carries other necessary information regarding USD/CHF, what session is on, the current volatility etc.' },
              ].map((s, i, arr) => (
                <div key={i} style={{ padding: '13px 14px', background: 'var(--bg-2)', borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', marginBottom: 3 }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', lineHeight: 1.6 }}>{s.desc}</div>
                </div>
              ))}
            </div>
            <div style={{ background: 'var(--gold-bg)', border: '1px solid rgba(154,110,0,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7 }}>
                Use this tool as a guide to making better trades. Do not follow forecasts blindly — always follow the market as USD/CHF can move unpredictably.
              </div>
            </div>
            <button className="tl-popup-close" onClick={() => setHowToOpen(false)}>
              <i className="fa-solid fa-xmark" /> Close
            </button>
          </div>
        </>
      )}

      {activePopup && popupStore[activePopup] && (
        <>
          <div className="tl-overlay open" onClick={() => setActivePopup(null)} />
          <div className="tl-popup open">
            <div className="tl-popup-handle" />
            <div className="tl-popup-kicker">{popupStore[activePopup].kicker}</div>
            <div className="tl-popup-signal">{popupStore[activePopup].signal}</div>
            <div className="tl-popup-dir" style={{ color: popupStore[activePopup].dirColor }}>{popupStore[activePopup].dir}</div>
            <div className="tl-popup-reason">{popupStore[activePopup].reason}</div>
            {popupStore[activePopup].entryPrice && popupStore[activePopup].sl && (
              <>
                <div className="tl-popup-divider" />
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginBottom: 10, lineHeight: 1.5, fontStyle: 'italic' }}>
                  Generative entry based on analysis
                </div>
                <div className="tl-popup-meta-row">
                  <span className="tl-popup-meta-label">Entry</span>
                  <span className="tl-popup-meta-val">{popupStore[activePopup].entryPrice}</span>
                </div>
                <div className="tl-popup-meta-row">
                  <span className="tl-popup-meta-label">Stop Loss</span>
                  <span className="tl-popup-meta-val" style={{ color: 'var(--red)' }}>{popupStore[activePopup].sl}</span>
                </div>
                <div className="tl-popup-meta-row">
                  <span className="tl-popup-meta-label">TP1</span>
                  <span className="tl-popup-meta-val" style={{ color: 'var(--green)' }}>{popupStore[activePopup].tp1}</span>
                </div>
                <div className="tl-popup-meta-row">
                  <span className="tl-popup-meta-label">TP2</span>
                  <span className="tl-popup-meta-val" style={{ color: 'var(--green)' }}>{popupStore[activePopup].tp2}</span>
                </div>

                {(() => {
                  const pop = popupStore[activePopup];
                  const isSell = pop.dirColor === 'var(--red)';
                  const isBuy  = pop.dirColor === 'var(--green)';
                  const action = isSell ? 'Sell' : isBuy ? 'Buy' : 'Neutral';
                  const emoji  = isSell ? '📉' : isBuy ? '📈' : '➡️';
                  const copyText =
                    `$USDCHF ${action} signal ${emoji}\n` +
                    `Entry: ${pop.entryPrice}\n` +
                    `SL: ${pop.sl}\n` +
                    `TP1: ${pop.tp1}\n` +
                    `TP2: ${pop.tp2}\n\n` +
                    `current price as the time of this post ${fmtPrice(p.price)}`;

                  return (
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(copyText);
                          setCopyDone(true);
                          setTimeout(() => setCopyDone(false), 2000);
                        } catch {}
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                        width: '100%', marginTop: 14, padding: '11px 0',
                        background: copyDone ? 'var(--green-bg)' : 'var(--bg-3)',
                        border: `1px solid ${copyDone ? 'var(--green)' : 'var(--border)'}`,
                        borderRadius: 10,
                        color: copyDone ? 'var(--green)' : 'var(--ink-2)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        fontFamily: 'inherit', transition: 'all 0.2s',
                      }}
                    >
                      <i className={`fa-solid ${copyDone ? 'fa-check' : 'fa-copy'}`} />
                      {copyDone ? 'Copied!' : 'Copy Signal'}
                    </button>
                  );
                })()}
              </>
            )}
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
