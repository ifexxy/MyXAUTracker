/* api/grant-access.js
   ─────────────────────────────────────────────────────────────────
   POST /api/grant-access
   Body: { adminToken, targetEmail, action, daysOrMonths, unit, note }

   Actions:
     grant     — give timed access (daysOrMonths + unit)
     extend    — extend existing manual access
     permanent — give access that never expires
     revoke    — immediately remove access

   Security:
     Caller must be authenticated via Firebase AND their UID must
     exist in the /admins Firestore collection.
     Create this manually: Firebase Console → Firestore → admins/{YOUR_UID}

   Required Vercel Environment Variables:
     FIREBASE_PROJECT_ID
     FIREBASE_CLIENT_EMAIL
     FIREBASE_PRIVATE_KEY
   ─────────────────────────────────────────────────────────────────
*/

import { adminAuth, db } from './_firebase.js';
import { Timestamp }     from 'firebase-admin/firestore';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const { adminToken, targetEmail, action, daysOrMonths, unit, note } = req.body || {};

  if (!adminToken || !targetEmail || !action) {
    return res.status(400).json({ error: 'Missing: adminToken, targetEmail or action' });
  }

  /* ── 1. Verify the caller is authenticated ── */
  let callerUid;
  try {
    const decoded = await adminAuth.verifyIdToken(adminToken);
    callerUid     = decoded.uid;
  } catch (e) {
    return res.status(401).json({ error: 'Invalid admin token: ' + e.message });
  }

  /* ── 2. Verify the caller is in the /admins collection ── */
  const adminDoc = await db.collection('admins').doc(callerUid).get();
  if (!adminDoc.exists()) {
    return res.status(403).json({
      error: 'Forbidden — your UID is not in the /admins collection',
    });
  }

  /* ── 3. Look up the target user by email ── */
  let targetUser;
  try {
    targetUser = await adminAuth.getUserByEmail(targetEmail);
  } catch {
    return res.status(404).json({ error: `No user found with email: ${targetEmail}` });
  }

  const userRef = db.collection('users').doc(targetUser.uid);
  const now     = new Date();

  /* ── 4. Execute the action ── */

  if (action === 'grant' || action === 'extend') {
    const amount    = Math.max(1, parseInt(daysOrMonths) || 1);
    const ms        = unit === 'months'
      ? amount * 30 * 24 * 60 * 60 * 1000
      : amount *      24 * 60 * 60 * 1000;
    const expiresAt = new Date(now.getTime() + ms);

    await userRef.set({
      manualAccess:            true,
      manualAccessNote:        note        || '',
      manualAccessGrantedBy:   callerUid,
      manualAccessGrantedAt:   Timestamp.fromDate(now),
      manualAccessExpiresAt:   Timestamp.fromDate(expiresAt),
      subscriptionStatus:      'manual',
    }, { merge: true });

    return res.status(200).json({
      success:    true,
      action,
      targetEmail,
      targetUid:  targetUser.uid,
      expiresAt:  expiresAt.toISOString(),
      message:    `Access ${action === 'extend' ? 'extended' : 'granted'} to ${targetEmail} until ${expiresAt.toDateString()}`,
    });
  }

  if (action === 'permanent') {
    await userRef.set({
      manualAccess:            true,
      manualAccessNote:        note || 'Permanent access',
      manualAccessGrantedBy:   callerUid,
      manualAccessGrantedAt:   Timestamp.fromDate(now),
      manualAccessExpiresAt:   null,
      subscriptionStatus:      'manual',
    }, { merge: true });

    return res.status(200).json({
      success:   true,
      action,
      targetEmail,
      targetUid: targetUser.uid,
      message:   `Permanent access granted to ${targetEmail}`,
    });
  }

  if (action === 'revoke') {
    await userRef.update({
      manualAccess:            false,
      manualAccessNote:        '',
      manualAccessExpiresAt:   null,
      subscriptionStatus:      'revoked',
    });

    return res.status(200).json({
      success:   true,
      action,
      targetEmail,
      targetUid: targetUser.uid,
      message:   `Access revoked for ${targetEmail}`,
    });
  }

  return res.status(400).json({
    error: `Unknown action "${action}". Valid: grant, extend, permanent, revoke`,
  });
}
