/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SPACE_RELAY_URL?: string;
  readonly VITE_CANONICAL_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
