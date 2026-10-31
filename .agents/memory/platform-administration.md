---
name: Platform administration scope
description: User-defined distinction between system-wide administration and business-level team management.
---

The user needs a system administrator portal with an overview and control of all businesses using the application, including monitoring and controlling their accounts. Business-level Team management alone does not meet this need.

**Why:** The user clarified: “if other businesses start using my app i need an over view and controll of all the businesses.”

**How to apply:** Scope platform-administration work across all businesses and their account relationships, while keeping normal business owners and employee admins restricted to their own business. Do not present tenant-level employee controls as system-wide administration.

Platform access restrictions must cover existing JWTs, direct table/storage requests, public client capabilities, and privileged financial RPCs—not only navigation or Express endpoints.

**Why:** Supabase SECURITY DEFINER RPCs bypass table RLS, and signed file URLs remain usable until their existing expiry. Later replacement of a financial RPC must retain its access check.

**How to apply:** Add restrictive access policies to future tenant tables, keep the guard on authenticated security-definer entrypoints, and explicitly state the signed-link expiry limitation. Qualify outer storage-object columns in nested policy queries to avoid accidentally resolving a project's identically named column.

Keep preview account-control mutations disabled until the published API also enforces platform restrictions.

**Why:** Preview and published servers share the hosted database; restricting accounts from a new preview while an older published service-role API remains active would leave a bypass.

**How to apply:** Verify the published release before enabling mutations, and obtain separate approval before applying hosted security migrations. Installing the migration must not restrict any accounts by itself.

Deleting an account or business must preserve job, financial, and staff history.

**Why:** The user selected “Keep history” when asked what deletion should do.

**How to apply:** Remove the appropriate access and active-directory listing without cascading through historical work. Treat deleting a login separately from deleting a business; do not remove other businesses’ staff login identities.

Protect the system administrator from suspension, archiving, and deletion, but allow recovery emails for that administrator.

**Why:** An emailed recovery request does not change a password until its recipient chooses one; ordinary password recovery already permits this. Blocking it in the portal makes legitimate self-service look broken.

**How to apply:** Do not reuse destructive-action self-protection to disable password recovery.

Published account controls must not depend on an HTTP readiness request back to the same published server.

**Why:** An autoscale self-request can queue or time out while its originating request occupies capacity, falsely disabling otherwise ready controls.

**How to apply:** Use trusted deployment-runtime metadata in production; retain the published security-contract check from preview.
