// ============================================================================
// api/create-order.js
// Creates a Razorpay order securely from the backend.
// ============================================================================

export default async function handler(req, res) {
  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    // Check environment variables
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("Razorpay environment variables are missing");

      return res.status(500).json({
        error: "Razorpay configuration is missing"
      });
    }

    // Get request data
    const { amount, subject } = req.body;

    // Validate amount
    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount < 100) {
      return res.status(400).json({
        error: "Invalid payment amount"
      });
    }

    // Create Basic Authentication token
    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

    // Create Razorpay order
    const response = await fetch(
      "https://api.razorpay.com/v1/orders",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "Authorization": `Basic ${auth}`
        },

        body: JSON.stringify({
          amount: paymentAmount,
          currency: "INR",

          receipt: `${subject || "dbms"}_${Date.now()}`,

          payment_capture: 1
        })
      }
    );

    const order = await response.json();

    // Log response for Vercel debugging
    console.log("Razorpay order response:", {
      status: response.status,
      orderId: order.id,
      error: order.error
    });

    // Handle Razorpay API errors
    if (!response.ok) {
      console.error("Razorpay order creation failed:", order);

      return res.status(response.status).json({
        error: "Could not create payment order",

        razorpayError: order.error
          ? {
              code: order.error.code,
              description: order.error.description,
              reason: order.error.reason
            }
          : null
      });
    }

    // Successfully created order
    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (err) {
    console.error("create-order unexpected error:", err);

    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}