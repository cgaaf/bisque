import { expect, test } from "vitest";
import { flush, mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import field from "./fixtures/field.rx";
import multiple from "./fixtures/multiple.rx";

function formValue(form: HTMLElement, name: string) {
  return new FormData(form as HTMLFormElement).getAll(name);
}

test("renders a combobox trigger with the placeholder, and no listbox while closed", () => {
  const { getByRole, queryByRole, getByTestId } = mount(basic);
  const trigger = getByRole("combobox");
  expect(trigger.getAttribute("aria-haspopup")).toBe("listbox");
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.hasAttribute("aria-controls")).toBe(false);
  expect(trigger.hasAttribute("data-placeholder")).toBe(true);
  expect(getByTestId("value").textContent).toBe("Pick a fruit");
  expect(getByTestId("value").hasAttribute("data-placeholder")).toBe(true);
  expect(queryByRole("listbox")).toBeNull();
  expect(getByTestId("positioner").hidden).toBe(true);
  expect(queryByRole("presentation")).toBeNull();
});

test("a click opens the listbox, focuses it, and choosing an item selects it and closes", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  await user.click(trigger);
  const listbox = getByRole("listbox");
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(trigger.getAttribute("aria-controls")).toBe(listbox.id);
  expect(trigger.hasAttribute("data-popup-open")).toBe(true);
  expect(listbox.hasAttribute("data-open")).toBe(true);
  expect(document.activeElement).toBe(listbox);
  expect(getByTestId("backdrop").hasAttribute("data-open")).toBe(true);
  expect(getByTestId("opens").textContent).toBe("open;");
  await expect.poll(() => getByTestId("positioner").getAttribute("data-side")).toBe("bottom");
  expect(getByTestId("arrow").getAttribute("aria-hidden")).toBe("true");

  const banana = getByRole("option", { name: "Banana" });
  expect(banana.getAttribute("aria-selected")).toBe("false");
  await user.click(banana);
  expect(getByTestId("value").textContent).toBe("Banana");
  expect(getByTestId("changes").textContent).toBe("banana;");
  expect(getByTestId("opens").textContent).toBe("open;close;");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(trigger.hasAttribute("data-placeholder")).toBe(false);
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
  expect(document.activeElement).toBe(getByRole("option", { name: focused }));
  expect(getByTestId("opens").textContent).toBe("open;");
});

test("arrow keys move through enabled items without wrapping; Enter selects", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  getByRole("combobox").focus();
  await user.keyboard("{ArrowDown}");
  const apple = getByRole("option", { name: "Apple" });
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
});

test("reopening focuses the selected item, which is marked selected with its indicator", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  await user.click(trigger);
  await user.click(getByRole("option", { name: "Avocado" }));
  await user.click(trigger);
  const avocado = getByRole("option", { name: "Avocado" });
  expect(document.activeElement).toBe(avocado);
  expect(avocado.getAttribute("aria-selected")).toBe("true");
  expect(avocado.hasAttribute("data-selected")).toBe(true);
  expect(avocado.textContent).toBe("✓Avocado");
  // The value shows the item's text, not its indicator.
  expect(getByTestId("value").textContent).toBe("Avocado");
});

test("the pointer highlights items; a disabled item can't be chosen", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("combobox"));
  const banana = getByRole("option", { name: "Banana" });
  await user.hover(banana);
  expect(document.activeElement).toBe(banana);
  const apricot = getByRole("option", { name: "Apricot" });
  expect(apricot.getAttribute("aria-disabled")).toBe("true");
  expect(apricot.hasAttribute("data-disabled")).toBe(true);
  await user.click(apricot);
  expect(getByTestId("changes").textContent).toBe("");
  expect(getByRole("listbox")).toBeTruthy();
});

test("Escape and Tab close the popup and return focus to the trigger", async () => {
  const { getByRole, queryByRole, user } = mount(basic);
  const trigger = getByRole("combobox");
  await user.click(trigger);
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await user.click(trigger);
  await user.keyboard("{Tab}");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
});

