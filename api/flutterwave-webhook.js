const { db }        = require('./_firebase.js');
const { Timestamp } = require('firebase-admin/firestore');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secretHash   = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  const incomingHash = req.headers['verif-hash'];

  if (!secretHash || incomingHash !== secretHash) {
    console.error('[flw-webhook] Invalid verif-hash');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const event = req.body;
  if (!event || !event.event) {
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { event: eventType, data } = event;
  console.log('[flw-webhook] Event:', eventType);

  try {

    if (eventType === 'charge.completed') {
      if (data.status !== 'successful') {
        return res.status(200).json({ received: true });
      }

      const uid       = data.meta && data.meta.uid ? data.meta.uid : null;
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      if (uid) {
        await db.collection('users').doc(uid).set({
          subscriptionStatus:    'active',
          manualAccess:          true,
          manualAccessExpiresAt: Timestamp.fromDate(periodEnd),
          manualAccessNote:      'Flutterwave subscription',
          flutterwaveTxRef:      data.tx_ref    || null,
          flutterwaveTxId:       String(data.id),
          currentPeriodEnd:      Timestamp.fromDate(periodEnd),
          activatedAt:           Timestamp.now(),
          lastPaymentAt:         Timestamp.now(),
          lastPaymentAmount:     data.amount    || 9900,
          lastPaymentCurrency:   data.currency  || 'NGN',
        }, { merge: true });

        console.log('[flw-webhook] Activated UID:', uid);

      } else {
        const email = data.customer && data.customer.email ? data.customer.email : null;
        if (email) {
          const snap = await db.collection('users')
            .where('email', '==', email).limit(1).get();
          if (!snap.empty) {
            await snap.docs[0].ref.update({
              subscriptionStatus:    'active',
              manualAccess:          true,
              manualAccessExpiresAt: Timestamp.fromDate(periodEnd),
              currentPeriodEnd:      Timestamp.fromDate(periodEnd),
              lastPaymentAt:         Timestamp.now(),
              lastPaymentAmount:     data.amount || 9900,
            });
            console.log('[flw-webhook] Renewal for:', email);
          }
        }
      }
    }

    if (eventType === 'subscription.cancelled') {
      const email = (data.customer && (data.customer.customer_email || data.customer.email)) || null;
      if (email) {
        const snap = await db.collection('users')
          .where('email', '==', email).limit(1).get();
        if (!snap.empty) {
          await snap.docs[0].ref.update({
            subscriptionStatus: 'cancelled',
            manualAccess:       false,
            cancelledAt:        Timestamp.now(),
          });
          console.log('[flw-webhook] Cancelled for:', email);
        }
      }
    }

  } catch (e) {
    console.error('[flw-webhook] Error:', e.message);
  }

  return res.status(200).json({ received: true, event: eventType });
};
