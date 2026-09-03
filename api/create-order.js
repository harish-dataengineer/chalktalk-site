export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("Razorpay environment variables are missing");

      return res.status(500).json({
        error: "Razorpay configuration is missing"
      });
    }

    const { amount, subject } = req.body;

    const paymentAmount = Number(amount);

    if (!paymentAmount || paymentAmount < 100) {
      return res.status(400).json({
        error: "Invalid payment amount"
      });
    }

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");

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
          receipt: `${subject || "dbms"}_${Date.now()}`
        })
      }
    );

    const order = await response.json();

    console.log("Razorpay order response:", {
      status: response.status,
      orderId: order.id,
      error: order.error
    });

    if (!response.ok) {
      console.error("Razorpay order creation failed:", order);

      return res.status(response.status).json({
        error: "Could not create payment order",
        details: order.error
      });
    }

    return res.status(200).json({
      success: true,

      // Return the same Key ID used to create the order
      keyId: keyId,

      orderId: order.id,
      amount: order.amount,
      currency: order.currency
    });

  } catch (err) {
    console.error("create-order error:", err);

    return res.status(500).json({
      error: "Server error",
      message: err.message
    });
  }
}