# Stored quote totals repair

The post-merge setup runs `node scripts/repair-quote-totals.mjs` against the
existing Supabase database. It requires the configured `VITE_SUPABASE_URL`
and `SUPABASE_SERVICE_ROLE_KEY`; no schema changes or new secrets are needed.
Do not run it against the shared database from a task fork.

For projects with approved change requests, the repair recalculates the active
quote's subtotal, GST amount and total using the Quote Details de-duplication
rules. It preserves quote status, tokens, client comments and approval dates,
and does not delete scope items or quote lines. Quotes without approved
changes are untouched. It is safe to rerun; amounts already correct to cents
are not rewritten.

Superseded quotes are not recalculated from current scope: that would change
historical offers and accepted amounts. Projects without an active quote are
skipped. The authorized client data gateway also recalculates the active quote
after a client approves or declines a variation, without requiring a trade login.

The repair pages all reads and fails if a read/write fails or a quote was
edited during repair. A failure blocks post-merge setup rather than silently
claiming the old totals were fixed. Check database access and rerun the command
after resolving the failure. The summary logs counts only, not client data.

Regression checks: `node --test tests/quoteTotals.test.mjs`.
The tests use an isolated in-memory database adapter and never contact Supabase.

Client-token approval regression checks (real HTTP gateway, synthetic database):

```sh
node_modules/.bin/esbuild tests/clientQuoteTotals.test.ts --bundle --platform=node --format=esm --packages=external --outfile=generated-artifacts/clientQuoteTotals.test.mjs
node --test generated-artifacts/clientQuoteTotals.test.mjs
```
