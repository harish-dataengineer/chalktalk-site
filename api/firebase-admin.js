import { initializeApp, cert, getApps } from "firebase-admin/app";
import admin from "firebase-admin";

const privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (!privateKey) {
  throw new Error(
    "FIREBASE_PRIVATE_KEY environment variable is missing"
  );
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey.replace(/\\n/g, "\n")
    })
  });
}

export default admin;