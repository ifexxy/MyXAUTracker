const { db } = require('./_firebase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://www.xautracker.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { phone } = req.body || {};
  if (!phone) return res.status(400).json({ error: 'Missing phone number' });

  try {
    const snap = await db.collection('users')
      .where('phone', '==', phone)
      .limit(1)
      .get();

    if (!snap.empty) {
      const userData = snap.docs[0].data();
      if (userData.trialEndsAt || userData.subscriptionStatus) {
        return res.status(200).json({ used: true });
      }
    }

    return res.status(200).json({ used: false });

  } catch (e) {
    console.error('Phone check error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
