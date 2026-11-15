# US39 — receipt at expense creation

Issue: https://github.com/greatng/wherewhere/issues/39

As a traveler, I want to choose an optional receipt while adding an expense so I can save the amount and photo in one flow.

AC1: New expense form has an optional receipt picker, compression status, preview and remove-selection control. Reuse existing image type/size/dimension validation and compression. Saving is disabled during compression and preserves form/photo on validation failure.
AC2: Store the compressed photo with the existing owner-scoped IndexedDB expense operation, not in the financial RPC payload. Offline saves retain both across reload and sign-out/discard cleanup follows existing outbox ownership rules.
AC3: Sync creates the expense once using its existing operation ID, persists its confirmed expense ID, then attaches the receipt. After financial confirmation, photo retries never re-create or re-apply the expense; partial failures show that the expense is saved but receipt pending. Upload uses one stable receipt ID and existing private access policies.
AC4: Removing or discarding a pending photo does not delete the confirmed expense. Existing attach/view/remove flows, currency validation and destination date defaults remain supported. Cover create-with-photo, offline persistence, upload retry without duplicate expense and meaningful mobile/desktop review.

# US40 — delete incorrect expenses

Issue: https://github.com/greatng/wherewhere/issues/40

As a trip organizer, I want to delete an incorrect expense so the group balances reflect the remaining expenses.

AC1: Organizer-only Delete expense action with confirmation. Cancellation makes no write. Approved guests, including plan editors, cannot delete expenses. Allow deletion on active trips only, consistent with existing corrections.
AC2: Server checks organizer, trip membership, expense/trip identity and expected version. Version conflicts must not remove receipt files or silently delete an expense changed elsewhere. Keep original operation IDs reserved after deletion so a delayed offline create replay cannot resurrect the expense.
AC3: Exclude deleted expenses from active lists/balances while retaining financial correction history for auditing. Preserve recorded settlements; do not silently undo real payments. Remove receipt files through Storage API and receipt metadata with retry-safe cleanup; pending upload state cannot recreate an attachment on a deleted expense.
AC4: Update lists/balances after deletion and report cleanup failures honestly. Cover authorized deletion, cancellation, permissions/version errors, settlement/balance correctness, receipt cleanup and stale offline replay in database/browser tests. No deletion of real user data during deployment verification.

## Verification

The complete local suite passes 83 E2E cases with one intentional desktop skip for a mobile-only capture, and 86 unit/database tests. Build and lint pass. Browser tests verify new-expense photo submission, compressed Blob/operation ID persistence across reload, receipt-only retry after a durable financial acknowledgement, cancellation, authorized deletion, cleanup failure/retry and guest/editor restrictions. Database tests verify organizer/version/trip guards, retained history, exclusion from both sides of balances, unchanged recorded settlements, rejection of stale creates/corrections, and deleted-receipt access/cleanup policies. No real user expense was deleted during verification.

Expense removal uses a retained tombstone rather than dropping the original operation ID. This prevents an old offline operation from resurrecting a deleted expense. Receipt files are removed via Storage after the authorized version-checked financial deletion; if cleanup fails, the organizer can retry it separately. A group member who is neither receipt uploader nor organizer cannot download a deleted expense’s receipt while cleanup is pending.

## Hosted setup

Migration `20261115060549_delete_expenses.sql` is applied to project `bsuzmybuskeadtofvjbz`. Read-only verification confirms the deletion columns and balance filtering, denies unauthenticated deletion, and confirms the moved private correction implementation is not executable by authenticated clients. The public deletion RPC enforces organizer identity, active trip, matching expense/trip and optimistic version internally. Deployment verification did not delete or alter a real expense.
