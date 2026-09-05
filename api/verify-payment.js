// ============================================================================
// Verifies that a payment success message actually came from Razorpay (not
// faked by someone editing the page), then records the purchase so it can
// be recovered later if the student switches devices or clears their browser.
//
// USES Vercel KV (a simple key-value database). Set it up once:
//   Vercel Dashboard → your project → Storage tab → Create Database → KV
//   This automatically adds the required environment variables for you —
//   you don't need to create any separate account or copy any keys manually.
// ============================================================================

import crypto from 'crypto';
import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    phone,
    subject
  } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keySecret) {
    console.error('Missing RAZORPAY_KEY_SECRET in environment variables');
    return res.status(500).json({ error: 'Payment gateway not configured' });
  }

  // ---- Step 1: verify this payment genuinely came from Razorpay ----
  const bodyToSign = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSignature = crypto
    .createHmac('sha256', keySecret)
    .update(bodyToSign)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Payment could not be verified', verified: false });
  }

  // ---- Step 2: record the purchase so it's recoverable later ----
  const cleanPhone = phone.replace(/\D/g, ''); // keep digits only
  const subjectKey = subject || 'dbms';

  const record = {
    phone: cleanPhone,
    subject: subjectKey,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    purchasedAt: new Date().toISOString()
  };

  try {
    await kv.set(`purchase:${subjectKey}:${cleanPhone}`, record);
  } catch (err) {
    // Payment is real either way — don't block the student's access just
    // because the record-keeping step failed. Log it so you can fix later.
    console.error('Failed to save purchase record:', err);
  }

  return res.status(200).json({ verified: true, unlocked: true });
}
