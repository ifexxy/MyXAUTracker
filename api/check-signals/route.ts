import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

/* Candle granularity per timeframe — coarser on longer frames to conserve
   TwelveData free-tier request credits. */
const INTERVAL_FOR_TIMEFRAME: Record<string, string> = {
  '10m': '1min', '1h': '1min', '4h': '5min', '24h': '15min',
};

/* Only re-check a signal this often, even if the cron itself fires more
   frequently than this — keeps API usage proportional to how fast the
   timeframe actually moves. */
const RECHECK_MINUTES: Record<string, number> = {
  '10m': 2, '1h': 5, '4h': 15, '24h': 30,
};

interface Candle { t: number; h: number; l: number; }

async function fetchCandles(symbol: string, interval: string, startISO: string): Promise<Candle[]> {
  const url = `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(symbol)}&interval=${interval}&start_date=${encodeURIComponent(startISO)}&order=ASC&apikey=${process.env.TWELVE_DATA_KEY}`;
  const r = await fetch(url);
  const d = await r.json();
  if (!d.values) return [];
  return d.values.map((v: any) => ({
    t: new Date(v.datetime).getTime(),
    h: parseFloat(v.high),
    l: parseFloat(v.low),
  }));
}

export async function GET(req: Request) {
  /* Accept either Vercel's own cron auth header, or a shared-secret query
     param — the latter lets an external scheduler (e.g. GitHub Actions)
     trigger this at a real interval, since Vercel Hobby cron only allows
     once-a-day schedules. */
  const authHeader = req.headers.get('authorization');
  const url = new URL(req.url);
  const secretParam = url.searchParams.get('secret');
  const validVercel = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const validExternal = !!secretParam && secretParam === process.env.CRON_SECRET;
  if (!validVercel && !validExternal) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = Date.now();
  const snap = await adminDb.collection('signals').where('status', '==', 'open').get();

  let checked = 0, resolved = 0;

  for (const docSnap of snap.docs) {
    const sig = docSnap.data();
    const timeframe = sig.timeframe as string;

    const lastChecked = sig.lastCheckedAt?.toMillis?.() ?? 0;
    const recheckMs = (RECHECK_MINUTES[timeframe] ?? 5) * 60 * 1000;
    if (now - lastChecked < recheckMs) continue; // not due yet — save API credits

    /* Timeframe horizon passed without hitting TP or SL — close it out as
       "expired" so it doesn't skew win/loss stats either way. */
    const expiresAtMs = sig.expiresAt?.toMillis?.() ?? 0;
    if (now > expiresAtMs) {
      await docSnap.ref.update({ status: 'expired', closedAt: Timestamp.now(), lastCheckedAt: Timestamp.now() });
      checked++; resolved++;
      continue;
    }

    const interval = INTERVAL_FOR_TIMEFRAME[timeframe] ?? '5min';
    const sinceMs = lastChecked || sig.createdAt?.toMillis?.() || now;
    const startISO = new Date(sinceMs).toISOString().slice(0, 19).replace('T', ' ');

    let candles: Candle[] = [];
    try {
      candles = await fetchCandles('XAU/USD', interval, startISO);
    } catch {
      continue; // API hiccup — retry next run
    }

    checked++;
    if (!candles.length) {
      await docSnap.ref.update({ lastCheckedAt: Timestamp.now() });
      continue;
    }

    const isLong = sig.direction === 'long';
    let hit: 'tp1' | 'tp2' | 'sl' | null = null;
    let hitTime = 0;

    /* Walk candles in chronological order — first level actually crossed
       wins. If a single candle's range contains both SL and a TP, we can't
       know which came first from OHLC alone, so we resolve it toward SL —
       the conservative assumption, rather than assuming the best case. */
    for (const c of candles) {
      const slHit  = isLong ? c.l <= sig.sl  : c.h >= sig.sl;
      const tp2Hit = isLong ? c.h >= sig.tp2 : c.l <= sig.tp2;
      const tp1Hit = isLong ? c.h >= sig.tp1 : c.l <= sig.tp1;

      if (slHit)  { hit = 'sl';  hitTime = c.t; break; }
      if (tp2Hit) { hit = 'tp2'; hitTime = c.t; break; }
      if (tp1Hit && !sig.tp1HitAt && !hit) { hit = 'tp1'; hitTime = c.t; } // keep scanning — TP2/SL may still follow
    }

    const update: Record<string, any> = { lastCheckedAt: Timestamp.now() };

    if (hit === 'sl') {
      update.status = 'sl_hit'; update.slHitAt = Timestamp.fromMillis(hitTime);
      update.closedAt = Timestamp.now(); resolved++;
    } else if (hit === 'tp2') {
      update.status = 'tp2_hit'; update.tp2HitAt = Timestamp.fromMillis(hitTime);
      update.closedAt = Timestamp.now(); resolved++;
    } else if (hit === 'tp1') {
      update.tp1HitAt = Timestamp.fromMillis(hitTime); // partial hit — stays open for TP2/SL
    }

    await docSnap.ref.update(update);
  }

  return NextResponse.json({ ok: true, checked, resolved });
}
