const { db, adminAuth } = require('./_firebase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { transaction_id, userToken } = req.body || {};

  if (!transaction_id || !userToken) {
    return res.status(400).json({ error: 'Missing transaction_id or userToken' });
  }

  /* 1. Verify Firebase user token */
  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(userToken);
    uid = decoded.uid;
  } catch (e) {
    console.error('Token verify failed:', e.message);
    return res.status(401).json({ error: 'Invalid user token' });
  }

  /* 2. Verify with Flutterwave */
  let flwData;
  try {
    const flwRes = await fetch(
      `https://api.flutterwave.com/v3/transactions/${transaction_id}/verify`,
      {
        headers: {
          Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );
    flwData = await flwRes.json();
  } catch (e) {
    console.error('Flutterwave fetch failed:', e.message);
    return res.status(502).json({ error: 'Could not reach Flutterwave' });
  }

  if (
    flwData.status !== 'success' ||
    flwData.data?.status !== 'successful' ||
    flwData.data?.amount < 9900 ||
    flwData.data?.currency !== 'NGN'
  ) {
    console.error('FLW verification failed:', JSON.stringify(flwData));
    return res.status(400).json({ error: 'Payment verification failed' });
  }

  /* 3. Update Firestore */
  try {
    const currentPeriodEnd = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    await db.collection('users').doc(uid).update({
      subscriptionStatus: 'active',
      currentPeriodEnd,
      lastPaymentAt:      new Date().toISOString(),
      lastPaymentAmount:  flwData.data.amount,
      flutterwaveTxId:    String(transaction_id),
      flutterwaveTxRef:   flwData.data.tx_ref,
    });

    return res.status(200).json({ success: true, currentPeriodEnd });

  } catch (e) {
    console.error('Firestore update failed:', e.message);
    return res.status(500).json({ error: 'Failed to update subscription' });
  }
};
