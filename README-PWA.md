# PWA / Standalone Presentation Mode

This app is installable as a PWA and runs in standalone mode (no browser chrome) for the wallet → transfer → proof flow.

## Build artifacts

`pnpm --filter web build` produces in `packages/web/dist/`:
- `manifest.webmanifest`
- `sw.js` (and Workbox runtime)
- `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon.png`

## Local preview

```bash
pnpm install
pnpm --filter web build
pnpm --filter web preview --host
```

**Do NOT demo from a LAN IP over plain HTTP.** Install prompt and standalone mode require HTTPS (or localhost).

## HTTPS for device install (required)

Deploy `packages/web/dist/` to an HTTPS host (Vercel / Netlify / Cloudflare Pages), or tunnel the preview:

```bash
pnpm --filter web build
pnpm --filter web preview --host --port 4173
# in another terminal
cloudflared tunnel --url http://localhost:4173
```

Open the tunnel HTTPS URL on the demo phone.

## Manual install & verification

1. Open the HTTPS URL in Safari (iOS) or Chrome (Android).
2. Install to home screen.
   - **iOS:** Share → Add to Home Screen.
   - **Android:** browser menu → Install app / Add to Home screen.
3. Launch from the home-screen icon.
4. Confirm: no URL bar, no browser chrome, splash/background matches (white), safe-area insets respected on notch devices.
5. In-app flow: WhatsApp → minimize → tap Ticketmaster icon → wallet → transfer → verify.
6. Confirm sender QR still resolves to sender history after transfer (non-destructive transfer requirement intact).

## Standalone UI behavior

- `isStandalone()` returns true in installed/display-mode standalone contexts.
- Safe-area insets applied to top bar and bottom/main content in standalone mode.
- Install banner shown only in browser mode; dismissal stored in `localStorage['pwa-banner-dismissed']`.
- Service worker: `autoUpdate`, navigation fallback to `/index.html`, NetworkFirst caching only for `/api/events` (no caching of `/api/transfers` or `/api/tickets` mutations).

## Automated checks

Playwright spec: `packages/web/tests/pwa.spec.ts` (expects running preview at `http://127.0.0.1:4173` with built assets).

```bash
pnpm --filter web build
pnpm --filter web preview --host --port 4173 &
npx playwright test packages/web/tests/pwa.spec.ts --config e2e/playwright.config.cjs
```

(Adjust config/baseURL if running outside the existing e2e harness.)
