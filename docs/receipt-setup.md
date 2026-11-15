# Expense receipt photos

New expenses default to today in the trip destination timezone, including expenses recorded before or after the trip. The date stays optional and editable; clearing it also clears optional time. Existing expense corrections retain their recorded date.

After an expense has synced, open **Attach receipt** in its card. Choose a JPEG, PNG or WebP image, inspect the compressed preview, and select **Save receipt**. The browser re-encodes the image as JPEG, removes source metadata and scales it to at most 1600px on its longest edge. Uploads must fit within 512 KiB. Source files over 20 MiB, images over 40 megapixels, unsupported formats and undecodable images are rejected. HEIC and PDF are not supported; export a JPEG first. One receipt is supported per expense.

Photos need an internet connection. Financial expenses continue to queue offline; attach the photo after the expense syncs. A selected compressed preview remains available in the open app after a connection failure, but photos are not persisted in the offline outbox. A pending attachment can be retried by its uploader or removed by its uploader or organizer. After reopening the app, use **Retry save** to recover an uploaded file awaiting confirmation, or select the original image to retry a missing file. Remove the pending attachment first if choosing a different image.

Approved trip members can view receipts and attach a missing receipt. The uploader and organizer can remove a receipt; plan-editing permission does not grant receipt administration. Views download through authenticated Storage access and use temporary browser URLs, never public links. Replacing a receipt requires removing it first.

## Supabase setup

Review and apply migration `20261114144759_expense_receipts.sql` after the existing migrations, using the normal migration deployment or Dashboard SQL Editor if the project uses manually maintained migration history. Do not replay previous migrations blindly. No Docker is required for the Dashboard route.

The migration creates a private `expense-receipts` bucket limited to `image/jpeg` and 524288 bytes, receipt metadata with one row per expense, approved-membership policies and uploader/organizer removal policies. Generated UUID paths contain no original filename. Metadata identity cannot be changed. A receipt becomes ready only when a matching stored JPEG with the expected byte size exists.

Files must be removed using the Storage API before deleting metadata. Database deletion guards enforce that ordering, including trip deletion cascades. The app removes a trip's receipt files before its organizer-confirmed deletion RPC. If a cleanup request fails, trip deletion stops and can be retried; some files may already have been removed as part of the explicitly requested permanent deletion. Do not delete Storage metadata directly with SQL, which does not remove the actual files.

The Storage service enforces MIME and byte limits. Client compression is for bandwidth/readability, not an authorization boundary. No OCR, public sharing, automatic financial interpretation, offline photo queue or multiple-photo support is included.

## Hosted verification

The migration is applied to project `bsuzmybuskeadtofvjbz`. Read-only checks confirm `public=false`, JPEG-only uploads, the 524288-byte bucket limit, anonymous table access denied, immutable object paths and status-only finalization privileges. The Storage service has three scoped receipt access policies. No real receipt or expense was created, changed or deleted to verify deployment.
