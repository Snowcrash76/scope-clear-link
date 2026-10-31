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
