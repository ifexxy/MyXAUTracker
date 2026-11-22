const { db } = require('./_firebase');

/* The paid trial: a one-time payment starts a 3-day trial.
   $1 is charged as NGN (same rate the app already uses: $10 = ₦15,000). */
const TRIAL_PRICE_NGN = 1500;
const TRIAL_DAYS = 3;
const TRIAL_REF_PREFIX = 'xautrial-';

/* tx_ref format used by the checkout: xautrial-<uid>-<timestamp>
   Binding the uid into the reference means a payment made from one account
   can't be claimed by another. */
function uidFromTrialRef(txRef) {
  const m = /^xautrial-([A-Za-z0-9_-]+)-(\d{10,})$/.exec(String(txRef || ''));
  return m ? m[1] : null;
}

function isValidTrialPayment(tx) {
  return (
    !!tx &&
    tx.status === 'successful' &&
    tx.currency === 'NGN' &&
    Number(tx.amount) >= TRIAL_PRICE_NGN
  );
}

/* Starts the trial for `uid` from a verified Flutterwave transaction.
   - Only accounts that were offered a trial (trialOffer === true) and haven't
     started one can use it.
   - Each Flutterwave transaction can be claimed once (payments/{txId}), so one
     $1 payment can't unlock several accounts.
   - Safe to call twice for the same payment (browser callback + webhook). */
async function activateTrial(uid, tx) {
  const userRef  = db.collection('users').doc(uid);
  const claimRef = db.collection('payments').doc(String(tx.id));

  return db.runTransaction(async (t) => {
    const [userSnap, claimSnap] = await Promise.all([t.get(userRef), t.get(claimRef)]);

    if (!userSnap.exists) return { status: 404, error: 'Account not found.' };
    const d = userSnap.data();

    if (claimSnap.exists) {
      if (claimSnap.data().uid === uid)
        return { ok: true, already: true, trialEndsAt: d.trialEndsAt || null };
      return { status: 409, error: 'This payment has already been used.' };
    }
    if (d.banned === true)
      return { status: 403, error: 'This account is suspended.' };
    if (d.trialOffer !== true || d.trialEndsAt)
      return { status: 409, error: 'A trial has already been used on this account.' };

    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString();

    t.set(claimRef, {
      uid,
      type:     'trial',
      amount:   Number(tx.amount),
      currency: tx.currency,
      txRef:    tx.tx_ref || null,
      at:       now.toISOString(),
    });
    t.update(userRef, {
      trialEndsAt,
      subscriptionStatus: 'trial',
      trialOffer:         false,
      trialPaidAt:        now.toISOString(),
      trialTxId:          String(tx.id),
    });
    return { ok: true, trialEndsAt };
  });
}

module.exports = {
  TRIAL_PRICE_NGN,
  TRIAL_DAYS,
  TRIAL_REF_PREFIX,
  uidFromTrialRef,
  isValidTrialPayment,
  activateTrial,
};
