import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

afterEach(() => {
  vi.useRealTimers();
});

/** Fake timers for the delays; animation frames stay real so a closed card can unmount. */
function setup() {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
}

function advance(ms: number) {
  vi.advanceTimersByTime(ms);
  flush();
}

const isOpen = (trigger: HTMLElement) => trigger.hasAttribute("data-popup-open");

test("opens on hover after 600ms, as an unlabelled supplementary popup", async () => {
  const user = setup();
  const { getByRole, queryByTestId, getByTestId } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  expect(link.getAttribute("href")).toBe("#typography");
  expect(queryByTestId("popup")).toBeNull();

  await user.hover(link);
  advance(599);
  expect(queryByTestId("popup")).toBeNull();
  advance(1);
  const popup = getByTestId("popup");
  expect(isOpen(link)).toBe(true);
  expect(popup.hasAttribute("role")).toBe(false);
  expect(popup.hasAttribute("data-open")).toBe(true);
  expect(getByTestId("positioner").style.position).toBe("absolute");
  expect(getByTestId("arrow").getAttribute("aria-hidden")).toBe("true");
  expect(document.activeElement).toBe(document.body);
  expect(getByTestId("changes").textContent).toBe("1");

  vi.useRealTimers();
  await expect.poll(() => popup.getAttribute("data-side")).toBe("bottom");
  expect(popup.getAttribute("data-align")).toBe("center");
});

test("closes 300ms after the pointer leaves", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.hover(link);
  advance(600);
  await user.hover(getByTestId("outside"));
  advance(299);
  expect(isOpen(link)).toBe(true);
  advance(1);
  expect(isOpen(link)).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
});

test("coming back before the close delay keeps it open", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.hover(link);
  advance(600);
  await user.hover(getByTestId("outside"));
  advance(200);
  await user.hover(link);
  advance(1000);
  expect(isOpen(link)).toBe(true);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("stays open while the pointer is over the card, closes after leaving it", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.hover(link);
  advance(600);
  await user.hover(getByTestId("popup"));
  advance(2000);
  expect(isOpen(link)).toBe(true);
  await user.hover(getByRole("link", { name: "Read more about type" }));
  advance(2000);
  expect(isOpen(link)).toBe(true);

  await user.hover(getByTestId("outside"));
  advance(300);
  expect(isOpen(link)).toBe(false);
});

test("leaving before the delay never opens it", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.hover(link);
  advance(500);
  await user.hover(getByTestId("outside"));
  advance(2000);
  expect(isOpen(link)).toBe(false);
  expect(getByTestId("changes").textContent).toBe("0");
});

test("opens on keyboard focus after the delay; focus can move into the card; leaving closes it", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.tab();
  await user.tab();
  expect(document.activeElement).toBe(link);
  advance(599);
  expect(isOpen(link)).toBe(false);
  advance(1);
  expect(isOpen(link)).toBe(true);

  const more = getByRole("link", { name: "Read more about type" });
  more.focus();
  flush();
  expect(isOpen(link)).toBe(true);
  getByRole("button", { name: "After" }).focus();
  flush();
  expect(isOpen(link)).toBe(false);
});

test("blurring the link before the delay never opens it", async () => {
  const user = setup();
  const { getByRole } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.tab();
  await user.tab();
  advance(300);
  await user.tab();
  advance(1000);
  expect(isOpen(link)).toBe(false);
});

test("Escape and a press outside close it", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(basic);
  const link = getByRole("link", { name: "Typography" });
  await user.hover(link);
  advance(600);
  await user.keyboard("{Escape}");
  expect(isOpen(link)).toBe(false);

  await user.hover(getByTestId("outside"));
  await user.hover(link);
  advance(600);
  expect(isOpen(link)).toBe(true);
  await user.click(getByTestId("outside"));
  expect(isOpen(link)).toBe(false);
});

test("can be controlled, with custom delays and placement", async () => {
  const user = setup();
  const { getByRole, getByTestId } = mount(controlled);
  const link = getByRole("link", { name: "Kerning" });
  expect(isOpen(link)).toBe(true);
  await user.hover(link);
  await user.unhover(link);
  expect(getByTestId("open").textContent).toBe("closed");
  await user.hover(link);
  advance(100);
  expect(getByTestId("open").textContent).toBe("open");

  vi.useRealTimers();
  const popup = getByTestId("popup");
  await expect.poll(() => popup.getAttribute("data-side")).toBe("top");
  expect(popup.getAttribute("data-align")).toBe("start");
});
