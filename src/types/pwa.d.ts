// Add TypeScript declarations for virtual modules provided by vite-plugin-pwa

declare module 'virtual:pwa-register' {
  export interface RegisterSWOptions {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onOfflineReady?: () => void;
    registerOnDemand?: boolean;
    scope?: string;
    selfDestroying?: boolean;
  }

  export function registerSW(options?: RegisterSWOptions): () => void;
}

declare module 'virtual:pwa-register/vue' {
  import { Component } from 'vue';
  const registerSW: Component;
  export default registerSW;
}
