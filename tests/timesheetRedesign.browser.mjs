import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

// Real UI, isolated synthetic API responses. Not a signed-in production test.
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const base = process.env.MOBILE_TEST_BASE_URL;
if (!base)
  throw new Error("Set MOBILE_TEST_BASE_URL to the development preview.");
await mkdir("generated-artifacts", { recursive: true });
await build({
  entryPoints: ["tests/employeePortal.fixture.tsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  alias: { "@": resolve("src") },
  define: { "process.env.NODE_ENV": '"development"' },
  outfile: "generated-artifacts/timesheet-redesign.js",
});
await writeFile(
  "generated-artifacts/timesheet-redesign.html",
  '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><div id="root"></div><script type="module" src="/generated-artifacts/timesheet-redesign.js"></script>',
);

const timezone = "Australia/Sydney";
const today = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
  new Date(),
);
const start = new Date(`${today}T12:00:00Z`);
start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
const monday = start.toISOString().slice(0, 10);
const day = (n) =>
  new Date(start.getTime() + n * 86400000).toISOString().slice(0, 10);
const member = (id, name) => ({
  id,
  name,
  email: `${id}@example.invalid`,
  role: "labourer",
  active: true,
  hourly_rate: 40,
});
const employees = [
  member("approved", "Ada Approved"),
  member("draft", "Ben Draft"),
  member("missing", "Cora Missing"),
  member("failed", "Yara Submitted"),
  member("worker", "Zed Submitted"),
];
const worker = employees.at(-1);
const job = {
  id: "job",
  name: "Synthetic job with a long but readable name",
  client_name: "Synthetic client",
  client_address: "",
  employee_notes: "",
};
const entry = (id, employee, workDate, minutes, status = "draft") => ({
  id,
  employee_id: employee,
  project_id: "job",
  work_date: workDate,
  started_at: `${workDate}T20:00:00.000Z`,
  ended_at: new Date(
    Date.parse(`${workDate}T20:00:00.000Z`) + (minutes + 30) * 60000,
  ).toISOString(),
  break_minutes: 30,
  paid_minutes: minutes,
  status,
  rate_snapshot: status === "approved" ? 40 : null,
  notes:
    "Recorded work with a longer note that should remain readable on a narrow phone screen without making the page scroll sideways.",
  created_at: `${workDate}T20:00:00.000Z`,
});
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
});
function url(view) {
  return `${base}/generated-artifacts/timesheet-redesign.html?view=${view}`;
}
async function makePage(width, mode, options = {}) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const management = mode !== "employee";
  const state = {
    calls: [],
    failBatch: false,
    failBootstrap: false,
    entries: management
      ? [
          entry("approved-entry", "approved", day(0), 300, "approved"),
          entry("draft-entry", "draft", day(0), 60),
          entry("failed-entry", "failed", day(0), 120, "submitted"),
          entry("worker-mon", "worker", day(0), 450, "submitted"),
          entry("worker-tue", "worker", day(1), 120, "submitted"),
        ]
      : [
          entry("worker-mon", "worker", day(0), 450),
          entry("worker-mon-2", "worker", day(0), 60),
          entry("worker-tue", "worker", day(1), 120),
        ],
    submissions: management
      ? ["approved", "failed", "worker"].map((id) => ({
          id: `submission-${id}`,
          employee_id: id,
          week_start: monday,
          status: id === "approved" ? "approved" : "submitted",
          review_comment: null,
        }))
      : [],
    ...options,
  };
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    const body = request.postDataJSON();
    if (request.method() !== "GET")
      state.calls.push({ path, body, method: request.method() });
    if (path === "/api/employee/session")
      return route.fulfill({
        json: {
          employee: management
            ? mode === "admin"
              ? { ...worker, id: "admin", role: "admin" }
              : null
            : worker,
          canManageTeam: management,
        },
      });
    if (path === "/api/team/bootstrap" || path === "/api/employee/bootstrap") {
      if (state.failBootstrap)
        return route.fulfill({
          status: 503,
          json: { error: "Synthetic temporary outage" },
        });
      return route.fulfill({
        json: {
          employee: worker,
          hourly_rate: 40,
          employees,
          jobs: [job],
          entries: state.entries,
          submissions: state.submissions,
          assignments: [],
          documents: [],
          notes: [],
          notifications: [],
          appointments: [],
          audit: [],
          permissions: { review_timesheets: false },
          timezone,
          today,
        },
      });
    }
    if (path === "/api/team/review") {
      if (state.failBatch && body.submission_id === "submission-failed")
        return route.fulfill({
          status: 409,
          json: { error: "Synthetic review conflict" },
        });
      const submission = state.submissions.find(
        (item) => item.id === body.submission_id,
      );
      submission.status =
        body.decision === "reopen" ? "rejected" : body.decision;
      state.entries
        .filter((item) => item.employee_id === submission.employee_id)
        .forEach((item) => {
          item.status = body.decision === "approved" ? "approved" : "draft";
          item.rate_snapshot = body.decision === "approved" ? 40 : null;
        });
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/employee/time" && request.method() === "POST") {
      state.entries.push({
        ...entry("new-entry", "worker", body.started_at.slice(0, 10), 60),
        ...body,
      });
      return route.fulfill({ json: { success: true } });
    }
    if (path === "/api/employee/clock-out") {
      const running = state.entries.find((item) => item.id === body.entry_id);
      running.ended_at = new Date(
        Date.parse(running.started_at) + 3600000,
      ).toISOString();
      return route.fulfill({ json: { success: true } });
    }
    return route.fulfill({ json: [] });
  });
  return { page, state, errors };
}
async function noOverflow(page) {
  const overflow = await page.evaluate(() => ({
    fits: document.documentElement.scrollWidth <= innerWidth,
    width: innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    elements: [...document.querySelectorAll("body *")]
      .filter((node) => {
        const rect = node.getBoundingClientRect();
        return rect.width && (rect.right > innerWidth + 1 || rect.left < -1);
      })
      .slice(0, 12)
      .map((node) => ({
        tag: node.tagName,
        class: node.className,
        text: node.textContent.slice(0, 100),
      })),
  }));
  assert.equal(
    overflow.fits,
    true,
    `No horizontal page overflow: ${JSON.stringify(overflow)}`,
  );
  for (const dialog of await page.getByRole("dialog").all()) {
    const box = await dialog.boundingBox();
    if (box)
      assert.ok(
        box.x >= 0 && box.x + box.width <= page.viewportSize().width + 1,
        "Dialog fits viewport",
      );
  }
}
const visibleMember = (page, id) =>
  page.getByTestId(`timesheet-member-${id}`).filter({ visible: true });
