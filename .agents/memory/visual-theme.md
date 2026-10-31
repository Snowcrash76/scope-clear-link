---
name: Visual theme
description: User preference for the app's background and theme.
---

Use a white background rather than a dark theme for this app.

**Why:** The user said they do not like the dark theme and asked to make the background white.

**How to apply:** Preserve white backgrounds and the shared amber-primary/outlined-secondary direction. The user explicitly requested one management design system, readable 14px+ text and dark text on amber controls; do not reintroduce a separate Team theme.

Verify semantic colours against the actual rendered background, including opacity.

**Why:** A warning token pair met 4.5:1, but using its dark colour as text on a translucent tinted background reduced contrast below that threshold.

**How to apply:** Use complete semantic foreground/background pairs for status badges, or foreground text on tinted notices. Measure rendered contrast rather than assuming that using token names alone guarantees accessibility.

Keep business Schedule in the normal app layout, put job section navigation above the content rather than beside it, and keep Variations in jobs rather than the main menu.

**Why:** The user explicitly requested consistent navigation across these pages.

**How to apply:** Preserve these placements in future navigation redesigns without changing employee access boundaries.
