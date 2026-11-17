import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import field from "./fixtures/field.rx";
import multiple from "./fixtures/multiple.rx";

function formValue(form: HTMLElement, name: string) {
  return new FormData(form as HTMLFormElement).getAll(name);
}

function optionNames(getAllByRole: (role: string) => HTMLElement[]) {
  return getAllByRole("option").map((option) => option.getAttribute("data-label") ?? option.textContent);
}

test("an input with role combobox; the listbox is hidden while closed", () => {
  const { getByRole, queryByRole, getByTestId } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  expect(input.tagName).toBe("INPUT");
  expect(input.getAttribute("aria-autocomplete")).toBe("list");
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  expect(queryByRole("listbox")).toBeNull();
  expect(getByTestId("positioner").hidden).toBe(true);
  expect(getByTestId("value").textContent).toBe("none");
});

test("typing opens the list and filters it, case- and accent-insensitively", async () => {
  const { getByRole, getAllByRole, queryAllByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.type(input, "b");
  const listbox = getByRole("listbox");
  expect(input.getAttribute("aria-expanded")).toBe("true");
  expect(input.getAttribute("aria-controls")).toBe(listbox.id);
  expect(optionNames(getAllByRole)).toEqual(["Banana", "Blueberry", "Crème brûlée"]);
  expect(getByTestId("group").hidden).toBe(false);
  expect(getByTestId("typed").textContent).toBe("b");

  await user.clear(input);
  await user.type(input, "CREME");
  expect(optionNames(getAllByRole)).toEqual(["Crème brûlée"]);
  // The group has no match left: hidden.
  expect(getByTestId("group").hidden).toBe(true);
  expect(getByTestId("empty").textContent).toBe("");

  await user.type(input, "x");
  expect(queryAllByRole("option", { hidden: true }).length).toBe(0);
  expect(getByTestId("empty").textContent).toBe("No fruit found");
  expect(getByTestId("popup").hasAttribute("data-empty")).toBe(true);
});

test("arrow keys move the active descendant while focus stays in the input", async () => {
  const { getByRole, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  expect(getByRole("listbox")).toBeTruthy();
  await user.keyboard("{ArrowDown}");
  const apple = getByRole("option", { name: "Apple" });
  expect(document.activeElement).toBe(input);
  expect(input.getAttribute("aria-activedescendant")).toBe(apple.id);
  expect(apple.hasAttribute("data-highlighted")).toBe(true);

  await user.keyboard("{ArrowDown}{ArrowDown}");
  // Blueberry is disabled: skipped.
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Crème brûlée" }).id);
  expect(apple.hasAttribute("data-highlighted")).toBe(false);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  // Past the last option: back to the input, nothing highlighted.
  expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  await user.keyboard("{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBe(apple.id);
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Cherry" }).id);
  expect(document.activeElement).toBe(input);
});

test("Enter chooses the highlighted option: the input shows its label, the list closes", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  await user.type(input, "ban");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(input.value).toBe("Banana");
  expect(getByTestId("changes").textContent).toBe("banana;");
  expect(getByTestId("typed").textContent).toBe("Banana");
  expect(getByTestId("value").textContent).toBe("Banana");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(formValue(getByTestId("form"), "fruit")).toEqual(["banana"]);
});

test("clicking an option chooses it and keeps focus in the input", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  await user.click(input);
  await user.click(getByRole("option", { name: "Cherry" }));
  expect(input.value).toBe("Cherry");
  expect(document.activeElement).toBe(input);
  expect(getByTestId("changes").textContent).toBe("cherry;");

  // Reopened, every option shows (the input shows the selection, not a filter), and the selected one is marked.
  await user.click(input);
  const cherry = getByRole("option", { name: "Cherry" });
  expect(cherry.getAttribute("aria-selected")).toBe("true");
  expect(getByRole("listbox").querySelectorAll("[role=option]").length).toBe(5);
});

test("the pointer highlights an option; a disabled option can't be chosen", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  const banana = getByRole("option", { name: "Banana" });
  await user.hover(banana);
  expect(input.getAttribute("aria-activedescendant")).toBe(banana.id);
  const blueberry = getByRole("option", { name: "Blueberry" });
  expect(blueberry.getAttribute("aria-disabled")).toBe("true");
  await user.click(blueberry);
  expect(getByTestId("changes").textContent).toBe("");
  expect(getByRole("listbox")).toBeTruthy();
});

test("a highlighted option that the filter removes is no longer the active descendant", async () => {
  const { getByRole, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  await user.keyboard("{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Apple" }).id);
  await user.type(input, "ch");
  expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  await user.keyboard("{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Cherry" }).id);
});

test("Escape closes and puts the selection back in the input; Tab closes", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  await user.click(input);
  await user.click(getByRole("option", { name: "Apple" }));
  // Typed over the selection, never emptied (emptying would clear the selection).
  await user.type(input, "zz", { initialSelectionStart: 0, initialSelectionEnd: input.value.length });
  expect(getByRole("listbox")).toBeTruthy();
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(input.value).toBe("Apple");
  expect(getByTestId("typed").textContent).toBe("Apple");
  expect(document.activeElement).toBe(input);

  await user.click(input);
  expect(getByRole("listbox")).toBeTruthy();
  await user.tab();
  await expect.poll(() => queryByRole("listbox")).toBeNull();
});

