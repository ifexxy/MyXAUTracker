const { adminAuth } = require('./_firebase.js');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { token, email, uid, name } = req.body || {};

  if (!token || !email || !uid) {
    return res.status(400).json({ error: 'Missing token, email or uid' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uid) {
      return res.status(403).json({ error: 'Token UID mismatch' });
    }
  } catch (e) {
    return res.status(401).json({ error: 'Invalid Firebase token: ' + e.message });
  }

  const txRef = 'xau-' + uid + '-' + Date.now();

  try {
    const payload = {
      tx_ref:       txRef,
      amount:       9900,
      currency:     'NGN',
      redirect_url: 'https://xautracker.vercel.app/success.html',
      payment_plan: process.env.FLUTTERWAVE_PLAN_ID,
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

    const flwRes = await fetch('https://api.flutterwave.com/v3/payments', {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.FLUTTERWAVE_SECRET_KEY,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await flwRes.json();

    if (data.status !== 'success') {
      throw new Error(data.message || 'Flutterwave init failed');
    }

    return res.status(200).json({ url: data.data.link, txRef });

  } catch (e) {
    console.error('[create-checkout]', e.message);
    return res.status(500).json({ error: e.message });
  }
};
