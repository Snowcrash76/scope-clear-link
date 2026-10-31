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

## Complete clean-blue redesign

### Design and navigation

- One Inter font family, including tabular financial figures. Headings and body copy share the same family.
- Semantic CSS variables are the palette source: primary `#2563EB`, background `#F8FAFC`, card `#FFFFFF`, text `#111827`, muted text `#667085`, border `#E3E8F0`, success `#15803D`, warning `#B45309`, danger `#B91C1C`, purple `#7C3AED`, with the requested soft fills.
- Shared shell, page headers, status badges, buttons, inputs, cards, dialogs, KPI definitions and pagination. Schedule-specific layout remains scoped and uses the shared tokens rather than a second palette.
- Small green-tinted status labels use foreground text with green icons/dots and fills where green-on-green misses 4.5:1 rendered contrast. This keeps the semantic palette without sacrificing readability.
- Current navigation retained: horizontal job sections, Variations inside jobs only, manager Schedule in AppShell, and existing employee portal links. No job side rail, “All sections”, header “Add stages”, or new employee bottom navigation.

### Pages and states covered

- Dashboard; Jobs and all nine job sections; Quotes; Invoices; Profitability; Schedule; Clients; Team list, assignments, reviews and permissions; Settings; Admin.
- Employee Today, Week, job details, timesheets, notifications, login and invite acceptance.
- Public client project and quote views, client decisions and PDF controls; landing, demo, authentication, recovery and not-found pages.
- Existing receipt upload/scanning/review, read-only cost detail, team email editing/removal, timesheet approvals and schedule dialogs retain their real handlers.
- `/design-preview` is development-only. It demonstrates buttons, visible-dot statuses, a KPI definition, a labelled form field, table, empty/loading states and an accessible dialog. The production build omits this route and component.

### Data and scope

- New presentation aggregates only records already loaded by each page. KPI labels state their GST and revenue basis; definitions explain exclusions and incomplete costing.
- Existing financial calculations, historical quote offers, authentication, role permissions, database schema, storage and backend handlers are unchanged.
- Indicative profitability is not labelled final profit or “healthy” just because a job currently has low recorded costs. No new configured margin threshold or fictitious budget is introduced.
- No sample clients, jobs, integration banners, invented budgets or unrecorded cash-collection totals were added to the application. The invoice payment-date field exists, but an actual payment-collection overview is not part of this presentation change.
- No new company document library, booking-write workflow, payment ledger, accounting integration or notification delivery is implied by the visual references.
- PDF rendering is deliberately unchanged; existing PDF-specific formatting is outside the application theme.

### Checks and comparison assets

- `npm run build` runs the source placeholder guard first; `npm run check:ui-content` runs it independently.
- `npm run test:ui` runs unit tests followed by isolated real-component browser suites serially. Authentication and API substitutes are test-only; production auth is never bypassed.
- `generated-artifacts/before/` and `generated-artifacts/after/` hold phone/desktop comparisons. Public/client baselines can be rebuilt read-only from the original Git source, without checking out or altering the running application.
- `generated-artifacts/scopeclear-ui-comparison.html` is the self-contained comparison gallery. Larger generated outputs remain ignored by Git and deployment.
- Final typecheck, production build, source placeholder guard and production-only exclusion check all pass.
- **146 unit tests across 27 files pass. All 13 browser suites have passing results**, combining the full run with corrective targeted reruns. Earlier stage runs that were interrupted or timed out are not represented as successful full-suite passes.
- Core manager, employee, public and client layouts were checked at **320, 375, 768, 1280 and 1440px**, alongside the suites’ populated forms, receipt scanning/review, timesheet permissions/approval/edit/delete, calendar, secure-send and document interactions.
- Corrective checks fixed the 320px job-filter chip and invoice action row, green status text contrast, and a Jobs caption that incorrectly labelled profit as costs. The relevant pages, interaction suites and final Jobs screenshots were rechecked.
- The gallery contains **82 phone/desktop comparisons**. Browser checks render real components with isolated services and synthetic data; live signed-in accounts, email delivery and a physical Android handset were not exercised.
- The build still warns about the existing large initial JavaScript bundle; mobile loading improvements are proposed separately rather than mixed into this presentation work.

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

