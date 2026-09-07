// §40A's backgrounded/closed-app push channel. Handles messages FCM delivers while this
// site isn't the focused tab — foreground messages are handled separately in
// src/lib/pushNotifications.ts, since onMessage() only fires while a tab is open.
//
// Service workers can't import the app's ES module bundle, so this duplicates the same
// (non-secret — see src/lib/firebase.ts) config via the classic compat SDK build instead.
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyD6XfRBHuQqhb4SNB3lW033EwaNeucYpKg",
  authDomain: "yummverse.firebaseapp.com",
  projectId: "yummverse",
  storageBucket: "yummverse.firebasestorage.app",
  messagingSenderId: "733915642455",
  appId: "1:733915642455:web:617f9e30c1238321cd8112",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? "Yummverse";
  const body = payload.notification?.body ?? "";
  self.registration.showNotification(title, { body, data: payload.data });
});
