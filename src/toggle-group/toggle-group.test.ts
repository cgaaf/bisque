import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const pressed = (el: HTMLElement) => el.getAttribute("aria-pressed");

test("is a group with state attributes, seeded by defaultValue", () => {
  const { getByTestId, getByRole } = mount(basic);
  const group = getByTestId("single");
  expect(group.getAttribute("role")).toBe("group");
  expect(group.getAttribute("data-orientation")).toBe("horizontal");
  expect(group.hasAttribute("data-multiple")).toBe(false);
  expect(group.className).toBe("mine");
  expect(getByTestId("multiple").hasAttribute("data-multiple")).toBe(true);
  expect(getByTestId("multiple").getAttribute("data-orientation")).toBe("vertical");
  expect(pressed(getByRole("button", { name: "Center" }))).toBe("true");
  expect(pressed(getByRole("button", { name: "Left" }))).toBe("false");
});

test("single: pressing one releases the other, pressing it again releases it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const left = getByRole("button", { name: "Left" });
  const center = getByRole("button", { name: "Center" });
  await user.click(left);
  expect(pressed(left)).toBe("true");
  expect(left.hasAttribute("data-pressed")).toBe(true);
  expect(pressed(center)).toBe("false");
  expect(getByTestId("log").textContent).toBe("left");
  await user.click(left);
  expect(pressed(left)).toBe("false");
  expect(getByTestId("log").textContent).toBe("");
});

test("a toggle's own onPressedChange runs before the group's change", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Right" }));
  expect(getByTestId("log").textContent).toBe("right");
});

test("multiple: toggles are pressed independently", async () => {
  const { getByRole, user } = mount(basic);
  const bold = getByRole("button", { name: "Bold" });
  const italic = getByRole("button", { name: "Italic" });
  await user.click(bold);
  await user.click(italic);
  expect(pressed(bold)).toBe("true");
  expect(pressed(italic)).toBe("true");
  await user.click(bold);
  expect(pressed(bold)).toBe("false");
  expect(pressed(italic)).toBe("true");
});

test("one Tab stop; the arrow keys, Home and End move between enabled toggles and wrap", async () => {
  const { getByRole, user } = mount(basic);
  const left = getByRole("button", { name: "Left" });
  const center = getByRole("button", { name: "Center" });
  const right = getByRole("button", { name: "Right" });
  getByRole("button", { name: "Before" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(left);
  expect(left.getAttribute("tabindex")).toBe("0");
  expect(center.getAttribute("tabindex")).toBe("-1");

  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(center);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(right);
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(left);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(right);
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(left);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(right);
  // ArrowDown belongs to a vertical group.
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(right);

  // Space presses the focused toggle; the Tab stop stays on it after the state changes.
  await user.keyboard(" ");
  expect(pressed(right)).toBe("true");
  expect(right.getAttribute("tabindex")).toBe("0");
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "Between" }));
  await user.tab({ shift: true });
  expect(document.activeElement).toBe(right);
});

test("vertical without loopFocus stops at the ends", async () => {
  const { getByRole, user } = mount(basic);
  const bold = getByRole("button", { name: "Bold" });
  const underline = getByRole("button", { name: "Underline" });
  bold.focus();
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(bold);
  await user.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}");
  expect(document.activeElement).toBe(underline);
});

test("follows a controlled value", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const left = getByRole("button", { name: "C left" });
  const right = getByRole("button", { name: "C right" });
  expect(pressed(left)).toBe("true");
  await user.click(right);
  expect(pressed(right)).toBe("true");
  expect(pressed(left)).toBe("false");
  expect(getByTestId("align").textContent).toBe("right");
});

test("a disabled group disables its toggles", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  expect(getByTestId("disabled").hasAttribute("data-disabled")).toBe(true);
  const a = getByRole("button", { name: "D a" }) as HTMLButtonElement;
  const b = getByRole("button", { name: "D b" }) as HTMLButtonElement;
  expect(a.disabled).toBe(true);
  expect(b.hasAttribute("data-disabled")).toBe(true);
  await user.click(b);
  expect(pressed(b)).toBe("false");
  expect(pressed(a)).toBe("true");
});
