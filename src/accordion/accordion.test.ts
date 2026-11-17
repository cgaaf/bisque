import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import multiple from "./fixtures/multiple.rx";

test("wires triggers to their panels", () => {
  const { getByRole, getByTestId } = mount(basic);
  const one = getByRole("button", { name: "One" });
  const panel = getByTestId("panel-one");
  expect(getByTestId("header-one").tagName).toBe("H3");
  expect(one.getAttribute("aria-expanded")).toBe("true");
  expect(one.getAttribute("aria-controls")).toBe(panel.id);
  expect(panel.getAttribute("role")).toBe("region");
  expect(panel.getAttribute("aria-labelledby")).toBe(one.id);
  expect(one.hasAttribute("data-panel-open")).toBe(true);
  expect(getByTestId("item-one").hasAttribute("data-open")).toBe(true);
  expect(getByTestId("root").getAttribute("data-orientation")).toBe("vertical");
  expect(getByTestId("root").className).toBe("mine");

  const two = getByRole("button", { name: "Two" });
  expect(two.getAttribute("aria-expanded")).toBe("false");
  expect(two.hasAttribute("aria-controls")).toBe(false);
});

test("opening one item closes the other when not `multiple`", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Two" }));
  expect(getByTestId("changes").textContent).toBe("two");
  expect(getByTestId("opened").textContent).toBe("two open");
  expect(getByTestId("panel-two").textContent).toBe("Second");
  expect(getByRole("button", { name: "One" }).getAttribute("aria-expanded")).toBe("false");
  // The closing panel animates out before it unmounts.
  expect(getByTestId("panel-one").hasAttribute("data-ending-style")).toBe(true);
  await expect.poll(() => queryByTestId("panel-one")).toBeNull();

  await user.click(getByRole("button", { name: "Two" }));
  expect(getByTestId("changes").textContent).toBe("");
  expect(getByTestId("opened").textContent).toBe("two closed");
});

test("trigger props work on an element the consumer owns", async () => {
  const { getByTestId, user } = mount(basic);
  const link = getByTestId("link");
  const panel = getByTestId("panel-four");
  expect(link.tagName).toBe("A");
  expect(panel.hidden).toBe(true);
  await user.click(link);
  expect(link.getAttribute("aria-expanded")).toBe("true");
  expect(panel.hidden).toBe(false);
});

test("a disabled item can't be toggled or focused by the arrow keys", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const three = getByRole("button", { name: "Three" }) as HTMLButtonElement;
  expect(three.disabled).toBe(true);
  expect(three.hasAttribute("data-disabled")).toBe(true);
  expect(getByTestId("item-three").hasAttribute("data-disabled")).toBe(true);
  await user.click(three);
  expect(three.getAttribute("aria-expanded")).toBe("false");
  expect(getByTestId("changes").textContent).toBe("");

  getByRole("button", { name: "Two" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByTestId("link"));
});

test("arrow keys, Home and End move between triggers and wrap", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const one = getByRole("button", { name: "One" });
  one.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("button", { name: "Two" }));
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(document.activeElement).toBe(getByTestId("link"));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(one);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(getByTestId("link"));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(one);
  // Horizontal arrows do nothing in a vertical accordion.
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(one);
});

test("keys pressed inside a panel stay there", async () => {
  const { getByRole, user } = mount(basic);
  const note = getByRole("textbox", { name: "Note" });
  await user.click(note);
  await user.keyboard("ab{ArrowDown}{Home}{End}");
  expect(document.activeElement).toBe(note);
  expect((note as HTMLInputElement).value).toBe("ab");
});

test("Enter and Space toggle the focused item", async () => {
  const { getByRole, user } = mount(basic);
  const two = getByRole("button", { name: "Two" });
  two.focus();
  await user.keyboard("{Enter}");
  expect(two.getAttribute("aria-expanded")).toBe("true");
  await user.keyboard(" ");
  expect(two.getAttribute("aria-expanded")).toBe("false");
});

test("`multiple` keeps several items open, controlled by `value`", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const beta = getByRole("button", { name: "Beta" });
  await user.click(beta);
  expect(getByTestId("value").textContent).toBe("a,b");
  expect(getByRole("button", { name: "Alpha" }).getAttribute("aria-expanded")).toBe("true");
  expect(beta.getAttribute("aria-expanded")).toBe("true");

  await user.click(getByRole("button", { name: "Alpha" }));
  expect(getByTestId("value").textContent).toBe("b");

  await user.click(getByRole("button", { name: "Close all" }));
  expect(beta.getAttribute("aria-expanded")).toBe("false");
});

test("root `keepMounted` keeps closed panels hidden, and a panel can opt out", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(multiple);
  const panelB = getByTestId("panel-b");
  expect(panelB.hidden).toBe(true);
  expect(panelB.hasAttribute("data-closed")).toBe(true);
  expect(getByTestId("panel-a").hidden).toBe(false);
  expect(queryByTestId("panel-c")).toBeNull();

  // An item without a `value` gets one of its own.
  await user.click(getByRole("button", { name: "Gamma" }));
  expect(getByTestId("panel-c").textContent).toBe("C");
  expect(getByTestId("value").textContent).toMatch(/^a,rs-ui-accordion-item-\d+$/);

  await user.click(getByRole("button", { name: "Alpha" }));
  const panelA = getByTestId("panel-a");
  expect(panelA.hasAttribute("data-ending-style")).toBe(true);
  expect(panelA.hidden).toBe(false);
  await expect.poll(() => panelA.hidden).toBe(true);
});

test("a horizontal accordion uses Left and Right, without wrapping when `loopFocus` is false", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  expect(getByTestId("controlled").getAttribute("data-orientation")).toBe("horizontal");
  const alpha = getByRole("button", { name: "Alpha" });
  alpha.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(alpha);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(alpha);
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("button", { name: "Gamma" }));
});

test("a disabled root disables every item", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const locked = getByRole("button", { name: "Locked" }) as HTMLButtonElement;
  expect(locked.disabled).toBe(true);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  await user.click(locked);
  expect(locked.getAttribute("aria-expanded")).toBe("false");
});

test("writes the panel's measured size to CSS variables", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const panel = getByTestId("panel-b");
  Object.defineProperty(panel, "scrollHeight", { configurable: true, get: () => 64 });
  Object.defineProperty(panel, "scrollWidth", { configurable: true, get: () => 200 });
  const beta = getByRole("button", { name: "Beta" });

  await user.click(beta);
  expect(panel.style.getPropertyValue("--accordion-panel-height")).toBe("64px");
  expect(panel.style.getPropertyValue("--accordion-panel-width")).toBe("200px");
  await expect.poll(() => panel.style.getPropertyValue("--accordion-panel-height")).toBe("auto");

  await user.click(beta);
  expect(panel.style.getPropertyValue("--accordion-panel-height")).toBe("64px");
});
