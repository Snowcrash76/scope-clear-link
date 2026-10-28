---
name: Receipt transcription rules
description: User-required boundaries for receipt extraction and review.
---

Extract only visible receipt information. Missing or unreadable supplier, ABN, date, receipt number, line-item fields, subtotal, GST, total and currency must be null, not inferred. Never use web search to fill gaps.

**Why:** The user explicitly requires transcription rather than enrichment, with editable review and warnings before saving.

**How to apply:** Disable external tools in the extraction request, validate structured output on the backend, and keep keys server-side. Do not assume AUD from a dollar sign or business context. Preserve inconsistent printed totals so the reviewer sees the actual discrepancy instead of silently correcting it. Mixed taxable and GST-free purchases may have valid GST below 10% of the entire subtotal.

Treat all Costs receipts as AUD automatically; do not show the per-receipt Australian-dollar confirmation checkbox.

**Why:** The user said AUD is the only currency they will use, then explicitly asked to remove the currency confirmation checkbox and assume AUD on all occasions.

**How to apply:** Use AUD for all cost review/save paths, including editing and restoring receipt attachments, without a separate currency approval step. This is the user's costing policy, not extracted receipt data or currency conversion. Keep raw receipt extraction unchanged and retain the general receipt review before saving.

Automatically calculate a blank Ex GST amount in the costing review form, without replacing a printed or entered subtotal.

**Why:** The user explicitly asked for the Ex GST box to be calculated and filled if blank.

**How to apply:** This is review-form arithmetic, not receipt extraction. Prefer total minus the provided GST, including mixed-tax receipts. When GST is also missing, use the form's standard 10%/GST-free setting and label the calculation; keep the raw receipt extraction unchanged.

Show individual receipt purchases and prices together with the overall receipt total, not only a combined description.

**Why:** The user wants itemisation like their Tradify example, while explicitly retaining a total.

**How to apply:** Keep the items editable and visible after saving. Preserve one receipt-level cost so itemisation does not double-count expenses. Item amounts may be printed inclusive or exclusive of GST; preserve them and check against the appropriate printed subtotal or total without assuming their tax basis.