- **Before:** current records do not provide a centralized client-contact model, an archive state, room/area quote grouping, or a final-cost confirmation flag.
- **After:** remaining items below are proposals only; no archive, quote-grouping, or final-cost feature/schema/API/permission changes are made.
- **Client records:** a future centralized client/contact model should define validation, consent, access boundaries, and links to existing jobs. The existing `projects.client_phone` field is surfaced in the job UI only when populated; no new phone column or trade-profile fallback is used.
- **Archive state:** define archive/restore, list visibility and retention separately from completion or deletion; preserve historical quotes, invoices, costs and margin calculations.
- **Room/area grouping:** support optional named groups and an explicit sort order for quote items; retain existing ungrouped items and preserve quote totals/PDF behavior.
- **Final-cost flag:** define qualifying evidence, confirming actor/time, distinction between estimate and confirmed actual cost, and an audited reopen path.
- **Files changed:** proposal text is documentation-only. The separate existing `projects.client_phone` field is surfaced by the current job UI changes; no new field is introduced.
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
- **Verification:** `npm run typecheck` passed; production build passed (existing stale Browserslist and large-chunk warnings remain); the non-DOM unit command passed 87 tests across 14 files, including new badge, week-navigation, review-order, day-grouping, and total tests. `git diff --check` passed. Final browser results are below.
- **Unchanged:** `shared/timesheetTotals.ts` and all shared date/time calculations; API endpoints, database, authentication, permission rules, self-review exclusion, review comment requirements, lock/reopen and audit trail behavior. Bulk approval makes the existing `/team/review` request once per eligible non-self submission. Clock-out retains `/employee/clock-out` and the existing optional-GPS consent/denial semantics.
- **Final presentation fixes:** employee timesheet actions use the same amber primary tokens as management, not the employee portal's legacy green action style. Editable entries expose Edit/Delete through one three-dot menu. The calendar uses the existing accessible popover. Dedicated responsive skeletons cover table rows and cards. Warning badges use the full semantic foreground/background pair; translucent warning notices use foreground text to avoid losing contrast. Existing lock, running-clock and review comment checks remain unchanged.

### Files by brief section

1. **Shared blocks:** `src/components/timesheets/{WeekSwitcher,TimesheetStatusBadge,HoursCell,SummaryStrip,EntriesTable,EntryCard,LockNotice,EmptyState,TimesheetSkeleton}.tsx`, `src/components/timesheets/{format,model,index}.ts`, and `src/components/TimesheetSummary.tsx`.
2. **Manager screen:** `src/components/team/ReviewPanel.tsx`; `src/components/team/TeamHome.tsx` only selects the timesheet loading skeleton. The existing review dialog, edit form, comments, endpoints and audit messages remain in use.
3. **Employee screen:** `src/components/employee/EmployeeTimesheets.tsx`. The old facade exports remain compatible. Start/finish and duration modes retain the same UTC conversion, paid-minute validation and save payload. The duration input's native step base now permits ordinary quarter-hour values including the default eight hours.
4. **Quality:** `tests/timesheetsPresentation.test.tsx`, `tests/timesheetRedesign.browser.mjs`, `tests/timesheetManagement.browser.mjs`, `tests/timesheetSummaries.browser.mjs`, and this document. Existing browser assertions were adapted to the requested drawer/menu/disclosure structure, not removed from the edit/approval/delete flows.

### Final viewport and interaction checks

| Viewport | Manager | Employee |
| --- | --- | --- |
| 320px | Cards, week/filter controls, review drawer, trapped/returned focus, one lock notice, bulk confirmation and partial failure: pass | Grouped day/week totals, deferred entry form, invalid range handling, duration save, break presets: pass |
| 375px | Same checks: pass | Same checks: pass |
| 768px | Weekly table and review drawer; same interactions: pass | Same checks: pass |
| 1280px | Weekly table and review drawer; same interactions: pass | Same checks: pass |

- No horizontal document overflow in any of those states. Table overflow stays inside its own container. Rendered status foreground/background contrast is at least 4.5:1 in the tested states.
- `timesheetManagement.browser.mjs`: all **9** employee/owner/admin × 320/390/1280px scenarios pass: edit, submit, deny, approve, reopen, cancellation, confirmed deletion, and delete error/retry.
- `timesheetSummaries.browser.mjs`: all **12** employee/owner/admin/missing-rate × 320/390/1280px scenarios pass: totals, historical approval rates, missing rates, own-rate visibility, coworker privacy and week switching.
- The redesign suite also passes clock-out with the existing break/note payload, and manager/employee bootstrap error recovery.
- Screenshots of the real components using isolated synthetic API responses are in `generated-artifacts/timesheets-{manager,manager-drawer,employee,employee-form}-{320,375,768,1280}.png`. These generated files are excluded from Git and deployment.
- The direct app screenshot at `/employee/timesheets` correctly shows sign-in; no authentication bypass was added. Signed-in layouts and interactions were verified with real components and synthetic services, **not a live customer account or a production permission test**.
- The pre-existing DOM-dependent quote SSR limitation and previously reported unrelated team-removal Escape/reopen failure remain outside this timesheet work. No claim is made that those were repaired. Nothing was published as part of this change.

