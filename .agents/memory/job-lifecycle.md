---
name: Job lifecycle
description: Completed-job archiving and safe deletion boundaries.
---

Completed jobs belong in an Archive view, not in the active job list or its counts and attention filters. They retain their quotes, invoices, costs and staff records and can be reopened.

**Why:** The user asked for completed jobs to move to an archive so they no longer show among active jobs.

**How to apply:** Completion is the archive boundary; do not introduce a second independent archived state without a reason. Keep historical financial/detail screens accessible.

The canonical job pipeline is Quoted, Approved, In Progress, Completed. Jobs start as Quoted, including both draft and sent quotes. Active includes the first three states; Archive contains Completed.

**Why:** The user explicitly requested that jobs start as a quote, without a preceding prospect stage. Quote delivery/approval and job progress are different lifecycles.

**How to apply:** Use the shared job-status projection consistently. Preserve separate quote draft/sent states and compatible legacy storage values rather than migrating financial history merely to change a job's display label. Dashboard counts and job filters must use the same Active definition; scheduling backlog remains limited to Approved/In Progress.

The Jobs summary's Active Job Quote Value includes saved ex-GST quote values for every active job, not only jobs in Quoted status. Completed/archived jobs are excluded.

**Why:** The user explicitly chose all active jobs so approved quotes remain counted while work is in progress.

**How to apply:** Keep this monetary total independent of quote-delivery status and the selected list tab; do not change saved quote amounts or job statuses to make them count.

Draft attention belongs in a compact Drafts filter/count alongside the Jobs tabs, not in an always-visible empty-drafts card. Drafts is a utility filter, not an additional job status.

**Why:** The user said the pending quote drafts box used too much space and asked to put it with the existing filter tabs.

**How to apply:** Count active Quoted jobs with a current draft/revised quote, not superseded historical drafts. Show the normal empty-list state only when the user selects an empty Drafts filter.

Job deletion must be one atomic, owner-scoped database operation, never a series of child deletions followed by deleting the job.

**Why:** Invoice-retention triggers, staff-history foreign keys and assignment guards may reject deletion. Deleting children first can erase records even when deleting the job fails.

**How to apply:** Retain existing database protections and offer archiving when they block deletion. Require irreversible-action confirmation, handle zero affected rows as failure, and never report success on an uncertain network response.
