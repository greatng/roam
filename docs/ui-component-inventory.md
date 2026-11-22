# Roam UI component inventory

Tracked in [issue #67](https://github.com/greatng/wherewhere/issues/67). The inventory covers the app shell, both entry routes, the trip picker and five trip sections, and the controls rendered inside them.

The implementation starts from `main` after #64. PR #66 merged into the former #64 branch after #64 had reached `main`, so this branch carries forward its two spacing and editor-action commits.

## Catalog evaluation

- **Buttons and appearance.** Roam already uses the Preact adaptation of the 21st Button and native three-option appearance controls based on the 21st theme component. `IconButton` composes the existing button, requires an accessible name and defaults to a non-submit action. The theme settings retain radio semantics and system preference. [Button](https://21st.dev/@shugar/components/button-1) · [Theme Toggle](https://21st.dev/@campsite/components/theme-toggle) · [Existing source references](../vendor/21st/README.md)
- **Action menus.** The shadcn dropdown demo uses React, Radix and Lucide. It offers keyboard handling and collision-aware placement. Roam has two bounded menu placements and working Preact focus handling, so the floating organizer actions now use the same `OverflowMenu` as record actions. This keeps anchored and floating appearance rules local and gives both paths one implementation of menu keyboard behavior. [Dropdown Menu](https://21st.dev/@shadcn/components/dropdown-menu)
- **Disclosures, form inputs and dialogs.** The catalog accordion and dialog examples add component trees for managed panels and modal focus. Roam's disclosures rely on native `details` and `toggle` events to scroll to inline editors. Text, date, time, file, select, checkbox and radio inputs use native validation and mobile pickers. Account is a non-modal panel with a radio group, and destructive confirmations use existing inline forms or browser prompts. Native controls keep their own semantics and avoid maintaining a second set of form and focus contracts. [Accordion](https://21st.dev/@shadcn/components/accordion) · [Dialog](https://21st.dev/@shadcn/components/dialog)

The official `21st review src` and JSON scan were used with the checked-in design context. CLI catalog search returned a sign-in requirement. The public examples and checked-in source snapshots supplied the evaluation. No upstream code or dependency was added. That keeps the existing palette, CSS and licensing footprint, avoids a React compatibility and update burden, and leaves one local menu implementation to test.

## Coverage and decisions

| Surface | Components and states | Decision |
| --- | --- | --- |
| Shell and account | Brand link, language toggle, quick theme button, account popover, appearance chooser, sign-out warning and PWA update notice | Account and quick theme use `IconButton` with the existing SVGs. `Button`, `ThemeChoice` and `RoamLogo` already serve as primitives. Keep preference storage, sign-out confirmation and update lifecycle in their owners. |
| Home and invitation route | Join-by-code/link with invalid and corrected submissions, direct join acknowledgment and install help, email code request/verify/resend, pending and declined access, create-trip editor | Reuse existing buttons and native form elements. Invitation validation, account lifecycle, acknowledgement order and editor focus have separate behavior. |
| Trip picker and navigation | Empty and populated lists, active/archived cards, selected header, horizontal tab row, Senior mode | Keep trip summaries, selection and scrolling in the trip feature. These are navigation controls with trip and preference state, not a generic ARIA tabs widget. |
| Overview and stop editor | Date navigation, current and next stops, itinerary list, free/end/loading/error variants, accommodation and contact disclosures, street directions, edit/remove and inline add/edit stop | Day and record icon actions use `IconButton`. Share transport choices with Plan, retaining the stop editor's English option text and allowed values. Keep date navigation, offline and Senior behavior in the feature. |
| Itinerary and Accommodation | Day timeline, activity and lodging cards, city/night, accommodation and activity editors, organizer and record menus, itinerary PDF export | Use `OverflowMenu` for the organizer trigger and record menus, `PlanEditorActions` for all three editor footers, and `TransportSelect` for destination/activity options. Keep time formatting, activity pills and categorized PDF generation in Plan. |
| Expenses and receipts | New/correct expense editors, split inputs, balances, settlements, payment confirmation, correction history, delete confirmation, private receipt picker, pending upload/retry/cleanup and offline draft | Expense delete uses `IconButton`. Draft and attachment flows share `ReceiptSourcePicker` and `ReceiptPreview`, including size text and alt text. They retain distinct persistence, cleanup, ownership and action state. |
| Preparation | Trip and personal checklists, empty/loading/error states, add/edit/remove, locally persisted checks | The two lists already share the feature-local `Checklist`. Their icon actions use `IconButton`. Keep edit state, privacy and sharing rules with Preparation. |
| Trip and organizer settings | Emergency contact editor, membership and permissions, join actions, reusable invite forms and QR panel, guest recovery, archive/restore and typed delete | Reuse the project buttons and disclosures. Keep QR contrast, confirmation copy, authorization and mutation handling local. |
| Cross-cutting states | Offline notice and queue, pending operation counts, loading/error/empty messages, focus on newly opened editors | Use existing status/alert roles and `editor-navigation`; keep language, severity and retry behavior with each workflow. A common state wrapper would obscure which live-region semantics apply. |

## Verification

- Chromium fixture screenshots cover sign-in and join entry, account, picker, Overview, Itinerary, Accommodation and its editor, Expenses, Preparation and Trip at 320/1280 px in English/Thai and light/dark.
- Interaction coverage checks keyboard opening and movement in the organizer and record menus, Escape focus restoration, outside dismissal, reduced motion, editor saves and cancellation, icon touch targets, and receipt previews.