## H — Read-only Schedule calendar

- **Before → after:** separate appointment/assignment lists → `/schedule`, Day/Week/Month, remembered team/job grouping, list alternative, visible-range loading/retry, mobile Day cards/date strip, keyboard navigation, Radix booking detail dialogs, contact links and stable job colours with text labels.
- **Files:** `components/schedule/{Schedule.tsx,scheduleUtils.ts,schedule.css}`, `App.tsx`, `AppShell.tsx`, dashboard schedule links, employee portal navigation/address cards, job Overview/Team schedule links; `server/scheduleRead.ts` and authenticated `/schedule` route; schedule unit/browser tests.
- **Security:** existing actor/business access only; nonmanager employees receive only their assignment-linked bookings, assigned safe jobs and own name. No financial fields, rates or coworker assignments. No schema, dependency, RLS or permission modifications.
- **Read-only boundary:** booking writes, drag/resize, cancellation, global scheduling-intent queues, reminders, recurrence, iCal and acknowledgement warnings are deferred. The view-local job panel does not claim jobs are globally unscheduled or require a site visit.
- **Proposal:** [Schedule calendar proposal](schedule-calendar-proposal.md) explains the separate-storage/unified-read model, zero new library dependencies, existing access, potential additive fields and approval-gated write workflow.
- **Checks:** typecheck/build/diff check passed; **118 tests across 21 files** passed. Calendar browser checks passed owner/employee at **375, 768 and 1280px**, including Sydney-local initial day from a US browser timezone, Day/Week defaults, detail Escape/focus return, contacts, saved grouping, Month arrow focus and no page overflow. Tests use synthetic responses, not a live signed-in customer account. No real booking or email was created.
- **Known distinction:** displayed overlap warnings compare local wall-clock intervals, not disambiguated UTC times during repeated/missing DST hours. The proposed write phase must resolve those explicitly.

## Job workspace, variations, documents, client actions, and audit history

- **A — Job workspace:** the job page now opens on Overview with a grouped desktop navigation rail, a horizontally scrollable mobile section row, an accessible “All sections” sheet, keyboard navigation, selected-section scrolling, and concise count/progress badges. The overview brings together next action, stage progress, client details, upcoming team assignments, variations, recent documents and money. The section selector lives in the job grid’s sticky desktop wrapper, not a short inner parent.
- **B — Variations:** added a cross-job Variations workspace with status/search/job filters and distinct “Needs your response” vs “Awaiting client” states. Attention totals now combine both states without conflating their workflows, and client-request variations appear first on the dashboard as **“Client variation request — needs your response.”** Existing approve/deny flows and quote calculations are unchanged. Quote totals now state original quote + approved variations = current total (ex GST).
- **C — Job documents:** grouped files only from explicit metadata; ordinary `client_document` uploads are not mislabeled as client uploads. Added search, file-type filters, list/grid views, PDF/image quick preview, accessible display-name edits and mobile camera capture. The existing employee-only visibility switch remains the only visibility control. No client-only/private visibility state is implied because there is no supporting field or API; see the review-only [company document library proposal](company-document-library-proposal.md). Acknowledgement workflows and company-wide library UI/sidebar remain deferred.
- **E — Client actions:** the job header, overview, Jobs rows and dashboard project cards share secure view/copy/send actions. Sending uses the existing authenticated `/api/send-client-page-link` capability; the raw client URL is never posted from the browser. The dialog supports a distinct recipient only after explicit confirmation, send-copy choice and retryable failure states. Existing `projects.client_phone` is surfaced as a `tel:` link only when populated; no profile-phone fallback is used. Quote and invoice previews open their existing client-view modals. The API reports `activityRecorded: false`, so the UI does not claim to record “Last sent” or invent recent activity; SMS remains unsupported.
- **F — Audit history:** replaced the always-visible audit dump with person/week history and one concise Last reviewed line per employee. Review actions have plain-language labels, actor names resolve through `employees.auth_user_id === actor_id`, missing actors display “Admin”, and edited/moved entries match both snapshot work weeks. History is capped at ten per week with Show more, and the global history view is filtered/paginated over loaded bootstrap rows only. The owner-scoped bootstrap audit SELECT now includes the existing `employee_id` field; no route, permission or schema change was made.
- **G — Timesheet summaries:** manager and employee surfaces emphasize one weekly hours total and status. Per-entry unpaid breaks remain available with explicit labels/tooltips; duplicate paid/time-on-site/break summary blocks are removed. Optional pay remains permission-gated, with rate/missing-rate context in accessible tooltips. Shared `timesheetTotals.ts`, date/time calculations, submission/review rules and audit writes were not changed.
- **Proposal boundary:** Part D remains documentation only. No company-document UI, sidebar link, schema, SQL, or visibility changes were implemented before approval.
- **Files changed:** job workspace navigation/overview/header; variations page and status helpers; project/client detail hooks and types; document section/upload and client actions; quote/invoice preview actions; timesheet summary/review/audit components; owner-scoped audit SELECT and its bootstrap type; focused unit tests. Existing backend send capability and proposal are owned by the main agent.
- **Verification:** `npm run typecheck` passed; `bun test --preload ./tests/setup.ts` passed **102 tests across 18 files**; production build and `git diff --check` passed. Build retains the existing stale Browserslist-data and >500KB chunk warnings. The owning agent runs `tests/jobWorkspace.browser.mjs` across 320/375/768/1280px, including section scrolling, aliases, client phone, secure send and retry behavior.

