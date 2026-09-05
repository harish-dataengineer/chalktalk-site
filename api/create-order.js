// ============================================================================
// Creates a Razorpay "order" before checkout opens. This is what lets us
// later verify a payment was genuine (see verify-payment.js) instead of
// just trusting whatever the browser tells us happened.
//
// ENV VARS NEEDED (Vercel → Settings → Environment Variables):
//   RAZORPAY_KEY_ID      — same key used in the frontend, safe to be public
//   RAZORPAY_KEY_SECRET  — NEVER expose this anywhere in frontend code
// Both come from https://dashboard.razorpay.com/ → Settings → API Keys
// ============================================================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error('Missing Razorpay credentials in environment variables');
    return res.status(500).json({ error: 'Payment gateway not configured' });
  }

  const { amount, subject } = req.body; // amount in paise, e.g. 9900 = ₹99

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: amount || 9900,
        currency: 'INR',
        receipt: `${subject || 'dbms'}_${Date.now()}`
      })
    });

    const order = await response.json();

    if (!response.ok) {
      console.error('Razorpay order creation failed:', order);
      return res.status(502).json({ error: 'Could not create payment order' });
    }

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (err) {
    console.error('create-order error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
