/* api/verify-payment.js
   POST /api/verify-payment
   Body: { token, uid, txRef }

   Called by success.html when the webhook hasn't updated
   Firestore yet. Directly asks Flutterwave if the payment
   succeeded and activates access immediately if yes.
*/

import { adminAuth, db } from './_firebase.js';
import { Timestamp }     from 'firebase-admin/firestore';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { token, uid, txRef } = req.body || {};

  if (!token || !uid || !txRef) {
    return res.status(400).json({ error: 'Missing: token, uid or txRef' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uid) throw new Error('UID mismatch');
  } catch (e) {
    return res.status(401).json({ error: 'Unauthorized: ' + e.message });
  }

  try {
    /* Search Flutterwave transactions by tx_ref */
    const flwRes = await fetch(
      `https://api.flutterwave.com/v3/transactions?tx_ref=${encodeURIComponent(txRef)}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
          'Content-Type':  'application/json',
        },
      }
    );

    const data = await flwRes.json();

    if (data.status !== 'success' || !data.data?.length) {
      return res.status(402).json({
        success: false,
        message: 'Transaction not found or not yet confirmed',
      });
    }

    const tx = data.data[0];

    if (tx.status !== 'successful') {
      return res.status(402).json({
        success: false,
        status:  tx.status,
        message: 'Payment not successful',
      });
    }

    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await db.collection('users').doc(uid).set({
      subscriptionStatus:    'active',
      flutterwaveTxRef:      txRef,
      flutterwaveTxId:       String(tx.id),
      currentPeriodEnd:      Timestamp.fromDate(periodEnd),
      activatedAt:           Timestamp.now(),
      lastPaymentAt:         Timestamp.now(),
      lastPaymentAmount:     tx.amount        || 9900,
      lastPaymentCurrency:   tx.currency      || 'NGN',
    }, { merge: true });

    return res.status(200).json({
      success:          true,
      status:           tx.status,
      txRef,
      amount:           tx.amount,
      currency:         tx.currency,
      currentPeriodEnd: periodEnd.toISOString(),
    });

  } catch (e) {
    console.error('[verify-payment]', e.message);
    return res.status(500).json({ error: e.message });
  }
}
