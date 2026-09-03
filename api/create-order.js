// ============================================================================
// api/create-order.js
// Secure Razorpay order creation
//
// IMPORTANT:
// Prices are controlled ONLY by the server.
// The frontend cannot change the payment amount.
// ============================================================================

export default async function handler(req, res) {

  // Allow only POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    // ------------------------------------------------------------------------
    // 1. Check Razorpay credentials
    // ------------------------------------------------------------------------

    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {

      console.error("Razorpay environment variables are missing");

      return res.status(500).json({
        error: "Payment configuration is missing"
      });
    }


    // ------------------------------------------------------------------------
    // 2. Get subject ONLY
    // DO NOT accept amount from frontend
    // ------------------------------------------------------------------------

    const { subject } = req.body;

    const subjectKey = (subject || "dbms").toLowerCase();


    // ------------------------------------------------------------------------
    // 3. SERVER-SIDE PRICES
    // Amount is in PAISE
    //
    // ₹99 = 9900 paise
    // ------------------------------------------------------------------------

    const PRICES = {

      dbms: 9900

      // Future subjects:
      // dsa: 9900,
      // java: 9900,
      // software_engineering: 9900

    };


    // ------------------------------------------------------------------------
    // 4. Validate subject
    // ------------------------------------------------------------------------

    const paymentAmount = PRICES[subjectKey];

    if (!paymentAmount) {

      return res.status(400).json({
        error: "Invalid subject"
      });

    }


    // ------------------------------------------------------------------------
    // 5. Create Razorpay authentication
    // ------------------------------------------------------------------------

    const auth = Buffer.from(
      `${keyId}:${keySecret}`
    ).toString("base64");


    // ------------------------------------------------------------------------
    // 6. Create Razorpay order
    // ------------------------------------------------------------------------

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

          receipt: `${subjectKey}_${Date.now()}`,

          notes: {
            subject: subjectKey
          }

        })

      }
    );


    const order = await response.json();


    // ------------------------------------------------------------------------
    // 7. Handle Razorpay errors
    // ------------------------------------------------------------------------

    if (!response.ok) {

      console.error(
        "Razorpay order creation failed:",
        order
      );

      return res.status(response.status).json({

        error: "Could not create payment order"

      });

    }


    // ------------------------------------------------------------------------
    // 8. Success
    // ------------------------------------------------------------------------

    console.log(
      "Razorpay order created successfully:",
      order.id
    );


    return res.status(200).json({

      success: true,

      // Safe to expose Razorpay Key ID
      keyId: keyId,

      orderId: order.id,

      amount: order.amount,

      currency: order.currency,

      subject: subjectKey

    });


  } catch (err) {

    console.error(
      "create-order error:",
      err
    );


    return res.status(500).json({

      error: "Server error"

    });

  }

}