/* api/cancel-subscription.js
   POST /api/cancel-subscription
   Body: { token, uid }

   Cancels the Flutterwave subscription and marks Firestore.
   Access continues until currentPeriodEnd.
*/

import { adminAuth, db } from './_firebase.js';
import { Timestamp }     from 'firebase-admin/firestore';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { token, uid } = req.body || {};
  if (!token || !uid) return res.status(400).json({ error: 'Missing token or uid' });

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uid) throw new Error('UID mismatch');
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  const userSnap = await db.collection('users').doc(uid).get();
  if (!userSnap.exists()) return res.status(404).json({ error: 'User not found' });

  const d = userSnap.data();

  if (d.subscriptionStatus === 'cancelled') {
    return res.status(400).json({ error: 'Subscription is already cancelled' });
  }

  if (d.subscriptionStatus === 'manual') {
    return res.status(400).json({ error: 'This account has manual access — contact admin to revoke' });
  }

  if (!d.flutterwaveTxRef) {
    return res.status(400).json({ error: 'No active Flutterwave subscription found' });
  }

  try {
    /* Find the subscription ID from Flutterwave */
    const listRes = await fetch(
      `https://api.flutterwave.com/v3/subscriptions?email=${encodeURIComponent(d.email || '')}`,
      {
        headers: { 'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
      }
    );
    const listData = await listRes.json();

    /* Cancel any active subscriptions found */
    if (listData.status === 'success' && listData.data?.length) {
      for (const sub of listData.data) {
        if (sub.status === 'active') {
          await fetch(`https://api.flutterwave.com/v3/subscriptions/${sub.id}/cancel`, {
            method:  'PUT',
            headers: { 'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}` },
          });
        }
      }
    }

    /* Mark cancelled in Firestore */
    await userSnap.ref.update({
      subscriptionStatus: 'cancelled',
      cancelledAt:        Timestamp.now(),
    });

    const periodEnd = d.currentPeriodEnd?.toDate?.();
    const fmtDate   = periodEnd?.toLocaleDateString('en-US', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    }) || 'end of billing period';

    return res.status(200).json({
      success:     true,
      message:     `Subscription cancelled. Access continues until ${fmtDate}.`,
      accessUntil: periodEnd?.toISOString() || null,
    });

  } catch (e) {
    console.error('[cancel-subscription]', e.message);
    return res.status(500).json({ error: e.message });
  }
      }
