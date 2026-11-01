---
name: Local preview verification
description: Local server and fixture interactions that can invalidate otherwise correct UI verification.
---

Keep one application server on the forwarded preview port, and isolate browser fixtures from unrelated development reloads.

**Why:** An orphaned server can keep serving old source while a restarted workflow silently binds a different port. Rebuilding fixture bundles can also trigger reloads in other test pages. Both produced misleading failures during a presentation-only change.

**How to apply:** Check which process actually owns the preview port when workflow readiness and browser results disagree. Run fixture suites serially and isolate their development reload transport, not application authentication. Wait for the page's meaningful elements rather than unrelated third-party requests.

An open dialog hides background job sections from accessible role locators.

**Why:** Successful invoice navigation can immediately open its invoice viewer. Waiting for the background job section then incorrectly reports failed navigation while the correct invoice is already visible.

**How to apply:** Verify the new dialog first and close it before asserting background navigation. Keep the application's focus and accessibility handling intact.

Integration-test dependencies must share one authoritative fixture state.

**Why:** Independently mocked authentication and data modules can instantiate separate stores, producing apparent application regressions when the test mutates a different store from the rendered component.

**How to apply:** Keep state ownership coherent across mocked dependencies and rule out disagreement between fixture stores before changing application logic. Reuse complete, API-shaped service fixtures when checking navigation: a generic empty response can work on the initial list but crash a destination that loads additional structured data. Diagnose that fixture mismatch before changing production code.

Re-enter the explicit fixture URL when resetting a routed browser fixture; do not assume a page reload still loads the fixture.

**Why:** The synthetic app updates browser history to its real route. Reloading that route loads the real application's authentication instead of the synthetic fixture, producing misleading timeouts.

**How to apply:** Navigate back to the generated fixture entry URL for reset/error-state checks. For animated sheets, disable animations during screenshots or wait for the transition to finish; a visible locator alone can still be outside the viewport during slide-in.
