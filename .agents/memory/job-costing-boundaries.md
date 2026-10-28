---
name: Job costing boundaries
description: User-required scope boundaries when extending job costing.
---

Job costing must only read existing quote, invoice and client logic for its calculations; do not rewrite or change those workflows as part of expense tracking.

**Why:** The user explicitly asked to add costing without changing existing invoice, quote or client logic.

**How to apply:** Keep cost persistence, validation and reporting separate. If an existing financial workflow needs a change, raise it separately rather than silently changing it to suit a profitability calculation.

Do not duplicate included quote work into a second set of quote items just to make it selectable in costing.

**Why:** That would change the quoting workflow and could count the same work twice in quote totals. Cost links should reference the existing work instead.

**How to apply:** Extend costing-only references when necessary; leave the quote's existing items and pricing unchanged.

Do not show the job profitability/cost breakdown as a persistent panel above all job tabs.

**Why:** The user explicitly asked to remove that shared panel because it appeared across every page in the jobs section.

**How to apply:** Keep costing tools in their dedicated areas; do not reintroduce a shared profitability panel when extending the job layout.

Show profit and margin for each job, not portfolio totals.

**Why:** The user explicitly said the portfolio totals were unavailable and confusing: "i want the profit and margin to show for each job".

**How to apply:** Prioritise each job's profit and numeric margin. Before quote approval, show calculations from the current saved quote as an estimate, not actual accepted revenue. Keep missing quote amounts distinct from zero. Show draft costs pending confirmation rather than implying they are included. Do not reintroduce portfolio totals.