async function statusContrast(page) {
  const contrasts = await page.evaluate(() => {
    const rgb = (value) => (value.match(/[\d.]+/g) ?? []).map(Number);
    const luminance = (color) =>
      color
        .slice(0, 3)
        .map((channel) => {
          const s = channel / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        })
        .reduce(
          (sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index],
          0,
        );
    return [...document.querySelectorAll("span")]
      .filter(
        (node) =>
          node.getClientRects().length &&
          node.querySelector("svg") &&
          /^(Draft|Submitted|Approved|Rejected|Running)$/.test(
            node.textContent.trim(),
          ),
      )
      .map((node) => {
        const chain = [];
        for (let parent = node; parent; parent = parent.parentElement)
          chain.unshift(parent);
        let background = [255, 255, 255];
        for (const ancestor of chain) {
          const color = rgb(getComputedStyle(ancestor).backgroundColor);
          const alpha = color[3] ?? 1;
          background = background.map(
            (channel, index) => color[index] * alpha + channel * (1 - alpha),
          );
        }
        const fore = luminance(rgb(getComputedStyle(node).color)),
          back = luminance(background);
        return {
          status: node.textContent.trim(),
          ratio: (Math.max(fore, back) + 0.05) / (Math.min(fore, back) + 0.05),
        };
      });
  });
  assert.ok(contrasts.length > 0);
  for (const contrast of contrasts)
    assert.ok(contrast.ratio >= 4.5, JSON.stringify(contrast));
}
try {
  for (const width of [320, 375, 768, 1280]) {
    const { page, state, errors } = await makePage(width, "owner");
    await page.goto(url("team-timesheets"));
    await visibleMember(page, "worker").waitFor();
    await statusContrast(page);
    const ids = await page
      .locator('[data-testid^="timesheet-member-"]:visible')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.testid));
    assert.equal(
      ids[0],
      "timesheet-member-failed",
      "Submitted rows sort before approved/drafts",
    );
    assert.equal(ids[1], "timesheet-member-worker");
    assert.equal(
      await page.getByRole("region", { name: "Timesheet totals" }).count(),
      0,
      "No duplicate global/per-person summary blocks",
    );
    await page.getByRole("button", { name: /^Missing hours/ }).click();
    await visibleMember(page, "missing").waitFor();
    assert.equal(await visibleMember(page, "worker").count(), 0);
    await page.getByRole("button", { name: /^All \d/ }).click();
    const trigger = page.getByRole("button", {
      name: "Review Zed Submitted",
      exact: true,
    });
    await trigger.click();
    const drawer = page.getByTestId("timesheet-review-drawer");
    await drawer.waitFor();
    assert.equal(
      await drawer.getByText(/This week is locked/).count(),
      1,
      "One lock notice per week",
    );
    await page.keyboard.press("Shift+Tab");
    assert.equal(
      await drawer.evaluate((node) => node.contains(document.activeElement)),
      true,
      "Focus trapped in drawer",
    );
    await noOverflow(page);
    await page.screenshot({
      path: `generated-artifacts/timesheets-manager-drawer-${width}.png`,
    });
    await page.keyboard.press("Escape");
    await drawer.waitFor({ state: "hidden" });
    await page.waitForFunction(
      () =>
        document.activeElement?.getAttribute("aria-label") ===
        "Review Zed Submitted",
    );
    await page
      .getByRole("button", { name: "Previous week", exact: true })
      .click();
    await page
      .getByText("No time recorded this week", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "This week", exact: true }).click();
    await visibleMember(page, "worker").waitFor();
    await page
      .getByRole("button", { name: "Approve all submitted", exact: true })
      .click();
    const confirmation = page.getByRole("alertdialog");
    await confirmation.getByText("Zed Submitted", { exact: true }).waitFor();
    await confirmation.getByText("Yara Submitted", { exact: true }).waitFor();
    await confirmation
      .getByRole("button", { name: "Cancel", exact: true })
      .click();
    assert.equal(state.calls.length, 0, "Cancel does not approve");
    await page
      .getByRole("button", { name: "Approve all submitted", exact: true })
      .click();
    state.failBatch = true;
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Approve all submitted", exact: true })
      .click();
    await page.getByText(/Zed Submitted: approved/).waitFor();
    await page.getByText(/Yara Submitted: Synthetic review conflict/).waitFor();
    assert.equal(
      state.calls.filter((call) => call.path === "/api/team/review").length,
      2,
    );
    assert.equal(
      state.submissions.find((item) => item.employee_id === "worker").status,
      "approved",
    );
    assert.equal(
      state.submissions.find((item) => item.employee_id === "failed").status,
      "submitted",
    );
    await noOverflow(page);
    await page.screenshot({
      path: `generated-artifacts/timesheets-manager-${width}.png`,
    });
    assert.deepEqual(errors, []);
    console.log(
      `PASS manager sorting, filters, week navigation, drawer focus, one lock, batch confirmation/partial failure at ${width}px`,
    );
    await page.close();

    const employee = await makePage(width, "employee");
    await employee.page.goto(url("timesheets"));
    await employee.page
      .getByRole("button", { name: "Add time", exact: true })
      .waitFor();
    await statusContrast(employee.page);
    const text = await employee.page.locator("main").innerText();
    assert.match(text, /10h 30m/);
    assert.match(text, /8h 30m/);
    assert.match(text, /2h 0[0]?m/);
    assert.equal(
      await employee.page.locator("#employee-entry-form").count(),
      0,
      "Form hidden until requested",
    );
    await employee.page
      .getByRole("button", { name: "Add time", exact: true })
      .click();
    const form = employee.page.getByRole("dialog");
    await form.waitFor();
    await noOverflow(employee.page);
    await employee.page.screenshot({
      path: `generated-artifacts/timesheets-employee-form-${width}.png`,
    });
    await employee.page.keyboard.press("Escape");
    await form.waitFor({ state: "hidden" });
    await employee.page.waitForFunction(() =>
      document.activeElement?.textContent.includes("Add time"),
    );
    await noOverflow(employee.page);
    await employee.page.screenshot({
      path: `generated-artifacts/timesheets-employee-${width}.png`,
    });
    await employee.page
      .getByRole("button", { name: "Add time", exact: true })
      .click();
    await employee.page.locator("#entry-start").fill(`${monday}T08:00`);
    await employee.page.locator("#entry-end").fill(`${monday}T07:00`);
    await employee.page
      .getByRole("button", { name: "Save time entry", exact: true })
      .click();
    await employee.page.getByRole("dialog").getByRole("alert").waitFor();
    assert.equal(
      employee.state.calls.length,
      0,
      "Invalid time range is not saved",
    );
    await employee.page
      .getByRole("button", { name: "Duration", exact: true })
      .click();
    await employee.page.locator("#entry-duration").fill("8");
    await employee.page
      .getByRole("button", { name: "45", exact: true })
      .click();
    await employee.page
      .locator("#entry-notes")
      .fill("Synthetic duration entry");
    await employee.page
      .getByRole("button", { name: "Save time entry", exact: true })
      .click();
    await employee.page.getByRole("dialog").waitFor({ state: "hidden" });
    const creation = employee.state.calls.find(
      (call) => call.path === "/api/employee/time",
    );
    assert.ok(creation);
    assert.equal(creation.body.break_minutes, 45);
    assert.equal(
      Date.parse(creation.body.ended_at) - Date.parse(creation.body.started_at),
      8 * 3600000,
    );
    assert.equal(creation.body.notes, "Synthetic duration entry");
    assert.deepEqual(employee.errors, []);
    console.log(
      `PASS employee day grouping, totals, progressive form, validation, duration save and overflow at ${width}px`,
    );
    await employee.page.close();
  }
  const runningEntry = {
    ...entry("running", "worker", today, 0),
    ended_at: null,
    paid_minutes: null,
    started_at: new Date(Date.now() - 3600000).toISOString(),
  };
  const running = await makePage(375, "employee", { entries: [runningEntry] });
  await running.page.goto(url("timesheets"));
  await running.page
    .getByRole("button", { name: "Clock out", exact: true })
    .click();
  await running.page.getByRole("dialog").waitFor();
  assert.equal(
    await running.page.locator("#clock-out-break").inputValue(),
    "30",
  );
  await running.page.locator("#clock-out-note").fill("Shift complete");
  await running.page
    .getByRole("dialog")
    .getByRole("button", { name: "Clock out", exact: true })
    .click();
  await running.page.waitForFunction(
    () => !document.querySelector("#clock-out-break"),
  );
  assert.ok(
    running.state.calls.some(
      (call) =>
        call.path === "/api/employee/clock-out" &&
        call.body.break_minutes === 30 &&
        call.body.notes === "Shift complete",
    ),
  );
  assert.deepEqual(running.errors, []);
  await running.page.close();
  console.log(
    "PASS employee clock-out dialog uses existing endpoint and break/note payload",
  );
  for (const mode of ["owner", "employee"]) {
    const retry = await makePage(375, mode, { failBootstrap: true });
    await retry.page.goto(
      url(mode === "owner" ? "team-timesheets" : "timesheets"),
    );
    await retry.page
      .getByRole("button", { name: "Retry", exact: true })
      .waitFor();
    retry.state.failBootstrap = false;
    await retry.page
      .getByRole("button", { name: "Retry", exact: true })
      .click();
    if (mode === "owner") await visibleMember(retry.page, "worker").waitFor();
    else
      await retry.page
        .getByRole("button", { name: "Add time", exact: true })
        .waitFor();
    await noOverflow(retry.page);
    assert.deepEqual(retry.errors, []);
    await retry.page.close();
  }
  console.log("PASS manager and employee bootstrap error/retry recovery");
} finally {
  await browser.close();
}
