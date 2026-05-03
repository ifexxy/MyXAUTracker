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

  const {
    adminToken,
    targetEmail,
    action,
    daysOrMonths,
    unit,
    note,
  } = req.body || {};

  if (!adminToken || !targetEmail || !action) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  /* 1. Verify Firebase ID token */
  let callerUid;
  try {
    const decoded = await adminAuth.verifyIdToken(adminToken);
    callerUid = decoded.uid;
  } catch (e) {
    console.error('Token verify failed:', e.message);
    return res.status(401).json({ error: 'Invalid admin token' });
  }

  /* 2. Check admin role in Firestore */
  try {
    const callerSnap = await db.collection('users').doc(callerUid).get();
    if (!callerSnap.exists || callerSnap.data().role !== 'admin') {
      return res.status(403).json({ error: 'Not authorised — admin role required' });
    }
  } catch (e) {
    console.error('Admin check failed:', e.message);
    return res.status(500).json({ error: 'Failed to verify admin role' });
  }

  /* 3. Look up target user by email */
  let targetUid;
  try {
    const targetUser = await adminAuth.getUserByEmail(targetEmail);
    targetUid = targetUser.uid;
  } catch (e) {
    console.error('User lookup failed:', e.message);
    return res.status(404).json({ error: 'No user found with that email' });
  }

  /* 4. Apply the action */
  try {
    const userRef = db.collection('users').doc(targetUid);

    if (action === 'revoke') {
      await userRef.update({
        manualAccess:          false,
        manualAccessNote:      '',
        manualAccessExpiresAt: null,
      });
      return res.status(200).json({
        success: true,
        message: `Access revoked for ${targetEmail}`,
      });
    }

    if (action === 'permanent') {
      await userRef.update({
        manualAccess:          true,
        manualAccessNote:      note || '',
        manualAccessExpiresAt: null,
      });
      return res.status(200).json({
        success: true,
        message: `Permanent access granted to ${targetEmail}`,
      });
    }

    /* grant or extend */
    const amount = parseInt(daysOrMonths, 10);
    if (!amount || amount < 1) {
      return res.status(400).json({ error: 'Invalid duration' });
    }

    let baseDate = new Date();
    if (action === 'extend') {
      const snap = await userRef.get();
      if (snap.exists) {
        const existing = snap.data().manualAccessExpiresAt;
        if (existing) {
          const existingDate = new Date(existing);
          if (existingDate > baseDate) baseDate = existingDate;
        }
      }
    }

    let expiresAt;
    if (unit === 'months') {
      expiresAt = new Date(baseDate);
      expiresAt.setMonth(expiresAt.getMonth() + amount);
    } else {
      expiresAt = new Date(baseDate.getTime() + amount * 24 * 60 * 60 * 1000);
    }

    await userRef.update({
      manualAccess:          true,
      manualAccessNote:      note || '',
      manualAccessExpiresAt: expiresAt.toISOString(),
    });

    const readableDate = expiresAt.toLocaleDateString('en-US', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    return res.status(200).json({
      success: true,
      message: `Access granted to ${targetEmail} until ${readableDate}`,
    });

  } catch (e) {
    console.error('Grant access error:', e.message);
    return res.status(500).json({ error: 'Failed to update user: ' + e.message });
  }
};
