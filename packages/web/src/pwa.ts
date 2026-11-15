import { registerSW } from "virtual:pwa-register";

export const swReady = registerSW({
  immediate: true,
  onNeedRefresh() {
    /* silent autoUpdate */
  },
  onOfflineReady() {
    /* silent */
  },
});

export const isStandalone = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true;
