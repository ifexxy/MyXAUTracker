const { FieldValue } = require('firebase-admin/firestore');
const { db, adminAuth } = require('./_firebase');
const { getClientIp } = require('./_ip');
const { setCors } = require('./_otp');

const WRITE_EVERY_MS = 5 * 60 * 1000;
const MAX_IPS = 10;

/* Called by the app on every page load while signed in.
   1. Refuses (403 banned) if the account is disabled / banned / revoked,
      so the browser can sign the user out immediately.
   2. Records lastSeen + lastIp (+ a short list of distinct IPs) server-side. */
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Missing token' });

  let uid;
  try {
    // checkRevoked=true also rejects disabled users
    const decoded = await adminAuth.verifyIdToken(token, true);
    uid = decoded.uid;
  } catch (e) {
    if (e.code === 'auth/user-disabled' || e.code === 'auth/id-token-revoked')
      return res.status(403).json({ banned: true });
    return res.status(401).json({ error: 'Invalid token' });
  }

  try {
    const ref = db.collection('users').doc(uid);
    const snap = await ref.get();
    if (!snap.exists) return res.status(200).json({ ok: true });

    const d = snap.data();
    if (d.banned === true) return res.status(403).json({ banned: true });

    const ip = getClientIp(req);
    const lastSeenMs = d.lastSeen && d.lastSeen.toMillis ? d.lastSeen.toMillis() : 0;
    const stale = Date.now() - lastSeenMs > WRITE_EVERY_MS;
    const known = Array.isArray(d.ips) ? d.ips : [];
    const newIp = ip !== 'unknown' && !known.includes(ip) && known.length < MAX_IPS;

    if (stale || d.lastIp !== ip || newIp) {
      const update = { lastSeen: FieldValue.serverTimestamp(), lastIp: ip };
      if (newIp) update.ips = FieldValue.arrayUnion(ip);
      await ref.update(update);
    }
    return res.status(200).json({ ok: true });
  } catch (e) {
    // Never lock a real user out because of a logging hiccup
    console.error('session error:', e.message);
    return res.status(200).json({ ok: true });
  }
};
