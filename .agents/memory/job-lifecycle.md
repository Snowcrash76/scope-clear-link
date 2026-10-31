---
name: Job lifecycle
description: Completed-job archiving and safe deletion boundaries.
---

Completed jobs belong in an Archive view, not in the active job list or its counts and attention filters. They retain their quotes, invoices, costs and staff records and can be reopened.

**Why:** The user asked for completed jobs to move to an archive so they no longer show among active jobs.

**How to apply:** Completion is the archive boundary; do not introduce a second independent archived state without a reason. Keep historical financial/detail screens accessible.

Job deletion must be one atomic, owner-scoped database operation, never a series of child deletions followed by deleting the job.

**Why:** Invoice-retention triggers, staff-history foreign keys and assignment guards may reject deletion. Deleting children first can erase records even when deleting the job fails.

**How to apply:** Retain existing database protections and offer archiving when they block deletion. Require irreversible-action confirmation, handle zero affected rows as failure, and never report success on an uncertain network response.
