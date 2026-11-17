import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import field from "./fixtures/field.rx";
import multiple from "./fixtures/multiple.rx";
import nested from "../combobox/fixtures/nested.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

function formValue(form: HTMLElement, name: string) {
  return new FormData(form as HTMLFormElement).getAll(name);
}

test("closed: a combobox button wired to a listbox popover that stays in the document", () => {
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("combobox");
  const listbox = getByRole("listbox", { hidden: true });
  expect(trigger.tagName).toBe("BUTTON");
  expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
  expect(trigger.getAttribute("popovertarget")).toBe(listbox.id);
  expect(listbox.getAttribute("popover")).toBe("auto");
  expect(shown(listbox)).toBe(false);
  expect(trigger.hasAttribute("data-placeholder")).toBe(true);
  expect(getByTestId("value").textContent).toBe("Pick a fruit");
  expect(getByTestId("value").hasAttribute("data-placeholder")).toBe(true);
});

test("a click opens the listbox and focuses it; choosing an item selects it, closes, and focuses the trigger", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  const listbox = getByRole("listbox", { hidden: true });
  await user.click(trigger);
  expect(shown(listbox)).toBe(true);
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  await expect.poll(() => document.activeElement).toBe(listbox);
  expect(getByTestId("opens").textContent).toBe("open;");

  const banana = getByRole("option", { name: "Banana" });
  expect(banana.getAttribute("aria-selected")).toBe("false");
  await user.click(banana);
  expect(getByTestId("value").textContent).toBe("Banana");
  expect(getByTestId("changes").textContent).toBe("banana;");
  await expect.poll(() => shown(listbox)).toBe(false);
  expect(getByTestId("opens").textContent).toBe("open;close;");
  expect(document.activeElement).toBe(trigger);
  expect(trigger.hasAttribute("data-placeholder")).toBe(false);
});

test("the browser places it below the trigger, start edges aligned, at least as wide as the trigger", async () => {
  const { getByRole, user } = mount(basic);
  const trigger = getByRole("combobox");
  await user.click(trigger);
  await frame();
  const anchor = trigger.getBoundingClientRect();
  const placed = getByRole("listbox").getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(4);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
  expect(Math.round(placed.width)).toBeGreaterThanOrEqual(Math.round(anchor.width));
});

test("the browser flips it above the trigger when it can't fit below", async () => {
  const { getByTestId, user } = mount(controlled);
  const trigger = getByTestId("low-trigger");
  await user.click(trigger);
  await frame();
  const placed = getByTestId("low-popup").getBoundingClientRect();
  expect(placed.bottom).toBeLessThanOrEqual(trigger.getBoundingClientRect().top + 1);
  expect(placed.top).toBeGreaterThanOrEqual(0);
});

test("groups, labels and separators carry their roles", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("combobox"));
  const group = getByRole("group", { name: "Fruits" });
  expect(group.querySelectorAll("[role=option]").length).toBe(4);
  expect(getByRole("separator").getAttribute("aria-orientation")).toBe("horizontal");
});

test.each([
  ["{ArrowDown}", "Apple"],
  ["{Enter}", "Apple"],
  [" ", "Apple"],
  ["{ArrowUp}", "Option FR"],
])("%s on the closed trigger opens on the first or last item", async (key, focused) => {
  const { getByRole, getByTestId, user } = mount(basic);
  getByRole("combobox").focus();
  await user.keyboard(key);
  await expect.poll(() => document.activeElement?.textContent).toBe(focused);
  expect(shown(getByRole("listbox"))).toBe(true);
  expect(getByTestId("opens").textContent).toBe("open;");
});

test("arrow keys move through enabled items without wrapping; Enter selects", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  getByRole("combobox").focus();
  await user.keyboard("{ArrowDown}");
  const apple = getByRole("option", { name: "Apple" });
  await expect.poll(() => document.activeElement).toBe(apple);
  expect(apple.hasAttribute("data-highlighted")).toBe(true);
  await user.keyboard("{ArrowDown}");
  // Apricot is disabled: skipped.
  expect(document.activeElement).toBe(getByRole("option", { name: "Avocado" }));
  expect(apple.hasAttribute("data-highlighted")).toBe(false);
  await user.keyboard("{End}{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Option FR" }));
  await user.keyboard("{Home}{ArrowUp}");
  expect(document.activeElement).toBe(apple);
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("value").textContent).toBe("Avocado");
  await expect.poll(() => document.activeElement).toBe(getByRole("combobox"));
});

test("reopening focuses the selected item, which is marked selected with its indicator", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  await user.click(trigger);
  await user.click(getByRole("option", { name: "Avocado" }));
  await user.click(trigger);
  const avocado = getByRole("option", { name: "Avocado" });
  await expect.poll(() => document.activeElement).toBe(avocado);
  expect(avocado.getAttribute("aria-selected")).toBe("true");
  expect(avocado.hasAttribute("data-selected")).toBe(true);
  expect(avocado.textContent).toBe("✓Avocado");
  // The value shows the item's text, not its indicator.
  expect(getByTestId("value").textContent).toBe("Avocado");
});

