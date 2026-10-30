# Company document library — approval proposal

**Status: proposal only. No SQL below has been run. No company-library routes, storage policies, permissions or UI have been installed.**

This covers Part D and the schema-dependent gaps discovered in Parts C and E. It reuses the existing business owner (`projects.user_id` / `employees.owner_id`), assigned jobs, employee identities, role settings and server-authenticated Supabase service client. It does not replace the database or authentication system.

## Approval decisions

1. Approve the four library tables, private storage bucket and two new role permissions below.
2. Approve `requires_acknowledgement`, category and independent client visibility fields. The supplied minimum table list needs the acknowledgement flag to support the requested upload toggle.
3. Approve a durable client-page email-delivery log for Activity / Last sent. Existing activity is assembled from job, quote, invoice and document records; it has no general email-event store.
4. Separately approve optional client-page view tracking. It is **not** needed for the library and is not included in the base SQL.
5. Confirm document audience semantics: the current two independent audiences can represent **Client + Team**, as well as either alone and neither. A three-option picker cannot represent all four without losing information. Recommended: retain all four states, or use two labelled audience switches. Do not silently grant employee access to legacy client documents.

## Current document model and immediate limits

- Job documents require `project_id`. They have file metadata, `purpose` and an independent `employee_visible` flag.
- Employee access uses current assignment, role permissions and the employee-visible flag. File delivery rechecks those conditions.
- Standard job documents currently appear through the secure client page; there is no independent `client_visible` flag. Removing employee access does **not** make a file internal.
- Existing purposes distinguish standard job documents, client uploads, employee photos and private receipt-related files. File MIME types support Photos versus other documents, but do not reliably establish whether a PDF is a site plan, report or certificate.
- Before approval, preserve those audiences and group only using existing metadata/type evidence. Do not label a standard file “Internal only” or infer a site plan from its filename.
- There is no verified client phone column. The profile phone belongs to the trade. Propose a real client/contact model separately rather than showing the trade's number as the client's.

## Proposed model

| Table | Purpose and ownership |
| --- | --- |
| `company_documents` | Business-owned current document, category, description, current version, lifecycle, expiry, audience and required-acknowledgement setting. Archive instead of deleting from the UI. |
| `company_document_versions` | Append-only file/version history. Each replacement gets a different object path. Retain old acknowledgements and version files. |
| `document_acknowledgements` | One employee acknowledgement per document version, timestamped by the server. Never accept another employee ID from the employee browser. |
| `job_document_links` | Same-business links to existing jobs. Detaching removes only the link, not the library document or its history. |
| `client_page_deliveries` | Optional approval item needed by Part E: successful delivery timestamp, recipient, provider message reference and sending actor. Owner/admin only, never returned to the client page. |

The existing role-permissions JSON gains:

- `view_company_documents`: default true for labourer, supervisor and admin; configurable by the business owner/admin.
- `manage_company_documents`: default true for admin, false for labourer/supervisor; the server also requires owner/admin role, even if someone edits role JSON incorrectly.

The owner retains management access. Inactive or removed employees cannot read files. Ordinary staff cannot inspect business-wide acknowledgement lists or version histories.

## Proposed SQL migration — text for review, not applied

This SQL assumes the existing employee portal migrations are installed. Before an approved rollout: take a restorable backup, inspect existing storage policies, review table naming/conflicts, and test the migration and rollback in a non-production database.

