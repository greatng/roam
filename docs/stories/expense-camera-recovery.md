# US43 — recover expense drafts after camera interruption

Issue: https://github.com/greatng/wherewhere/issues/43

As a traveler, I want my unsaved expense draft to survive opening the receipt camera and an app reload, so I can finish without losing entered details.

1. Reproduce draft loss on reload; persist description, amount, date/time, payer and splits before invoking the native picker and after edits, scoped to signed-in user and trip.
2. Persist the compressed receipt Blob when delivered by the browser; restore the expense tab and open draft on return/reload. If the operating system kills the picker before delivering the image, restore fields and allow selecting the photo again; do not claim camera hardware recovery.
3. Do not submit a financial expense until Save. Clear draft after durable outbox save; retain draft after validation failure. Preserve account/trip isolation and existing sign-out/trip cleanup.
4. Add browser regressions for reload before/after receipt selection and save without duplicate expense; run relevant tests, lint and build.

No backend change. Native camera result cannot be recovered if the browser never delivers it. Use existing local database/cache cleanup paths.

## Reproduction

Mobile browser regression: fill expense fields, invoke Take photo, reload the page. Before the fix, `.expense-entry` is absent because the tab resets, and draft fields are only in the discarded DOM. This demonstrates the data-loss path; it does not establish why a particular physical phone returned home.

## Boundaries

The draft is local, scoped to current user and trip, and must follow existing sign-out and trip cleanup. Native camera results are recoverable only after the browser delivers the file. An unsaved draft is not a submitted expense or a pending financial operation.

## Verification

1. RED: the mobile camera-chooser/reload regression could not find the expense form before the fix. GREEN: desktop and mobile restore description, amount, date and time; no financial RPC runs before Save.
2. Both projects recover a delivered, compressed receipt after a second reload. Picker opens only after its draft write succeeds. Storage failures display an alert.
3. The outbox write and draft deletion share one IndexedDB transaction; old draft writes are invalidated first. Reload after successful save opens a blank new form and the financial operation count stays one. Draft Blob identity/trip isolation and cleanup have a unit regression. Existing offline, photo-only retry and sign-out flows remain green.
4. 44 focused desktop/mobile browser cases and 13 focused unit cases passed. Lint and production build passed (existing bundle-size advisory). No backend migration required. Actual camera hardware, OS process termination and iOS user activation after the draft-write await are not emulated.
