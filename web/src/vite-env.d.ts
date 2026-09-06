/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin for API calls in production (e.g. https://api.example.com) — left unset
   * in local dev so requests stay relative and go through Vite's dev-server proxy. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
