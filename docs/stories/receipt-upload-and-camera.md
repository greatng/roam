# US41 — receipt upload authorization

Issue: https://github.com/greatng/wherewhere/issues/41

As an approved traveler, I want a receipt chosen with a new expense to upload successfully without a row-level-security error.

AC1: Reproduce the failing write stage against the actual Supabase Storage request lifecycle, including permission checks before object metadata is populated. Fix the confirmed cause without making the bucket public or widening access beyond the current approved uploader/path/trip/expense rules.
AC2: Keep JPEG-only and 512 KiB bucket limits, uploader ownership, active/non-deleted expense checks, immutable paths and finalization checks for actual file MIME/size. Unapproved/removed members, outsiders and other uploaders remain denied.
AC3: Existing financial confirmation and receipt retry preserve the saved expense and stable receipt ID. Tests reflect Storage permission probes as well as final stored metadata, with browser and database regressions. Improve the user-facing access error without leaking tokens or private content.

# US42 — receipt source choices

Issue: https://github.com/greatng/wherewhere/issues/42

As a traveler, I want explicit File and Camera choices for receipts so I can select an existing image or take a new photo on my phone.

AC1: Both the new-expense form and saved-expense attachment UI offer accessible Choose file and Take photo actions. File does not force capture; camera uses the environment-facing capture hint. Native support/fallback remains browser-dependent.
AC2: Both sources share the same supported JPEG/PNG/WebP compression, preview, removal, busy/error and offline behavior. Preserve the existing private-upload and durable new-expense queue flow.
AC3: Verify both chooser configurations and file processing on desktop/mobile, retain keyboard access and 44px targets, and refresh a review screenshot. No external camera app integration or extra camera permissions beyond the native picker.

## Diagnosis

Supabase Storage performs an INSERT permission probe before writing the file. Its upload authorization metadata includes `mimetype` and `contentLength`, not final `size`. Requiring final metadata in INSERT RLS rejects an otherwise authorized upload. The new migration checks identity, exact pending path, approved membership, active trip and non-deleted expense. Private bucket JPEG/512 KiB limits and the finalization trigger still verify actual stored MIME and byte size.

Primary source: [Storage uploader](https://github.com/supabase/storage/blob/master/src/storage/uploader.ts), `authorizeUpload` and `upload`.

Native camera capture is a browser hint. Physical camera behavior requires a real-device check; desktop browsers may offer their ordinary file chooser.

## Verification and delivery

- US41 AC1: reproduced the original denial in PGlite using Storage's permission-probe metadata; new policy passes that regression and an empty-metadata probe.
- US41 AC2: unauthorized uploader, removed member, outsider, wrong path and deleted-expense probes remain denied. Actual PNG/mismatched-size finalization remains rejected; matching JPEG succeeds. Bucket remains private/JPEG-only/524288 bytes.
- US41 AC3: existing browser regressions verify durable Blob reload, stable financial confirmation and photo-only retry. Confirmed-expense permission failures now explain that the expense is already saved.
- US42 AC1–AC3: desktop/mobile native filechooser tests verify both buttons in both forms, capture attributes and shared compressed previews. Hidden inputs are excluded from keyboard tab order; visible shared buttons retain 44px targets. Updated phone screenshot was inspected.
- Full verification: 86 unit/database tests passed; 85 browser tests passed and one desktop-only skip was intentional; lint and production build passed. Existing bundle-size advisory remains.
- Hosted migration applied to bsuzmybuskeadtofvjbz and the effective Storage INSERT policy was read back. No real traveler data was modified to test it. Physical-camera and hosted authenticated upload need device confirmation.