```sql
BEGIN;

-- Cross-business foreign keys must include the owner, not just a valid row ID.
CREATE UNIQUE INDEX projects_id_user_id_library_key
  ON public.projects(id, user_id);

CREATE TABLE public.company_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  title text NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  category text NOT NULL CHECK (category IN
    ('swms','safety','licences_insurance','policies','forms','training')),
  file_reference text NOT NULL CHECK (length(file_reference) BETWEEN 1 AND 1000),
  file_type text NOT NULL CHECK (length(file_type) BETWEEN 1 AND 150),
  size bigint NOT NULL CHECK (size BETWEEN 1 AND 52428800),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 5000),
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  expires_on date,
  visibility text NOT NULL DEFAULT 'admins'
    CHECK (visibility IN ('admins','team','roles')),
  allowed_roles text[] NOT NULL DEFAULT '{}',
  requires_acknowledgement boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(id, owner_id),
  CHECK (allowed_roles <@ ARRAY['labourer','supervisor','admin']::text[]),
  CHECK ((visibility = 'roles' AND cardinality(allowed_roles) > 0)
    OR (visibility <> 'roles' AND cardinality(allowed_roles) = 0))
);

CREATE TABLE public.company_document_versions (
  document_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  file_reference text NOT NULL,
  file_type text NOT NULL,
  size bigint NOT NULL CHECK (size BETWEEN 1 AND 52428800),
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  PRIMARY KEY(document_id, version),
  UNIQUE(document_id, version, owner_id),
  FOREIGN KEY(document_id, owner_id)
    REFERENCES public.company_documents(id, owner_id),
  UNIQUE(file_reference)
);

ALTER TABLE public.company_documents
  ADD CONSTRAINT company_documents_current_version_fkey
  FOREIGN KEY(id, version, owner_id)
  REFERENCES public.company_document_versions(document_id, version, owner_id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE public.document_acknowledgements (
  document_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  version integer NOT NULL,
  employee_id uuid NOT NULL,
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(document_id, version, employee_id),
  FOREIGN KEY(document_id, version, owner_id)
    REFERENCES public.company_document_versions(document_id, version, owner_id),
  FOREIGN KEY(employee_id, owner_id)
    REFERENCES public.employees(id, owner_id)
);

CREATE TABLE public.job_document_links (
  project_id uuid NOT NULL,
  company_document_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  added_at timestamptz NOT NULL DEFAULT now(),
  added_by uuid NOT NULL REFERENCES auth.users(id),
  PRIMARY KEY(project_id, company_document_id),
  FOREIGN KEY(project_id, owner_id)
    REFERENCES public.projects(id, user_id),
  FOREIGN KEY(company_document_id, owner_id)
    REFERENCES public.company_documents(id, owner_id)
);

CREATE INDEX company_documents_owner_status_category_idx
  ON public.company_documents(owner_id, status, category);
CREATE INDEX company_documents_owner_expiry_idx
  ON public.company_documents(owner_id, expires_on)
  WHERE status = 'active' AND expires_on IS NOT NULL;
CREATE INDEX document_acknowledgements_employee_idx
  ON public.document_acknowledgements(owner_id, employee_id, document_id, version);
CREATE INDEX job_document_links_owner_job_idx
  ON public.job_document_links(owner_id, project_id);

ALTER TABLE public.company_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_acknowledgements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_document_links ENABLE ROW LEVEL SECURITY;

-- Match the existing portal's server-only data approach.
-- No permissive browser/anonymous policies on these tables.
REVOKE ALL ON public.company_documents, public.company_document_versions,
  public.document_acknowledgements, public.job_document_links
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.company_documents TO service_role;
GRANT SELECT, INSERT ON public.company_document_versions TO service_role;
GRANT SELECT, INSERT ON public.document_acknowledgements TO service_role;
GRANT SELECT, INSERT, DELETE ON public.job_document_links TO service_role;

INSERT INTO storage.buckets(id, name, public, file_size_limit)
VALUES ('company-documents','company-documents',false,52428800);

-- Restrictive policy blocks this new bucket even if another existing
-- permissive policy is overly broad. It does not restrict other buckets.
CREATE POLICY company_documents_server_only
  ON storage.objects AS RESTRICTIVE
  FOR ALL TO anon, authenticated
  USING (bucket_id <> 'company-documents')
  WITH CHECK (bucket_id <> 'company-documents');

-- Existing explicit settings win over proposed defaults if keys exist.
UPDATE public.employee_role_permissions
SET permissions = jsonb_build_object(
  'view_company_documents', true,
  'manage_company_documents', role = 'admin'
) || permissions;

-- C: classification and genuinely independent client sharing.
ALTER TABLE public.project_documents
  ADD COLUMN document_category text NOT NULL DEFAULT 'other'
    CHECK (document_category IN
      ('site_plans','photos','reports_certificates','client_documents','other')),
  ADD COLUMN client_visible boolean NOT NULL DEFAULT true;

-- Preserve the existing employee-photo exclusion from client access.
UPDATE public.project_documents SET client_visible = false
WHERE purpose = 'employee_photo';
-- Other private purposes must be identified from the deployed schema and
-- existing client filters before approval; preserve every existing exclusion.
-- Do not use this migration to publish existing employee-only/private files.

CREATE TABLE public.client_page_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id),
  project_id uuid NOT NULL,
  sent_by uuid NOT NULL REFERENCES auth.users(id),
  recipient text NOT NULL CHECK (length(recipient) BETWEEN 3 AND 254),
  provider_message_id text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(project_id, owner_id)
    REFERENCES public.projects(id, user_id)
);
CREATE INDEX client_page_deliveries_job_time_idx
  ON public.client_page_deliveries(owner_id, project_id, sent_at DESC);
ALTER TABLE public.client_page_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_page_deliveries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.client_page_deliveries TO service_role;

COMMIT;
```