test("typeahead in the open list focuses the next match by label", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("combobox"));
  await user.keyboard("b");
  expect(document.activeElement).toBe(getByRole("option", { name: "Banana" }));
  // Matches the item's label ("France"), not its text.
  await user.keyboard("{Home}");
  await new Promise((resolve) => setTimeout(resolve, 520));
  await user.keyboard("fr");
  expect(document.activeElement).toBe(getByRole("option", { name: "Option FR" }));
});

test("typeahead on the closed trigger selects the match, skipping disabled items, without opening", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  getByRole("combobox").focus();
  await user.keyboard("a");
  expect(getByTestId("value").textContent).toBe("Apple");
  // The same letter again cycles: apricot is disabled, so avocado.
  await user.keyboard("a");
  expect(getByTestId("value").textContent).toBe("Avocado");
  expect(queryByRole("listbox")).toBeNull();
  expect(getByTestId("changes").textContent).toBe("apple;avocado;");
});

test("closed-trigger typeahead starts a new search after focus leaves", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const trigger = getByRole("combobox");
  trigger.focus();
  await user.keyboard("b");
  expect(getByTestId("value").textContent).toBe("Banana");
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

test("controlled value and open state", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(controlled);
  const trigger = getByTestId("trigger");
  expect(getByTestId("value").textContent).toBe("Cherry");
  await user.click(getByRole("button", { name: "Set plum" }));
  expect(getByTestId("value").textContent).toBe("Plum");
  await user.click(getByRole("button", { name: "Clear" }));
  expect(getByTestId("value").textContent).toBe("");

  await user.click(trigger);
  expect(getByTestId("open").textContent).toBe("open");
  expect(document.activeElement).toBe(getByTestId("popup"));
  await user.click(getByRole("option", { name: "Cherry" }));
  expect(getByTestId("fruit").textContent).toBe("cherry");
  expect(getByTestId("open").textContent).toBe("closed");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
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
  const { getByTestId, queryByRole, user } = mount(controlled);
  const trigger = getByTestId("disabled-trigger") as HTMLButtonElement;
  expect(trigger.disabled).toBe(true);
  expect(trigger.hasAttribute("data-disabled")).toBe(true);
  await user.click(trigger);
  expect(queryByRole("listbox")).toBeNull();
});

test("multiple: items toggle, the popup stays open, every value is submitted", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const form = getByTestId("form");
  expect(getByTestId("value").textContent).toBe("Cheese");
  expect(formValue(form, "toppings")).toEqual(["cheese"]);

  await user.click(getByTestId("trigger"));
  const listbox = getByRole("listbox");
  expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
  expect(document.activeElement).toBe(getByRole("option", { name: "Cheese" }));
  await user.click(getByRole("option", { name: "Olives" }));
  expect(getByRole("listbox")).toBe(listbox);
  expect(getByTestId("value").textContent).toBe("Cheese, Olives");
  expect(formValue(form, "toppings")).toEqual(["cheese", "olives"]);

  await user.click(getByRole("option", { name: "Cheese" }));
  expect(getByTestId("picked").textContent).toBe("olives");
  expect(getByRole("option", { name: "Cheese" }).getAttribute("aria-selected")).toBe("false");
  expect(formValue(form, "toppings")).toEqual(["olives"]);
  await user.keyboard("{Escape}");
});

test("inside a field: labelled, described, named and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(field);
  const trigger = getByRole("combobox", { name: "Size" });
  expect(trigger.getAttribute("aria-describedby")).toBe(getByTestId("size-description").id);
  const root = getByTestId("size-root");

  // Focus moving from the trigger into the popup stays inside the field: not blurred, not yet touched.
  await user.click(trigger);
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(root.hasAttribute("data-touched")).toBe(false);
  await user.keyboard("{Escape}");
  expect(root.hasAttribute("data-focused")).toBe(true);
  trigger.blur();
  flush();
  expect(root.hasAttribute("data-focused")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(true);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("size-error").textContent).toBe("Choose a size");
  expect(trigger.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(trigger);

  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
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
