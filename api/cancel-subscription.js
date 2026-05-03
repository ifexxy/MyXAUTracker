const { db, adminAuth } = require('./_firebase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', 'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userToken } = req.body || {};

  if (!userToken) {
    return res.status(400).json({ error: 'Missing userToken' });
  }

  let uid;
  try {
    const decoded = await adminAuth.verifyIdToken(userToken);
    uid = decoded.uid;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid user token' });
  }

  try {
    await db.collection('users').doc(uid).update({
      subscriptionStatus: 'cancelled',
    });

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled. You keep access until your current period ends.',
    });

  } catch (e) {
    console.error('Cancel error:', e.message);
    return res.status(500).json({ error: 'Failed to cancel: ' + e.message });
  }
};
