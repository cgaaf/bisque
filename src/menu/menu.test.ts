import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("opens from the trigger and wires ARIA", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
  expect(queryByRole("menu")).toBeNull();

  await user.click(trigger);
  const popup = getByRole("menu");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(popup.id);
  expect(document.activeElement).toBe(popup);
  const positioner = getByTestId("positioner");
  expect(positioner.style.position).toBe("absolute");
  await expect.poll(() => positioner.getAttribute("data-side")).toBe("bottom");
});

test("arrow keys move through enabled items and wrap", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("button", { name: "Actions" }).focus();
  await user.keyboard("{ArrowDown}");
  const rename = getByRole("menuitem", { name: "Rename" });
  expect(document.activeElement).toBe(rename);
  expect(rename.hasAttribute("data-highlighted")).toBe(true);

  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Delete" }));
  expect(rename.hasAttribute("data-highlighted")).toBe(false);
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(rename);
});

test("ArrowUp on the trigger opens on the last item", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("button", { name: "Actions" }).focus();
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
});

test("typing moves to the item that starts with the letters", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  await user.keyboard("d");
  expect(document.activeElement).toBe(getByRole("menuitem", { name: "Delete" }));
  await user.keyboard("d");
  expect(document.activeElement).toBe(getByRole("menuitemradio", { name: "Date" }));
});

test("choosing an item runs its handler, closes, and returns focus", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  trigger.focus();
  await user.keyboard("{Enter}");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("chosen").textContent).toBe("delete");
  await expect.poll(() => queryByRole("menu")).toBeNull();
  expect(document.activeElement).toBe(trigger);
});

test("a disabled item can't be chosen", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  const archive = getByRole("menuitem", { name: "Archive" });
  expect(archive.getAttribute("aria-disabled")).toBe("true");
  await user.click(archive);
  expect(getByTestId("chosen").textContent).toBe("none");
  expect(getByRole("menu")).toBeTruthy();
});

test("checkbox and radio items update their state and keep the menu open", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  await user.click(getByRole("button", { name: "Actions" }));
  const wrap = getByRole("menuitemcheckbox", { name: "Word wrap" });
  expect(wrap.getAttribute("aria-checked")).toBe("false");
  await user.click(wrap);
  expect(wrap.getAttribute("aria-checked")).toBe("true");
  expect(getByTestId("wrap").textContent).toBe("on");

  const date = getByRole("menuitemradio", { name: "Date" });
  await user.click(date);
  expect(date.getAttribute("aria-checked")).toBe("true");
  expect(getByRole("menuitemradio", { name: "Name" }).getAttribute("aria-checked")).toBe("false");
  expect(getByTestId("sort").textContent).toBe("date");
  expect(getByRole("group", { name: "Sort by" })).toBe(getByText("Sort by").parentElement);
  expect(getByRole("menu")).toBeTruthy();
});

test("Escape and Tab close the menu", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  const trigger = getByRole("button", { name: "Actions" });
  await user.click(trigger);
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("menu")).toBeNull();
  await user.click(trigger);
  await user.keyboard("{ArrowDown}");
  await user.tab();
  await expect.poll(() => queryByRole("menu")).toBeNull();
});
