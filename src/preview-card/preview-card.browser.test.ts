import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Mounted = ReturnType<typeof mount>;

/** The real pointer stays where the last test left it: start each test away from the link. */
async function start(fixture: Parameters<typeof mount>[0]): Promise<Mounted> {
  const mounted = mount(fixture);
  await mounted.user.hover(mounted.getByTestId("outside"));
  return mounted;
}

/** Keyboard-style focus: moved with Tab first (see src/tooltip/tooltip.browser.test.ts), then by script. */
async function keyboardFocus(user: Mounted["user"], element: HTMLElement) {
  await user.keyboard("{Tab}");
  element.focus();
}

test("opens on hover after 600ms, as an unlabelled manual popover that doesn't take focus", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const link = getByRole("link", { name: "Typography" });
  const popup = getByTestId("popup");
  expect(link.getAttribute("href")).toBe("#typography");
  expect(popup.getAttribute("popover")).toBe("manual");
  expect(popup.hasAttribute("role")).toBe(false);
  expect(shown(popup)).toBe(false);

  await user.hover(link);
  await sleep(400);
  expect(shown(popup)).toBe(false);
  await expect.poll(() => shown(popup), { timeout: 1000 }).toBe(true);
  expect(link.hasAttribute("data-popup-open")).toBe(true);
  expect(document.activeElement).toBe(document.body);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("the browser places it below the link, centred, sideOffset away", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const link = getByRole("link", { name: "Typography" });
  const popup = getByTestId("popup");
  await user.hover(link);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await frame();
  const anchor = link.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(8);
  expect(Math.abs(Math.round(placed.left + placed.width / 2 - (anchor.left + anchor.width / 2)))).toBe(0);
});

test("closes 300ms after the pointer leaves", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const link = getByRole("link", { name: "Typography" });
  const popup = getByTestId("popup");
  await user.hover(link);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.hover(getByTestId("outside"));
  await sleep(150);
  expect(shown(popup)).toBe(true);
  await expect.poll(() => shown(popup), { timeout: 600 }).toBe(false);
  expect(link.hasAttribute("data-popup-open")).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
});

test("coming back before the close delay keeps it open", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const link = getByRole("link", { name: "Typography" });
  const popup = getByTestId("popup");
  await user.hover(link);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.hover(getByTestId("outside"));
  await sleep(100);
  await user.hover(link);
  await sleep(600);
  expect(shown(popup)).toBe(true);
  expect(getByTestId("changes").textContent).toBe("1");
});

test("stays open while the pointer is over the card, closes after leaving it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const link = getByRole("link", { name: "Typography" });
  const popup = getByTestId("popup");
  await user.hover(link);
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.hover(popup);
  await sleep(500);
  expect(shown(popup)).toBe(true);
  await user.hover(getByRole("link", { name: "Read more about type" }));
  await sleep(500);
  expect(shown(popup)).toBe(true);

  await user.hover(getByTestId("outside"));
  await expect.poll(() => shown(popup), { timeout: 800 }).toBe(false);
});

test("leaving before the delay never opens it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  await user.hover(getByRole("link", { name: "Typography" }));
  await sleep(300);
  await user.hover(getByTestId("outside"));
  await sleep(700);
  expect(shown(getByTestId("popup"))).toBe(false);
  expect(getByTestId("changes").textContent).toBe("0");
});

test("opens on keyboard focus after the delay; focus can move into the card; leaving both closes it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const link = getByRole("link", { name: "Typography" });
  const popup = getByTestId("popup");
  await keyboardFocus(user, link);
  await sleep(400);
  expect(shown(popup)).toBe(false);
  await expect.poll(() => shown(popup), { timeout: 1000 }).toBe(true);

  getByRole("link", { name: "Read more about type" }).focus();
  await sleep(100);
  expect(shown(popup)).toBe(true);
  getByRole("button", { name: "After" }).focus();
  await expect.poll(() => shown(popup)).toBe(false);
});

test("blurring the link before the delay never opens it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  await keyboardFocus(user, getByRole("link", { name: "Typography" }));
  await sleep(300);
  getByRole("button", { name: "After" }).focus();
  await sleep(700);
  expect(shown(getByTestId("popup"))).toBe(false);
});

test("Escape closes it", async () => {
  const { getByRole, getByTestId, user } = await start(basic);
  const popup = getByTestId("popup");
  await user.hover(getByRole("link", { name: "Typography" }));
  await expect.poll(() => shown(popup), { timeout: 1500 }).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => shown(popup)).toBe(false);
  expect(getByTestId("changes").textContent).toBe("2");
});

test("controlled: shown from the start against its link, above and start-aligned", async () => {
  const { getByRole, getByTestId } = await start(controlled);
  const link = getByRole("link", { name: "Kerning" });
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(true);
  await frame();
  const anchor = link.getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(anchor.top - placed.bottom)).toBe(6);
  expect(Math.abs(Math.round(placed.left - anchor.left))).toBe(0);
});

test("a press outside closes it", async () => {
  const { getByTestId, user } = await start(controlled);
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(true);
  // The pointer was never on the link, so only the press can close it.
  await user.click(getByTestId("outside"));
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("controlled, with its own delays: leaving asks the owner to close it, resting asks to open it", async () => {
  const { getByRole, getByTestId, user } = await start(controlled);
  const link = getByRole("link", { name: "Kerning" });
  const popup = getByTestId("popup");
  await user.hover(link);
  await user.unhover(link);
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
  await user.hover(link);
  await expect.poll(() => getByTestId("open").textContent, { timeout: 400 }).toBe("open");
  expect(shown(popup)).toBe(true);
  await user.click(getByRole("button", { name: "Show" }));
  expect(shown(popup)).toBe(true);
});
