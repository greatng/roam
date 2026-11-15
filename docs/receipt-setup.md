# Expense receipt photos

New expenses default to today in the trip destination timezone, including expenses recorded before or after the trip. The date stays optional and editable; clearing it also clears optional time. Existing expense corrections retain their recorded date.

When adding an expense, choose an optional receipt under **Receipt photo (optional)**, inspect its compressed preview and select **Save expense**. You can also add a photo later by opening **Attach receipt** on a synced expense and selecting **Save receipt**. The browser re-encodes the image as JPEG, removes source metadata and scales it to at most 1600px on its longest edge. Uploads must fit within 512 KiB. Source files over 20 MiB, images over 40 megapixels, unsupported formats and undecodable images are rejected. HEIC and PDF are not supported; export a JPEG first. One receipt is supported per expense.

Photos need a connection to upload. Receipts chosen in the new-expense form are stored as compressed Blobs with the owner-scoped IndexedDB expense operation, so offline save and page reload retain both the financial entry and photo. Sync confirms the expense once, stores its confirmed ID, and then uploads the receipt. If the photo fails, **Expense saved; receipt pending** and **Retry receipt upload** indicate that only the photo is waiting; retry does not create another expense. Discarding that pending upload removes its local copy, not the confirmed expense. Sign-out clears pending local photos with the existing outbox cleanup. A pending server attachment can still be removed from its expense card.

Photos selected later on an already saved expense remain a temporary preview until uploaded. A pending server attachment can be retried by its uploader or removed by its uploader or organizer. After reopening the app, use **Retry save** to recover an uploaded file awaiting confirmation, or select the original image to retry a missing file. Remove the pending attachment first if choosing a different image.

Approved trip members can view receipts and attach a missing receipt. The uploader and organizer can remove a receipt; plan-editing permission does not grant receipt administration. Views download through authenticated Storage access and use temporary browser URLs, never public links. Replacing a receipt requires removing it first.

## Supabase setup

Review and apply migration `20261114144759_expense_receipts.sql` after the existing migrations, using the normal migration deployment or Dashboard SQL Editor if the project uses manually maintained migration history. Do not replay previous migrations blindly. No Docker is required for the Dashboard route.

The migration creates a private `expense-receipts` bucket limited to `image/jpeg` and 524288 bytes, receipt metadata with one row per expense, approved-membership policies and uploader/organizer removal policies. Generated UUID paths contain no original filename. Metadata identity cannot be changed. A receipt becomes ready only when a matching stored JPEG with the expected byte size exists.

Files must be removed using the Storage API before deleting metadata. Database deletion guards enforce that ordering, including trip deletion cascades. The app removes a trip's receipt files before its organizer-confirmed deletion RPC. If a cleanup request fails, trip deletion stops and can be retried; some files may already have been removed as part of the explicitly requested permanent deletion. Do not delete Storage metadata directly with SQL, which does not remove the actual files.

The Storage service enforces MIME and byte limits. Client compression is for bandwidth/readability, not an authorization boundary. No OCR, public sharing, automatic financial interpretation or multiple-photo support is included.

## Hosted verification

The migration is applied to project `bsuzmybuskeadtofvjbz`. Read-only checks confirm `public=false`, JPEG-only uploads, the 524288-byte bucket limit, anonymous table access denied, immutable object paths and status-only finalization privileges. The Storage service has three scoped receipt access policies. No real receipt or expense was created, changed or deleted to verify deployment.


## Delete an expense

Organizers can use the trash icon labelled **Delete expense** on an active trip, then confirm. A version-checked server call removes the expense from active lists and balances; correction history and its operation ID are retained to prevent stale offline operations from recreating it. Recorded settlements are preserved because they represent real payments. Guests and plan editors cannot delete expenses.

Receipt files and metadata are cleaned after financial deletion. If cleanup fails, **Receipt cleanup pending** and **Retry receipt cleanup** let the organizer finish it without restoring the expense. The uploader and organizer retain cleanup access; other members cannot download the deleted receipt. Apply migration `20261115060549_delete_expenses.sql` after the receipt migration before deploying this frontend. Existing installations should review migration history before applying it, using the normal CLI workflow or the Dashboard SQL Editor.

### Upload permission probe fix (US41)

Apply `20261115082235_receipt_storage_permission_probe.sql` after the earlier migrations. Storage authorization happens before final object size is available; do not add final-size checks to the INSERT policy. Keep the private bucket MIME/size limits and ready-finalization trigger.

Both receipt forms offer **Choose file** and **Take photo**. Camera capture depends on native browser/device support and falls back to its picker. Both paths use the same compression.

### Camera interruption recovery (US43)

New-expense fields are stored locally under the signed-in user and trip as they change. The picker waits for a draft write before opening; compressed photos are stored when the browser delivers them. Reloading restores the Expenses tab and opens the draft. Saving atomically moves the expense/photo into the existing outbox and removes the draft. Signing out or clearing trip data removes the local draft through the existing private-cache cleanup.

If the operating system terminates the camera/browser before returning its file, the app cannot recover that undelivered image. Reopen the draft and choose the photo again. A recovered draft is not submitted until Save expense is pressed. Local-storage errors display a warning; keep the page open if preservation fails.
