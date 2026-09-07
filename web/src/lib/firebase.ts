import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";

// Firebase's client-side config values are not secrets — they identify the project, not
// authorize access to it (that's what Firebase Security Rules / App Check are for) — so
// this is safe to ship in the browser bundle as-is, same as Firebase's own setup docs show.
const firebaseConfig = {
  apiKey: "AIzaSyD6XfRBHuQqhb4SNB3lW033EwaNeucYpKg",
  authDomain: "yummverse.firebaseapp.com",
  projectId: "yummverse",
  storageBucket: "yummverse.firebasestorage.app",
  messagingSenderId: "733915642455",
  appId: "1:733915642455:web:617f9e30c1238321cd8112",
  measurementId: "G-WXSNLGTSFL",
};

export const firebaseApp = initializeApp(firebaseConfig);

// isSupported() is Firebase's own recommended guard — getAnalytics() throws in
// environments it doesn't support (e.g. some in-app/webview browsers), so this resolves to
// null there instead of crashing the whole app on load.
export const firebaseAnalytics: Promise<Analytics | null> = isSupported().then((supported) =>
  supported ? getAnalytics(firebaseApp) : null,
);
