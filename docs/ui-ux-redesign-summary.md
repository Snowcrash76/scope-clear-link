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
- At the end of Round 1, full application TypeScript checking reported nine errors. Round 2 resolves them and adds `npm run typecheck`.

Republishing is required to make this workspace version live.

## Round 2 — section log

### Section 1 — Team and Employee portal extraction

- **Before:** `TeamPortalUI.tsx` and `EmployeePortalUI.tsx` held large, intertwined route and panel implementations; the extracted components were too few to make the public files maintainable.
- **After:** kept the original modules as public compatibility facades and moved page views, dialogs, cards, lists, loading states, and shared portal helpers into focused `team/` and `employee/` modules. Existing routes, exports, API calls, permissions, and workflows were retained. Semantic status colors and responsive text/accessibility refinements were applied without changing calculations or server behavior.
- **Files changed:** `src/components/TeamPortalUI.tsx`; `src/components/EmployeePortalUI.tsx`; `src/components/employee/AssignmentCard.tsx`; `src/components/employee/EmployeeAccept.tsx`; `src/components/employee/EmployeeGate.tsx`; `src/components/employee/EmployeeHome.tsx`; `src/components/employee/EmployeeJob.tsx`; `src/components/employee/EmployeeLogin.tsx`; `src/components/employee/EmployeeNotifications.tsx`; `src/components/employee/EmployeeReviewQueue.tsx`; `src/components/employee/EmployeeTimesheets.tsx`; `src/components/employee/Empty.tsx`; `src/components/employee/LoadState.tsx`; `src/components/employee/NavigateEmployee.tsx`; `src/components/employee/PageTitleView.tsx`; `src/components/employee/PhotoGalleryView.tsx`; `src/components/employee/PortalLayout.tsx`; `src/components/employee/UnreadDot.tsx`; `src/components/employee/portalShared.ts`; `src/components/team/AssignmentEditDialog.tsx`; `src/components/team/AssignmentListView.tsx`; `src/components/team/AuditTrailView.tsx`; `src/components/team/PermissionCardView.tsx`; `src/components/team/ReviewDialog.tsx`; `src/components/team/ReviewPanel.tsx`; `src/components/team/TeamHome.tsx`; `src/components/team/TeamLoadView.tsx`; `src/components/team/TimeEntryEditor.tsx`; `src/components/team/UpdatesPanelView.tsx`; `src/components/team/portalShared.ts`.
- **Verification:** production build passed; 23 employee portal/invitation/timesheet-total unit tests passed; `timesheetManagement.browser.mjs` passed employee/owner/admin workflows at 320px, 390px and 1280px; `mobileLayout.browser.mjs` passed receipt and entry layouts at 320px, 360px, 390px, 768px and 1280px.
- **Skip/limitation:** the existing signed-in employee UI is not available to the unauthenticated screenshot browser.

### Section 2 — native popup replacements

- **Before:** document, employee, and team actions used native browser popups, interrupting the app's visual and keyboard flow.
- **After:** replaced the touched confirmations and prompts with accessible in-app dialog flows; clock-out and related team/employee actions remain on their existing handlers and permissions.
- **Files changed:** `src/components/DocumentsSection.tsx`; `src/components/EmployeePortalUI.tsx`; `src/components/employee/PhotoGallery.tsx`; `src/components/team/AssignmentList.tsx`; `src/components/team/UpdatesPanel.tsx`; `tests/employeePortal.browser.mjs`.
- **Verification:** production build passed. The existing browser suite was run and the team-member removal Escape/reopen scenario still fails: after dismissal, a body pointer event causes the menu to open and close before the next click. A non-modal dropdown and explicit dialog focus return were tried without fixing it; investigation stopped as requested.
- **Skip/limitation:** the failing menu-reopen scenario is documented rather than further iterated. No model, auth, permission, or server changes were made.

### Section 3 — accessibility and type safety

- **Before:** several icon-only actions, upload controls, and status surfaces had missing or weak accessible names, small text, or low contrast; the production TypeScript check was not clean.
- **After:** added accessible labels/tooltips and clearer input descriptions, improved text sizing and schedule contrast, and applied the nine requested type fixes plus the typecheck script. No business calculations, permissions, routes, or server paths changed.
- **Files changed:** `package.json`; `src/components/ClientDocumentsSection.tsx`; `src/components/DocumentUploadModal.tsx`; `src/components/DocumentsSection.tsx`; `src/components/ImageUpload.tsx`; `src/components/InvoiceSection.tsx`; `src/components/MultiImageUpload.tsx`; `src/components/RichTextEditor.tsx`; `src/components/StageManager.tsx`; `src/components/TimesheetSummary.tsx`; `src/components/TodaySchedule.tsx`; `src/components/job-costing/JobCostsTab.tsx`; `src/components/job-costing/ReceiptLineItemsEditor.tsx`; `src/components/job-costing/ReceiptReviewFields.tsx`; `src/components/job-costing/ReceiptScanControls.tsx`; `src/hooks/useCreateProject.ts`; `src/integrations/supabase/types.ts`; `src/lib/exportReport.ts`.
- **Verification:** `npm run typecheck` and production build passed; `timesheetManagement.browser.mjs` and `mobileLayout.browser.mjs` passed.
- **Skip/limitation:** the independent team-removal Escape/reopen failure remains as recorded in Section 2.