**Deployment prerequisite for the proposed client-visible column:** review existing purpose values and exclusions first. The matching server client-table and file-delivery predicates must enforce `client_visible` **in addition to** current purpose, ownership and capability rules. Grant no new direct browser policies. Do not enable an “Internal” control until all client read/download paths enforce the field. No such changes are made before approval.

## Proposed server route contracts — text only

All `/api/team/...` routes use the existing verified Supabase bearer-token actor resolver. Derive owner ID from the authenticated actor; reject an owner ID in the request body. Every lookup, including an ID lookup and file retrieval, is constrained to that business. Never expose service credentials or storage object paths through list responses.

Common status rules: 401 unsigned, 403 role/visibility/assignment denial, 404 inaccessible/absent record without existence disclosure, 409 stale version/duplicate conflict, 422 invalid fields, 413 excessive file size. Mutations strictly validate all supplied keys.

### Owner/admin management

| Method and path | Input, output and transaction |
| --- | --- |
| `GET /api/team/company-documents` | Query `category,status,search,cursor,limit` (max 50). Owner/admin plus manage permission. Return safe document metadata, expiry state, current-version acknowledgement count and cursor. Do not return file references. |
| `POST /api/team/company-documents/uploads` | Validate filename/type/size/title/category/description/expiry/visibility/roles/ack flag. Allocate server-owned upload ID and `owner/document/version/random` object path; return a short-lived signed upload capability. Allowed types PDF, JPEG, PNG, WebP and explicitly approved office formats; reject HTML, scripts and executables. Do not publish a document yet. |
| `POST /api/team/company-documents` | Commit a completed upload only after checking server-issued upload capability, actual stored object metadata and business ownership. Insert document version 1 and current document in one database transaction. Set actor/time on server. Return safe metadata. Roll back metadata together; clean abandoned storage objects on a scheduled owner-scoped cleanup. |
| `PATCH /api/team/company-documents/:id` | Title/category/description/expiry/audience/roles/ack requirement only. Reject file/version/owner/creator fields. Archive through `status:archived`; no hard delete. Recheck existing job-link audience compatibility and report any assigned staff no longer eligible. |
| `POST /api/team/company-documents/:id/version-uploads` | Validate a replacement upload and expected current version. Return a new path, never overwrite an existing file. |
| `POST /api/team/company-documents/:id/versions` | Require `expectedVersion`, completed upload capability, notes and explicit acknowledgement-reset confirmation. Lock document row; reject concurrent stale replacement with 409. Insert version N+1 and update current pointer/file metadata atomically. Keep all old versions and acknowledgements. Current-version acknowledgement count starts at zero by querying the new version, not deleting history. |
| `GET /api/team/company-documents/:id/versions` | Paginated version metadata and uploading actor display name. Admin only; no raw paths or actor IDs in UI labels. |
| `GET /api/team/company-documents/:id/versions/:version/file` | Authorize business and management role again, then stream or issue a 60-second private signed download. Use safe Content-Disposition; unsupported preview types download rather than execute. |
| `GET /api/team/company-documents/:id/acknowledgements` | Current version by default, explicit older version for management history. Return employee display name and server acknowledgement timestamp. Eligible active people only in the “4 of 6” denominator; old or inactive acknowledgements remain historical evidence. |
| `GET /api/team/jobs/:id/company-documents` | Require existing job-management ownership. Return linked document metadata and assigned eligible staff acknowledgement counts, distinguishing library versus job-uploaded files. |
| `POST /api/team/jobs/:id/company-documents` | Body `companyDocumentId`; verify both rows have the same owner. Attach an active document, idempotently. Warn/reject attaching a document whose audience excludes assigned staff if the action promises all assigned staff access. Never widen document audience implicitly. |
| `DELETE /api/team/jobs/:id/company-documents/:documentId` | Delete only the same-owner link. Keep the library file, version history and acknowledgements. |

Creation and version replacement need a **new transactional SQL function or equivalent transaction-capable service implementation** after approval; sequential REST inserts are not sufficient. Those functions will be service-role executable only, validate the resolved actor/business, and must be reviewed with the final approved migration. The SQL above defines the proposed tables/policies, not a claim that application transactions are already implemented.

