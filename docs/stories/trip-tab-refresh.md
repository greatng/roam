# US45 — retain trip tab on refresh

Issue: https://github.com/greatng/wherewhere/issues/45

As a traveler, I want refresh to keep my selected trip tab instead of always opening Expenses just because an unsaved draft exists.

1. Reproduce a saved expense draft forcing Expenses after selecting Itinerary and refreshing. Retain the selected tab per browser session, user and trip; default to Overview when no valid preference exists.
2. Restoring a draft must not navigate away from the selected tab. Opening Expenses still restores the fields/photo and open form; refreshing while in Expenses preserves recovery. Senior view stays on Overview.
3. Cover the regression and existing draft recovery on desktop/mobile; run focused checks. No backend or changes to existing storage identifiers.

## Evidence

The new mobile regression failed before the change: refreshing Itinerary with a saved draft marked Expenses current instead. It passes after removing the draft's navigation override and remembering a validated tab in sessionStorage scoped by user/trip. No preference or invalid/unavailable storage defaults to Overview.

Six focused desktop/mobile browser cases pass: refresh preserves Itinerary, Trip and Overview despite a draft; opening Expenses retains draft fields; refreshing Expenses retains the photo/save recovery flow; Senior view remains on Overview. Lint and production build pass (existing bundle-size advisory). No backend changes.
