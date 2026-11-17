// Tabs used as an app would against a slow server (fixtures/async.rx): a panel that loads when its tab is chosen,
// one that fails and is retried, an `onValueChange` that is itself an action, a controlled owner that agrees late or
// guesses. The fake server holds every answer until the test releases it.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, held, release, resetServer, server, waiting } from "../test/slow-server.ts";
import slow from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// Every first answer has landed (the report panel shows a fallback for its first load: held past 150ms).
async function ready() {
  const view = mount(slow);
  await held();
  release("overview");
  release("sales");
  await answered();
  server.calls = [];
  return view;
}

const selected = (tab: HTMLElement) => tab.getAttribute("aria-selected") === "true";

test("a tab whose panel loads switches at once: selection, panel, focus and indicator don't wait", async () => {
  const { getByRole, getByTestId, user } = await ready();
  const overview = getByRole("tab", { name: "Overview" });
  const projects = getByRole("tab", { name: "Projects" });
  const indicator = getByTestId("indicator");
  await frame();
  const left = () => Number.parseFloat(indicator.style.getPropertyValue("--active-tab-left"));
  const start = left();
  await user.click(projects);
  await frame();
  expect(waiting()).toEqual(["projects"]);
  expect(selected(projects)).toBe(true);
  expect(selected(overview)).toBe(false);
  expect(projects.getAttribute("tabindex")).toBe("0");
  expect(getByTestId("panel-projects").hidden).toBe(false);
  expect(getByTestId("loading").textContent).toBe("loading");
  expect(left()).toBeGreaterThan(start);
  // The keyboard moves on too while the answer is out.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("tab", { name: "Account" }));
  await user.keyboard("{Enter}");
  expect(selected(getByRole("tab", { name: "Account" }))).toBe(true);
  // Answers out of order: the older one is dropped.
  release("account");
  await answered();
  expect(getByTestId("panel-account").textContent).toBe("Details of account");
  release("projects");
  await answered();
  expect(getByTestId("panel-account").textContent).toBe("Details of account");
  expect(getByTestId("loading").textContent).toBe("");
});

test("a panel that fails shows its error, and a retry replaces it; focus stays in the panel", async () => {
  const { getByRole, getByTestId, user } = await ready();
  server.failing = ["costs"];
  const costs = getByRole("tab", { name: "Costs" });
  await user.click(costs);
  expect(selected(costs)).toBe(true);
  const panel = getByTestId("report-costs");
  expect(panel.querySelector('[data-testid="report-loading"]')).not.toBeNull();
  await held();
  release("costs");
  await answered();
  expect(panel.querySelector('[data-testid="report-error"]')!.textContent).toBe("Request failed: costs");
  server.failing = [];
  const retry = getByRole("button", { name: "Retry" });
  retry.focus();
  await user.keyboard("{Enter}");
  release("costs");
  await answered();
  expect(panel.querySelector('[data-testid="report-error"]')).toBeNull();
  expect(panel.querySelector('[data-testid="report-text"]')!.textContent).toBe("Details of costs");
  expect(panel.contains(document.activeElement)).toBe(true);
});

test("an onValueChange that awaits doesn't hold the tabs", async () => {
  const { getByRole, getByTestId, user } = await ready();
  const week = getByRole("tab", { name: "Week" });
  await user.click(week);
  expect(waiting()).toEqual(["week"]);
  expect(selected(week)).toBe(true);
  expect(getByRole("tabpanel", { name: "Week" }).textContent).toBe("Week view");
  await user.click(getByRole("tab", { name: "Day" }));
  expect(selected(getByRole("tab", { name: "Day" }))).toBe(true);
  release("week");
  release("day");
  await answered();
  expect(getByTestId("logged").textContent).toBe("day");
  expect(selected(getByRole("tab", { name: "Day" }))).toBe(true);
});

test("controlled tabs whose owner agrees late follow the owner", async () => {
  const { getByRole, user } = await ready();
  const b = getByRole("tab", { name: "Late B" });
  await user.click(b);
  expect(waiting()).toEqual(["late b"]);
  expect(selected(b)).toBe(false);
  release("late b");
  await answered();
  expect(selected(b)).toBe(true);
  expect(getByRole("tabpanel", { name: "Late B" }).textContent).toBe("Late panel B");
  // Refused: the request fails and the owner never writes.
  server.failing = ["late a"];
  await user.click(getByRole("tab", { name: "Late A" }));
  release("late a");
  await answered();
  expect(selected(b)).toBe(true);
});

test("controlled tabs whose owner guesses switch at once, with one request", async () => {
  const { getByRole, user } = await ready();
  const b = getByRole("tab", { name: "Guess B" });
  await user.click(b);
  expect(selected(b)).toBe(true);
  expect(getByRole("tabpanel", { name: "Guess B" }).textContent).toBe("Guess panel B");
  release("guess b");
  await answered();
  expect(selected(b)).toBe(true);
  expect(server.calls).toEqual(["guess b"]);
});

test("controlled tabs whose owner guesses go back when the guess reverts", async () => {
  const { getByRole, user } = await ready();
  server.failing = ["guess b"];
  const b = getByRole("tab", { name: "Guess B" });
  await user.click(b);
  expect(selected(b)).toBe(true);
  release("guess b");
  await answered();
  expect(selected(b)).toBe(false);
  expect(selected(getByRole("tab", { name: "Guess A" }))).toBe(true);
  expect(getByRole("tabpanel", { name: "Guess A" }).textContent).toBe("Guess panel A");
});
