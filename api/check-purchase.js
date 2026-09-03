// ============================================================================
// api/check-purchase.js
// Checks whether a phone number has purchased a subject.
//
// SECURITY NOTE:
// This checks purchase status only.
// OTP verification will be added as the next step.
// ============================================================================

import { kv } from "@vercel/kv";

export default async function handler(req, res) {

  // Only allow POST
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {

    const { phone, subject } = req.body;


    // ------------------------------------------------------------------------
    // Validate phone
    // ------------------------------------------------------------------------

    if (!phone) {
      return res.status(400).json({
        error: "Phone number required"
      });
    }

    const cleanPhone = String(phone).replace(/\D/g, "");

    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        error: "Please enter a valid 10-digit phone number"
      });
    }


    // ------------------------------------------------------------------------
    // Validate subject
    // ------------------------------------------------------------------------

    const subjectKey = String(
      subject || "dbms"
    ).toLowerCase();


    const allowedSubjects = [
      "dbms"
    ];

    if (!allowedSubjects.includes(subjectKey)) {
      return res.status(400).json({
        error: "Invalid subject"
      });
    }


    // ------------------------------------------------------------------------
    // Check purchase record
    // ------------------------------------------------------------------------

    const purchaseKey =
      `purchase:${subjectKey}:${cleanPhone}`;

    const record =
      await kv.get(purchaseKey);


    // ------------------------------------------------------------------------
    // No purchase found
    // ------------------------------------------------------------------------

    if (!record) {

      return res.status(200).json({
        unlocked: false
      });

    }


    // ------------------------------------------------------------------------
    // Check whether access is active
    // ------------------------------------------------------------------------

    if (record.active !== true) {

      return res.status(200).json({
        unlocked: false
      });

    }


    // ------------------------------------------------------------------------
    // Purchase confirmed
    // ------------------------------------------------------------------------

    return res.status(200).json({

      unlocked: true,

      subject: subjectKey

    });


  } catch (err) {

    console.error(
      "check-purchase error:",
      err
    );

    return res.status(500).json({
      error: "Server error"
    });

  }

}