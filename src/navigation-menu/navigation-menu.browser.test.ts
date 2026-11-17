import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

type Mounted = ReturnType<typeof mount>;
const shown = (content: HTMLElement) => content.matches(":popover-open");
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function parts({ getByRole, getByTestId }: Mounted) {
  return {
    overview: getByRole("button", { name: /Overview/ }),
    handbook: getByRole("button", { name: "Handbook" }),
    home: getByRole("link", { name: "Home" }),
    overviewContent: getByTestId("overview-content"),
    handbookContent: getByTestId("handbook-content"),
  };
}

test("renders a nav with a list of triggers and links, closed", () => {
  const m = mount(basic);
  const { overview, handbook, home, overviewContent } = parts(m);
  expect(m.getByTestId("root").tagName).toBe("NAV");
  expect(m.getByTestId("list").tagName).toBe("UL");
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  expect(overview.getAttribute("aria-controls")).toBe(overviewContent.id);
  expect(shown(overviewContent)).toBe(false);
  // The list is one Tab stop.
  expect(overview.getAttribute("tabindex")).toBe("0");
  expect(handbook.getAttribute("tabindex")).toBe("-1");
  expect(home.getAttribute("tabindex")).toBe("-1");
  expect(home.getAttribute("aria-current")).toBe("page");
  expect(home.hasAttribute("data-active")).toBe(true);
});

test("a click opens the item's content below its trigger and wires ARIA; a second click closes it", async () => {
  const m = mount(basic);
  const { overview, overviewContent } = parts(m);
  await m.user.click(overview);
  expect(shown(overviewContent)).toBe(true);
  await expect.poll(() => overview.getAttribute("aria-expanded")).toBe("true");
  expect(overview.hasAttribute("data-popup-open")).toBe(true);
  expect(m.getByTestId("icon").hasAttribute("data-popup-open")).toBe(true);
  expect(m.getByTestId("icon").getAttribute("aria-hidden")).toBe("true");
  expect(m.getByTestId("last").textContent).toBe("overview");
  // A click doesn't move focus into the content.
  expect(overviewContent.contains(document.activeElement)).toBe(false);
  // Below the trigger, centred on it, 8px away.
  await frame();
  const anchor = overview.getBoundingClientRect();
  const placed = overviewContent.getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(8);
  expect(Math.round(placed.left + placed.width / 2)).toBe(Math.round(anchor.left + anchor.width / 2));

  await m.user.click(overview);
  await expect.poll(() => shown(overviewContent)).toBe(false);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  expect(m.getByTestId("last").textContent).toBe("null");
  expect(m.getByTestId("changes").textContent).toBe("2");
});

test("switching items reports one change, keeps each content's state, and sets an activation direction", async () => {
  const m = mount(basic);
  const { overview, handbook, overviewContent, handbookContent } = parts(m);
  await m.user.click(overview);
  await m.user.click(m.getByRole("button", { name: "Clicked 0" }));
  expect(m.getByRole("button", { name: "Clicked 1" })).toBeTruthy();

  await m.user.click(handbook);
  await expect.poll(() => shown(handbookContent)).toBe(true);
  expect(shown(overviewContent)).toBe(false);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  expect(handbook.getAttribute("aria-expanded")).toBe("true");
  expect(handbookContent.getAttribute("data-activation-direction")).toBe("right");
  await frame();
  expect(m.getByTestId("changes").textContent).toBe("2");
  expect(m.getByTestId("last").textContent).toBe("handbook");

  await m.user.click(overview);
  await expect.poll(() => shown(overviewContent)).toBe(true);
  expect(overviewContent.getAttribute("data-activation-direction")).toBe("left");
  // The Counter kept its count: closed content stays in the document.
  expect(m.getByRole("button", { name: "Clicked 1" })).toBeTruthy();
  expect(m.getByTestId("changes").textContent).toBe("3");
});

test("hover opens after the delay, moving to another trigger switches at once, leaving closes after the close delay", async () => {
  const m = mount(basic);
  const { overview, handbook, overviewContent, handbookContent } = parts(m);
  const start = performance.now();
  await m.user.hover(overview);
  await expect.poll(() => shown(overviewContent)).toBe(true);
  expect(performance.now() - start).toBeGreaterThanOrEqual(50);
  expect(overviewContent.contains(document.activeElement)).toBe(false);

  await m.user.hover(handbook);
  await expect.poll(() => shown(handbookContent)).toBe(true);
  expect(shown(overviewContent)).toBe(false);
  expect(m.getByTestId("changes").textContent).toBe("2");

  await m.user.hover(m.getByTestId("outside"));
  await expect.poll(() => shown(handbookContent)).toBe(false);
  expect(handbook.getAttribute("aria-expanded")).toBe("false");
});

test("moving the pointer onto the content keeps it open; a click makes a hover-open stick", async () => {
  const m = mount(basic);
  const { overview, overviewContent } = parts(m);
  await m.user.hover(overview);
  await expect.poll(() => shown(overviewContent)).toBe(true);
  await m.user.hover(m.getByRole("link", { name: "Quick start" }));
  await wait(120);
  expect(shown(overviewContent)).toBe(true);

  await m.user.hover(overview);
  await m.user.click(overview);
  expect(shown(overviewContent)).toBe(true);
  await m.user.hover(m.getByTestId("outside"));
  await wait(120);
  expect(shown(overviewContent)).toBe(true);
  expect(overview.getAttribute("aria-expanded")).toBe("true");
});

