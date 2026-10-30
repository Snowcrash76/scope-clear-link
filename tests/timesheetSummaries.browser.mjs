import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base)
  throw new Error("Set MOBILE_TEST_BASE_URL to the running development app.");
await mkdir("generated-artifacts", { recursive: true });
await build({
  entryPoints: ["tests/employeePortal.fixture.tsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  alias: { "@": resolve("src") },
  define: { "process.env.NODE_ENV": '"development"' },
  outfile: "generated-artifacts/timesheet-summary.js",
});
await writeFile(
  "generated-artifacts/timesheet-summary.html",
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/timesheet-summary.js"></script>',
);
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
}).format(new Date());
const d = new Date(today + "T12:00:00Z");
d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
const monday = d.toISOString().slice(0, 10);
const employee = {
  id: "self",
  name: "Fixture employee",
  email: "self@example.invalid",
  role: "labourer",
  active: true,
  hourly_rate: 42,
  auth_user_id: "synthetic-self-auth",
};
const coworker = {
  ...employee,
  id: "other",
  name: "Other team member",
  hourly_rate: 99,
  auth_user_id: "synthetic-reviewer-auth",
};
const job = {
  id: "job",
  name: "Fixture job",
  client_name: "Fixture client",
  client_address: "",
  employee_notes: "",
};
function entry(id, status, hours, rate, extra = {}) {
  return {
    id,
    employee_id: employee.id,
    project_id: job.id,
    work_date: today,
    started_at: today + "T00:00:00Z",
    ended_at: new Date(
      Date.parse(today + "T00:00:00Z") + hours * 3600000,
    ).toISOString(),
    break_minutes: 0,
    paid_minutes: hours * 60,
    status,
    rate_snapshot: rate,
    notes: "",
    created_at: today + "T00:00:00Z",
    ...extra,
  };
}
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
try {
  for (const width of [320, 390, 1280])
    for (const mode of ["employee", "owner", "admin", "missing"]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      const own = [
        entry("approved", "approved", 8, mode === "missing" ? null : 40, {
          break_minutes: 30,
          paid_minutes: 450,
        }),
        entry("pending", "submitted", 2, null),
        entry("draft", "draft", 1, null),
        entry("running", "draft", 1, null, {
          ended_at: null,
          paid_minutes: null,
        }),
      ];
      const other = entry("other-draft", "draft", 1, null, {
        employee_id: coworker.id,
      });
      const management = mode === "owner" || mode === "admin";
      const previousWeek = new Date(`${monday}T12:00:00Z`);
      previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);
      const audit = [
        ...Array.from({ length: 25 }, (_, index) => ({
          id: `synthetic-review-${index}`, employee_id: employee.id,
          actor_id: coworker.auth_user_id,
          action: index === 23 ? "week.rejected" : "week.approved",
          created_at: `${today}T01:00:${String(index).padStart(2, "0")}Z`,
          detail: { week_start: monday, comment: index === 23 ? "Synthetic correction reason" : "" },
        })),
        { id: "other-person-event", employee_id: coworker.id, actor_id: "unresolved-private-actor",
          action: "time.manual", created_at: `${today}T01:01:00Z`, detail: { work_date: today } },
        { id: "old-week-event", employee_id: employee.id, actor_id: coworker.auth_user_id,
          action: "week.approved", created_at: `${today}T01:02:00Z`,
          detail: { week_start: previousWeek.toISOString().slice(0, 10) } },
      ];
      await page.route("**/api/**", async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === "/api/employee/session")
          return route.fulfill({
            json: {
              employee:
                mode === "owner"
                  ? null
                  : {
                      ...employee,
                      role: mode === "admin" ? "admin" : "labourer",
                    },
              canManageTeam: management,
            },
          });
        if (path === "/api/employee/bootstrap")
          return route.fulfill({
            json: {
              employee,
              hourly_rate: 42,
              timezone: "Australia/Sydney",
              today,
              permissions: { review_timesheets: false },
              jobs: [job],
              entries: own,
              submissions: [],
              assignments: [],
              documents: [],
              notes: [],
              notifications: [],
            },
          });
        if (path === "/api/team/bootstrap")
          return route.fulfill({
            json: {
              employees: [employee, coworker],
              timezone: "Australia/Sydney",
              jobs: [job],
              entries: [...own, other],
              submissions: [
                {
                  id: "submitted",
                  employee_id: employee.id,
                  week_start: monday,
                  status: "approved",
                },
              ],
              appointments: [],
              assignments: [],
              permissions: {},
              notes: [],
              documents: [],
              audit,
            },
          });
        return route.fulfill({ json: [] });
      });
      await page.goto(
        base +
          "/generated-artifacts/timesheet-summary.html?view=" +
          (management ? "team-timesheets" : "timesheets"),
      );
      let summary;
      assert.doesNotMatch(await page.locator("body").innerText(), /Time on site|Paid after breaks|Immutable review audit/);
      if (management) {
        const total = page.getByRole("button", { name: /^Total hours:/ });
        await total.waitFor();
        assert.match(await total.innerText(), /11h 30m/);
        await total.click();
        await page.getByRole("dialog").getByText(/Includes 0h 30m of unpaid breaks removed/).waitFor();
        await page.keyboard.press("Escape");
        const strip = page
          .getByText("Estimated approved pay", { exact: true })
          .locator("..");
        if (mode === "missing") {
          assert.match(await strip.innerText(), /Unavailable/);
          assert.match(await strip.innerText(), /missing a recorded rate/);
        } else assert.match(await strip.innerText(), /\$300\.00/);
        await page
          .getByRole("button", {
            name: "Review Other team member",
            exact: true,
          })
          .click();
        summary = page.getByTestId("timesheet-review-drawer");
        await summary.waitFor();
        assert.match(await summary.innerText(), /Total hours[\s\S]*1h/);
        assert.doesNotMatch(await summary.innerText(), /Estimated approved pay|Paid after breaks/, "Per-person drawer does not repeat the global pay dashboard");
      } else {
        const total = page.getByRole("button", { name: /Includes .*unpaid breaks removed/ });
        await total.waitFor();
        assert.match(await total.innerText(), /10h 30m/);
        await total.click();
        await page.getByRole("dialog").getByText(/Includes 0h 30m of unpaid breaks removed/).waitFor();
        await page.keyboard.press("Escape");
        await page.locator("details summary").click();
        summary = page.getByRole("region", { name: "Timesheet details" });
        await summary.waitFor();
        assert.match(await summary.innerText(), /running clock is excluded/);
        assert.match(await summary.innerText(), /\$42\.00 \/ hr/);
        if (mode === "missing") {
          assert.match(await summary.innerText(), /Unavailable/);
          await summary.getByRole("button", { name: /Missing recorded rate/ }).click();
          await page.getByRole("dialog").getByText(/missing a recorded rate/).waitFor();
          await page.keyboard.press("Escape");
        } else assert.match(await summary.innerText(), /\$300\.00/);
      }
      if (!management)
        assert.equal(
          await page.getByText("Other team member", { exact: true }).count(),
          0,
        );
      else {
        assert.equal(
          await page
            .getByTestId("timesheet-member-other")
            .filter({ visible: true })
            .count(),
          1,
          "One visible roster row for the coworker",
        );
        await page
          .getByRole("button", { name: "Close review", exact: true })
          .click();
        const person = page.getByTestId("timesheet-member-self").filter({ visible: true });
        assert.match(await person.innerText(), /Last reviewed by Other team member/);
        const historyTrigger = person.getByRole("button", { name: "History", exact: true });
        await historyTrigger.click();
        const history = page.getByRole("dialog", { name: "Review history", exact: true });
        await history.waitFor();
        assert.equal(await history.locator("time").count(), 10, "Only ten events initially");
        assert.doesNotMatch(await history.innerText(), /unresolved-private-actor|week\.approved|week\.rejected|other-person-event/);
        assert.match(await history.innerText(), /Synthetic correction reason/);
        await history.getByRole("button", { name: "Show more", exact: true }).click();
        assert.equal(await history.locator("time").count(), 25, "History stays scoped to this person and week");
        await page.keyboard.press("Escape");
        await history.waitFor({ state: "hidden" });
        await page.waitForFunction(() => document.activeElement?.textContent.trim() === "History" &&
          document.activeElement.closest('[data-testid="timesheet-member-self"]'), undefined, { timeout: 3000 });
        await page.getByRole("button", { name: "Timesheet options", exact: true }).click();
        await page.getByRole("menuitem", { name: "Review history", exact: true }).click();
        await history.waitFor();
        assert.equal(await history.locator("time").count(), 20, "Global history paginates twenty loaded records");
        await history.getByLabel("Person", { exact: true }).selectOption(coworker.id);
        assert.equal(await history.locator("time").count(), 1);
        assert.match(await history.innerText(), /Admin/);
        await history.getByLabel("From", { exact: true }).fill("2099-01-01");
        await history.getByText("No review activity for this week yet.", { exact: true }).waitFor();
        await page.keyboard.press("Escape");
        await page
          .getByRole("button", { name: "Previous week", exact: true })
          .click();
        await page
          .getByText("No time recorded this week", { exact: true })
          .waitFor();
        await page
          .getByRole("button", { name: "Next week", exact: true })
          .click();
        await page
          .getByTestId("timesheet-member-other")
          .filter({ visible: true })
          .waitFor();
        if (mode === "admin")
          assert.equal(
            await page
              .getByRole("button", { name: "Reopen week", exact: true })
              .count(),
            0,
            "No self approval/reopening",
          );
      }
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        "No horizontal overflow",
      );
      assert.deepEqual(errors, []);
      console.log(
        `PASS ${mode} weekly hours, historical pay, missing rates and privacy at ${width}px`,
      );
      await context.close();
    }
} finally {
  await browser.close();
}
