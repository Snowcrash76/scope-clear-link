---
name: Employee portal boundaries
description: User-required employee portal phase gates, access boundaries and reuse constraints.
---

Build the employee portal in phases. Complete and confirm each phase works before starting the next; after Phase 1, summarise the work and wait for the user's explicit go-ahead before Phase 2.

**Why:** The user explicitly requested this release sequence in the employee portal brief.

**How to apply:** Scope current work to the approved phase. Later expenses, employee variation requests, safety, offline support and payroll export are not permission to start those phases early.

Reuse existing Jobs, Documents, Costs and Variations models, and do not break existing admin or client portals.

**Why:** The employee portal is an extension of the existing product, not a replacement or a parallel job-management system.

**How to apply:** Keep employee-only identity, assignments and time tracking owner-scoped. Enforce assignment and role permissions on the server and direct database/storage paths, not only navigation. Employee endpoints must not expose unassigned jobs or financial figures; hourly cost rates are admin-only.

Replace job-ID-only client project links with separate secure capabilities, and resend existing project links.

**Why:** Assigned employees necessarily know job IDs. Keeping those IDs as financial client access keys would defeat employee financial restrictions. The user explicitly approved replacing existing client project links after being told they must be resent.

**How to apply:** Do not restore anonymous job-ID access for compatibility. Coordinate the matching app build and external Supabase policy migration during release; the older published client cannot read through the new security boundary. Preserve quote-token flows and pre-existing file references through scoped access, not reopened public buckets.

Retain employee work and audit history when removing a team member. An email correction must require a new invitation and must not let the old identity become a business owner.

**Why:** Employee removal must not erase approved labour costs or timesheets. Email addresses are access identities, not just contact text.

**How to apply:** Preserve historical employee references when adding future removal, rehire or account-change flows; do not reuse a removed profile for a different person.

Use an authorised sending domain for staff invitations rather than the email provider's development sender.

**Why:** The user confirmed receiving invitations after the verified sender was configured.

**How to apply:** Keep sender configuration server-side and republish when changing it; do not add a second email provider just to deliver staff invites.
