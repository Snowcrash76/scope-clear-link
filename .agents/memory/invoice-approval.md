---
name: Invoice approval responsibility
description: Invoice approval belongs to the trade before sending, not to the client.
---

The trade approves an invoice before sending it; approval is not requested from the client.

**Why:** The user explicitly chose “Me before sending” when asked who should approve invoices.

**How to apply:** Keep invoice approval separate from client quote or variation approval. Approval alone must not email the client.

Approval applies to the exact invoice reviewed. Editing an approved but unsent invoice requires approval again. Sent, paid, overdue and cancelled invoices must be retained rather than deleted or overwritten; corrections need a separate workflow.

**Why:** Approving an earlier version does not authorise sending later financial changes, and historical invoices must remain reliable.

**How to apply:** Preserve existing issued invoices and their amounts when changing preparation workflows.

An ambiguous email response must retain an immutable delivery attempt and its provider idempotency key until delivery is confirmed.

**Why:** A connection can fail after the provider accepts an email. Starting a new attempt or permitting edits then risks duplicate emails or a client receiving different amounts from the saved invoice.

**How to apply:** Retry the same payload and key, keep financial edits locked during uncertainty, and mark Sent only after provider confirmation. Beyond the provider's idempotency window, require reconciliation rather than automatic resend.
