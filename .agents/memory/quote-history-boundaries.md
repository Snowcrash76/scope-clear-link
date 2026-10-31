---
name: Quote history boundaries
description: Current project scope must not be used to rewrite superseded quote amounts.
---

Recalculate only the active quote from current project scope and approved
variations. Do not repair superseded quotes using today's project data without
a quote-specific historical snapshot.

**Why:** A shareable link to an earlier or accepted quote represents the offer
and decision at that time. Preserving its approval timestamp while rewriting
its price would misrepresent what the client accepted.

**How to apply:** Scope maintenance backfills and client variation recalculation
to the project's explicit active quote. Test with multiple quotes whose approval
dates differ; preserve older quote totals and decisions.

Quote-linked deposits and stage payments are percentages of the saved approved
quote's ex-GST value, not of the live job scope or automatically of the unpaid
balance.

**Why:** A client approved the saved offer; subsequent scope edits must not
silently change a percentage invoice, and a percentage of the remaining balance
would mean a different amount.

**How to apply:** Keep quote-linked invoice previews and saved amounts on the
same basis. Treat remaining-balance invoicing as a separate explicit choice.

Do not assume the hosted Supabase schema includes every local migration.

**Why:** The hosted line-item schema lacked optional variation metadata even
though the repository contained its migration, which blocked merge setup.

**How to apply:** Preserve the existing title-based legacy handling when metadata
is absent. Verify schema compatibility before adding maintenance to merge setup;
do not apply unrelated migrations just to make a repair run.
