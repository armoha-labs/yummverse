/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for API calls in production (e.g. https://api.example.com) — left unset
   * in local dev so requests stay relative and go through Vite's dev-server proxy. */
  readonly VITE_API_URL?: string;

  /** Firebase Console → Project Settings → Cloud Messaging → Web Push certificates. Push
   * notification registration is skipped entirely (not attempted-and-failed) when unset. */
  readonly VITE_FIREBASE_VAPID_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
