---
name: Shared UI conventions
description: Shared-component instructions and the desktop/mobile workspace layout contract.
---

End every future phase prompt with:

> Reuse the existing shared components in src/components/ui and follow the header, search, layout and component rules already established. Do not create new variants of headers, search, buttons, badges, cards or empty states. If something is missing, extend the shared component instead.

**Why:** The user explicitly supplied this as the rule to paste at the end of every future phase prompt.

**How to apply:** Preserve this wording in future phase prompts for this project's UI work. Extend existing shared presentation components rather than introducing competing one-off versions.

At md and above, the sidebar is the only workspace branding/navigation surface; there is no top header. Global search belongs below the tenant identity in the sidebar and supports Ctrl/Cmd+K. The Jobs inline search remains list-local.

Below md, hide the persistent sidebar and keep the bottom tabs. The shared mobile header contains the brand, search and avatar without a section label or hamburger. Job Details replaces the brand with a back arrow.

**Why:** The user explicitly requested one brand presentation, no duplicate desktop header, and these breakpoint-specific shared layouts.

**How to apply:** Keep the breakpoint at md, not lg. Use shared layout components, never per-screen copies. The mobile avatar preserves access to the existing workspace navigation/account controls; do not duplicate the brand inside that drawer. The back-arrow replacement is the explicit exception to displaying a logo on mobile Job Details.
