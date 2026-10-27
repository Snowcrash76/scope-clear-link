---
name: Receipt transcription rules
description: User-required boundaries for receipt extraction and review.
---

Extract only visible receipt information. Missing or unreadable supplier, ABN, date, receipt number, line-item fields, subtotal, GST, total and currency must be null, not inferred. Never use web search to fill gaps.

**Why:** The user explicitly requires transcription rather than enrichment, with editable review and warnings before saving.

**How to apply:** Disable external tools in the extraction request, validate structured output on the backend, and keep keys server-side. Do not assume AUD from a dollar sign or business context. Preserve inconsistent printed totals so the reviewer sees the actual discrepancy instead of silently correcting it. Mixed taxable and GST-free purchases may have valid GST below 10% of the entire subtotal.
