# US35 — clear itinerary day boundaries

Issue: https://github.com/greatng/wherewhere/issues/35

As a traveler, I want accent-coloured itinerary dates and clear day boundaries so I can immediately distinguish one day from the next.

AC1: Emphasize the existing Day N/date heading with a restrained accent colour and a visible boundary; keep numbered circles removed.
AC2: Work in light/dark themes, preserve readable contrast, compact spacing, day grouping, menus and destination-time semantics.
AC3: Inspect and refresh the mobile itinerary previews; no backend changes.

# US36 — default expense date

Issue: https://github.com/greatng/wherewhere/issues/36

As a traveler recording an expense, I want the date to default to today in my trip destination so I can log expenses without repeatedly picking the date.

AC1: New expense date defaults to destination-local today, regardless of the device timezone or selected itinerary day. Do not clamp it to trip dates.
AC2: Date stays editable and optional; clearing it clears/disables optional time. Time starts blank but enabled while a date is present. Saving/resetting a new expense restores today. Existing corrections preserve saved dates.
AC3: Cover the default across a destination/device date boundary, reset and clearing without changing offline idempotence or financial splits.

# US37 — compressed receipt photos

Issue: https://github.com/greatng/wherewhere/issues/37

As a trip participant, I want to attach a compressed receipt photo to a saved expense so the group can verify spending without large uploads.

AC1: One optional receipt per synced expense. Choose/capture JPEG, PNG or WebP; compress on-device to JPEG with longest edge at most 1600px, target <=512 KiB, remove image metadata by re-encoding, and never upload the original. Reject unsupported, oversized (>20 MiB), undecodable or still-too-large images clearly.
AC2: Receipt attachment requires a connection. Offline expense creation/retry remains unchanged and photos can be attached after sync. Show preview, compression/upload progress, useful failures and retry without duplicate attachment records. Only expense financial data is in the existing outbox.
AC3: Store images in a private Supabase Storage bucket with JPEG-only and 512 KiB limits; relate metadata to the correct trip/expense. Approved trip members can view receipts and attach a missing receipt. Only the uploader or organizer may remove one. Pending/removed members, outsiders and unauthenticated callers cannot read or upload. No public URLs, service credentials, EXIF or filenames identifying users.
AC4: Handle partial upload failures through a visible pending attachment that its uploader/organizer can retry/remove; do not overwrite another receipt. Remove files using the Storage API before metadata removal; clean receipt files during organizer trip deletion rather than silently orphaning them. Preserve expense history and balances.
AC5: Meaningful image compression, database/storage permission and browser upload/view/remove/error tests; setup instructions, migration, and mobile review capture. No OCR, PDFs, multiple photos, offline photo queue or receipt financial automation.

## Verification and delivery

US35 AC1–AC3: inspected light/dark mobile itinerary captures; the Day N and date share a contrast-checked accent, a clear left boundary and a subtle divider. Numbered circles remain removed. Existing day/menu flows pass.

US36 AC1–AC3: browser tests use UTC at a time when Bangkok has moved to the next date, verify destination-today defaults, editable/clearable dates, time clearing/disablement and reset to today. Offline expense and correction regressions pass unchanged.

US37 AC1: compression tests check JPEG/PNG/WebP headers before decode, reject excessive or unknown dimensions, paint transparent images on white, reject non-JPEG encoder fallbacks and bound output dimensions/bytes. Browser tests inspect actual uploaded JPEG bytes and dimensions. AC2/AC4: browser tests verify offline preview retention, one pending row across upload failure/retry, authenticated viewing, file-before-metadata removal and file cleanup before trip deletion. Database tests prove that a trip with a remaining receipt object cannot be deleted, and succeeds after cleanup. AC3: policies and column grants are exercised for approved members, uploaders, organizers, pending/removed members and outsiders; the bucket is private and JPEG-only. AC5: complete local results are 63 E2E cases passed, one intentional desktop skip for mobile capture, and 80 unit/database tests passed. Build and lint pass. Screenshots contain synthetic compression-test data; no private traveler records were used.

Separate security and requirement reviews were completed. The image preflight now fails closed when dimensions cannot be validated within a bounded header read. Production migration and read-only verification are recorded in [receipt-setup.md](../receipt-setup.md); real-device receipt upload using an actual trip has not been performed.