test("ArrowDown opens and moves focus into the content; Escape closes it and puts focus back on the trigger", async () => {
  const m = mount(basic);
  const { overview, overviewContent } = parts(m);
  overview.focus();
  await m.user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(m.getByRole("link", { name: "Quick start" }));
  expect(overview.getAttribute("aria-expanded")).toBe("true");
  // Focus going back to the trigger keeps it open.
  overview.focus();
  await frame();
  expect(shown(overviewContent)).toBe(true);
  // ArrowDown on the open trigger moves focus in again.
  await m.user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(m.getByRole("link", { name: "Quick start" }));

  await m.user.keyboard("{Escape}");
  expect(shown(overviewContent)).toBe(false);
  await expect.poll(() => document.activeElement).toBe(overview);
  await expect.poll(() => overview.getAttribute("aria-expanded")).toBe("false");
});

test("Tab from the open trigger goes into its content, which follows it in the document", async () => {
  const m = mount(basic);
  const { overview, overviewContent } = parts(m);
  await m.user.click(overview);
  expect(shown(overviewContent)).toBe(true);
  overview.focus();
  await m.user.tab();
  // The first Tab stop in it: the link, or in Safari (which skips links and buttons) the search field.
  expect(overviewContent.contains(document.activeElement)).toBe(true);
  expect(document.activeElement).not.toBe(overviewContent);
  expect(shown(overviewContent)).toBe(true);
});

test("arrow keys in the content don't move to the list's triggers", async () => {
  const m = mount(basic);
  const { overview } = parts(m);
  overview.focus();
  await m.user.keyboard("{ArrowDown}");
  const quick = m.getByRole("link", { name: "Quick start" });
  await expect.poll(() => document.activeElement).toBe(quick);
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(quick);
  await m.user.keyboard("{End}");
  expect(document.activeElement).toBe(quick);
});

test("Tab past the end of the content closes it and moves on", async () => {
  const m = mount(basic);
  const { overview, overviewContent } = parts(m);
  overview.focus();
  await m.user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(m.getByRole("link", { name: "Quick start" }));
  m.getByRole("textbox", { name: "Search" }).focus();
  // Chromium and Firefox stop on the Counter button first; Safari skips it.
  await m.user.tab();
  if (overviewContent.contains(document.activeElement)) await m.user.tab();
  expect(document.activeElement).toBe(m.getByRole("textbox", { name: "After" }));
  await expect.poll(() => shown(overviewContent)).toBe(false);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
});

test("arrow keys move between the list's triggers and links, without wrapping", async () => {
  const m = mount(basic);
  const { overview, handbook, home } = parts(m);
  overview.focus();
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(handbook);
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(home);
  await m.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(home);
  await m.user.keyboard("{Home}");
  expect(document.activeElement).toBe(overview);
});

test("a link with closeOnClick closes the content; a press outside does too", async () => {
  const m = mount(basic);
  const { overview, overviewContent } = parts(m);
  await m.user.click(overview);
  const link = m.getByRole("link", { name: "Accessibility" });
  link.addEventListener("click", (event) => event.preventDefault());
  await m.user.click(link);
  await expect.poll(() => shown(overviewContent)).toBe(false);
  expect(overview.getAttribute("aria-expanded")).toBe("false");

  await m.user.click(overview);
  expect(shown(overviewContent)).toBe(true);
  await m.user.click(m.getByTestId("outside"));
  expect(shown(overviewContent)).toBe(false);
  await expect.poll(() => overview.getAttribute("aria-expanded")).toBe("false");
  expect(m.getByTestId("last").textContent).toBe("null");
});

test("controlled: the value prop opens and closes it, and changes are reported", async () => {
  const m = mount(controlled);
  const trigger = m.getByRole("button", { name: "Docs" });
  const content = m.getByTestId("docs-content");
  await expect.poll(() => shown(content)).toBe(true);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  // Placed on the side asked for.
  await frame();
  expect(Math.round(content.getBoundingClientRect().left)).toBe(
    Math.round(trigger.getBoundingClientRect().right),
  );
  await m.user.click(trigger);
  expect(m.getByTestId("value").textContent).toBe("null");
  await expect.poll(() => shown(content)).toBe(false);
  await m.user.click(trigger);
  expect(m.getByTestId("value").textContent).toBe("docs");
  await expect.poll(() => shown(content)).toBe(true);
  await m.user.keyboard("{Escape}");
  await expect.poll(() => m.getByTestId("value").textContent).toBe("null");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("a disabled trigger doesn't open its content on click, hover or keys", async () => {
  const m = mount(controlled);
  const trigger = m.getByRole("button", { name: "Blog" });
  const content = m.getByTestId("blog-content");
  await m.user.click(m.getByRole("button", { name: "Docs" }));
  await expect.poll(() => m.getByTestId("value").textContent).toBe("null");
  expect(trigger.getAttribute("aria-disabled")).toBe("true");
  // Playwright won't press an element marked aria-disabled unless forced.
  await m.user.click(trigger, { force: true });
  await m.user.hover(trigger, { force: true });
  await wait(120);
  expect(shown(content)).toBe(false);
  trigger.focus();
  await m.user.keyboard("{ArrowDown}");
  await frame();
  expect(shown(content)).toBe(false);
  expect(m.getByTestId("value").textContent).toBe("null");
});
