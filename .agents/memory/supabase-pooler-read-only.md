---
name: Supabase pooler read-only checks
description: Read-only maintenance connections must verify transaction state explicitly.
---

Do not assume `PGOPTIONS=-c default_transaction_read_only=on` makes a Supabase Session Pooler connection read-only.

**Why:** The project's pooler returned `default_transaction_read_only=off` despite that connection option. An explicit read-only transaction correctly reported `transaction_read_only=on`.

**How to apply:** Wrap maintenance probes in `BEGIN READ ONLY` and verify transaction state. PostgreSQL's `pg_dump` starts its own read-only export transaction. Do not claim a connection enforces read-only access merely because its environment options request it.

Verify live security functions against the tested migration before replacing or wrapping them.

**Why:** This external database is also managed through Supabase, outside workspace version control.

**How to apply:** Resolve genuine schema drift and preserve unrelated live behaviour rather than blindly overwriting functions.