### Section 4 — client-facing project and quote experience

- **Before:** client project and quote screens were dense, harder to scan on phones, and did not provide a cohesive decision flow.
- **After:** redesigned the client project/quote surfaces for narrow screens, made accept/decline and request-change decisions explicit, retained the existing PDF generator, and used a same-page contact/request-change fallback rather than an invented endpoint. Existing calculations and approval permissions were preserved.
- **Files changed:** `src/components/client/ClientPortalHeader.tsx`; `src/pages/ClientProjectView.tsx`; `src/pages/ClientQuote.tsx`.
- **Verification:** typecheck and production build passed. `clientPages.browser.mjs` passed actual client project and quote components at 320px, 375px and 768px, invalid-link states, accept/decline persistence, PDF, and same-page change-request interactions.
- **Skip/limitation:** a real contact phone number cannot be safely obtained for an invalid/unknown client record; contact details are shown only when loaded. No additional expired-quote server blocking behavior was introduced or represented as implemented.

### Section 5 — ProjectManage and QuoteSection component split

- **Before:** `src/pages/ProjectManage.tsx` was 1,360 lines and `src/components/QuoteSection.tsx` was 1,309 lines, with header, tab content, quote line-item rendering, and totals embedded in each monolith.
- **After:** `ProjectManage.tsx` is 979 lines and keeps every route-level tab wrapper and existing route export; its focused header, notification, variation, and activity content are extracted to prop-driven components. `QuoteSection.tsx` is 1,064 lines and retains its public export; quote header/reference/status, editable and display totals, and included/approved line-item tables are separated into focused prop-driven modules. Cost calculations, status transitions, handlers, and permissions are unchanged.
- **Files changed:** `src/pages/ProjectManage.tsx`; `src/components/project-manage/ProjectActivityContent.tsx`; `src/components/project-manage/ProjectManageHeader.tsx`; `src/components/project-manage/ProjectManageNotifications.tsx`; `src/components/project-manage/ProjectVariationsTabContent.tsx`; `src/components/QuoteSection.tsx`; `src/components/quote/QuoteHeader.tsx`; `src/components/quote/QuoteLineItemsTable.tsx`; `src/components/quote/QuoteTotals.tsx`; `tests/jobSectionMenu.test.tsx`.
- **Verification after the ProjectManage split:** typecheck and production build passed; `jobSectionMenu.test.tsx` passed (3 tests) with a temporary in-memory `localStorage` preload for Bun.
- **Verification after the QuoteSection split:** typecheck and production build passed; `jobSectionMenu.test.tsx`, `newQuoteDraft.test.ts`, and `additionVariations.test.tsx` passed (10 tests total) with the same temporary preload. `clientPages.browser.mjs` passed actual client project and quote routes at 320px, 375px and 768px, including accept/decline, persistent decisions/PDF and same-page change-request flows.
- **Skip/limitation:** `quoteResponsive.test.tsx` requires `document.createElement` for the existing `RichTextContent` sanitizer and cannot run in Bun's non-DOM test environment. The browser client-route tests passed instead. Build output still reports the pre-existing stale Browserslist data and large-chunk warnings.

### Section 6 — proposals only

- **Before:** current records do not support a real client phone contact, an archive state, room/area quote grouping, or a final-cost confirmation flag.
- **After:** proposals only; no feature, schema, API, permission, calculation, or task-creation changes are made.
- **Client records and phone:** establish a client/contact record with validated phone data, consent and access boundaries; link existing jobs and plan migration of project-derived legacy contact details.
- **Archive state:** define archive/restore, list visibility and retention separately from completion or deletion; preserve historical quotes, invoices, costs and margin calculations.
- **Room/area grouping:** support optional named groups and an explicit sort order for quote items; retain existing ungrouped items and preserve quote totals/PDF behavior.
- **Final-cost flag:** define qualifying evidence, confirming actor/time, distinction between estimate and confirmed actual cost, and an audited reopen path.
- **Files changed:** `docs/ui-ux-redesign-summary.md` only. No implementation or data-model changes.
- **Verification:** documentation review only; obtain product approval before schema or workflow design.

### Final integration notes

