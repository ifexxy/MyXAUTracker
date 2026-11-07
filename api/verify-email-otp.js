const { FieldValue } = require('firebase-admin/firestore');
const { db, adminAuth } = require('./_firebase');
const {
  COLLECTION,
  MAX_ATTEMPTS,
  normalizeEmail,
  isValidEmail,
  otpDocId,
  hashCode,
  safeEqualHex,
  setCors,
} = require('./_otp');

/* Checks the emailed code, then creates the account server-side so a
   signup can't skip verification by calling Firebase directly from the browser. */
module.exports = async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const { email: rawEmail, password, code } = req.body || {};
  const email = normalizeEmail(rawEmail);

  if (!isValidEmail(email))
    return res.status(400).json({ error: 'Enter a valid email address.' });
  if (typeof password !== 'string' || password.length < 6)
    return res.status(400).json({ error: 'Password must be 6+ characters.' });
  if (!/^\d{6}$/.test(String(code || '')))
    return res.status(400).json({ error: 'Enter the 6-digit code.' });

  try {
    const ref = db.collection(COLLECTION).doc(otpDocId(email));

    /* 1. Check the code. Attempts are counted inside the transaction so
          parallel guesses can't dodge the limit. */
    const outcome = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists)
        return { status: 400, error: 'Request a verification code first.' };

      const d = snap.data();

      if (Date.now() > d.expiresAt) {
        tx.delete(ref);
        return { status: 400, error: 'Code expired. Request a new one.' };
      }
      if (d.attempts >= MAX_ATTEMPTS)
        return { status: 429, error: 'Too many incorrect attempts. Request a new code.' };

      if (!safeEqualHex(d.codeHash, hashCode(email, String(code)))) {
        tx.update(ref, { attempts: d.attempts + 1 });
        return { status: 400, error: 'Incorrect code. Try again.' };
      }
      return { ok: true };
    });

    if (!outcome.ok)
      return res.status(outcome.status).json({ error: outcome.error });

    /* 2. Create the Firebase Auth user (email is now verified) */
    let uid;
    try {
      const created = await adminAuth.createUser({ email, password, emailVerified: true });
      uid = created.uid;
    } catch (e) {
      if (e.code === 'auth/email-already-exists')
        return res.status(409).json({ error: 'An account with this email already exists.' });
      if (e.code === 'auth/invalid-password')
        return res.status(400).json({ error: 'Password must be 6+ characters.' });
      throw e;
    }

    /* 3. Same user document the old flow wrote, minus the phone field */
    const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await db.collection('users').doc(uid).set({
        email,
        createdAt:             FieldValue.serverTimestamp(),
        trialEndsAt,
        subscriptionStatus:    'trial',
        manualAccess:          false,
        manualAccessNote:      '',
        manualAccessExpiresAt: null,
        currentPeriodEnd:      null,
        lastPaymentAt:         null,
        lastPaymentAmount:     null,
      });
    } catch (e) {
      // Don't leave an Auth user with no profile behind
      await adminAuth.deleteUser(uid).catch(() => {});
      throw e;
    }

    /* 4. Code is single-use */
    await ref.delete().catch(() => {});

    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('verify-email-otp error:', e.message);
    return res.status(500).json({ error: 'Sign up failed. Please try again.' });
  }
};
