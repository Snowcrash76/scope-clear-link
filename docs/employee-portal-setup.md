# Employee portal — Phase 1 activation

The code does not automatically change the external Supabase database. It must
not be described as activated until the migration and live checks are complete.

## Coordinate the application and database release

The published app and preview use the same external Supabase project. The new
security policies deliberately remove legacy anonymous table access and replace
job-ID-only client links. The old published build cannot use those new policies.

1. Choose a short maintenance window, and retain the previous database policies
   through your normal Supabase backup process.
2. Publish the matching application build, then immediately run
   `supabase/migrations/20261029000000_employee_portal.sql` in the project's
   Supabase SQL editor as the database administrator.
3. The migration runs in a transaction. If it fails, report the error and do not
   skip security or cron statements to make it appear successful.
4. Confirm that Supabase Cron contains the `employee-weekly-reminders` hourly
   job. It runs without an open browser or an active application instance.
5. Refresh **Team**. Set employee hourly pay/job-cost rates, configure operational role
   permissions, and assign staff to jobs and appointments.
6. Use the job's **Copy client link** action to resend secure project links.
   Previous `/project/<job-id>` links no longer grant access. Quote-token links
   remain supported through the secured server gateway.

The owner can obtain the exact SQL from **Team → Database setup instructions**.
The SQL editor is:
https://supabase.com/dashboard/project/aswmcyldowvpugmfmykf/sql/new

## Team member management update

Existing Phase 1 installations also need
`supabase/migrations/20261030000000_team_member_management.sql` before publishing
the team email/removal controls. This additive update keeps existing staff and
work records unchanged. Fresh installations apply both migrations in order;
the Team setup helper supplies the required SQL.

Removal archives the member, revokes access and unused invitations, and retains
timesheets, costs and audit history. A removed email may be used for a new
profile, but a fresh invitation is required. Changing an enrolled member's email
also revokes their old identity and invitations until the new address accepts
a fresh invitation. Clock out any running shift before either operation.

## Settings

- `VITE_PUBLIC_BASE_URL`: the verified published HTTPS application address, used
  in invitation emails. This is a public configuration value, not a credential.
- Existing `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` and `RESEND_API_KEY`
  remain server-side secrets. Never put them in a `VITE_` variable.
- `RESEND_FROM_EMAIL`, if configured, must be a sender authorised by your email
  provider. The existing development sender may only deliver to the provider's
  permitted recipient; test delivery before inviting staff broadly.
- Phase 1 uses Monday–Sunday weeks in `Australia/Sydney`. UTC timestamps preserve
  elapsed work across daylight saving and overnight shifts.

## Required live checks before Phase 1 is complete

Use dedicated test accounts, not customer credentials. Check invite receipt,
acceptance, expiration, replay and wrong-email rejection; staff/admin separation;
assignment and deactivation revocation; denied raw Supabase reads/RPC/storage
requests; time capture and submission; scoped, non-self review; exactly one GST-0
Labour cost per approved entry; correction/reapproval; document publishing;
private photos/notes; notifications; and the persisted reminder job.

The local PostgreSQL test substitutes only Supabase's platform auth/storage
schemas and cron scheduler. It verifies migration/transaction/RLS behaviour, not
the live Supabase instance, email delivery, or that the remote scheduler exists.
Component fixtures likewise do not establish a signed-in live end-to-end pass.

No Phase 2 work is authorised by activation of Phase 1.
