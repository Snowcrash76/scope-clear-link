# ScopeClear interface redesign

## Visual direction

- **Layout paradigm:** a field-operations workspace with persistent section navigation, compact but legible data surfaces, and project detail organized around the existing job sections.
- **Mood:** clean, assured blue. A soft blue-grey canvas, ink-toned typography, white work surfaces, deliberate blue actions, and restrained status colors.
- **Typography:** Manrope for headings, DM Sans for interface copy, with tabular and monospaced figures where they aid scanning.
- **Motion:** restrained state transitions, respect for reduced-motion preferences, and no decorative animation that competes with work.

## Coverage

- Shared application shell, section navigation, status labels, and global spacing/type/color tokens.
- Dashboard, job list, quotes, invoices, profitability, and job-level cost/document surfaces.
- Job section header, overview, schedule, team/people, and client records.
- Employee portal navigation, employee work views, and client quote/project review flows.
- Branded sign-in, account creation, password recovery/reset, not-found, and the public landing page.
- Development-only `/design-preview` route, loaded lazily and excluded from production routing.

## Truth and capability notes

- Quote values are identified as ex-GST or inc-GST according to the existing calculation and stored value.
- Invoice receivables use existing invoice totals and payment statuses; no collected-in-the-last-30-days KPI is shown because a recorded `paid_at` timestamp is not available.
- Profitability summary figures are taken from existing job cost calculations and configured thresholds.
- Schedule counts are limited to the selected visible date range; the page does not claim booked-hour or capacity figures.
- Documents remain attached to jobs. A separate company-wide document library is not represented because no such capability exists.
- No invoice-generation command is added to the global invoice page; the existing handler remains the only source of invoice creation.
- Client and employee permissions, protected routes, approval flows, and secure link behavior remain unchanged.

## Verification note

TypeScript checks were run at the committed UI stages. Browser-suite runs were intentionally left to the owning agent while fixture and runner changes were being stabilized; earlier stage runner attempts timed out and are not reported as passes.
