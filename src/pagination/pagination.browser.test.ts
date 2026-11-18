// Pagination in the three engines: real key presses on the buttons, focus kept on a pressed page while the list
// around it changes, and link-based pagination (fixtures/links.rx) with a disabled step that can't be followed.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import links from "./fixtures/links.rx";

const currentText = (root: Element) => root.querySelector("[aria-current='page']")?.textContent;

test("Enter and Space press a page, and the pressed button keeps focus as the window moves", async () => {
  const { getByTestId, user } = mount(basic);
  const root = getByTestId("uncontrolled");
  // Page 5 of 20 shows 1 … 4 5 6 … 20.
  const six = getByTestId("u-6");
  six.focus();
  await user.keyboard("{Enter}");
  expect(currentText(root)).toBe("6");
  // The list is now 1 … 5 6 7 … 20: page 6's button is the same element, still focused.
  expect(getByTestId("u-6")).toBe(six);
  expect(document.activeElement).toBe(six);
  const seven = getByTestId("u-7");
  seven.focus();
  await user.keyboard(" ");
  expect(currentText(root)).toBe("7");
  expect(document.activeElement).toBe(seven);
  expect(seven.getAttribute("aria-current")).toBe("page");
  // Four presses in a row, each moving the window.
  for (const n of [8, 9, 10, 11]) {
    const item = getByTestId(`u-${n}`);
    item.focus();
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the list the one before left
    await user.keyboard("{Enter}");
    expect(currentText(root)).toBe(`${n}`);
    expect(document.activeElement).toBe(item);
  }
  expect(getByTestId("log").textContent).toBe("11");
});

test("Next and Previous answer Enter and Space, and keep focus", async () => {
  const { getByTestId, user } = mount(basic);
  const root = getByTestId("controlled");
  const next = getByTestId("c-next");
  next.focus();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(currentText(root)).toBe("6");
  expect(getByTestId("page").textContent).toBe("6");
  expect((next as HTMLButtonElement).disabled).toBe(true);
  const prev = getByTestId("c-prev");
  prev.focus();
  await user.keyboard("{Enter}");
  expect(currentText(root)).toBe("5");
  expect(document.activeElement).toBe(prev);
  // Six presses in a row on the controlled root, down to the first page and back.
  for (const key of ["{Enter}", " ", "{Enter}", " "]) {
    // oxlint-disable-next-line no-await-in-loop -- each press acts on the page the one before left
    await user.keyboard(key);
  }
  expect(currentText(root)).toBe("1");
  expect(getByTestId("page").textContent).toBe("1");
  expect((prev as HTMLButtonElement).disabled).toBe(true);
  await user.click(getByTestId("c-2"));
  await user.click(getByTestId("c-3"));
  expect(currentText(root)).toBe("3");
  expect(getByTestId("page").textContent).toBe("3");
});

test("every control is an ordinary Tab stop: no roving tabindex", () => {
  const { getByTestId } = mount(basic);
  const root = getByTestId("uncontrolled");
  expect(root.querySelectorAll("[tabindex]")).toHaveLength(0);
});

beforeEach(() => {
  history.replaceState(null, "", location.pathname + location.search);
});

test("links: following one moves the page, which the app reads from the URL", async () => {
  const { getByRole, getByTestId, user } = mount(links);
  const two = getByRole("link", { name: "Page 2" });
  expect(two.getAttribute("href")).toBe("#page-2");
  expect(two.hasAttribute("type")).toBe(false);
  expect(getByRole("link", { name: "Page 1" }).getAttribute("aria-current")).toBe("page");
  await user.click(two);
  await expect.poll(() => two.getAttribute("aria-current")).toBe("page");
  expect(location.hash).toBe("#page-2");
  // Previous now goes to page 1, Next to page 3.
  expect(getByRole("link", { name: "Previous" }).getAttribute("href")).toBe("#page-1");
  const next = getByRole("link", { name: "Next" });
  expect(next.getAttribute("href")).toBe("#page-3");
  next.focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => location.hash).toBe("#page-3");
  await expect.poll(() => getByRole("link", { name: "Page 3" }).getAttribute("aria-current")).toBe("page");
  // The link went where it pointed when pressed, though pressing it made Next the disabled last step.
  expect(next.hasAttribute("href")).toBe(false);
  // A link doesn't change the page itself, so onPageChange isn't called; the consumer's handler ran.
  expect(getByTestId("log").textContent).toBe("n");
});

test("links: a disabled step has no href, keeps role link with aria-disabled, and goes nowhere", async () => {
  const { getByRole, getByTestId, user } = mount(links);
  const prev = getByRole("link", { name: "Previous" });
  expect(prev.hasAttribute("href")).toBe(false);
  expect(prev.getAttribute("aria-disabled")).toBe("true");
  expect(prev.hasAttribute("data-disabled")).toBe(true);
  expect(prev.hasAttribute("disabled")).toBe(false);
  await user.click(prev, { force: true });
  expect(location.hash).toBe("");
  // The consumer's handler is dropped while it is disabled.
  expect(getByTestId("log").textContent).toBe("");
  // Once the page moves off the first, it is an ordinary link again.
  await user.click(getByRole("link", { name: "Page 3" }));
  await expect.poll(() => prev.getAttribute("href")).toBe("#page-2");
  expect(prev.hasAttribute("role")).toBe(false);
  expect(prev.hasAttribute("aria-disabled")).toBe(false);
  const next = getByRole("link", { name: "Next" });
  expect(next.hasAttribute("href")).toBe(false);
  await user.click(next, { force: true });
  expect(location.hash).toBe("#page-3");
  expect(getByTestId("log").textContent).toBe("");
});
