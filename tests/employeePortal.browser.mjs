import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
await mkdir("generated-artifacts", { recursive: true });
await build({
  entryPoints: ["tests/employeePortal.fixture.tsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  alias: { "@": resolve("src") },
  define: { "process.env.NODE_ENV": '"development"' },
  outfile: "generated-artifacts/employee-portal.js",
});
await writeFile(
  "generated-artifacts/employee-portal.html",
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/index.css"><title>Employee portal component fixture</title></head><body><div id="root"></div><script type="module" src="/generated-artifacts/employee-portal.js"></script></body></html>',
);

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
});
const base =
  process.env.MOBILE_TEST_BASE_URL ||
  `https://${process.env.REPLIT_DEV_DOMAIN}`;
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Australia/Sydney",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const monday = (() => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
})();
const tomorrow = (() => {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();
const employee = {
  id: "fixture-self",
  name: "Mae Installer",
  email: "mae@example.invalid",
  role: "supervisor",
  active: true,
};
const otherEmployee = {
  id: "fixture-other",
  name: "Liam Field",
  email: "liam@example.invalid",
  role: "labourer",
  active: true,
};
const job = {
  id: "fixture-job",
  name: "Northbridge fit-out",
  client_name: "Cedar Projects",
  client_address: "14 Example Road, Sydney NSW",
  client_phone: "0400 123 456",
  employee_notes: "Meet at loading bay.",
};

// Synthetic responses are confined to this isolated browser fixture. They are
// never written to Supabase, seeded into production, or used to authenticate App routes.
function entry(id, employeeId, startedAt, endedAt, notes, breakMinutes = 30) {
  return {
    id,
    employee_id: employeeId,
    project_id: job.id,
    work_date: today,
    started_at: startedAt,
    ended_at: endedAt,
    break_minutes: breakMinutes,
    notes,
    status: endedAt ? "submitted" : "draft",
    paid_minutes: null,
    created_at: startedAt,
  };
}

function makeApi(page, { owner = false, running = false, admin = false } = {}) {
  const state = {
    isRunning: running,
    start: new Date(Date.now() - 7_000).toISOString(),
    calls: [],
    teamEmployees: [{ ...employee, hourly_rate: 42.75, archived_at: null }],
    rejectRemoval: false,
  };
  page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    if (url.pathname === "/api/employee/session") {
      return route.fulfill({
        json: {
          employee: owner
            ? null
            : { ...employee, role: admin ? "admin" : employee.role },
          canManageTeam: owner || admin,
        },
      });
    }
    if (url.pathname === "/api/employee/bootstrap") {
      const active = state.isRunning
        ? entry("clock-live", employee.id, state.start, null, "")
        : null;
      return route.fulfill({
        json: {
          employee,
          permissions: {
            view_scope: true,
            view_variations: true,
            view_documents: true,
            add_photos: true,
            add_notes: true,
            review_timesheets: true,
          },
          timezone: "Australia/Sydney",
          today,
          jobs: [job],
          assignments: [
            {
              id: "fixture-assignment",
              employee_id: employee.id,
              project_id: job.id,
              appointment_id: "fixture-appointment",
              date: today,
              start_time: "07:00",
              end_time: "15:30",
              notes: null,
            },
          ],
          entries: [
            ...(active ? [active] : []),
            entry(
              "past-entry",
              employee.id,
              new Date(Date.now() - 3_600_000).toISOString(),
              new Date(Date.now() - 1_800_000).toISOString(),
              "Checked power isolation.",
            ),
          ],
          submissions: [
            {
              id: "self-submission",
              employee_id: employee.id,
              week_start: monday,
              status: "submitted",
              review_comment: null,
              submitted_at: new Date().toISOString(),
            },
          ],
          documents: [],
          notes: [],
          notifications: [],
        },
      });
    }
    if (url.pathname === "/api/employee/jobs/fixture-job") {
      return route.fulfill({
        json: {
          job,
          scope: [
            {
              id: "scope",
              title: "Complete site installation",
              description: "Follow the marked plan.",
              category: "included",
            },
          ],
          variations: [
            {
              id: "variation",
              title: "Approved extra fitting",
              description: "Use the marked location.",
              status: "approved",
            },
          ],
          notes: [],
          documents: [
            {
              id: "document",
              project_id: job.id,
              file_name:
                "A-very-long-construction-plan-filename-for-mobile-layout-testing.pdf",
              display_name: null,
              file_type: "application/pdf",
              purpose: "client_document",
              caption: null,
              photo_stage: null,
              employee_visible: true,
              created_at: new Date().toISOString(),
            },
          ],
        },
      });
    }
    if (url.pathname === "/api/employee/reviews") {
      const prior = new Date(Date.now() - 3_600_000).toISOString();
      return route.fulfill({
        json: {
          employees: [employee, otherEmployee],
          jobs: [job],
          submissions: [
            {
              id: "self-submission",
              employee_id: employee.id,
              employee_name: employee.name,
              week_start: monday,
              status: "submitted",
              review_comment: null,
              submitted_at: prior,
            },
            {
              id: "other-submission",
              employee_id: otherEmployee.id,
              employee_name: otherEmployee.name,
              week_start: monday,
              status: "submitted",
              review_comment: null,
              submitted_at: prior,
            },
          ],
          entries: [
            entry(
              "other-entry-a",
              otherEmployee.id,
              new Date(Date.now() - 5_400_000).toISOString(),
              new Date(Date.now() - 3_600_000).toISOString(),
              "Ground-floor rough in.",
              15,
            ),
            entry(
              "other-entry-b",
              otherEmployee.id,
              new Date(Date.now() - 3_200_000).toISOString(),
              new Date(Date.now() - 1_800_000).toISOString(),
              "Tested and labelled circuits.",
              20,
            ),
          ],
        },
      });
    }
    if (url.pathname === "/api/team/bootstrap") {
      return route.fulfill({
        json: {
          employees: state.teamEmployees,
          jobs: [job],
          appointments: [],
          assignments: [
            {
              id: "fixture-assignment",
              employee_id: employee.id,
              employee_name: employee.name,
              project_id: job.id,
              appointment_id: "fixture-appointment",
              date: today,
              start_time: "07:00:00",
              end_time: "15:30:00",
              notes: "Meet at rear gate.",
            },
          ],
          entries: [],
          submissions: [],
          permissions: {
            labourer: {
              view_scope: true,
              view_variations: true,
              view_documents: true,
              add_photos: true,
              add_notes: true,
              review_timesheets: false,
            },
            supervisor: {
              view_scope: true,
              view_variations: true,
              view_documents: true,
              add_photos: true,
              add_notes: true,
              review_timesheets: true,
            },
            admin: {
              view_scope: true,
              view_variations: true,
              view_documents: true,
              add_photos: true,
              add_notes: true,
              review_timesheets: true,
            },
          },
          timezone: "Australia/Sydney",
          notes: [],
          documents: [],
          audit: [],
        },
      });
    }
    if (
      url.pathname === "/api/team/employees/fixture-self" &&
      ["PATCH", "DELETE"].includes(method)
    ) {
      const body = request.postDataJSON();
      state.calls.push({ path: url.pathname, method, body });
      if (method === "DELETE" && state.rejectRemoval)
        return route.fulfill({
          status: 409,
          json: {
            error:
              "This member has a running timer. Have them clock out first.",
          },
        });
      if (method === "PATCH") Object.assign(state.teamEmployees[0], body);
      else
        Object.assign(state.teamEmployees[0], {
          active: false,
          archived_at: new Date().toISOString(),
        });
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname === "/api/employee/notes" && method === "POST") {
      state.calls.push({ path: url.pathname, body: request.postDataJSON() });
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname === "/api/employee/clock-in" && method === "POST") {
      const body = request.postDataJSON();
      state.calls.push({ path: url.pathname, body });
      state.isRunning = true;
      state.start = new Date().toISOString();
      return route.fulfill({ json: { success: true } });
    }
    if (url.pathname === "/api/employee/clock-out" && method === "POST") {
      const body = request.postDataJSON();
      state.calls.push({ path: url.pathname, body });
      state.isRunning = false;
      return route.fulfill({ json: { success: true } });
    }
    if (
      url.pathname === "/api/team/assignments/fixture-assignment" &&
      method === "PATCH"
    ) {
      const body = request.postDataJSON();
      state.calls.push({ path: url.pathname, method, body });
      return route.fulfill({ json: { success: true } });
    }
    state.calls.push({ path: url.pathname, method });
    return route.fulfill({
      status: 404,
      json: { error: `Fixture route not defined: ${url.pathname}` },
    });
  });
  return state;
}

