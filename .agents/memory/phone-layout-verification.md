---
name: Phone layout verification
description: Verifying mobile quote layouts when the browser cannot access signed-in screens.
---

Public landing, login and demo screenshots do not establish that the signed-in quote layout fits a phone.

**Why:** A mobile pass checked those public pages but missed intrinsic-width overflow in the real quote component, which the user then reported from their published Android session.

**How to apply:** Inspect the specific screen in the user's screenshot. When authenticated visual checks are unavailable, render the real component in an isolated synthetic-data fixture and check narrow widths without connecting customer data or bypassing authentication. Keep fixtures out of deployment and distinguish component verification from a signed-in end-to-end test. Remind the user that changes to a published site need republishing.
