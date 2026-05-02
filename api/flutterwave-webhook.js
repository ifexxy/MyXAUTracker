/* api/flutterwave-webhook.js
   ─────────────────────────────────────────────────────────────────
   POST /api/flutterwave-webhook

   Set this URL in Flutterwave Dashboard:
   Settings → Webhooks → Webhook URL:
   https://xautracker.vercel.app/api/flutterwave-webhook

   Set a Secret Hash in Flutterwave Dashboard:
   Settings → Webhooks → Secret Hash → type any strong string
   e.g. "xautracker_flw_secret_2026"
   Then add that same string to Vercel env vars as:
   FLUTTERWAVE_WEBHOOK_HASH = xautracker_flw_secret_2026

   How Flutterwave webhook verification works:
   Unlike Stripe (which uses HMAC), Flutterwave simply sends your
   secret hash as a plain header called "verif-hash" with every
   webhook. You just compare it to your stored secret. No raw body
   or crypto needed.

   Events handled:
     charge.completed       — payment received (first + renewals)
     subscription.cancelled — user cancelled their subscription
   ─────────────────────────────────────────────────────────────────
*/

import { db }        from './_firebase.js';
import { Timestamp } from 'firebase-admin/firestore';

export default async function handler(req, res) {

  /* Only accept POST */
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ── Step 1: Verify the request is from Flutterwave ──────────────
     Flutterwave sends your FLUTTERWAVE_WEBHOOK_HASH as the
     "verif-hash" header on every webhook request.
     If it doesn't match, reject the request immediately.
  ─────────────────────────────────────────────────────────────────*/
  const secretHash      = process.env.FLUTTERWAVE_WEBHOOK_HASH;
  const incomingHash    = req.headers['verif-hash'];

  if (!secretHash) {
    console.error('[flw-webhook] FLUTTERWAVE_WEBHOOK_HASH env var not set');
    return res.status(500).json({ error: 'Webhook secret not configured' });
  }

  if (!incomingHash || incomingHash !== secretHash) {
    console.error('[flw-webhook] Invalid verif-hash — request rejected');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  /* ── Step 2: Parse the event ─────────────────────────────────────
     Vercel automatically parses JSON bodies so req.body is
     already a plain object. No manual parsing needed.
  ─────────────────────────────────────────────────────────────────*/
  const event = req.body;

  if (!event || !event.event) {
    console.error('[flw-webhook] Empty or malformed payload');
    return res.status(400).json({ error: 'Invalid payload' });
  }

  const { event: eventType, data } = event;
  console.log('[flw-webhook] Received event:', eventType);

  /* ── Step 3: Handle events ──────────────────────────────────────*/
  try {

    /* ════════════════════════════════════════════════════
       charge.completed
       Fires on every successful payment — both the first
       subscription charge and all monthly renewals.
    ════════════════════════════════════════════════════ */
    if (eventType === 'charge.completed') {

      /* Only process payments that are actually successful */
      if (data.status !== 'successful') {
        console.log('[flw-webhook] charge not successful, status:', data.status);
        return res.status(200).json({ received: true });
      }

      /* Extract the Firebase UID we stored in meta when creating checkout */
      const uid = data.meta?.uid || null;

      if (!uid) {
        /* Renewal payment — meta.uid is only present on first payment.
           Find the user by their email address instead. */
        const email = data.customer?.email;
        if (email) {
          const snap = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

          if (!snap.empty) {
            const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            await snap.docs[0].ref.update({
              subscriptionStatus:  'active',
              currentPeriodEnd:    Timestamp.fromDate(periodEnd),
              lastPaymentAt:       Timestamp.now(),
              lastPaymentAmount:   data.amount       || 9900,
              lastPaymentCurrency: data.currency     || 'NGN',
            });
            console.log('[flw-webhook] Renewal activated for:', email);
          } else {
            console.warn('[flw-webhook] No user found for email:', email);
          }
        }
        return res.status(200).json({ received: true });
      }

      /* First payment — UID is available in meta */
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      /* set() with merge:true creates the doc if it doesn't exist yet */
      await db.collection('users').doc(uid).set({
        subscriptionStatus:    'active',
        flutterwaveTxRef:      data.tx_ref          || null,
        flutterwaveTxId:       String(data.id)      || null,
        currentPeriodEnd:      Timestamp.fromDate(periodEnd),
        activatedAt:           Timestamp.now(),
        lastPaymentAt:         Timestamp.now(),
        lastPaymentAmount:     data.amount           || 9900,
        lastPaymentCurrency:   data.currency         || 'NGN',
      }, { merge: true });

      console.log('[flw-webhook] Access activated for UID:', uid, 'amount:', data.amount);
    }

    /* ════════════════════════════════════════════════════
       subscription.cancelled
       Fires when a user cancels their subscription.
       Access continues until currentPeriodEnd.
    ════════════════════════════════════════════════════ */
    if (eventType === 'subscription.cancelled') {
      const email = data.customer?.customer_email || data.data?.customer?.email;

      if (email) {
        const snap = await db.collection('users')
          .where('email', '==', email)
          .limit(1)
          .get();

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
    /* Log the error but ALWAYS return 200 to Flutterwave.
       If we return 4xx/5xx, Flutterwave will keep retrying
       which will cause duplicate activations. */
    console.error('[flw-webhook] Handler error for', eventType, ':', e.message);
  }

  /* Always acknowledge receipt */
  return res.status(200).json({ received: true, event: eventType });
}
