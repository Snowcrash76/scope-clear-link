---
name: Local preview verification
description: Local server and fixture interactions that can invalidate otherwise correct UI verification.
---

Keep one application server on the forwarded preview port, and isolate browser fixtures from unrelated development reloads.

**Why:** An orphaned server can keep serving old source while a restarted workflow silently binds a different port. Rebuilding fixture bundles can also trigger reloads in other test pages. Both produced misleading failures during a presentation-only change.

**How to apply:** Check which process actually owns the preview port when workflow readiness and browser results disagree. Run fixture suites serially and isolate their development reload transport, not application authentication. Wait for the page's meaningful elements rather than unrelated third-party requests.
