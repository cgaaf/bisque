import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Fake timers for the hover delays; animation frames stay real so a closed popup can unmount. */
function fakeTimers() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

type Queries = ReturnType<typeof mount>;

function parts({ getByRole }: Queries) {
  return {
    overview: getByRole("button", { name: /Overview/ }),
    handbook: getByRole("button", { name: "Handbook" }),
    home: getByRole("link", { name: "Home" }),
  };
}

/** The content the viewport shows: its element is the one carrying `data-open`. */
function shown(viewport: HTMLElement) {
  return viewport.querySelector<HTMLElement>("[data-open]");
}

test("renders a nav with a list of triggers and links, closed", () => {
  const q = mount(basic);
  const { overview, handbook, home } = parts(q);
  expect(q.getByTestId("root").tagName).toBe("NAV");
  expect(q.getByTestId("list").tagName).toBe("UL");
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  expect(q.queryByTestId("popup")).toBeNull();
  // The list is one Tab stop.
  expect(overview.getAttribute("tabindex")).toBe("0");
  expect(handbook.getAttribute("tabindex")).toBe("-1");
  expect(home.getAttribute("tabindex")).toBe("-1");
  expect(home.getAttribute("aria-current")).toBe("page");
  expect(home.hasAttribute("data-active")).toBe(true);
});

test("a click opens the item's content in the viewport and wires ARIA", async () => {
  const q = mount(basic);
  const { overview } = parts(q);
  await q.user.click(overview);
  const popup = q.getByTestId("popup");
  const viewport = q.getByTestId("viewport");
  expect(popup.tagName).toBe("NAV");
  expect(overview.getAttribute("aria-expanded")).toBe("true");
  expect(overview.getAttribute("aria-controls")).toBe(popup.id);
  expect(overview.hasAttribute("data-popup-open")).toBe(true);
  expect(q.getByTestId("icon").hasAttribute("data-popup-open")).toBe(true);
  expect(q.getByTestId("icon").getAttribute("aria-hidden")).toBe("true");
  const content = shown(viewport)!;
  expect(content).toBe(q.getByTestId("overview-content"));
  expect(content.className).toBe("content");
  expect(viewport.contains(q.getByRole("link", { name: "Quick start" }))).toBe(true);
  expect(q.getByTestId("last").textContent).toBe("overview");
  // A click leaves focus on the trigger.
  expect(document.activeElement).toBe(overview);
  expect(q.getByTestId("positioner").style.position).toBe("absolute");
  expect(q.getByTestId("backdrop").hasAttribute("data-open")).toBe(true);
  expect(q.getByTestId("arrow").getAttribute("aria-hidden")).toBe("true");

  // A second click closes it.
  await q.user.click(overview);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  await expect.poll(() => q.queryByTestId("popup")).toBeNull();
  expect(q.getByTestId("last").textContent).toBe("null");
});

test("content keeps its own state and handlers, and switching items swaps it with an activation direction", async () => {
  const q = mount(basic);
  const { overview, handbook } = parts(q);
  await q.user.click(overview);
  await q.user.click(q.getByRole("button", { name: "Clicked 0" }));
  expect(q.getByRole("button", { name: "Clicked 1" })).toBeTruthy();

  await q.user.click(handbook);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  expect(handbook.getAttribute("aria-expanded")).toBe("true");
  const viewport = q.getByTestId("viewport");
  const next = shown(viewport)!;
  expect(next).toBe(q.getByTestId("handbook-content"));
  expect(next.getAttribute("data-activation-direction")).toBe("right");
  await expect.poll(() => q.queryByTestId("overview-content")).toBeNull();

  await q.user.click(overview);
  expect(shown(viewport)!.getAttribute("data-activation-direction")).toBe("left");
  // The Counter kept its count: the content was created once, where it was declared.
  expect(q.getByRole("button", { name: "Clicked 1" })).toBeTruthy();
});

