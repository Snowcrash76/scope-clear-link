---
name: Job costing boundaries
description: User-required scope boundaries when extending job costing.
---

Job costing must only read existing quote, invoice and client logic for its calculations; do not rewrite or change those workflows as part of expense tracking.

**Why:** The user explicitly asked to add costing without changing existing invoice, quote or client logic.

**How to apply:** Keep cost persistence, validation and reporting separate. If an existing financial workflow needs a change, raise it separately rather than silently changing it to suit a profitability calculation.