### Employee reading and acknowledgement

Use existing active employee identity and assignment checks. Require `view_company_documents` and audience eligibility (`team`, matching `roles`, or admin). Owner/admin may read `admins`; regular staff may not, even with a valid document ID.

| Method and path | Contract |
| --- | --- |
| `GET /api/employee/company-documents` | Safe current-version active-document metadata only, grouped by category, own acknowledged timestamp and whether action is required. No global employee acknowledgements, private paths, owner contact details or admin-only documents. |
| `GET /api/employee/company-documents/:id/file` | Repeat active identity/owner/permission/audience checks and requested current-version check. Return short-lived signed URL or stream. A stale URL is not a permanent grant; signed links expire in 60 seconds. |
| `POST /api/employee/company-documents/:id/acknowledge` | Body only `version`. Derive employee ID from actor, verify current active eligible version; reject stale version with 409. Insert acknowledgement using server timestamp with ON CONFLICT no-op; duplicate presses are idempotent. |
| `GET /api/employee/jobs/:id/company-documents` | Existing `requireAssigned` plus library audience permission. Return linked eligible metadata and this employee's acknowledgement only. Knowing an assigned job ID must not grant unrelated library access. |
| `GET /api/employee/company-documents/pending` | Eligible current required documents not acknowledged by self. Today banner uses this, prioritizing attached SWMS for that employee's next existing appointment. Do not expose other employees' schedules or acknowledgement states. |

Static `/pending` must be registered before `/:id` handlers. Employee list/file and job-link paths must share one authorization function so filters cannot be bypassed by direct-ID fetches.

### Client access and email activity

- Do **not** expose the company library or employee acknowledgements to client capability links.
- Part E's approved existing-column email handler generates the secure project capability on the server, uses the existing verified sender configuration, validates the recipient and requires confirmation for a different address. It never takes a URL/token from the browser. Send failures leave Draft unchanged; successful delivery conditionally changes only Draft to Sent.
- After the optional delivery-log table is approved, append a delivery row on successful provider acceptance and surface it in the existing Activity UI with recipient/time and on the client card as Last sent. Provider acceptance means sent, **not delivered/read**. If logging fails after sending, report “sent, activity could not be recorded”; do not invite automatic duplicate sending.
- Optional future `client_page_views`: project/owner ID and server timestamp only, no capability token, full URL, IP or user-agent retention by default. Require a valid existing capability and rate-limit/coalesce refreshes. Browser prefetches and shared links mean “last opened” is not proof that the named client read the page. This requires separate approval and privacy wording; omit Last viewed now.

## UI after approval

- Main Documents page under PEOPLE: category filters, search, current version, expiry warning at 30 business-local calendar days, expired text/icon, audience, current acknowledgements, view/replace/edit/archive.
- Employee Documents page and Today banner: only eligible documents, clear read/acknowledged state, no coworkers' financial information.
- Job Documents: attach from library; distinguish “From company library”; detach rather than delete; show current-version acknowledgement per eligible assigned employee.
- Replace-version confirmation names the new version and explains that staff must acknowledge it again. Preserve historical evidence; never describe old acknowledgements as erased.
- At <768px use cards; all dialogs trap focus, support Escape, restore trigger focus, and have 44px targets. Expiry/ack state uses text/icons as well as colour.

## Required tests and rollout gates

1. Owner A cannot list, fetch, replace or link Owner B's document, including direct-ID and signed-URL requests.
2. Labourer cannot read an admin-only document, archived document, removed-employee file, disallowed role or unassigned job's library panel. Changing a browser body employee/owner ID does not help.
3. Replacement is atomic under two concurrent requests; one succeeds and one gets 409. Old version/acks remain; current eligible count resets.
4. Own acknowledgement is idempotent and server-timestamped; stale version rejects; staff cannot acknowledge for someone else.
5. Attach/detach retains library history; cross-business FK rejects; document audience is never widened by linking.
6. Expiry tests cover 30 days, 31 days, today, yesterday and Australia/Sydney midnight boundaries.
7. Existing job-upload/download, secure-client capability, receipt privacy and employee document tests continue passing after the new client-visible gate is enabled.
8. No real customer email/file is used in browser fixtures. Verify 320/375/768/1280px and keyboard-only interactions.
9. Approve a backup/restore and matching server/client deployment sequence before applying the final migration. **This document is not approval to execute anything.**
