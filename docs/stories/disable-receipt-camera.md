# US44 — disable direct receipt camera capture

Issue: https://github.com/greatng/wherewhere/issues/44

As a traveler, I want the unreliable direct camera action removed so I can attach an existing receipt image without an unsuccessful camera return.

1. Remove Take photo and its capture input from new and saved expense receipt controls in both languages. Keep Choose file with no forced capture.
2. Preserve existing image compression, previews, private upload, draft recovery, receipt removal and financial saving. No schema change.
3. Update browser regressions to verify the absence of direct camera controls in both flows and continued file selection, compression and draft recovery on desktop/mobile. Update setup guidance and review screenshots.

Scope: disable the app's direct camera integration. Native system file pickers may independently offer their own camera choice; that is controlled by the OS/browser.

Verification: AC1 passes by removing the shared camera button/input (both languages) and asserting no direct camera controls or capture attribute in both forms. AC2–AC3 pass in eight focused desktop/mobile browser cases covering file chooser events, compressed previews, private receipt save/view/removal and draft recovery across reload. Lint and production build pass; the existing bundle-size advisory remains. Updated new-expense and attachment screenshots show the file-only controls. No backend migration or physical-camera fix is claimed.
