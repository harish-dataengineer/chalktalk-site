// ============================================================================
// Verifies that a payment success message actually came from Razorpay (not
// faked by someone editing the page), then:
//   1. Records the purchase in Vercel KV (for phone-based access recovery)
//   2. Logs the purchase to your Google Sheet (for your own record-keeping)
//   3. Sends the buyer a confirmation email via SendGrid
//
// Steps 2 and 3 are "best effort" — if either fails, the student still gets
// unlocked (the payment was real either way). We just log the failure so
// you can notice and fix it, rather than blocking a paying student.
//
// ENV VARS NEEDED (Vercel → Settings → Environment Variables):
//   RAZORPAY_KEY_SECRET   — used to verify the payment signature
//   SENDGRID_API_KEY      — from https://app.sendgrid.com/ (see setup notes below)
//   SENDER_EMAIL          — the single sender email you verified in SendGrid
//   SHEET_WEBHOOK_URL     — your Google Apps Script Web App URL (see setup notes)
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
    email,
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

  // ---- Step 2: record the purchase in Vercel KV ----
  const cleanPhone = phone.replace(/\D/g, ''); // keep digits only
  const subjectKey = subject || 'dbms';
  const purchasedAt = new Date().toISOString();

  const record = {
    phone: cleanPhone,
    email: email || '',
    subject: subjectKey,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    purchasedAt
  };

  try {
    await kv.set(`purchase:${subjectKey}:${cleanPhone}`, record);
  } catch (err) {
    console.error('Failed to save purchase record to KV:', err);
  }

  // ---- Step 3: log to Google Sheet (best effort, never blocks unlock) ----
  const sheetWebhookUrl = process.env.SHEET_WEBHOOK_URL;
  if (sheetWebhookUrl) {
    try {
      await fetch(sheetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
      });
    } catch (err) {
      console.error('Failed to log purchase to Google Sheet:', err);
    }
  }

  // ---- Step 4: send confirmation email via SendGrid (best effort) ----
  const sendgridKey = process.env.SENDGRID_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL;
  if (sendgridKey && senderEmail && email) {
    try {
      await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email }] }],
          from: { email: senderEmail, name: 'ChalkTalk' },
          subject: 'Your ChalkTalk purchase — DBMS Full Notes',
          content: [{
            type: 'text/plain',
            value:
              `Thanks for your purchase!\n\n` +
              `You've unlocked the full DBMS notes (Units 2–5) on ChalkTalk.\n\n` +
              `Payment ID: ${razorpay_payment_id}\n` +
              `Amount: ₹99\n` +
              `Date: ${purchasedAt}\n\n` +
              `You can access your notes anytime at your ChalkTalk link. If you switch devices, use "Recover my access" with this phone number: ${cleanPhone}\n\n` +
              `Happy studying!\n— ChalkTalk`
          }]
        })
      });
    } catch (err) {
      console.error('Failed to send confirmation email:', err);
    }
  }

  return res.status(200).json({ verified: true, unlocked: true });
}
