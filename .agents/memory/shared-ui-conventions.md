---
name: Shared UI conventions
description: Shared-component instructions and the desktop/mobile workspace layout contract.
---

End every future phase prompt with:

> Reuse the existing shared components in src/components/ui and follow the header, search, layout and component rules already established. Do not create new variants of headers, search, buttons, badges, cards or empty states. If something is missing, extend the shared component instead.

**Why:** The user explicitly supplied this as the rule to paste at the end of every future phase prompt.

**How to apply:** Preserve this wording in future phase prompts for this project's UI work. Extend existing shared presentation components rather than introducing competing one-off versions.

Do not add Workspace help or related support controls until the user requests them.

**Why:** The user said Workspace help was not requested, asked for its removal, and will add it at a later time.

**How to apply:** Leave it out of desktop and mobile navigation; do not reintroduce it during layout or consistency work.

At md and above, the sidebar is the only workspace branding/navigation surface; there is no top header. Global search belongs below the tenant identity in the sidebar and supports Ctrl/Cmd+K. The Jobs inline search remains list-local.

Below md, hide the persistent sidebar and keep the bottom tabs. The shared mobile header contains the brand, search and avatar without a section label or hamburger. Job Details replaces the brand with a back arrow.

**Why:** The user explicitly requested one brand presentation, no duplicate desktop header, and these breakpoint-specific shared layouts.

**How to apply:** Keep the breakpoint at md, not lg. Use shared layout components, never per-screen copies. The mobile avatar preserves access to the existing workspace navigation/account controls; do not duplicate the brand inside that drawer. The back-arrow replacement is the explicit exception to displaying a logo on mobile Job Details.

Jobs, Quotes, Invoices and future list screens share one list toolbar, search input and result count. Order: title, stats, toolbar, tabs, count, list, pagination. Local search is always visible, never a collapsed search button or a second global-search overlay.

**Why:** The user explicitly requested this consistent list-search contract and no unrelated added features.

**How to apply:** Use a 44px rounded-xl input, field-specific placeholder, clear/Escape, 150ms case-insensitive filtering and URL `q` persistence. Combine search with tabs/other filters and recalculate tab counts. Keep genuine no-data states distinct from searched zero results, which offer Clear search. On phones, search is full-width before wrapping actions.

Shared page title blocks start with a text-2xl bold title, a text-sm slate-500 subtitle and an optional primary action on the right. No fixed category eyebrow/kicker belongs above a page or panel title, and shared title/panel components must not expose an eyebrow prop.

**Why:** The user explicitly removed all fixed above-title category labels across the app.

**How to apply:** Include employee, auth, error/loading and dialog views when checking consistency. Preserve metric/stat labels, form field labels and sidebar group headings. Above-title context is only appropriate when its information changes, such as a status, job reference or date range.
