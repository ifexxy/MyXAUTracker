/* api/create-checkout.js
   POST /api/create-checkout
   Body: { token, email, uid, name }

   Creates a Flutterwave hosted payment link tied to
   your monthly subscription plan. Returns { url } for
   the frontend to redirect the user to.

   Flutterwave docs: https://developer.flutterwave.com/docs
*/

import { adminAuth } from './_firebase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { token, email, uid, name } = req.body || {};

  if (!token || !email || !uid) {
    return res.status(400).json({ error: 'Missing required fields: token, email, uid' });
  }

  /* Verify the Firebase ID token — user must be logged in */
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uid) {
      return res.status(403).json({ error: 'Token UID does not match provided uid' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid Firebase token: ' + e.message });
  }

  /* Build a unique transaction reference */
  const txRef = `xau-${uid}-${Date.now()}`;

  try {
    const response = await fetch('https://api.flutterwave.com/v3/payment-plans/' + process.env.FLUTTERWAVE_PLAN_ID + '/subscriptions', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
    });

    /* Use the standard payment link endpoint which supports plans */
    const payload = {
      tx_ref:          txRef,
      amount:          9900,
      currency:        'NGN',
      redirect_url:    'https://xautracker.vercel.app/success.html',
      payment_plan:    process.env.FLUTTERWAVE_PLAN_ID,
      customer: {
        email,
        name: name || email,
      },
      customizations: {
        title:       'XAU Tracker Pro',
        description: 'Monthly subscription — Predict page access',
        logo:        'https://xautracker.vercel.app/og-image.png',
      },
      meta: {
        uid,
        source: 'xautracker',
      },
    };

    const flwRes  = await fetch('https://api.flutterwave.com/v3/payments', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${process.env.FLUTTERWAVE_SECRET_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await flwRes.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Flutterwave payment init failed');
    }

    return res.status(200).json({
      url:   data.data.link,
      txRef,
    });

  } catch (e) {
    console.error('[create-checkout] Flutterwave error:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
