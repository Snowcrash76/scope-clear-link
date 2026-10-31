---
name: Visual theme
description: User preference for the app's background and theme.
---

Use the light “Option C: Clean blue” theme with white surfaces and a pale background, not a dark theme.

**Why:** The user rejected the dark theme, then explicitly selected the Clean blue screenshot and supplied its light palette.

**How to apply:** Preserve the shared blue-primary/white-secondary direction and Inter typography. This replaces the earlier amber primary styling. Restyling must not change business logic, calculations, permissions, routes or navigation structure; never copy fictional screenshot metrics. Do not reintroduce a separate Team theme.

Verify semantic colours against the actual rendered background, including opacity.

**Why:** A warning token pair met 4.5:1, but using its dark colour as text on a translucent tinted background reduced contrast below that threshold.

**How to apply:** Use complete semantic foreground/background pairs for status badges, or foreground text on tinted notices. Measure rendered contrast rather than assuming that using token names alone guarantees accessibility. Green text on the requested soft green or translucent green fills can also fall below 4.5:1; keep the green icon/dot and fill, but use foreground text for readable small labels.

Keep business Schedule in the normal app layout, put job section navigation above the content rather than beside it without an additional “All sections” button, and keep Variations in jobs rather than the main menu.

**Why:** The user explicitly requested consistent navigation across these pages.

**How to apply:** Preserve these placements in future navigation redesigns without changing employee access boundaries.

Keep one compact, full-width job header with client details only once and supported overflow actions behind an icon, not a separate “Actions” row. Job tabs are plain text with an active blue underline, in normal flow rather than sticky. Show a next-action card only for a real linked action.

**Why:** The user explicitly requested these refinements after finding repeated client details, redundant variation banners and an idle next-action card confusing.

**How to apply:** Preserve this job-page structure in later design work. Do not restore resolved variation-update banners or invent unsupported archive, delete or client-link rotation actions.
