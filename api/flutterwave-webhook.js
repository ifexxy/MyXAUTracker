/* api/flutterwave-webhook.js
   POST /api/flutterwave-webhook

   Set this URL in Flutterwave Dashboard:
   Settings → Webhooks → https://xautracker.vercel.app/api/flutterwave-webhook

   Set your webhook secret hash in Flutterwave Dashboard:
   Settings → Webhooks → Secret Hash
   Then add it to Vercel env vars as: FLUTTERWAVE_WEBHOOK_HASH

   Events handled:
     charge.completed          — payment received
     subscription.cancelled    — user cancelled
*/

import { db }        from './_firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  /* Verify the request is genuinely from Flutterwave */
  const secretHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  const signature  = req.headers['verif-hash'];

  if (!signature || signature !== secretHash) {
    console.error('[flw-webhook] Invalid signature — request rejected');
    return res.status(401).send('Unauthorized');
  }

  const payload = req.body;
  console.log('[flw-webhook] Event:', payload.event);

  try {

    /* ════════════════════════════════════════
       charge.completed
       Fires on every successful payment.
       Both first-time and recurring charges.
    ════════════════════════════════════════ */
    if (payload.event === 'charge.completed') {
      const data   = payload.data;

      /* Only process successful charges */
      if (data.status !== 'successful') {
        console.log('[flw-webhook] charge not successful, status:', data.status);
        return res.status(200).json({ received: true });
      }

      /* Extract Firebase UID from meta */
      const uid = data.meta?.uid || null;

      if (!uid) {
        console.warn('[flw-webhook] charge.completed — no UID in meta, skipping');
        return res.status(200).json({ received: true });
      }

      /* Calculate next period end — 30 days from now */
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      await db.collection('users').doc(uid).set({
        subscriptionStatus:      'active',
        flutterwaveCustomerId:   data.customer?.email || null,
        flutterwaveTxRef:        data.tx_ref          || null,
        flutterwaveTxId:         String(data.id)      || null,
        currentPeriodEnd:        Timestamp.fromDate(periodEnd),
        activatedAt:             Timestamp.now(),
        lastPaymentAt:           Timestamp.now(),
        lastPaymentAmount:       data.amount          || 9900,
        lastPaymentCurrency:     data.currency        || 'NGN',
      }, { merge: true });

      console.log('[flw-webhook] Access activated for UID:', uid);
    }

    /* ════════════════════════════════════════
       subscription.cancelled
       Fires when a subscription is cancelled.
    ════════════════════════════════════════ */
    if (payload.event === 'subscription.cancelled') {
      const data     = payload.data;
      const email    = data.customer?.customer_email;

      if (email) {
        const snap = await db.collection('users')
          .where('email', '==', email).limit(1).get();

        if (!snap.empty) {
          await snap.docs[0].ref.update({
            subscriptionStatus: 'cancelled',
            cancelledAt:        Timestamp.now(),
          });
          console.log('[flw-webhook] Subscription cancelled for:', email);
        }
      }
    }

  } catch (e) {
    /* Always return 200 so Flutterwave stops retrying */
    console.error('[flw-webhook] Error:', e.message);
  }

  return res.status(200).json({ received: true });
    }
