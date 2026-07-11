# Installing DiscipleSpaces (PWA)

DiscipleSpaces is a **Progressive Web App**. After you open it once over HTTPS (or `localhost` in development), you can install it to your home screen / app launcher for offline use.

## Production install (recommended)

1. Host the `dist/` folder (or your deploy URL) over **HTTPS**.
2. Open the site in a modern browser.
3. Wait for the service worker to register (Settings may show **Offline ready**).
4. Install using one of the methods below.

Local check:

```bash
npm run build
npm run preview
```

Then open the preview URL and install.

## Android (Chrome / Edge)

1. Open DiscipleSpaces in Chrome.
2. Tap the browser menu **⋮**.
3. Choose **Install app** or **Add to Home screen**.
4. Confirm.

Or use **Settings → Install DiscipleSpaces** when the in-app install button is available.

## iPhone / iPad (Safari)

iOS does not use the Android-style install prompt:

1. Open the site in **Safari** (not only an in-app browser).
2. Tap the **Share** button.
3. Scroll and tap **Add to Home Screen**.
4. Confirm the name (**Spaces** / DiscipleSpaces) and tap **Add**.

## Desktop (Chrome, Edge, Chromium)

1. Open the app URL.
2. Look for the **install icon** in the address bar, or the browser menu → **Install DiscipleSpaces**.
3. Or open **Settings** in the app and tap **Install DiscipleSpaces** when shown.

## After install

- Launch from the home screen / app list for a full-screen, standalone experience.
- Bible data and the app shell cache for offline use after the first successful load.
- All Space data stays in **this device’s** IndexedDB unless you export a Space Update.

## Troubleshooting

| Issue | What to try |
|--------|-------------|
| No install option | Use HTTPS (or localhost); complete first load; try Chrome/Edge/Safari as appropriate |
| iOS install missing | Use Safari Share → Add to Home Screen |
| Offline not ready | Open the app online once after deploy; check SW in DevTools |
| Old version after update | Close all tabs, reopen; `registerType: autoUpdate` refreshes the SW |

## Related

- In-app **Help & tutorial** (`/help`)
- Project `README.md` for development commands
