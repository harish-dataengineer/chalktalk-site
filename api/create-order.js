// ============================================================================
// Creates a Razorpay "order" before checkout opens. This is what lets us
// later verify a payment was genuine (see verify-payment.js) instead of
// just trusting whatever the browser tells us happened.
//
// IMPORTANT: this returns the keyId it used to create the order, and the
// frontend uses THAT value to open checkout instead of its own separately
// hardcoded key. This guarantees the key and the order can never mismatch.
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

  const { amount, subject } = req.body;

  // Validate the amount rather than trusting it blindly
  const paymentAmount = Number(amount);
  if (!paymentAmount || paymentAmount < 100) {
    return res.status(400).json({ error: 'Invalid payment amount' });
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');

    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        amount: paymentAmount,
        currency: 'INR',
        receipt: `${subject || 'dbms'}_${Date.now()}`,
        payment_capture: 1 // auto-capture the payment once authorized
      })
    });

    const order = await response.json();

    // Log the response so Vercel's runtime logs show exactly what happened
    console.log('Razorpay order response:', {
      status: response.status,
      orderId: order.id,
      error: order.error
    });

    if (!response.ok) {
      console.error('Razorpay order creation failed:', order);
      return res.status(response.status).json({
        error: 'Could not create payment order',
        razorpayError: order.error
          ? {
              code: order.error.code,
              description: order.error.description,
              reason: order.error.reason
            }
          : null
      });
    }

    return res.status(200).json({
      success: true,
      keyId: keyId, // frontend must use THIS, not its own hardcoded value
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (err) {
    console.error('create-order unexpected error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
