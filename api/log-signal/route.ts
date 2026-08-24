import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import { Timestamp } from 'firebase-admin/firestore';

const TIMEFRAME_MINUTES: Record<string, number> = {
  '10m': 10, '1h': 60, '4h': 240, '24h': 1440,
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { instrument, timeframe, direction, entryPrice, sl, tp1, tp2, rr1, rr2 } = body;

    if (!instrument || !timeframe || !direction || !entryPrice || !sl || !tp1 || !tp2) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (direction !== 'long' && direction !== 'short') {
      return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
    }
    const minutes = TIMEFRAME_MINUTES[timeframe];
    if (!minutes) {
      return NextResponse.json({ error: 'Invalid timeframe' }, { status: 400 });
    }

    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + minutes * 60 * 1000);

    const docRef = await adminDb.collection('signals').add({
      instrument, timeframe, direction,
      entryPrice, sl, tp1, tp2,
      rr1: rr1 ?? null, rr2: rr2 ?? null,
      createdAt: now,
      expiresAt,
      lastCheckedAt: null,
      status: 'open',            // open | tp1_hit | tp2_hit | sl_hit | expired
      tp1HitAt: null, tp2HitAt: null, slHitAt: null, closedAt: null,
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
