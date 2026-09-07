import { getMessaging, getToken, onMessage, isSupported, type Messaging } from "firebase/messaging";
import { firebaseApp } from "./firebase";

// From Firebase Console → Project Settings → Cloud Messaging → Web Push certificates.
// Without it, getToken() has no way to identify this app to FCM, so registration is
// skipped entirely rather than attempted and failed — same dev-friendly "optional,
// falls back gracefully" pattern as the backend's SMTP/Cloudinary/Firebase-admin config.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

let messagingPromise: Promise<Messaging | null> | null = null;

async function getMessagingInstance(): Promise<Messaging | null> {
  messagingPromise ??= isSupported().then((supported) => (supported ? getMessaging(firebaseApp) : null));
  return messagingPromise;
}

/** Requests notification permission, registers the service worker, and returns an FCM
 * device token — or null if push isn't configured/supported/permitted. Never throws; the
 * point is to degrade silently rather than block whatever screen called it. */
async function requestPushToken(): Promise<string | null> {
  if (!VAPID_KEY) {
    console.info("Push notifications: VITE_FIREBASE_VAPID_KEY isn't set — skipping registration.");
    return null;
  }
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const messaging = await getMessagingInstance();
    if (!messaging) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    return await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  } catch (err) {
    console.warn("Push notifications: failed to register.", err);
    return null;
  }
}

/** Foreground messages don't auto-show a system notification the way background ones do
 * via the service worker (onMessage() just hands you the payload) — this shows one
 * manually so foreground and backgrounded behavior match. */
async function listenForForegroundMessages(): Promise<void> {
  const messaging = await getMessagingInstance();
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    if (Notification.permission !== "granted") return;
    const title = payload.notification?.title ?? "Yummverse";
    const body = payload.notification?.body ?? "";
    new Notification(title, { body });
  });
}

/** Call once per session from a signed-in layout (staff) or an active customer session —
 * requests permission, gets a token, and registers it with the backend via whichever api
 * client (staff vs customer) the caller is using. Best-effort throughout: a user who denies
 * the permission prompt, or a backend call that fails, never blocks the screen that called it. */
export async function registerForPushNotifications(post: (path: string, data?: unknown) => Promise<unknown>): Promise<void> {
  const token = await requestPushToken();
  if (!token) return;

  try {
    await post("/notifications/register-token", { platform: "WEB", fcmToken: token });
  } catch (err) {
    console.warn("Push notifications: failed to register device with the backend.", err);
  }

  await listenForForegroundMessages();
}
