/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Deployed API origin. Empty in dev — requests go through the Vite /api proxy. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