test("the selected item is scrolled into view when the list opens on it", async () => {
  const { getByTestId, getByRole, user } = mount(controlled);
  const trigger = getByTestId("low-trigger");
  const popup = getByTestId("low-popup");
  await user.click(trigger);
  await user.click(getByRole("option", { name: "Six" }));
  await expect.poll(() => shown(popup)).toBe(false);
  await user.click(trigger);
  await expect.poll(() => document.activeElement).toBe(getByRole("option", { name: "Six" }));
  expect(popup.scrollTop).toBeGreaterThan(0);
});

test("the pointer highlights items; a disabled item can't be chosen", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("combobox"));
  const banana = getByRole("option", { name: "Banana" });
  await user.hover(banana);
  expect(document.activeElement).toBe(banana);
  expect(banana.hasAttribute("data-highlighted")).toBe(true);
  const apricot = getByRole("option", { name: "Apricot" });
  expect(apricot.getAttribute("aria-disabled")).toBe("true");
  expect(apricot.hasAttribute("data-disabled")).toBe(true);
  // Playwright won't press an aria-disabled element unless forced.
  await user.click(apricot, { force: true });
  expect(getByTestId("changes").textContent).toBe("");
  expect(shown(getByRole("listbox"))).toBe(true);
});

test("Escape closes it and focuses the trigger, however it was opened", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  const listbox = getByRole("listbox", { hidden: true });
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => listbox.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(listbox)).toBe(false);
  expect(document.activeElement).toBe(trigger);

  // Opened with the pointer: Safari never focused the trigger.
  await user.click(trigger);
  await expect.poll(() => document.activeElement).toBe(listbox);
  await user.keyboard("{Escape}");
  expect(shown(listbox)).toBe(false);
  expect(document.activeElement).toBe(trigger);
  await expect.poll(() => getByTestId("opens").textContent).toBe("open;close;open;close;");
  await expect.poll(() => trigger.getAttribute("aria-expanded")).toBe("false");
});

test("a press outside or on the trigger closes it, and is reported", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  const listbox = getByRole("listbox", { hidden: true });
  await user.click(trigger);
  expect(shown(listbox)).toBe(true);
  // A point of the page the popup doesn't cover.
  await user.click(document.body, { position: { x: 5, y: 5 } });
  expect(shown(listbox)).toBe(false);
  await user.click(trigger);
  expect(shown(listbox)).toBe(true);
  await user.click(trigger);
  expect(shown(listbox)).toBe(false);
  await expect.poll(() => getByTestId("opens").textContent).toBe("open;close;open;close;");
  expect(getByTestId("changes").textContent).toBe("");
});

test("Tab closes it and moves on past the trigger", async () => {
  const { getByRole, user } = mount(basic);
  const trigger = getByRole("combobox");
  const listbox = getByRole("listbox", { hidden: true });
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => listbox.contains(document.activeElement)).toBe(true);
  await user.tab();
  await expect.poll(() => shown(listbox)).toBe(false);
  expect(document.activeElement).toBe(getByRole("textbox", { name: "After" }));
});

test("typeahead in the open list focuses the next match by label", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("combobox").focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement).toBe(getByRole("option", { name: "Apple" }));
  await user.keyboard("b");
  expect(document.activeElement).toBe(getByRole("option", { name: "Banana" }));
  // Matches the item's label ("France"), not its text.
  await user.keyboard("{Home}");
  await new Promise((resolve) => setTimeout(resolve, 520));
  await user.keyboard("fr");
  expect(document.activeElement).toBe(getByRole("option", { name: "Option FR" }));
});

test("typeahead on the closed trigger selects the match, skipping disabled items, without opening", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  trigger.focus();
  await user.keyboard("a");
  expect(getByTestId("value").textContent).toBe("Apple");
  // The same letter again cycles: apricot is disabled, so avocado.
  await user.keyboard("a");
  expect(getByTestId("value").textContent).toBe("Avocado");
  expect(shown(getByRole("listbox", { hidden: true }))).toBe(false);
  expect(getByTestId("changes").textContent).toBe("apple;avocado;");
  expect(document.activeElement).toBe(trigger);
});

test("closed-trigger typeahead starts a new search after focus leaves", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  trigger.focus();
  await user.keyboard("b");
  expect(getByTestId("value").textContent).toBe("Banana");
  // Safari skips buttons when tabbing, so focus leaves and comes back by script.
  trigger.blur();
  trigger.focus();
  await user.keyboard("a");
  expect(getByTestId("value").textContent).toBe("Apple");
});

test("submits the selected value with its form", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form");
  expect(formValue(form, "fruit")).toEqual([""]);
  await user.click(getByRole("combobox"));
  await user.click(getByRole("option", { name: "Option FR" }));
  expect(formValue(form, "fruit")).toEqual(["fr"]);
  expect(getByTestId("value").textContent).toBe("France");
});