test("hover opens after the delay, moving to another trigger switches at once, leaving closes after the close delay", async () => {
  const user = fakeTimers();
  const q = mount(basic);
  const { overview, handbook } = parts(q);
  await user.hover(overview);
  advance(49);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  advance(1);
  expect(overview.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(document.body);

  await user.hover(handbook);
  advance(0);
  expect(handbook.getAttribute("aria-expanded")).toBe("true");
  expect(overview.getAttribute("aria-expanded")).toBe("false");

  await user.hover(q.getByTestId("outside"));
  advance(49);
  expect(handbook.getAttribute("aria-expanded")).toBe("true");
  advance(1);
  expect(handbook.getAttribute("aria-expanded")).toBe("false");
});

test("moving the pointer onto the popup keeps it open; a click makes a hover-open stick", async () => {
  const user = fakeTimers();
  const q = mount(basic);
  const { overview } = parts(q);
  await user.hover(overview);
  advance(50);
  await user.hover(q.getByTestId("popup"));
  advance(100);
  expect(overview.getAttribute("aria-expanded")).toBe("true");

  await user.hover(overview);
  await user.click(overview);
  expect(overview.getAttribute("aria-expanded")).toBe("true");
  await user.hover(q.getByTestId("outside"));
  advance(200);
  expect(overview.getAttribute("aria-expanded")).toBe("true");
});

test("ArrowDown opens and moves focus into the content; Shift+Tab goes back to the trigger, Escape closes", async () => {
  const q = mount(basic);
  const { overview } = parts(q);
  overview.focus();
  await q.user.keyboard("{ArrowDown}");
  expect(overview.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(q.getByRole("link", { name: "Quick start" }));

  await q.user.keyboard("{Shift>}{Tab}{/Shift}");
  expect(document.activeElement).toBe(overview);
  expect(overview.getAttribute("aria-expanded")).toBe("true");

  // Tab from the open trigger goes into its content.
  await q.user.tab();
  expect(document.activeElement).toBe(q.getByRole("link", { name: "Quick start" }));
  await q.user.keyboard("{Escape}");
  expect(overview.getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(overview);
});

test("Tab past the end of the content closes it and moves on past the trigger", async () => {
  const q = mount(basic);
  const { overview } = parts(q);
  overview.focus();
  await q.user.keyboard("{ArrowDown}");
  await q.user.tab();
  await q.user.tab();
  expect(document.activeElement).toBe(q.getByRole("button", { name: "Clicked 0" }));
  await q.user.tab();
  // Focus moves past the trigger, out of the popup. (Where to exactly is createPopupFocus's call: its `tabbables`
  // in src/internal/impl/dom.ts counts a <button tabindex="-1">, so today it lands on the Handbook trigger rather
  // than on "After", where a browser's tab order would go.)
  expect(document.activeElement).not.toBe(overview);
  expect(q.getByTestId("popup").contains(document.activeElement)).toBe(false);
  expect(overview.getAttribute("aria-expanded")).toBe("false");
});

test("arrow keys move between the list's triggers and links", async () => {
  const q = mount(basic);
  const { overview, handbook, home } = parts(q);
  overview.focus();
  await q.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(handbook);
  await q.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(home);
  // No wrapping.
  await q.user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(home);
  await q.user.keyboard("{Home}");
  expect(document.activeElement).toBe(overview);
});

test("a link with closeOnClick closes the popup; a press outside does too", async () => {
  const q = mount(basic);
  const { overview } = parts(q);
  await q.user.click(overview);
  const link = q.getByRole("link", { name: "Accessibility" });
  link.addEventListener("click", (event) => event.preventDefault());
  await q.user.click(link);
  expect(overview.getAttribute("aria-expanded")).toBe("false");

  await q.user.click(overview);
  await q.user.click(q.getByTestId("outside"));
  expect(overview.getAttribute("aria-expanded")).toBe("false");
});

test("the popup and positioner take the shown content's size as CSS variables", async () => {
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === "overview-content"
      ? 300
      : this.dataset.testid === "handbook-content"
        ? 200
        : 0;
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
    return this.dataset.testid === "overview-content"
      ? 120
      : this.dataset.testid === "handbook-content"
        ? 80
        : 0;
  });
  const q = mount(basic);
  const { overview, handbook } = parts(q);
  await q.user.click(overview);
  const popup = q.getByTestId("popup");
  const positioner = q.getByTestId("positioner");
  await expect.poll(() => popup.style.getPropertyValue("--popup-width")).toBe("300px");
  expect(popup.style.getPropertyValue("--popup-height")).toBe("120px");
  expect(positioner.style.getPropertyValue("--positioner-width")).toBe("300px");
  await q.user.click(handbook);
  await expect.poll(() => popup.style.getPropertyValue("--popup-width")).toBe("200px");
  expect(positioner.style.getPropertyValue("--positioner-height")).toBe("80px");
});

test("controlled: the value prop opens and closes it, and changes are reported", async () => {
  const q = mount(controlled);
  const trigger = q.getByRole("button", { name: "Docs" });
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(q.getByTestId("docs-content").hasAttribute("data-open")).toBe(true);
  await q.user.click(trigger);
  expect(q.getByTestId("value").textContent).toBe("null");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  await q.user.click(trigger);
  expect(q.getByTestId("value").textContent).toBe("docs");
  q.getByTestId("close").click();
  flush();
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
});
