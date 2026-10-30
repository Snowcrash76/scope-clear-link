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

Prioritise each job's profit and margin, with a clearly labelled totals row on Profitability.

**Why:** The user said portfolio totals were confusing and wanted figures for each job. Their later UI brief explicitly requested a Profitability totals row; that supersedes the earlier prohibition on totals.

**How to apply:** Keep per-job figures prominent. Before quote approval, label calculations as estimates. Keep missing revenue distinct from zero, and exclude draft costs. Totals must disclose incomplete/missing revenue rather than presenting a partial sum as complete.

The Profitability section uses confirmed receipt costs including GST.

**Why:** The user explicitly requested GST-inclusive costs rather than the previous ex-GST costs.

**How to apply:** Use recorded inclusive receipt amounts, not a blanket 10% uplift, because receipts can include GST-free purchases. Keep draft costs excluded. The request changes costs only: keep quote and invoice revenue unchanged and label their tax basis separately rather than claiming all report figures share one GST basis.

Use the same recorded GST-inclusive confirmed-cost basis for Jobs and Profitability, while quote values display ex GST by default.

**Why:** The user explicitly approved correcting inconsistent displayed profit/margin and GST labels across pages without changing stored prices or tax amounts.

**How to apply:** Profit is ex-GST revenue minus recorded GST-inclusive confirmed costs; margin divides that profit by ex-GST revenue. Label inclusive totals explicitly. Keep margins neutral as “Costs so far” until completeness can actually be established; no labour or no draft costs alone does not prove all expenses are entered.