test("controlled value and open state, including opening from outside its parts", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const trigger = getByTestId("trigger");
  const popup = getByTestId("popup");
  expect(getByTestId("value").textContent).toBe("Cherry");
  await user.click(getByRole("button", { name: "Set plum" }));
  expect(getByTestId("value").textContent).toBe("Plum");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(getByTestId("value").textContent).toBe("");

  await user.click(trigger);
  await expect.poll(() => getByTestId("open").textContent).toBe("open");
  await expect.poll(() => document.activeElement).toBe(popup);
  await user.click(getByRole("option", { name: "Cherry" }));
  expect(getByTestId("fruit").textContent).toBe("cherry");
  expect(getByTestId("open").textContent).toBe("closed");
  await expect.poll(() => shown(popup)).toBe(false);

  await user.click(getByRole("button", { name: "Open from outside" }));
  await expect.poll(() => shown(popup)).toBe(true);
  await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("read-only: opens, but nothing can be selected", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const trigger = getByTestId("readonly-trigger");
  expect(trigger.getAttribute("aria-readonly")).toBe("true");
  await user.click(trigger);
  const listbox = getByRole("listbox");
  expect(listbox.getAttribute("aria-readonly")).toBe("true");
  await user.click(getByRole("option", { name: "A" }));
  expect(trigger.textContent).toBe("B");
  // Typeahead on the closed trigger doesn't select either.
  await user.keyboard("{Escape}");
  trigger.focus();
  await user.keyboard("a");
  expect(trigger.textContent).toBe("B");
});

test("disabled: the trigger can't open", async () => {
  const { getByTestId, user } = mount(controlled);
  const trigger = getByTestId("disabled-trigger") as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  expect(trigger.hasAttribute("data-disabled")).toBe(true);
  await user.click(trigger, { force: true });
  const popup = document.getElementById(trigger.getAttribute("aria-controls")!)!;
  expect(shown(popup)).toBe(false);
});

test("multiple: items toggle, the popup stays open, every value is submitted", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const form = getByTestId("form");
  expect(getByTestId("value").textContent).toBe("Cheese");
  expect(formValue(form, "toppings")).toEqual(["cheese"]);

  await user.click(getByTestId("trigger"));
  const listbox = getByRole("listbox");
  expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
  await expect.poll(() => document.activeElement).toBe(getByRole("option", { name: "Cheese" }));
  await user.click(getByRole("option", { name: "Olives" }));
  expect(shown(listbox)).toBe(true);
  expect(getByTestId("value").textContent).toBe("Cheese, Olives");
  expect(formValue(form, "toppings")).toEqual(["cheese", "olives"]);

  await user.click(getByRole("option", { name: "Cheese" }));
  expect(getByTestId("picked").textContent).toBe("olives");
  expect(getByRole("option", { name: "Cheese" }).getAttribute("aria-selected")).toBe("false");
  expect(formValue(form, "toppings")).toEqual(["olives"]);
  await user.keyboard("{Escape}");
  expect(shown(listbox)).toBe(false);
});

test("inside a field: labelled, described, named and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(field);
  const trigger = getByRole("combobox", { name: "Size" });
  expect(trigger.getAttribute("aria-describedby")).toBe(getByTestId("size-description").id);
  const root = getByTestId("size-root");

  // Focus moving from the trigger into the popup stays inside the field: not blurred, not yet touched.
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement?.getAttribute("role")).toBe("option");
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(root.hasAttribute("data-touched")).toBe(false);
  await user.keyboard("{Escape}");
  expect(document.activeElement).toBe(trigger);
  expect(root.hasAttribute("data-focused")).toBe(true);
  trigger.blur();
  await expect.poll(() => root.hasAttribute("data-focused")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(true);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("size-error").textContent).toBe("Choose a size");
  expect(trigger.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(trigger);

  await user.keyboard("{ArrowDown}");
  await expect.poll(() => document.activeElement?.textContent).toBe("Small");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(trigger.textContent).toBe("Large");
  expect(queryByTestId("size-error")).toBeNull();
  expect(trigger.hasAttribute("data-dirty")).toBe(true);
  expect(formValue(getByTestId("form"), "size")).toEqual(["l"]);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("size=l");
});

test("inside a disabled field: disabled", () => {
  const { getByRole } = mount(field);
  expect((getByRole("combobox", { name: "Locked" }) as HTMLButtonElement).disabled).toBe(true);
});

test("inside a modal dialog: Escape closes the list, not the dialog, and focus returns to the trigger", async () => {
  const { getByRole, getByTestId, user } = mount(nested);
  const dialog = getByTestId("dialog") as HTMLDialogElement;
  await user.click(getByRole("button", { name: "Open dialog" }));
  await expect.poll(() => dialog.open).toBe(true);
  const trigger = getByRole("combobox", { name: "Size" });
  const popup = getByTestId("size-popup");
  trigger.focus();
  await user.keyboard("{ArrowDown}");
  await expect.poll(() => popup.contains(document.activeElement)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  expect(dialog.open).toBe(true);
  expect(document.activeElement).toBe(trigger);
  await user.keyboard("{Escape}");
  await expect.poll(() => dialog.open).toBe(false);
});
