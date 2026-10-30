---
name: Phone layout verification
description: Verifying actual signed-in components and interaction states on phone layouts.
---

Public landing, login and demo screenshots do not establish that signed-in layouts fit a phone. Blank-form checks also do not establish that attachment previews and populated receipt review states fit.

**Why:** A mobile pass checked those public pages but missed intrinsic-width overflow in the real quote component. A later quote-only fix still left the receipt-photo workflow misaligned on the user's Android phone.

**How to apply:** Inspect the specific screen in the user's screenshot. When authenticated visual checks are unavailable, render the real component in an isolated synthetic-data fixture and check narrow widths without connecting customer data or bypassing authentication. Exercise interactions with large photos, long filenames, populated review fields and long dropdown options; measure both page width and dialog content width instead of relying only on appearance. Keep fixtures out of deployment and distinguish component verification from a signed-in end-to-end test. Remind the user that changes to a published site need republishing.

Modal menu verification must account for the accessibility tree and exit animations.

**Why:** Radix modal menus intentionally hide background controls from accessibility queries while open and may retain closing content during animation. Immediate absence assertions or visible-role queries for background controls can falsely report broken navigation.

**How to apply:** Wait for the menu to finish closing before asserting dismissal or restored focus. For an intentional outside-click test, locate the background control without assuming it remains exposed to assistive technology during the modal state.

Menu-to-dialog handoffs must be verified with Escape, Cancel and reopening the same actions menu, not just the initial confirmation.

**Why:** A native-popup replacement passed initial dialog and timesheet checks but the broader employee portal suite exposed a team-removal Escape/reopen failure.

**How to apply:** Include the full dismissal/reopen interaction when changing portal dialogs or menu modality. Do not infer that passing a timesheet suite proves the separate team-member removal flow works.
