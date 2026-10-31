# ScopeClear — Clean blue styling

## Scope

Presentation changes only. The current navigation, routes, auth, permissions,
financial calculations, approval behaviour and backend data access are unchanged.
Schedule remains in the app layout; job sections remain above the content without
an All sections button. The header Add stages shortcut remains removed.

## Shared styling

- One Inter import and one HSL token palette in `src/index.css`, referenced by
  Tailwind and the shared components.
- Pale page backgrounds, white surfaces, blue primary controls, 16px cards,
  10px inputs/buttons, soft shadows and visible focus rings.
- Real status labels with decorative dots and semantic colours.
- Dashboard statistics retain all six existing metrics, including unpaid and
  overdue invoices; no counts or filters were redefined to match the reference.
- Shared `JobCard` for the dashboard and Jobs list, with responsive Open Job
  styling and existing client actions kept outside the card link.
- Schedule and Team inherit the shared type and palette. Calendar job colours
  remain stable identifiers rather than implying a booking status.
- The existing global search shortcut is retained, with a platform-specific hint.
  No New Job shortcut was added.

## Real data and intentional omissions

- Quote value uses the existing quote summary subtotal and shared AUD formatter,
  explicitly labelled **ex GST**. Missing/non-finite amounts are hidden; zero is
  a legitimate displayed amount.
- Quote reference and valid-until date display only when present and valid.
- Stage progress uses completed stages / total stages; absent stages have no bar.
- Scope category and Assigned to are omitted: neither is available in the
  existing project/quote data supplied to these cards.
- No integration connection status is available to this dashboard, so there is
  no “FIXT Gateway Active” pill.
- No trend, target, fabricated role, generated reference, invented expiry,
  screenshot price or placeholder completion percentage was added.
- No date segmented control was added because the dashboard does not currently
  have a shared date filter wired to statistics and activity.
- Activity retains the existing real events and timestamps. The source has no
  reliable actor field, and there is no aggregate Activity Log route; actor names
  and a nonfunctional View Activity Log action were not invented.
- The empty-state Create Quote button opens the existing New Job flow. No new
  creation or persistence workflow was introduced.
- The screenshot's workflow-toolbox showcase was not added to the live product.

## Verification

- Type check and production build passed.
- 138 unit tests passed, including exact palette values, AA contrast for semantic
  token pairs, status labels/dots, missing quote fields, zero amounts and progress.
- 36 signed-in synthetic-service page checks passed at 375px and 1280px, including
  no overflow, real fixture amounts, no screenshot placeholders, minimum dashboard
  text size, search shortcut and readable job title layout.
- 6 Schedule scenarios passed for managers/employees at 375px, 768px and 1280px.
- 4 job-workspace interaction scenarios passed at 320px, 375px, 768px and 1280px.
- 12 timesheet-summary scenarios and 9 timesheet-management scenarios passed,
  covering roles, historical pay/privacy, editing, review/reopening and deletion.
- Browser fixtures render the actual application components against isolated
  synthetic services; they do not sign in to or mutate customer accounts.
- The public landing page was visually checked. The live signed-in customer
  session was not available to the screenshot browser.

Existing build warnings about chunk size and stale Browserslist data remain.
No dependency upgrades, schema changes or migrations were included.
