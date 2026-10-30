# ScopeClear UI/UX redesign handover

Each of the eight requested sections has its own commit. A separate regression-test commit covers the financial example and mutually exclusive job counts.

## Before / after

1. **Data consistency:** Separate job and quote display lifecycles and shared badges replace conflicting raw status labels. Jobs now uses the same confirmed, GST-inclusive cost basis as Profitability. Quote values default to ex GST; inclusive amounts are labelled. Margins remain neutral “Costs so far”.
2. **Design system:** Team management now shares the main shell, grouped navigation, typography and amber/outlined controls. Shared PageLayout and functional global search align management routes. Public/client, auth, demo and employee layouts remain separate.
3. **Job detail:** Quote/Costs/Timesheets/Invoices/Variations/Activity are primary tabs; other existing tools remain under More. Labelled Actions, quote-status-specific actions, a visible saved reference input and readable sanitized lists replace the former mixed controls.
4. **Lists:** Jobs have labelled sorting, status counts and next actions; Quotes have search/filter/create navigation; Clients have details, job counts and deduplicated current quote totals; Profitability has known-revenue-aware totals, estimates and Costs links.
5. **Team:** Team-member list first, creation drawer, per-member actions and confirmed removal. Admin rates are hidden until revealed. Saved invitation delivery/history is not available from the current Team response.
6. **Dashboard:** Linked, filtered statistics; recorded unpaid/overdue invoice totals; actionable attention items; primary New Job and secondary export; linked, timestamped activity.
7. **Global quality:** Clearer skeleton/error/empty states, keyboard focus and dialog handling, larger text/touch controls and compact in-flow Help. Specialized public/employee layouts were not merged into management navigation.
8. **Variations:** Existing real scope-change records are surfaced through job tabs and dashboard counts. Links select and focus the saved variation; no placeholder product or new model was created.

## Numeric example

These are the example values supplied in the brief, verified with regression fixtures—not a claim that current live accounts contain those figures.

- Quote list: **$29,810 inc GST, unlabelled → $27,100.00 ex GST**.
- Jobs profit/margin: **$26,410.04 / 97.5% → $26,341.03 / 97.2%**, matching Profitability.
- Profit: ex-GST revenue minus recorded GST-inclusive confirmed costs. Draft costs remain excluded; receipts are not automatically uplifted by 10%.
- Overdue invoice totals are a subset of recorded unpaid totals, not an additional amount to add. Partial payments are not tracked.

## Not implemented without further approval/data

- Standalone client persistence and phone fields: contacts currently derive from projects.
- Real job archiving: no archive state exists; Archive is not replaced by Delete or Completed.
- Room/area-based grouping: no saved area field exists; current category grouping remains.
- A final-cost certification flag: margins are not presented as final without evidence.
- Persistent invitation-history/delivery badges: accepted accounts and invites sent in the current view can be identified, but historical pending invitations are not in the current response.

No database, authentication or permission changes were made for this redesign. Existing stored quote/receipt values were not rewritten.

## Verification

- Production build passed.
- Existing costing API/calculation suite: 14 tests passed.
- New financial/status consistency suite: 5 tests passed.
- Actual management app components with isolated synthetic services: 36 route/viewport checks passed, including primary pages, Team routes and job tabs at 375px and 1280px. No horizontal overflow or runtime page errors in those scenarios.
- Employee/owner/admin timesheet edit, review, reopen and confirmed-delete interactions passed at 320px, 390px and 1280px.
- Receipt camera-selection, scanning, editable review, saved items and view/edit layouts passed at phone/desktop widths. Public entry routes also passed the existing 320px layout checks.
- Live signed-in user data/UI were not verified. The unauthenticated screenshot correctly redirects to sign-in.
- Full application TypeScript checking still reports nine errors in existing unrelated code. Build success is not a claim that full TypeScript checking passed.

Republishing is required to make this workspace version live.

## Round 2 — Section 1: team and employee maintainability

- Formatted the Team and Employee portal modules with the repository's Prettier, preserving their existing named exports, hooks, request paths, state transitions, and route behavior.
- Extracted shared employee page heading, empty-state and photo-gallery components under `src/components/employee/`; extracted the scheduled-team assignment list, team updates panel, permission card and audit trail under `src/components/team/`. The original portal modules remain the compatibility entry points.
- Replaced the status badge palette with semantic `success`, `warning`, `destructive`, `info`, and muted tokens. Added the `info` theme token and adjusted warning/destructive token shades so foreground text remains readable on tinted status surfaces.
- Replaced key hard-coded palette classes with semantic theme tokens in the team/employee portals, shell, dashboard, project list, invoice statuses, job section menu, and job-costing views. No business logic, calculations, data models, permissions, or server behavior changed.
- Verification: production build passed. Employee portal, invitation, and timesheet-total suites passed (23 tests). `timesheetManagement.browser.mjs` passed all employee/owner/admin workflows at 320px, 390px and 1280px. `mobileLayout.browser.mjs` passed receipt and entry layout checks at 320px, 360px, 390px, 768px and 1280px. The `jobSectionMenu.test.tsx` suite could not initialize in Bun's non-browser environment because the existing Supabase client reads `localStorage` at module load.
