# US46 — Roam #R monogram

Issue: https://github.com/greatng/wherewhere/issues/46

As a traveler, I want a stylish, sleek #R monogram so Roam has a recognizable modern identity.

1. Replace the visible header wordmark with a custom SVG #R mark, preserving accessible Roam name and home navigation.
2. Apply matching artwork to favicon, installable PWA and Apple icons; retain existing app name/storage identifiers, compact header and light/dark readability. Use geometric vector paths rather than font-dependent glyphs.
3. Verify production build/lint, review phone screenshots in light/dark and refresh branded icon assets. No other functional changes.

Design direction: geometric slanted hash and strong R, muted sage/ink palette, generous space, restrained rounded app-icon tile.

## Delivery and verification

Custom geometric paths pair a slanted sage hash with a bold R; no font dependency. The header preserves the accessible Roam home link, keyboard target and compact size. The install icon uses ivory/sage on an ink tile; maskable artwork remains inside the central safe zone. Existing names, preference keys and database identifiers are untouched.

Shared path source: `src/shared/brand.ts`. Regenerate favicon and PNG assets with Node 24: `node scripts/generate-brand-icons.mjs` from the repository root. All existing manifest icon paths remain stable.

Four desktop/mobile browser cases pass, covering accessible keyboard navigation, itinerary/expense flows and light/dark overflow checks. Header and viewport screenshots were captured and inspected in both themes. Lint/build pass, with the existing bundle-size advisory. SVG XML parses successfully. Launcher icon refresh depends on the installed browser/OS cache.
