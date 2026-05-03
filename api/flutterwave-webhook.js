const { db } = require('./_firebase');
const crypto = require('crypto');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* Verify the request is actually from Flutterwave */
  const secretHash = process.env.FLW_WEBHOOK_SECRET;
  const signature  = req.headers['verif-hash'];

  if (!signature || signature !== secretHash) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body;

  try {
    if (event.event === 'charge.completed' && event.data.status === 'successful') {
      const txRef    = event.data.tx_ref;
      const amount   = event.data.amount;
      const currency = event.data.currency;

      if (amount < 9900 || currency !== 'NGN') {
        return res.status(400).json({ error: 'Invalid amount or currency' });
      }

      /* Extract UID from tx_ref — format is xau-TIMESTAMP-UID */
      const parts = txRef.split('-');
      const uid   = parts.slice(2).join('-');

      if (!uid) {
        return res.status(400).json({ error: 'Could not extract UID from tx_ref' });
      }

      const currentPeriodEnd = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000
      ).toISOString();

      await db.collection('users').doc(uid).update({
        subscriptionStatus: 'active',
        currentPeriodEnd,
        lastPaymentAt:      new Date().toISOString(),
        lastPaymentAmount:  amount,
        flutterwaveTxId:    String(event.data.id),
        flutterwaveTxRef:   txRef,
      });

      return res.status(200).json({ success: true });
    }

    /* Ignore other event types */
    return res.status(200).json({ received: true });

  } catch (e) {
    console.error('Webhook error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
