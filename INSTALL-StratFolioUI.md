# Install StratFolioUI

StratFolioUI is packaged as a Progressive Web App (PWA). Open the live app:

**https://toniree.github.io/stratfolio-app/**

## Android

Open the HTTPS URL in Chrome, then tap **Install app** when prompted. If the
prompt is not shown, open Chrome's menu and tap **Install app** or
**Add to Home screen**.

## iPhone or iPad

Open the HTTPS URL in Safari, tap **Share**, then **Add to Home Screen** and
confirm **Add**. Apple does not show the same automatic install prompt as
Android.

## Generate the install QR code

To regenerate the QR code from the source project, run:

```bash
npm run pwa:qr -- https://toniree.github.io/stratfolio-app/
```

This writes `StratFolioUI-install-qr.png` in the project root. The QR code and
the URL passed to the command are the install link to share.

The app must be served over HTTPS (except during localhost development) for its
service worker and installation support to work.
