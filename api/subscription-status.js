/* api/subscription-status.js
   GET /api/subscription-status?uid=xxx
   Header: Authorization: Bearer <FirebaseIdToken>

   Returns the full access status for the authenticated user.
   Used by the account/settings page to show subscription details.

   Env vars needed:
     FIREBASE_*
*/

import { adminAuth, db } from './_firebase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  'https://xautracker.vercel.app');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  /* Extract Bearer token from Authorization header */
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.replace('Bearer ', '').trim();
  const uid        = req.query.uid;

  if (!token || !uid) {
    return res.status(400).json({ error: 'Missing authorization token or uid' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (decoded.uid !== uid) throw new Error('UID mismatch');
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const snap = await db.collection('users').doc(uid).get();
  if (!snap.exists()) return res.status(404).json({ error: 'User not found' });

  const d   = snap.data();
  const now = Date.now();

  const trialActive  = d.trialEndsAt?.toMillis?.()         > now;
  const subActive    = d.subscriptionStatus === 'active'
                    && d.currentPeriodEnd?.toMillis?.()     > now;
  const manualActive = d.manualAccess === true
                    && (d.manualAccessExpiresAt === null || d.manualAccessExpiresAt?.toMillis?.() > now);

  return res.status(200).json({
    uid,
    email:              d.email,
    hasAccess:          trialActive || subActive || manualActive,
    accessType:         manualActive ? 'manual' : subActive ? 'subscription' : trialActive ? 'trial' : 'none',
    subscriptionStatus: d.subscriptionStatus || 'none',
    trialEndsAt:        d.trialEndsAt?.toDate?.()?.toISOString()         || null,
    currentPeriodEnd:   d.currentPeriodEnd?.toDate?.()?.toISOString()    || null,
    cancelledAt:        d.cancelledAt?.toDate?.()?.toISOString()         || null,
    manualAccess:       d.manualAccess       || false,
    manualAccessNote:   d.manualAccessNote   || null,
    manualAccessExpiresAt: d.manualAccessExpiresAt?.toDate?.()?.toISOString() || null,
    paystackSubscriptionCode: d.paystackSubscriptionCode || null,
    lastPaymentAt:      d.lastPaymentAt?.toDate?.()?.toISOString()       || null,
    lastPaymentAmount:  d.lastPaymentAmount  || null,
  });
}
