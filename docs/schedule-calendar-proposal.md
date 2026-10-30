# Schedule calendar — review proposal

## Approved boundary and delivered read-only scope

The attached brief permits a read-only calendar immediately when it needs no schema change or dependency. The calendar therefore reads the existing appointments and employee assignments; it does not create, edit, move, resize or cancel bookings. Existing assignment forms and their employee notifications remain authoritative. No migration, RLS policy, permission key or dependency has been added.

## Data model

Keep appointments and assignments separate in storage, with a unified **server-side read model**. One appointment is a booking; zero or more assignments identify its crew. Deduplicate by appointment ID, not one event per staff member. Team/job grouping is a display projection. Business-local dates and times remain in the current appointment fields; the existing portal reports Australia/Sydney, rather than a configurable team timezone field.

`GET /api/schedule?from=YYYY-MM-DD&to=YYYY-MM-DD` loads only appointments intersecting the visible date range, including the previous day's overnight bookings. Reads are business-scoped. Related assignments and safe job/contact fields are joined without exposing rates, costs, quotes or invoices. Jobs and minimal staff names are reference data for grouping. Date ranges are validated and capped at 62 days; large ID joins are chunked.

An appointment with end <= start is displayed through the following day. The existing assignment-creation API currently rejects that interval. The read-only calendar does not change that validation or claim overnight creation is supported.

## Dependencies and presentation

Use a custom CSS-grid calendar and the existing date/dialog primitives. **New dependencies: none; added library bundle size: 0 bytes.** This is not a claim that the new UI itself has zero bundle cost. Day, Week and Month plus a list alternative share the same read model. Mobile defaults to Day, with explicit date controls and booking cards. Remember team/job grouping locally.

## Permissions

- Owners and current team administrators (`canManageTeam`) see bookings belonging to their business.
- Other active employees see only their own assignment-linked appointments and their assigned jobs. Coworker records and business financial data are not returned.
- Actor/owner/employee IDs are resolved from authentication on the backend, never accepted as scope from a browser.
- No new `manage_schedule` key is needed for the read-only phase. A future write permission must be explicitly approved; until then the existing team-management restriction remains authoritative.
- Existing employee Today/This week remains the staff workflow.

## Proposed booking-management phase — NOT built, requires approval

1. Reuse `AssignmentEditDialog` and existing assignment endpoints for simple work appointments; preserve notification and shared-appointment update semantics. Add explicit create/edit/reschedule/cancel dialogs, not touch-only drag.
2. Before adding types/status, approve additive appointment fields: `booking_type` (work day/site visit/quote visit), `status` (scheduled/cancelled), optional `all_day`; keep current `notes`. Backfill old appointments as scheduled work days. Job colour can be computed from job ID without a colour column.
3. Confirm whether cancellation is soft status or existing assignment removal; do not delete historical work or bypass notifications.
4. Approve overnight creation semantics and local-date/time conversion using `localDateTimeToUtc`. Nonexistent spring-forward times must be rejected; repeated fall-back times require a documented disambiguation choice.
5. Compare each proposed crew member's UTC intervals with existing bookings. Show names, local dates/times and overlaps, warn rather than block, and require explicit confirmation. Recheck just before saving; concurrent edits need a revision/updated-at guard.
6. Desktop move/resize can use pointer events without a library, but must route through the same validated save/notification flow. Touch and keyboard users get equivalent dialogs.
7. True Unscheduled needs business intent: approved jobs needing crew/date, quotes needing visits and variations requiring site work. Existing absence in a visible range is **not** proof of global unscheduled status. Propose a scheduling-intent field/table linked to the existing job and optional quote/variation, only after confirming lifecycle and permissions. The current panel says “Jobs without a booking in this view” instead.
8. A sticky mobile Add booking button belongs to this write phase; the read-only version links existing assignment management instead of pretending to create bookings.
9. Company-document acknowledgement UI remains a separate unapproved proposal, so no acknowledgement warnings are invented.

These are design proposals, not executable migrations. Before implementation, provide exact SQL/backfill/RLS/route changes for approval and clarify multi-member edits, cancellation and DST ambiguity. No employee permission expansion is implicit in approval of a calendar layout.

## Optional future integrations — proposal only

- Per-user revocable iCal feed tokens for Google, Apple and Outlook; no financial fields in feeds.
- Client reminders by email/SMS with explicit contact consent, retry/idempotency and delivery history.
- Recurrence with occurrence exceptions, timezone/DST handling and bounded generation.

## Timesheet / costing findings

Existing `portal_review_week` posts one confirmed GST-0 Labour job cost per approved time entry, using stored paid minutes and the approval-time hourly rate. A unique timesheet-entry reference prevents duplicates. Reopening removes the related posted costs; the existing guard prevents manual alteration of those protected rows. None of this is changed by calendar or timesheet navigation work.

The existing job costs model exposes the timesheet-entry reference but not paid minutes as a typed cost field. Approved hours can be read from the existing team bootstrap entries, matched by those references; posted amounts come from the existing confirmed Labour costs. Ordinary manually entered Labour costs must not be mislabeled as approved timesheets. Approval and submission are per person/week across jobs, so a Job display filter must not silently narrow a review decision.
