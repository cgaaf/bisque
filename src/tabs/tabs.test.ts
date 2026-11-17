import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

test("selects the first enabled tab by default and wires tabs to panels", () => {
  const { getByRole, getByTestId, queryByText } = mount(basic);
  const list = getByRole("tablist");
  expect(list.getAttribute("aria-orientation")).toBe("horizontal");
  expect(getByTestId("root").getAttribute("data-orientation")).toBe("horizontal");
  expect(getByTestId("root").className).toBe("mine");

  const overview = getByRole("tab", { name: "Overview" });
  const panel = getByRole("tabpanel");
  expect(overview.getAttribute("aria-selected")).toBe("true");
  expect(overview.hasAttribute("data-active")).toBe(true);
  expect(overview.getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.getAttribute("aria-labelledby")).toBe(overview.id);
  expect(panel.textContent).toBe("Overview panel");
  expect(queryByText("Projects panel")).toBeNull();
  // A kept panel is in the DOM but hidden.
  const account = getByTestId("panel-account");
  expect(account.hidden).toBe(true);
  expect(account.hasAttribute("data-hidden")).toBe(true);

  const projects = getByRole("tab", { name: "Projects" });
  expect(projects.getAttribute("aria-selected")).toBe("false");
  expect(projects.hasAttribute("aria-controls")).toBe(false);
});

test("the selected tab is the list's only Tab stop", async () => {
  const { getByRole, user } = mount(basic);
  const tabs = ["Overview", "Projects", "Billing", "Account"].map((name) => getByRole("tab", { name }));
  expect(tabs.map((tab) => tab.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"]);

  getByRole("button", { name: "Before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(tabs[0]);
  await user.tab();
  expect(document.activeElement).toBe(getByRole("tabpanel"));
});

test("clicking a tab selects it and calls the consumer's handler", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("tab", { name: "Projects" }));
  expect(getByRole("tab", { name: "Projects" }).getAttribute("aria-selected")).toBe("true");
  expect(getByRole("tab", { name: "Projects" }).getAttribute("tabindex")).toBe("0");
  expect(getByRole("tab", { name: "Overview" }).getAttribute("tabindex")).toBe("-1");
  expect(getByTestId("changes").textContent).toBe("projects;");
  await expect.poll(() => getByRole("tabpanel").textContent).toBe("Projects panel");

  await user.click(getByRole("tab", { name: "Overview" }));
  expect(getByTestId("clicks").textContent).toBe("1");
  expect(getByTestId("changes").textContent).toBe("projects;overview;");
});

test("manual activation: arrows move focus, Enter or Space selects", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const overview = getByRole("tab", { name: "Overview" });
  const projects = getByRole("tab", { name: "Projects" });
  const account = getByRole("tab", { name: "Account" });
  overview.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(projects);
  expect(projects.getAttribute("aria-selected")).toBe("false");
  // The disabled tab is skipped, and the arrows wrap.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(account);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(overview);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(account);
  await user.keyboard("{Home}{ArrowDown}");
  expect(document.activeElement).toBe(overview);
  expect(getByTestId("changes").textContent).toBe("");

  await user.keyboard("{ArrowRight}{Enter}");
  expect(projects.getAttribute("aria-selected")).toBe("true");
  await user.keyboard("{ArrowLeft} ");
  expect(overview.getAttribute("aria-selected")).toBe("true");
  expect(getByTestId("changes").textContent).toBe("projects;overview;");
});

test("Tab back into the list lands on the selected tab, not the last focused one", async () => {
  const { getByRole, user } = mount(basic);
  const overview = getByRole("tab", { name: "Overview" });
  overview.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("tab", { name: "Projects" }));
  getByRole("button", { name: "After" }).focus();
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(getByRole("tabpanel"));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(overview);
});

test("a disabled tab can't be selected and drops the consumer's handlers", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const billing = getByRole("tab", { name: "Billing" });
  expect(billing.getAttribute("aria-disabled")).toBe("true");
  expect(billing.hasAttribute("data-disabled")).toBe(true);
  await user.click(billing);
  expect(billing.getAttribute("aria-selected")).toBe("false");
  expect(getByTestId("changes").textContent).toBe("");
  expect(getByTestId("clicks").textContent).toBe("0");
});

test("the panel animates out, and a kept panel shows when selected", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const overviewPanel = getByTestId("panel-overview");
  await user.click(getByRole("tab", { name: "Account" }));
  expect(overviewPanel.hasAttribute("data-ending-style")).toBe(true);
  await expect.poll(() => queryByTestId("panel-overview")).toBeNull();
  const account = getByTestId("panel-account");
  expect(account.hidden).toBe(false);
  expect(account.getAttribute("tabindex")).toBe("0");
});

