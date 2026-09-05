// ============================================================================
// api/verify-payment.js
//
// Secure payment verification:
//
// 1. Verify Firebase authenticated user
// 2. Verify Razorpay payment signature
// 3. Verify order and payment directly with Razorpay
// 4. Store transaction
// 5. Store purchase against Firebase UID
// ============================================================================

import crypto from "crypto";
import { kv } from "@vercel/kv";
import admin from "./firebase-admin.js";


export default async function handler(req, res) {

  // --------------------------------------------------------------------------
  // Only POST requests allowed
  // --------------------------------------------------------------------------

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }


  try {

    const {

      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,

      // Firebase token received after OTP verification
      firebaseToken,

      subject

    } = req.body;


    // ------------------------------------------------------------------------
    // 1. Validate required fields
    // ------------------------------------------------------------------------

    if (
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature ||
      !firebaseToken
    ) {

      return res.status(400).json({
        error: "Missing required fields"
      });

    }


    // ------------------------------------------------------------------------
    // 2. VERIFY FIREBASE USER TOKEN
    // ------------------------------------------------------------------------

    let decodedToken;

    try {

      decodedToken = await admin
        .auth()
        .verifyIdToken(firebaseToken);

    } catch (error) {

      console.error(
        "Invalid Firebase token:",
        error.message
      );

      return res.status(401).json({

        error: "User authentication failed",

        verified: false

      });

    }


    // Firebase user identity
    const firebaseUid = decodedToken.uid;


    // Firebase verified phone number
    const firebasePhone =
      decodedToken.phone_number;


    if (!firebasePhone) {

      return res.status(400).json({

        error: "Verified phone number not found"

      });

    }


    // Remove +91 and other non-numeric characters
    const cleanPhone =
      firebasePhone.replace(/\D/g, "").slice(-10);


    // ------------------------------------------------------------------------
    // 3. Razorpay environment variables
    // ------------------------------------------------------------------------

    const keyId =
      process.env.RAZORPAY_KEY_ID;

    const keySecret =
      process.env.RAZORPAY_KEY_SECRET;


    if (!keyId || !keySecret) {

      console.error(
        "Razorpay environment variables missing"
      );

      return res.status(500).json({

        error: "Payment configuration missing"

      });

    }


    // ------------------------------------------------------------------------
    // 4. VERIFY RAZORPAY SIGNATURE
    // ------------------------------------------------------------------------

    const bodyToSign =
      `${razorpay_order_id}|${razorpay_payment_id}`;


    const expectedSignature = crypto

      .createHmac(
        "sha256",
        keySecret
      )

      .update(bodyToSign)

      .digest("hex");


    const signatureIsValid =
  typeof razorpay_signature === "string" &&
  expectedSignature.length === razorpay_signature.length &&
  crypto.timingSafeEqual(
    Buffer.from(expectedSignature),
    Buffer.from(razorpay_signature)
  );


    if (!signatureIsValid) {

      console.error(
        "Invalid Razorpay signature"
      );

      return res.status(400).json({

        error: "Payment verification failed",

        verified: false

      });

    }


    // ------------------------------------------------------------------------
    // 5. SUBJECT AND PRICE
    // ------------------------------------------------------------------------

    const subjectKey = String(
      subject || "dbms"
    ).toLowerCase();


    const PRICES = {

      dbms: 9900

    };


    const expectedAmount =
      PRICES[subjectKey];


    if (!expectedAmount) {

      return res.status(400).json({

        error: "Invalid subject"

      });

    }


    // ------------------------------------------------------------------------
    // 6. Razorpay authentication
    // ------------------------------------------------------------------------

    const auth = Buffer.from(

      `${keyId}:${keySecret}`

    ).toString("base64");


    // ------------------------------------------------------------------------
    // 7. GET ORDER DIRECTLY FROM RAZORPAY
    // ------------------------------------------------------------------------

    const orderResponse = await fetch(

      `https://api.razorpay.com/v1/orders/${razorpay_order_id}`,

      {

        method: "GET",

        headers: {

          Authorization:
            `Basic ${auth}`

        }

      }

    );


    const razorpayOrder =
      await orderResponse.json();


    if (!orderResponse.ok) {

      console.error(
        "Razorpay order verification failed:",
        razorpayOrder
      );

      return res.status(400).json({

        error: "Could not verify payment order"

      });

    }


    // Verify order amount
    if (
      razorpayOrder.amount !== expectedAmount
    ) {

      console.error(
        "Order amount mismatch"
      );

      return res.status(400).json({

        error: "Payment amount mismatch"

      });

    }


    // ------------------------------------------------------------------------
    // 8. GET PAYMENT DIRECTLY FROM RAZORPAY
    // ------------------------------------------------------------------------

    const paymentResponse = await fetch(

      `https://api.razorpay.com/v1/payments/${razorpay_payment_id}`,

      {

        method: "GET",

        headers: {

          Authorization:
            `Basic ${auth}`

        }

      }

    );


    const razorpayPayment =
      await paymentResponse.json();


    if (!paymentResponse.ok) {

      console.error(
        "Razorpay payment verification failed:",
        razorpayPayment
      );

      return res.status(400).json({

        error: "Could not verify payment"

      });

    }


    // ------------------------------------------------------------------------
    // 9. VERIFY PAYMENT BELONGS TO ORDER
    // ------------------------------------------------------------------------

    if (

      razorpayPayment.order_id !==
      razorpay_order_id

    ) {

      return res.status(400).json({

        error: "Payment and order mismatch"

      });

    }


    // ------------------------------------------------------------------------
    // 10. VERIFY PAYMENT AMOUNT
    // ------------------------------------------------------------------------

    if (

      razorpayPayment.amount !==
      expectedAmount

    ) {

      return res.status(400).json({

        error: "Incorrect payment amount"

      });

    }


    // ------------------------------------------------------------------------
    // 11. VERIFY PAYMENT SUCCESS
    // ------------------------------------------------------------------------

    if (

      razorpayPayment.status !==
      "captured"

    ) {

      return res.status(400).json({

        error: "Payment not completed yet",

        verified: false

      });

    }


    // ------------------------------------------------------------------------
    // 12. PREVENT DUPLICATE TRANSACTIONS
    // ------------------------------------------------------------------------

    const transactionKey =

      `transaction:${razorpay_payment_id}`;


    const existingTransaction =

      await kv.get(transactionKey);


    if (existingTransaction) {

      return res.status(200).json({

        verified: true,

        unlocked: true,

        alreadyProcessed: true

      });

    }


    // ------------------------------------------------------------------------
    // 13. CREATE TRANSACTION RECORD
    // ------------------------------------------------------------------------

    const transaction = {

      paymentId:
        razorpay_payment_id,

      orderId:
        razorpay_order_id,

      firebaseUid:
        firebaseUid,

      phone:
        cleanPhone,

      subject:
        subjectKey,

      amount:
        expectedAmount,

      status:
        "SUCCESS",

      method:
        razorpayPayment.method || null,

      purchasedAt:
        new Date().toISOString()

    };


    // ------------------------------------------------------------------------
    // 14. SAVE TRANSACTION
    // ------------------------------------------------------------------------

    await kv.set(

      transactionKey,

      transaction

    );


    // ------------------------------------------------------------------------
    // 15. SAVE PURCHASE USING FIREBASE UID
    // ------------------------------------------------------------------------

    const purchaseKey =

      `purchase:${firebaseUid}:${subjectKey}`;


    const purchaseRecord = {

      firebaseUid:
        firebaseUid,

      phone:
        cleanPhone,

      subject:
        subjectKey,

      active:
        true,

      paymentId:
        razorpay_payment_id,

      orderId:
        razorpay_order_id,

      purchasedAt:
        transaction.purchasedAt

    };


    await kv.set(

      purchaseKey,

      purchaseRecord

    );


    // ------------------------------------------------------------------------
    // 16. SAVE TRANSACTION ID TO HISTORY
    // ------------------------------------------------------------------------

    await kv.lpush(

      "transactions:all",

      razorpay_payment_id

    );


    console.log(

      "Payment verified successfully:",

      razorpay_payment_id,

      "Firebase user:",

      firebaseUid

    );


    // ------------------------------------------------------------------------
    // SUCCESS
    // ------------------------------------------------------------------------

    return res.status(200).json({

      verified: true,

      unlocked: true

    });


  } catch (err) {

    console.error(

      "verify-payment error:",

      err

    );


    return res.status(500).json({

      error: "Server error",

      verified: false,

      unlocked: false

    });

  }

} 