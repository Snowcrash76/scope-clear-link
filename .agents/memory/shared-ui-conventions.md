---
name: Shared UI conventions
description: User's standing instruction for future consistency-refactor phase prompts.
---

End every future phase prompt with:

> Reuse the existing shared components in src/components/ui and follow the header, search, layout and component rules already established. Do not create new variants of headers, search, buttons, badges, cards or empty states. If something is missing, extend the shared component instead.

**Why:** The user explicitly supplied this as the rule to paste at the end of every future phase prompt.

**How to apply:** Preserve this wording in future phase prompts for this project's UI work. Extend existing shared presentation components rather than introducing competing one-off versions.
