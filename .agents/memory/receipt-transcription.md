---
name: Receipt transcription rules
description: User-required boundaries for receipt extraction and review.
---

Extract only visible receipt information. Missing or unreadable supplier, ABN, date, receipt number, line-item fields, subtotal, GST, total and currency must be null, not inferred. Never use web search to fill gaps.

**Why:** The user explicitly requires transcription rather than enrichment, with editable review and warnings before saving.

**How to apply:** Disable external tools in the extraction request, validate structured output on the backend, and keep keys server-side. Do not assume AUD from a dollar sign or business context. Preserve inconsistent printed totals so the reviewer sees the actual discrepancy instead of silently correcting it. Mixed taxable and GST-free purchases may have valid GST below 10% of the entire subtotal.

Default the Costs receipt review form to AUD, including when the receipt reader returns no currency.

**Why:** The user said AUD is the only currency they will use and asked for it as the default.

**How to apply:** Treat AUD as the user's form default, not extracted receipt data. Keep raw unreadable currency null in extraction results; preserve explicit foreign-currency detections and their warning rather than silently converting amounts.

Automatically calculate a blank Ex GST amount in the costing review form, without replacing a printed or entered subtotal.

**Why:** The user explicitly asked for the Ex GST box to be calculated and filled if blank.

**How to apply:** This is review-form arithmetic, not receipt extraction. Prefer total minus the provided GST, including mixed-tax receipts. When GST is also missing, use the form's standard 10%/GST-free setting and label the calculation; keep the raw receipt extraction unchanged.