test("the activation direction follows the order of the tabs", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const root = getByTestId("root");
  expect(root.getAttribute("data-activation-direction")).toBe("none");
  await user.click(getByRole("tab", { name: "Account" }));
  expect(root.getAttribute("data-activation-direction")).toBe("right");
  expect(getByRole("tab", { name: "Account" }).getAttribute("data-activation-direction")).toBe("right");
  await user.click(getByRole("tab", { name: "Projects" }));
  expect(root.getAttribute("data-activation-direction")).toBe("left");
  expect(getByTestId("list").getAttribute("data-activation-direction")).toBe("left");
});

test("the indicator carries the selected tab's position as CSS variables", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const indicator = getByTestId("indicator");
  expect(indicator.getAttribute("role")).toBe("presentation");
  // jsdom has no layout: every size is 0, so the indicator stays hidden, but the variables are written (after
  // the flush that selected the tab: they are measured in a microtask).
  expect(indicator.hidden).toBe(true);
  await expect.poll(() => indicator.style.getPropertyValue("--active-tab-width")).toBe("0px");
  expect(indicator.style.getPropertyValue("--active-tab-left")).toBe("0px");

  const account = getByRole("tab", { name: "Account" });
  Object.defineProperty(account, "offsetWidth", { configurable: true, get: () => 80 });
  Object.defineProperty(account, "offsetHeight", { configurable: true, get: () => 30 });
  account.getBoundingClientRect = () => new DOMRect(150, 0, 80, 30);
  await user.click(account);
  await expect.poll(() => indicator.style.getPropertyValue("--active-tab-left")).toBe("150px");
  expect(indicator.style.getPropertyValue("--active-tab-width")).toBe("80px");
  expect(indicator.style.getPropertyValue("--active-tab-height")).toBe("30px");
  expect(indicator.hidden).toBe(false);
});

test("vertical, controlled and automatic: focus selects, Up/Down move, no wrap", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  expect(getByTestId("list").getAttribute("aria-orientation")).toBe("vertical");
  const alpha = getByRole("tab", { name: "Alpha" });
  const beta = getByRole("tab", { name: "Beta" });
  expect(beta.getAttribute("aria-selected")).toBe("true");
  expect(getByTestId("panel-b").textContent).toBe("B");

  beta.focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(beta);
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(alpha);
  expect(alpha.getAttribute("aria-selected")).toBe("true");
  expect(getByTestId("current").textContent).toBe("a");
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(alpha);
  expect(getByTestId("root").getAttribute("data-activation-direction")).toBe("up");

  await user.keyboard("{ArrowDown}{ArrowDown}");
  const link = getByTestId("link-tab-c");
  expect(document.activeElement).toBe(link);
  expect(link.tagName).toBe("A");
  expect(link.getAttribute("aria-selected")).toBe("true");
  expect(getByTestId("current").textContent).toBe("c");
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(link);
});

test("follows a controlled value changed from outside", async () => {
  const { getByRole, user } = mount(controlled);
  await user.click(getByRole("button", { name: "Pick alpha" }));
  expect(getByRole("tab", { name: "Alpha" }).getAttribute("aria-selected")).toBe("true");
  expect(getByRole("tab", { name: "Alpha" }).getAttribute("tabindex")).toBe("0");
});

test("an uncontrolled default value is honoured", () => {
  const { getByRole } = mount(controlled);
  expect(getByRole("tab", { name: "Two" }).getAttribute("aria-selected")).toBe("true");
  expect(getByRole("tab", { name: "One" }).getAttribute("aria-selected")).toBe("false");
  expect(getByRole("tabpanel", { name: "Two" }).textContent).toBe("Panel two");
});

test("a tab made with the props function alone registers with the root", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  // Alone in its list, the first one is selected and is the list's Tab stop.
  const inbox = getByTestId("link-tab-inbox");
  const sent = getByTestId("link-tab-sent");
  expect(inbox.getAttribute("aria-selected")).toBe("true");
  expect(inbox.getAttribute("tabindex")).toBe("0");
  expect(sent.getAttribute("tabindex")).toBe("-1");
  expect(getByRole("tabpanel", { name: "Inbox" }).textContent).toBe("Inbox panel");

  // Beside ordinary tabs in an uncontrolled root, it stays selected once chosen.
  const three = getByTestId("link-tab-three");
  await user.click(three);
  expect(three.getAttribute("aria-selected")).toBe("true");
  expect(three.getAttribute("tabindex")).toBe("0");
  expect(getByRole("tab", { name: "Two" }).getAttribute("aria-selected")).toBe("false");
  expect(getByRole("tabpanel", { name: "Three" }).textContent).toBe("Panel three");
});