test("ArrowDown on the closed input opens on the selected option", async () => {
  const { getByRole, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  await user.click(getByRole("option", { name: "Cherry" }));
  await user.keyboard("{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Cherry" }).id);
});

test("the trigger toggles the list and keeps focus in the input; Clear empties it", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  expect(queryByRole("button", { name: "Clear" })).toBeNull();
  const trigger = getByRole("button", { name: "Show fruits" });
  expect(trigger.getAttribute("tabindex")).toBe("-1");
  await user.click(trigger);
  expect(getByRole("listbox")).toBeTruthy();
  expect(document.activeElement).toBe(input);
  await user.click(trigger);
  await expect.poll(() => queryByRole("listbox")).toBeNull();

  await user.click(trigger);
  await user.click(getByRole("option", { name: "Banana" }));
  await user.click(getByRole("button", { name: "Clear" }));
  expect(input.value).toBe("");
  expect(getByTestId("changes").textContent).toBe("banana;null;");
  expect(formValue(getByTestId("form"), "fruit")).toEqual([""]);
  expect(document.activeElement).toBe(input);
  expect(queryByRole("button", { name: "Clear" })).toBeNull();
});

test("controlled value, input value and open state, with a custom filter and autoHighlight", async () => {
  const { getByRole, queryByRole, getAllByRole, getByTestId, user } = mount(controlled);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  expect(input.value).toBe("Pear");
  await user.click(getByRole("button", { name: "Pick plum" }));
  expect(input.value).toBe("Plum");

  await user.click(input);
  expect(getByTestId("open").textContent).toBe("open");
  await user.clear(input);
  await user.type(input, "p");
  expect(getByTestId("text").textContent).toBe("p");
  // startsWith, not contains: "Apple" is out.
  expect(getAllByRole("option").map((option) => option.textContent)).toEqual(["Pear", "Pineapple", "Plum"]);
  // autoHighlight: the first match is highlighted.
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Pear" }).id);
  await user.type(input, "i");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Pineapple" }).id);
  await user.keyboard("{Enter}");
  expect(getByTestId("value").textContent).toBe("pineapple");
  expect(getByTestId("text").textContent).toBe("Pineapple");
  expect(getByTestId("open").textContent).toBe("closed");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
});

test("disabled and read-only", async () => {
  const { getByRole, queryByRole, user } = mount(controlled);
  const disabled = getByRole("combobox", { name: "Disabled" }) as HTMLInputElement;
  expect(disabled.disabled).toBe(true);
  expect(disabled.hasAttribute("data-disabled")).toBe(true);

  const readOnly = getByRole("combobox", { name: "Read only" }) as HTMLInputElement;
  expect(readOnly.value).toBe("Y");
  expect(readOnly.readOnly).toBe(true);
  await user.click(readOnly);
  await user.keyboard("{ArrowDown}");
  expect(queryByRole("listbox")).toBeNull();
});

test("multiple: options toggle, the input clears, chips remove, Backspace removes the last", async () => {
  const { getByRole, getAllByTestId, getByTestId, user } = mount(multiple);
  const form = getByTestId("form");
  const input = getByRole("combobox", { name: "Languages" }) as HTMLInputElement;
  expect(getAllByTestId("chip").map((chip) => chip.firstChild?.textContent)).toEqual(["rx"]);
  expect(formValue(form, "langs")).toEqual(["rx"]);

  await user.type(input, "ty");
  const listbox = getByRole("listbox");
  expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("picked").textContent).toBe("rx,ts");
  expect(input.value).toBe("");
  expect(getByRole("listbox")).toBe(listbox);
  expect(getByRole("option", { name: "TypeScript" }).getAttribute("aria-selected")).toBe("true");
  expect(formValue(form, "langs")).toEqual(["rx", "ts"]);

  await user.click(getByRole("option", { name: "ReactiveScript" }));
  expect(getByTestId("picked").textContent).toBe("ts");
  expect(document.activeElement).toBe(input);

  await user.click(getByRole("option", { name: "Rust" }));
  await user.click(getByRole("button", { name: "Remove ts" }));
  expect(getByTestId("picked").textContent).toBe("rs");
  await user.keyboard("{Backspace}");
  expect(getByTestId("picked").textContent).toBe("");
  expect(formValue(form, "langs")).toEqual([]);
});

test("inside a field: labelled, described, named and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(field);
  const input = getByRole("combobox", { name: "City" });
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("city-description").id);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("city-error").textContent).toBe("Choose a city");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(input);

  await user.type(input, "ber");
  await user.keyboard("{ArrowDown}{Enter}");
  // Enter chose the option; it didn't submit the form.
  expect(getByTestId("submitted").textContent).toBe("");
  expect(queryByTestId("city-error")).toBeNull();
  expect(formValue(getByTestId("form"), "city")).toEqual(["ber"]);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("city=ber");
});

test("inside a disabled field: disabled", () => {
  const { getByRole } = mount(field);
  expect((getByRole("combobox", { name: "Locked" }) as HTMLInputElement).disabled).toBe(true);
});

test("emptying the input clears the selection", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  await user.click(input);
  await user.click(getByRole("option", { name: "Apple" }));
  await user.clear(input);
  expect(getByTestId("changes").textContent).toBe("apple;null;");
  await user.keyboard("{Escape}");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(input.value).toBe("");
  expect(formValue(getByTestId("form"), "fruit")).toEqual([""]);
});
