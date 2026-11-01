---
name: Employee portal boundaries
description: User-required employee portal phase gates, access boundaries and reuse constraints.
---

Multi-day crew assignments are separate daily shifts, not one continuous overnight booking. The end date is inclusive and the same local hours apply each day, including weekends.

**Why:** Daily schedules and timesheet access must continue to match the existing appointment model; treating a range as one continuous booking would incorrectly cover overnight hours.

**How to apply:** Save the whole range atomically and retain per-day editing/removal. Use calendar dates in the business timezone so daylight-saving changes do not move the daily start time.

Build the employee portal in phases. Complete and confirm each phase works before starting the next; after Phase 1, summarise the work and wait for the user's explicit go-ahead before Phase 2.

**Why:** The user explicitly requested this release sequence in the employee portal brief.

**How to apply:** Scope current work to the approved phase. Later expenses, employee variation requests, safety, offline support and payroll export are not permission to start those phases early.

Reuse existing Jobs, Documents, Costs and Variations models, and do not break existing admin or client portals.

**Why:** The employee portal is an extension of the existing product, not a replacement or a parallel job-management system.

**How to apply:** Keep employee-only identity, assignments and time tracking owner-scoped. Enforce assignment and role permissions on the server and direct database/storage paths, not only navigation. Employee endpoints must not expose unassigned jobs or commercial job finances. The explicitly approved own-pay exception is documented below.

Replace job-ID-only client project links with separate secure capabilities, and resend existing project links.

**Why:** Assigned employees necessarily know job IDs. Keeping those IDs as financial client access keys would defeat employee financial restrictions. The user explicitly approved replacing existing client project links after being told they must be resent.

**How to apply:** Do not restore anonymous job-ID access for compatibility. Coordinate the matching app build and external Supabase policy migration during release; the older published client cannot read through the new security boundary. Preserve quote-token flows and pre-existing file references through scoped access, not reopened public buckets.

Retain employee work and audit history when removing a team member. An email correction must require a new invitation and must not let the old identity become a business owner.

**Why:** Employee removal must not erase approved labour costs or timesheets. Email addresses are access identities, not just contact text.

**How to apply:** Preserve historical employee references when adding future removal, rehire or account-change flows; do not reuse a removed profile for a different person.

Use an authorised sending domain for staff invitations rather than the email provider's development sender.

**Why:** The user confirmed receiving invitations after the verified sender was configured.

**How to apply:** Keep sender configuration server-side and republish when changing it; do not add a second email provider just to deliver staff invites.

Treat creating an invited account separately from accepting an invitation with an existing account. A different account already signed in to the browser must not determine the new employee's identity.

**Why:** The user reported new-password acceptance being rejected because the browser still carried another account's session.

**How to apply:** Create only the invited email's account; never reset an existing account through an invitation. Existing-account acceptance must still authenticate the invited email.

Preserve existing business accounts when employee invitations conflict with them; use a separate employee email rather than silently removing their jobs or changing their ownership.

**Why:** An invitation audit found that apparent new-account failures included existing business-owner accounts. Automatically converting those identities would jeopardise their existing business access, not repair a password.

**How to apply:** Explain the conflict clearly and get the owner's choice of employee email. Never delete accounts, jobs or team history to make an invitation pass. If invitation acceptance has an uncertain network outcome, do not delete a newly created account that may already have been successfully linked.

The existing hourly cost rates are the employees' actual pay rates. Admins and each employee themselves may see timesheet pay estimates; employees must not see coworkers' pay.

**Why:** The user explicitly confirmed “Yes, use the current rates” and “Admins and each employee themselves.”

**How to apply:** Keep all other job finances private. Label approved-hours pay as an estimate before tax, not an outstanding balance or payroll calculation; actual payments, deductions, overtime and super are not tracked by this feature.

Timesheets need approval/denial plus employee and admin edit/delete controls. Employees manage their own unlocked entries; owners/admins manage entries within their business.

**Why:** The user explicitly requested both review decisions and editing/deletion for team members and admins. Approved hours already post job labour costs, so silent changes would make costs inaccurate.

**How to apply:** Require explicit reopening before correcting submitted/approved weeks, reverse approved labour first, and preserve the correction/deletion audit. Admins must be able to resubmit corrected hours without requiring an inactive employee to sign in.

Company document library schema, permissions, storage rules and acknowledgement features require explicit approval of the written proposal before implementation or migration execution.

**Why:** The user requested the company library as a proposal-only phase, while permitting navigation, client-action, document-presentation and timesheet-presentation improvements separately.

**How to apply:** Do not treat approval of those presentation changes as library approval. Include any newly needed document classification, independent client-sharing or durable client-send/view tracking fields in the proposal rather than silently adding storage or permissions.

Owner assistance must keep the owner's real session and provide a read-only employee-facing preview, not impersonation.

**Why:** The approved assistance approach lets the business owner help staff with setup and corrections without employee passwords, session switching or actions falsely attributed to an employee.

**How to apply:** Restrict preview access to the business owner and a currently verified owned member. Show true inactive, removed or incomplete setup states. Keep member context throughout preview navigation and private-file access. Explicit Help edit actions leave preview for existing owner tools; preserve timesheet locking, reversal rules and owner audit attribution. Isolate preview data by both real account and selected member, and do not display stale private data during fresh access checks.

Timesheet review belongs under Team by person/week, with jobs as a display filter rather than a job-page timesheet section.

**Why:** The user explained that jobs can last one day or many months, so weekly payroll review under Team is simpler.

**How to apply:** Preserve old job timesheet links with the job filter. Do not let a job display filter silently narrow whole-week submission, approval, denial or reopening, or alter approved labour posting.

The user approved an interactive Schedule calendar: date-click creation, job-linked or standalone bookings, crew selection, editing/rescheduling, confirmed cancellation, and overlap warnings. Managers manage bookings; employees view their own assignments.

**Why:** The user explicitly approved the written interactive-calendar proposal after the initial read-only phase.

**How to apply:** Planned bookings are not hours worked: never create timesheets or pay automatically from bookings, and standalone appointments must not grant job access or offer job clock-in. Keep existing assignment notifications and employee-only access boundaries. Recurrence, external calendar sync and heavy dependency changes still require approval.