- **Section 1:** removed remaining raw border/background colours from `ProjectsPage.tsx`, `TradeDashboard.tsx` and `job-costing/ProfitabilityPage.tsx`. Avatars now pair semantic backgrounds with their correct foregrounds instead of white on amber. Employee/Team destructive actions and employee brand marks also use matched token pairs.
- **Section 3:** raised remaining employee metadata/unread counters to at least 12px in `employee/{EmployeeAccept,EmployeeHome,EmployeeLogin,EmployeeTimesheets,PageTitle,PortalLayout,UnreadDot}.tsx`. Unread counters use info tokens. Client text uses dark foreground tokens instead of amber text on white.
- **Section 4:** `client/ClientChangeRequest.tsx`, `ClientProjectView.tsx` and `ClientQuote.tsx` now offer the same on-page “Request a change” dialog before and after a decision. It uses the existing `useProject.createChangeRequest` workflow, retains text if saving fails, and does not change the quote decision or price. The original image-capable project variation form remains available. A presentation-only `subject` prop in `ApprovalModal.tsx` makes quote confirmations say “Accept Quote”, not “Approve Variation”.
- **Added tests:** `tests/clientPages.browser.mjs` checks real client components at 320/375/768px, invalid links, above-fold 44px actions, accept/decline on both routes, persistent decision panels, actual PDF downloads and same-page change submissions. All data and service replacements are synthetic and isolated to the test bundle. `tests/setup.ts` supplies in-memory localStorage to non-browser tests, without changing production auth.
- **Measured contrast:** primary, success, warning, destructive and info token pairs measure approximately 7.94:1, 5.72:1, 4.55:1, 8.52:1 and 7.19:1. This is not a full WCAG audit.
- **Unresolved interaction:** the full `employeePortal.browser.mjs` run passes clock-in/out (including break validation and GPS cases), ticking timers, supervisor review and pay visibility, but fails reopening the team actions menu immediately after cancelling removal with Escape. Changing dropdown modality and explicitly restoring focus did not make that scenario pass. This is not a passing suite; whether this failure existed before Round 2 has not been established.
- **Test limitations:** Bun unit checks need `bun test --preload ./tests/setup.ts ...` because browser storage is absent. The quote SSR test additionally needs a DOM for the existing sanitizer; rendered client routes are covered by browser tests instead. No live customer session, production permission or production email-delivery test was performed.
- No Round 2 changes to business calculations, server routes, database schema, authentication or permissions. Type metadata now describes the existing invite table; no migration was applied. Secure client capabilities remain in place.
- **Final combined checks:** `npm run typecheck`, `npm run build`, editor diagnostics and `git diff --check` passed. The non-DOM test command passed **81 tests across 13 files** (quote SSR test excluded for the DOM requirement above). The management browser suite passed **36 route/viewport checks**; the client suite passed **12 layout/error/decision-flow scenarios**. The 375px screenshot of the real client quote with synthetic data fits the viewport and shows the primary action above the fold. The screenshot's history request correctly rejected the synthetic capability (401); the browser interaction suite uses isolated synthetic API responses. This is not a test against a real customer's link or account.

## Timesheets

- **Before:** manager review repeated overall and per-person totals, surfaced submission state in several different ways, and showed dense entries with repeated lock copy. The employee screen placed the week picker, submission panel, totals, entry list, and a seven-field editor together.
- **After:** shared semantic status badges, date/week controls, hours formatting, lock/empty states, summary strips, and mobile entry cards support a single weekly manager overview and focused review drawer. The manager page uses a real weekly table at 768px and wider, compact roster cards below 768px, highlights the actual local weekday, and keeps the reviewer’s own hours visible while withholding self-review actions. Employee timesheets group entries by day, put week total/status/submit action together, tuck details and the employee’s own rate into a disclosure, and open the existing entry form and GPS-consented clock-out flow in sheets/dialogs. Manager review rows sort submitted weeks first, include a Missing hours roster filter, and expose individually-confirmed bulk approval with per-person results.
- **Files changed:** `src/components/timesheets/EmptyState.tsx`; `EntriesTable.tsx`; `EntryCard.tsx`; `HoursCell.tsx`; `LockNotice.tsx`; `SummaryStrip.tsx`; `TimesheetStatusBadge.tsx`; `WeekSwitcher.tsx`; `format.ts`; `index.ts`; `model.ts`; `src/components/TimesheetSummary.tsx`; `src/components/team/ReviewPanel.tsx`; `src/components/employee/EmployeeTimesheets.tsx`; `tests/timesheetsPresentation.test.tsx`; `tests/timesheetManagement.browser.mjs`; `tests/timesheetSummaries.browser.mjs`; `docs/ui-ux-redesign-summary.md`.
- **Verification:** `npm run typecheck` passed; production build passed (existing stale Browserslist and large-chunk warnings remain); the required non-DOM unit command passed 87 tests across 14 files, including new badge, week-navigation, review-order, day-grouping, and total tests. `git diff --check` passed. The owner is running the viewport browser suite.
- **Unchanged:** `shared/timesheetTotals.ts` and all shared date/time calculations; API endpoints, database, authentication, permission rules, self-review exclusion, review comment requirements, lock/reopen and audit trail behavior. Bulk approval makes the existing `/team/review` request once per eligible non-self submission. Clock-out retains `/employee/clock-out` and the existing optional-GPS consent/denial semantics.
- **Viewport/screenshots:** manager integration coverage is delegated to `tests/timesheetRedesign.browser.mjs` at 320/375/768/1280px. No screenshots were captured in this implementation pass, per the task instruction to leave browser verification to the main agent.
