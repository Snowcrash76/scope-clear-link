---
name: Client deletion scope
description: User-confirmed full client wiping overrides ordinary financial retention only through explicit destructive deletion.
---

Deleting a client should wipe all related app information, including their jobs, quotes, issued/paid invoices, costs, stored receipts/documents and linked timesheet records. Employee login accounts remain separate from the client.

**Why:** The user requested “when I wipe the client everything else related to the client gets wiped” and explicitly chose “Full wipe, including issued invoices” after being warned about permanent financial and timesheet deletion.

**How to apply:** Keep this separate from ordinary editing, approval and sending, which still preserve historical invoices. Require owner authorisation and explicit irreversible-action confirmation; the database wipe must be atomic and must not affect another business or unrelated client. Storage deletion cannot share a database transaction, so retain durable cleanup work and tell the owner when file removal remains pending. Never claim that deleting app records removes copies already emailed externally.
