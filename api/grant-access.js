const { adminAuth, db } = require('./_firebase.js');
const { Timestamp }     = require('firebase-admin/firestore');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { adminToken, targetEmail, action, daysOrMonths, unit, note } = req.body || {};

  if (!adminToken)  return res.status(400).json({ error: 'Missing adminToken' });
  if (!targetEmail) return res.status(400).json({ error: 'Missing targetEmail' });
  if (!action)      return res.status(400).json({ error: 'Missing action' });

  let callerUid;
  try {
    const decoded = await adminAuth.verifyIdToken(adminToken);
    callerUid     = decoded.uid;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token: ' + e.message });
  }

  let adminDoc;
  try {
    adminDoc = await db.collection('admins').doc(callerUid).get();
  } catch (e) {
    return res.status(500).json({ error: 'Firestore error: ' + e.message });
  }

  if (!adminDoc.exists()) {
    return res.status(403).json({
      error: 'UID ' + callerUid + ' is not in the /admins collection',
    });
  }

  let targetUser;
  try {
    targetUser = await adminAuth.getUserByEmail(targetEmail);
  } catch (e) {
    return res.status(404).json({ error: 'No account found with email: ' + targetEmail });
  }

  const userRef = db.collection('users').doc(targetUser.uid);
  const now     = new Date();

  if (action === 'grant' || action === 'extend') {
    const amount    = Math.max(1, parseInt(daysOrMonths) || 1);
    const ms        = unit === 'months'
      ? amount * 30 * 24 * 60 * 60 * 1000
      : amount *      24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + ms);

    await userRef.set({
      email:                   targetEmail,
      manualAccess:            true,
      manualAccessNote:        note        || '',
      manualAccessGrantedBy:   callerUid,
      manualAccessGrantedAt:   Timestamp.fromDate(now),
      manualAccessExpiresAt:   Timestamp.fromDate(expiresAt),
      subscriptionStatus:      'active',
    }, { merge: true });

    return res.status(200).json({
      success:   true,
      message:   'Access granted to ' + targetEmail + ' until ' + expiresAt.toDateString(),
      expiresAt: expiresAt.toISOString(),
    });
  }

  if (action === 'permanent') {
    await userRef.set({
      email:                   targetEmail,
      manualAccess:            true,
      manualAccessNote:        note || 'Permanent access',
      manualAccessGrantedBy:   callerUid,
      manualAccessGrantedAt:   Timestamp.fromDate(now),
      manualAccessExpiresAt:   null,
      subscriptionStatus:      'active',
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Permanent access granted to ' + targetEmail,
    });
  }

  if (action === 'revoke') {
    await userRef.set({
      manualAccess:            false,
      manualAccessNote:        '',
      manualAccessExpiresAt:   null,
      subscriptionStatus:      'revoked',
    }, { merge: true });

    return res.status(200).json({
      success: true,
      message: 'Access revoked for ' + targetEmail,
    });
  }

  return res.status(400).json({
    error: 'Unknown action: ' + action + '. Valid: grant, extend, permanent, revoke',
  });
};