async function openFixture(context, view = "today", query = "") {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const url = `${base}/generated-artifacts/employee-portal.html?view=${view}${query}`;
  await page.goto(url);
  const heading =
    view === "job"
      ? job.name
      : view === "team"
        ? "Team"
        : view === "assignments"
          ? "Assignments"
          : view === "timesheets"
            ? "Timesheets"
            : "Today";
  await page.getByRole("heading", { name: heading, exact: true }).waitFor();
  return { page, errors };
}

try {
  for (const width of [320, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    makeApi(context, {});
    const { page, errors } = await openFixture(context);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `no horizontal overflow at ${width}px`,
    );
    await page.getByRole("button", { name: "Clock in" }).waitFor();
    await page.getByRole("button", { name: "Open navigation" }).click();
    assert.equal(
      await page.getByRole("link", { name: "This week" }).count(),
      1,
    );
    assert.deepEqual(errors, []);
    console.log(`PASS real EmployeeHome layout and navigation at ${width}px`);
    await context.close();
  }

  // Permission denied must not prevent either clock request; no location is sent.
  {
    const context = await browser.newContext({
      viewport: { width: 320, height: 844 },
    });
    const state = makeApi(context, {});
    await context.addInitScript(() =>
      Object.defineProperty(navigator, "geolocation", {
        configurable: true,
        value: {
          getCurrentPosition(_success, failure) {
            failure({ code: 1, message: "denied" });
          },
        },
      }),
    );
    const { page, errors } = await openFixture(context);
    await page.getByRole("checkbox", { name: "Include GPS" }).check();
    await page.getByRole("button", { name: "Clock in" }).click();
    await page.getByRole("button", { name: "Clock out" }).waitFor();
    assert.equal(state.calls[0].path, "/api/employee/clock-in");
    assert.equal("gps" in state.calls[0].body, false);
    await page.getByRole("button", { name: "Clock out" }).click();
    await page.getByLabel("Unpaid break (minutes)").fill("15.5");
    await page.getByRole("button", { name: "Clock out" }).last().click();
    await page
      .getByText("Enter a whole number of break minutes, zero or more.")
      .waitFor();
    assert.equal(state.calls.length, 1, "invalid break must not clock out");
    await page.getByLabel("Unpaid break (minutes)").fill("15");
    await page.getByLabel("Shift note (optional)").fill("Site complete");
    await page.getByRole("button", { name: "Clock out" }).last().click();
    await page.getByRole("button", { name: "Clock in" }).waitFor();
    assert.equal(state.calls[1].path, "/api/employee/clock-out");
    assert.equal(state.calls[1].body.break_minutes, 15);
    assert.equal(state.calls[1].body.notes, "Site complete");
    assert.equal("gps" in state.calls[1].body, false);
    assert.deepEqual(errors, []);
    console.log(
      "PASS GPS-denied clock-in and clock-out remain nonblocking and omit coordinates",
    );
    await context.close();
  }

  // Explicit GPS opt-in includes coordinates on both clock actions.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ["geolocation"],
      geolocation: { latitude: -33.8688, longitude: 151.2093 },
    });
    const state = makeApi(context, {});
    const { page, errors } = await openFixture(context);
    await page.getByRole("checkbox", { name: "Include GPS" }).check();
    await page.getByRole("button", { name: "Clock in" }).click();
    await page.getByRole("button", { name: "Clock out" }).waitFor();
    assert.deepEqual(state.calls[0].body.gps, {
      latitude: -33.8688,
      longitude: 151.2093,
    });
    await page.getByRole("button", { name: "Clock out" }).click();
    await page.getByLabel("Unpaid break (minutes)").fill("20");
    await page.getByLabel("Shift note (optional)").fill("Complete");
    await page.getByRole("button", { name: "Clock out" }).last().click();
    await page.getByRole("button", { name: "Clock in" }).waitFor();
    assert.deepEqual(state.calls[1].body.gps, {
      latitude: -33.8688,
      longitude: 151.2093,
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS opted-in GPS coordinates sent on both clock-in and clock-out",
    );
    await context.close();
  }

  // Running clock has a live one-second display, without writing to the API.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const state = makeApi(context, { running: true });
    const { page, errors } = await openFixture(context);
    const timer = page.getByText(/Started .*h \d{2}m \d{2}s/);
    await timer.waitFor();
    const first = await timer.innerText();
    await page.waitForFunction(
      (previous) => {
        const el = [...document.querySelectorAll("p")].find((p) =>
          /Started .*h \d{2}m \d{2}s/.test(p.textContent || ""),
        );
        return !!el && el.textContent !== previous;
      },
      first,
      { timeout: 4000 },
    );
    assert.deepEqual(state.calls, []);
    assert.deepEqual(errors, []);
    console.log("PASS running shift clock ticks live at one-second cadence");
    await context.close();
  }

  // Real employee review component displays all weekly entries and suppresses self-review.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const state = makeApi(context, {});
    const { page, errors } = await openFixture(context, "timesheets");
    await page.getByRole("heading", { name: "Supervisor reviews" }).waitFor();
    const reviewSection = page.locator("section").filter({
      has: page.getByRole("heading", { name: "Supervisor reviews" }),
    });
    await reviewSection.getByText("Liam Field", { exact: true }).waitFor();
    assert.equal(
      await reviewSection.getByText("Liam Field", { exact: true }).count(),
      1,
    );
    assert.equal(
      await reviewSection.getByText("Mae Installer", { exact: true }).count(),
      0,
    );
    await reviewSection.getByText("Ground-floor rough in.").waitFor();
    await reviewSection.getByText("Tested and labelled circuits.").waitFor();
    assert.equal(await reviewSection.getByText(/2 entries ·/).count(), 1);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(state.calls, []);
    assert.deepEqual(errors, []);
    console.log(
      "PASS supervisor review shows every weekly entry and hides own submission",
    );
    await context.close();
  }

  // Employee projections do not display rates; the real team component does.
  {
    const employeeContext = await browser.newContext({
      viewport: { width: 320, height: 844 },
    });
    makeApi(employeeContext, {});
    const { page: employeePage } = await openFixture(employeeContext);
    await employeePage.getByRole("heading", { name: "Today" }).waitFor();
    assert.doesNotMatch(
      await employeePage.locator("body").innerText(),
      /hourly_rate|42\.75/,
    );
    await employeeContext.close();

    const teamContext = await browser.newContext({
      viewport: { width: 320, height: 844 },
    });
    makeApi(teamContext, { owner: true });
    const { page: teamPage, errors } = await openFixture(teamContext, "team");
    await teamPage.getByRole("button", { name: "Show hourly rates" }).click();
    await teamPage.getByText("$42.75 / hour").waitFor();
    assert.equal(
      await teamPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      "PASS cost rate is shown in Team UI and absent from employee UI at 320px",
    );
    await teamContext.close();
  }

  for (const width of [320, 390, 1280]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    const state = makeApi(context, { owner: true });
    const { page, errors } = await openFixture(context, "team");
    await page.getByRole("heading", { name: "Team", exact: true }).waitFor();
    await page
      .getByRole("button", { name: "Actions for Mae Installer" })
      .click();
    await page.getByRole("menuitem", { name: "Edit" }).click();
    await page
      .getByLabel("Email", { exact: true })
      .last()
      .fill("corrected@example.invalid");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /invitation/i })
      .waitFor();
    assert.equal(state.calls[0].method, "PATCH");
    assert.equal(state.calls[0].body.email, "corrected@example.invalid");
    await page
      .getByRole("button", { name: "Actions for Mae Installer" })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    let dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    // Radix exit animations finish before the menu trigger can safely reopen.
    await page.waitForTimeout(250);
    assert.equal(state.calls.length, 1);
    await page
      .getByRole("button", { name: "Actions for Mae Installer" })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    dialog = page.getByRole("alertdialog");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    assert.equal(state.calls.length, 1);
    await page
      .getByRole("button", { name: "Actions for Mae Installer" })
      .click();
    await page.getByRole("menuitem", { name: "Remove" }).click();
    dialog = page.getByRole("alertdialog");
    assert.match(await dialog.innerText(), /history/i);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    state.rejectRemoval = true;
    await dialog.getByRole("button", { name: /Remove/ }).click();
    await dialog
      .getByRole("alert")
      .filter({ hasText: /running timer/i })
      .waitFor();
    state.rejectRemoval = false;
    await dialog.getByRole("button", { name: /Remove/ }).click();
    await page
      .getByRole("status")
      .filter({ hasText: /removed from the team/i })
      .waitFor();
    assert.equal(
      await page
        .getByRole("button", { name: /Actions for Mae Installer/ })
        .count(),
      0,
    );
    assert.equal(state.calls.at(-1).method, "DELETE");
    assert.equal(state.calls.at(-1).body, null);
    assert.deepEqual(errors, []);
    console.log(
      `PASS Team email edit, removal confirmation/cancel/error/success, and dashboard navigation at ${width}px`,
    );
    await context.close();
  }
  {
    const context = await browser.newContext({
      viewport: { width: 320, height: 844 },
    });
    makeApi(context, { admin: true });
    const { page } = await openFixture(context, "team");
    // Team now lives in AppShell. Its global links are covered through the real
    // App fixture; this isolated TeamHome must retain authorised admin actions.
    await page.getByRole("heading", { name: "Team", exact: true }).waitFor();
    await page.getByRole("button", { name: /Invite team member|Add team member/i }).waitFor();
    await context.close();
  }

  // Rescheduling edits the shared existing appointment and warns all assigned staff.
  {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const state = makeApi(context, { owner: true });
    const { page, errors } = await openFixture(context, "assignments");
    await page.getByRole("heading", { name: "Assignments" }).waitFor();
    await page.getByRole("button", { name: "Edit schedule" }).click();
    const dialog = page.getByRole("dialog", { name: "Edit schedule" });
    await dialog
      .getByText(
        /Every team member assigned to it will see the new date, time and notes/,
      )
      .waitFor();
    await dialog.getByLabel("Date").fill(tomorrow);
    await dialog.getByLabel("Start time").fill("08:15");
    await dialog.getByLabel("Finish time").fill("16:00");
    await dialog
      .getByLabel("Appointment notes")
      .fill("Meet at the north entry.");
    await dialog.getByRole("button", { name: "Save shared schedule" }).click();
    await page
      .getByRole("status")
      .getByText("Shared appointment updated for everyone assigned.")
      .waitFor();
    assert.deepEqual(state.calls[0], {
      path: "/api/team/assignments/fixture-assignment",
      method: "PATCH",
      body: {
        date: tomorrow,
        start_time: "08:15",
        end_time: "16:00",
        notes: "Meet at the north entry.",
      },
    });
    assert.deepEqual(errors, []);
    console.log(
      "PASS shared appointment reschedule warns crew and PATCHes the existing assignment",
    );
    await context.close();
  }
  for (const width of [320, 390]) {
    const context = await browser.newContext({
      viewport: { width, height: 844 },
    });
    const state = makeApi(context, {});
    const { page, errors } = await openFixture(context, "job");
    await page.getByLabel("Photo", { exact: true }).setInputFiles({
      name: "site-progress-with-a-very-long-filename-for-mobile-testing.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jH9sAAAAASUVORK5CYII=",
        "base64",
      ),
    });
    await page
      .getByLabel("Caption", { exact: true })
      .fill("Completed work in the north room, ready for supervisor review.");
    await page.getByLabel("Stage", { exact: true }).selectOption("after");
    await page
      .getByRole("textbox", { name: "Job update note" })
      .fill("Ready for inspection.");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `populated job/photo form fits ${width}px`,
    );
    await page
      .getByRole("button", { name: "Save update", exact: true })
      .click();
    await page.waitForFunction(
      () =>
        document.querySelector('[aria-label="Job update note"]').value === "",
    );
    assert.ok(
      state.calls.some(
        (c) =>
          c.path === "/api/employee/notes" &&
          c.body.body === "Ready for inspection.",
      ),
    );
    assert.deepEqual(errors, []);
    console.log(
      `PASS actual job, attachment, scope, document and note form at ${width}px`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