## I — Timesheets moved from jobs into Team

- **Before → after:** removed the job Timesheets section and embedded panel; weekly person-based review stays at **Team > Timesheets**. Old `?tab=timesheets` links redirect with replace to `/team/timesheets?job=:id`; legacy team job-timesheet links also redirect.
- **Job filter:** URL-backed accessible Job select, All jobs default and removable chip. Entries, daily hours, person rows and totals respect the filter. Review data remains full-business/full-week; a job query parameter does not narrow the bootstrap.
- **Whole-week safety:** while a job display filter is active, submit/review/reopen/bulk-review actions are disabled with an explanation to clear the filter. Running and lock status use the complete employee week. Existing unlocked entry editing/deletion remains available. No approval scope or API payload was changed.
- **Hours logged:** Overview and the job Team section show approved + submitted hours from existing authorised data, linking to the filtered Team timesheets.
- **Costs:** compact Approved timesheet labour card shows approved hours and linked confirmed Labour amounts to authorised managers. It excludes manual Labour rows and reports missing linked-cost metadata as unavailable. Loading/errors do not masquerade as a zero total.
- **Costing finding:** existing `portal_review_week` inserts one confirmed GST-0 Labour cost per approved entry using paid minutes and the approval-time rate snapshot; the unique entry reference prevents duplicates. Reopening removes those posted costs and existing guards protect manual edits. These procedures, shared timesheet calculations, API approval handlers and migrations were not changed.
- **Files:** `JobSectionMenu.tsx`, `pages/ProjectManage.tsx`, `team/{TeamHome.tsx,ReviewPanel.tsx,ReviewDialog.tsx,JobHoursSummary.tsx,jobTimesheetSummary.ts}`, `project-manage/ProjectOverview.tsx`, `job-costing/JobCostsTab.tsx`; summary unit tests, `timesheetJobFilter.browser.mjs` and the existing workspace navigation test expectation.
- **Verification:** typecheck, production build and diff checks pass. **122 unit tests across 22 files pass.** New alias/filter/chip/no-empty-coworker/full-week guard/Overview-Team hours/linked labour/no-mutation checks pass at **375 and 1280px**. Existing timesheet summaries/privacy/audit tests pass all **12 cases**, and edit/submit/approve/deny/reopen/delete/recovery tests pass all **9 cases**, at 320/390/1280px.
- **H final verification:** owner/employee Schedule checks pass all six 375/768/1280px cases, including horizontal/vertical Month keyboard focus, list mode, mobile Sydney-local default from a US browser timezone, details/focus restoration, saved grouping, and one explicit server-error/retry scenario.
- **Limits:** browser interaction suites use real components with synthetic services, not live customer accounts or a production database. No real booking, timesheet, labour cost or customer email was created. Existing Browserslist/chunk-size build warnings remain. Calendar write workflows and new schema/permissions still require proposal approval.
- **Commits:** Schedule/read-model/proposal and the timesheet move are committed separately, with a small focused calendar keyboard follow-up.
