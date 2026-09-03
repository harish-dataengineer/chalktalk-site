import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from
  "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";


const firebaseConfig = {

  apiKey: "AIzaSyDmWid8s3zTe8EHVegqKJMaHbMDvv92E1g",

  authDomain: "chalktalk-b1fd6.firebaseapp.com",

  projectId: "chalktalk-b1fd6",

  storageBucket: "chalktalk-b1fd6.firebasestorage.app",

  messagingSenderId: "108725937862",

  appId: "1:108725937862:web:0bdc230e85615d277117c7"

};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);


/*
|--------------------------------------------------------------------------
| Setup invisible reCAPTCHA
|--------------------------------------------------------------------------
*/

function setupRecaptcha() {

  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  window.recaptchaVerifier = new RecaptchaVerifier(
    auth,
    "recaptcha-container",
    {
      size: "invisible"
    }
  );

  return window.recaptchaVerifier;
}


/*
|--------------------------------------------------------------------------
| Send OTP
|--------------------------------------------------------------------------
*/

async function sendOTP(phoneNumber) {

  try {

    const appVerifier = setupRecaptcha();

    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      appVerifier
    );

    window.confirmationResult = confirmationResult;

    return {
      success: true
    };

  } catch (error) {

    console.error("OTP error:", error);

    // Reset reCAPTCHA after an error
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear();
      window.recaptchaVerifier = null;
    }

    return {
      success: false,
      error: error.message
    };

  }

}


/*
|--------------------------------------------------------------------------
| Verify OTP
|--------------------------------------------------------------------------
*/

async function verifyOTP(code) {

  try {

    if (!window.confirmationResult) {
      throw new Error(
        "OTP session not found. Please request OTP again."
      );
    }

    const result =
      await window.confirmationResult.confirm(code);

    const user = result.user;

    // Firebase ID token used by our backend
    const idToken = await user.getIdToken();

    // Store temporarily in browser memory/session
    sessionStorage.setItem(
      "chalktalk_firebase_token",
      idToken
    );

    return {

      success: true,

      phone: user.phoneNumber,

      uid: user.uid,

      idToken: idToken

    };

  } catch (error) {

    console.error(
      "OTP verification error:",
      error
    );

    return {

      success: false,

      error: error.message

    };

  }

}


/*
|--------------------------------------------------------------------------
| Make functions available to normal HTML scripts
|--------------------------------------------------------------------------
*/

window.sendOTP = sendOTP;

window.verifyOTP = verifyOTP;

window.firebaseAuth = auth;


console.log(
  "Firebase authentication initialized successfully"
);