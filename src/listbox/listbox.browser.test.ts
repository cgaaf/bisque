import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import field from "./fixtures/field.rx";
import multiple from "./fixtures/multiple.rx";
import reset from "./fixtures/reset.rx";

function formValue(form: HTMLElement, name: string) {
  return new FormData(form as HTMLFormElement).getAll(name);
}

const selectedNames = (listbox: HTMLElement) =>
  [...listbox.querySelectorAll("[role=option][aria-selected=true]")].map((option) =>
    option.textContent?.replace("✓", "").trim(),
  );

const tabStops = (listbox: HTMLElement) =>
  [...listbox.querySelectorAll("[role=option][tabindex='0']")].map((option) =>
    option.textContent?.replace("✓", "").trim(),
  );

test("a listbox of options, none selected, the first enabled option its one Tab stop", async () => {
  const { getByRole, getByTestId } = mount(basic);
  const listbox = getByRole("listbox", { name: "Fruit" });
  expect(listbox.getAttribute("aria-orientation")).toBe("vertical");
  expect(listbox.hasAttribute("aria-multiselectable")).toBe(false);
  const options = getByRole("option", { name: "Apple" });
  expect(options.getAttribute("aria-selected")).toBe("false");
  expect(getByRole("option", { name: "Apricot" }).getAttribute("aria-disabled")).toBe("true");
  await expect.poll(() => tabStops(listbox)).toEqual(["Apple"]);
  // The indicator shows only for the selected option.
  expect(listbox.querySelectorAll("[aria-hidden=true]").length).toBe(0);
  expect(formValue(getByTestId("form"), "fruit")).toEqual([""]);
});

test("groups are labelled by their label", () => {
  const { getByRole } = mount(basic);
  const group = getByRole("group", { name: "Fruits" });
  expect(group.querySelectorAll("[role=option]").length).toBe(4);
});

test("Tab enters on the Tab stop, and leaves the list in one step", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("textbox", { name: "Before" }).focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Apple" }));
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(getByRole("textbox", { name: "After" }));
});

test("a click selects an option, focuses it, and submits it with the form", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const listbox = getByRole("listbox", { name: "Fruit" });
  const banana = getByRole("option", { name: "Banana" });
  await user.click(banana);
  expect(banana.getAttribute("aria-selected")).toBe("true");
  expect(banana.hasAttribute("data-selected")).toBe(true);
  expect(document.activeElement).toBe(banana);
  expect(getByTestId("changes").textContent).toBe("banana;");
  expect(formValue(getByTestId("form"), "fruit")).toEqual(["banana"]);
  expect(banana.querySelector("[aria-hidden=true]")?.textContent).toBe("✓");
  // Single selection: another click replaces it; the same one again keeps it.
  await user.click(getByRole("option", { name: "Option FR" }));
  expect(selectedNames(listbox)).toEqual(["Option FR"]);
  await user.click(getByRole("option", { name: "Option FR" }));
  expect(getByTestId("changes").textContent).toBe("banana;fr;");
  expect(tabStops(listbox)).toEqual(["Option FR"]);
});

test("a disabled option can't be selected or focused by a press", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const apricot = getByRole("option", { name: "Apricot" });
  await user.click(apricot, { force: true });
  expect(apricot.getAttribute("aria-selected")).toBe("false");
  expect(document.activeElement).not.toBe(apricot);
  expect(getByTestId("changes").textContent).toBe("");
});

test("the arrow keys, Home and End move focus without selecting, skipping disabled options and not wrapping", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  getByRole("option", { name: "Apple" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Avocado" }));
  await user.keyboard("{End}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Option FR" }));
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Option FR" }));
  await user.keyboard("{Home}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Apple" }));
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Apple" }));
  expect(getByTestId("changes").textContent).toBe("");
});

test("Space and Enter select the focused option", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const listbox = getByRole("listbox", { name: "Fruit" });
  getByRole("option", { name: "Apple" }).focus();
  await user.keyboard("{ArrowDown}{ }");
  expect(selectedNames(listbox)).toEqual(["Avocado"]);
  await user.keyboard("{ArrowDown}{Enter}");
  expect(selectedNames(listbox)).toEqual(["Banana"]);
  expect(getByTestId("changes").textContent).toBe("avocado;banana;");
});

test("typeahead focuses the next match by label, skipping disabled options", async () => {
  const { getByRole, user } = mount(basic);
  getByRole("option", { name: "Apple" }).focus();
  await user.keyboard("a");
  expect(document.activeElement).toBe(getByRole("option", { name: "Avocado" }));
  await user.keyboard("a");
  expect(document.activeElement).toBe(getByRole("option", { name: "Apple" }));
  await new Promise((resolve) => setTimeout(resolve, 600));
  // The label, not the text, of an option given one.
  await user.keyboard("fr");
  expect(document.activeElement).toBe(getByRole("option", { name: "Option FR" }));
  expect(getByRole("option", { name: "Option FR" }).getAttribute("aria-selected")).toBe("false");
});

test("after a selection the Tab stop is the selected option", async () => {
  const { getByRole, user } = mount(basic);
  await user.click(getByRole("option", { name: "Avocado" }));
  await user.keyboard("{ArrowDown}");
  getByRole("textbox", { name: "Before" }).focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Avocado" }));
});

test("multiple: a click toggles, Space toggles, every value is submitted", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const listbox = getByRole("listbox", { name: "Toppings" });
  const form = getByTestId("form");
  expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
  expect(formValue(form, "toppings")).toEqual(["cheese"]);
  await user.click(getByRole("option", { name: "Ham" }));
  expect(selectedNames(listbox)).toEqual(["Cheese", "Ham"]);
  await user.click(getByRole("option", { name: "Cheese" }));
  expect(selectedNames(listbox)).toEqual(["Ham"]);
  await user.keyboard("{ArrowDown}{ArrowDown}{ }");
  expect(selectedNames(listbox)).toEqual(["Ham", "Onion"]);
  await user.keyboard("{Enter}");
  expect(selectedNames(listbox)).toEqual(["Ham"]);
  expect(getByTestId("changes").textContent).toBe("cheese,ham;ham;ham,onion;ham;");
  expect(formValue(form, "toppings")).toEqual(["ham"]);
});

test("multiple: plain arrow keys move focus without selecting; Shift+Arrow moves and toggles", async () => {
  const { getByRole, user } = mount(multiple);
  const listbox = getByRole("listbox", { name: "Toppings" });
  getByRole("option", { name: "Cheese" }).focus();
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Onion" }));
  expect(selectedNames(listbox)).toEqual(["Cheese"]);
  await user.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
  expect(selectedNames(listbox)).toEqual(["Cheese", "Pepper", "Tomato"]);
  // At the end, focus doesn't move, so nothing toggles.
  await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
  expect(selectedNames(listbox)).toEqual(["Cheese", "Pepper", "Tomato"]);
  await user.keyboard("{Shift>}{ArrowUp}{/Shift}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Pepper" }));
  expect(selectedNames(listbox)).toEqual(["Cheese", "Tomato"]);
});

test("multiple: Shift+click and Shift+Space select from the anchor, skipping disabled options", async () => {
  const { getByRole, user } = mount(multiple);
  const listbox = getByRole("listbox", { name: "Toppings" });
  await user.click(getByRole("option", { name: "Ham" }));
  await user.click(getByRole("option", { name: "Pepper" }), { modifiers: ["Shift"] });
  expect(selectedNames(listbox)).toEqual(["Cheese", "Ham", "Onion", "Pepper"]);
  expect(document.activeElement).toBe(getByRole("option", { name: "Pepper" }));
  // Shift+Space from the same anchor (Ham, the option last toggled).
  await user.keyboard("{ArrowDown}");
  await user.keyboard("{Shift>}{ }{/Shift}");
  expect(selectedNames(listbox)).toEqual(["Cheese", "Ham", "Onion", "Pepper", "Tomato"]);
});

test("multiple: Ctrl+Shift+Home and End select to the first or last option and move there", async () => {
  const { getByRole, user } = mount(multiple);
  const listbox = getByRole("listbox", { name: "Toppings" });
  await user.click(getByRole("option", { name: "Cheese" }));
  expect(selectedNames(listbox)).toEqual([]);
  getByRole("option", { name: "Onion" }).focus();
  await user.keyboard("{Control>}{Shift>}{End}{/Shift}{/Control}");
  expect(selectedNames(listbox)).toEqual(["Onion", "Pepper", "Tomato"]);
  expect(document.activeElement).toBe(getByRole("option", { name: "Tomato" }));
  getByRole("option", { name: "Ham" }).focus();
  await user.keyboard("{Control>}{Shift>}{Home}{/Shift}{/Control}");
  expect(selectedNames(listbox)).toEqual(["Cheese", "Ham", "Onion", "Pepper", "Tomato"]);
  expect(document.activeElement).toBe(getByRole("option", { name: "Cheese" }));
});

for (const modifier of ["Control", "Meta"]) {
  test(`multiple: ${modifier}+A selects every enabled option, and again clears them`, async () => {
    const { getByRole, getByTestId, user } = mount(multiple);
    const listbox = getByRole("listbox", { name: "Toppings" });
    getByRole("option", { name: "Cheese" }).focus();
    await user.keyboard(`{${modifier}>}a{/${modifier}}`);
    expect(selectedNames(listbox)).toEqual(["Cheese", "Ham", "Onion", "Pepper", "Tomato"]);
    // Not typeahead: focus stayed.
    expect(document.activeElement).toBe(getByRole("option", { name: "Cheese" }));
    await user.keyboard(`{${modifier}>}a{/${modifier}}`);
    expect(selectedNames(listbox)).toEqual([]);
    expect(getByTestId("changes").textContent).toBe("cheese,ham,onion,pepper,tomato;;");
  });
}

test("multiple: the Tab stop is the first selected option", async () => {
  const { getByRole, user } = mount(multiple);
  const listbox = getByRole("listbox", { name: "Toppings" });
  await expect.poll(() => tabStops(listbox)).toEqual(["Cheese"]);
  await user.click(getByRole("option", { name: "Pepper" }));
  await user.click(getByRole("option", { name: "Cheese" }));
  await expect.poll(() => tabStops(listbox)).toEqual(["Pepper"]);
});

test("a form reset restores the default selection", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  const listbox = getByRole("listbox", { name: "Toppings" });
  await user.click(getByRole("option", { name: "Ham" }));
  await user.click(getByRole("option", { name: "Cheese" }));
  expect(selectedNames(listbox)).toEqual(["Ham"]);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => selectedNames(listbox)).toEqual(["Cheese"]);
  expect(formValue(getByTestId("form"), "toppings")).toEqual(["cheese"]);
  expect(getByTestId("changes").textContent).toBe("cheese,ham;ham;cheese;");
});

test("a form reset keeps a single value that didn't change, and the controlled value", async () => {
  const { getByRole, getByTestId, user } = mount(reset);
  const form = getByTestId("form");
  await user.click(getByRole("button", { name: "Reset" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(formValue(form, "speed")).toEqual(["slow"]);
  expect(formValue(form, "size")).toEqual(["m"]);
  await user.click(getByRole("option", { name: "Fast" }));
  await user.click(getByRole("option", { name: "Small" }));
  expect(formValue(form, "speed")).toEqual(["fast"]);
  expect(formValue(form, "size")).toEqual(["s"]);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => formValue(form, "speed")).toEqual(["slow"]);
  expect(selectedNames(getByRole("listbox", { name: "Speed" }))).toEqual(["Slow"]);
  // Controlled: the owner's value stays, in the list and the form.
  expect(formValue(form, "size")).toEqual(["s"]);
  expect(selectedNames(getByRole("listbox", { name: "Size" }))).toEqual(["Small"]);
});

test("controlled: follows its value, which the owner can change and clear", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const listbox = getByRole("listbox", { name: "Size" });
  expect(selectedNames(listbox)).toEqual(["Medium"]);
  await user.click(getByRole("option", { name: "Small" }));
  expect(selectedNames(listbox)).toEqual(["Small"]);
  expect(getByTestId("size").textContent).toBe("s");
  await user.click(getByRole("button", { name: "Choose large" }));
  expect(selectedNames(listbox)).toEqual(["Large"]);
  await user.click(getByRole("button", { name: "Clear size" }));
  expect(selectedNames(listbox)).toEqual([]);
});

test("controlled multiple: follows its list", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const listbox = getByRole("listbox", { name: "Colors" });
  await user.click(getByRole("option", { name: "Blue" }));
  expect(selectedNames(listbox)).toEqual(["Red", "Blue"]);
  expect(getByTestId("colors").textContent).toBe("red,blue");
  await user.click(getByRole("button", { name: "Choose green and blue" }));
  expect(selectedNames(listbox)).toEqual(["Green", "Blue"]);
});

test("controlled: an owner that keeps its value keeps the selection, and is asked", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const listbox = getByRole("listbox", { name: "Fixed" });
  await user.click(getByRole("option", { name: "Two" }));
  expect(getByTestId("asked").textContent).toBe("two");
  expect(selectedNames(listbox)).toEqual(["One"]);
});

test("horizontal, looping, selection following focus: Left and Right move and select, Up and Down don't", async () => {
  const { getByRole, user } = mount(controlled);
  const listbox = getByRole("listbox", { name: "Days" });
  expect(listbox.getAttribute("aria-orientation")).toBe("horizontal");
  getByRole("option", { name: "Mon" }).focus();
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Tue" }));
  expect(selectedNames(listbox)).toEqual(["Tue"]);
  await user.keyboard("{ArrowRight}");
  expect(selectedNames(listbox)).toEqual(["Thu"]);
  await user.keyboard("{ArrowRight}");
  expect(selectedNames(listbox)).toEqual(["Mon"]);
  await user.keyboard("{ArrowLeft}");
  expect(selectedNames(listbox)).toEqual(["Thu"]);
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(getByRole("option", { name: "Thu" }));
  await user.keyboard("t");
  expect(selectedNames(listbox)).toEqual(["Tue"]);
});

test("disabled: no option can be focused from the keyboard or selected", async () => {
  const { getByRole, user } = mount(controlled);
  const listbox = getByRole("listbox", { name: "Locked" });
  expect(listbox.getAttribute("aria-disabled")).toBe("true");
  expect(tabStops(listbox)).toEqual([]);
  await user.click(getByRole("option", { name: "B" }), { force: true });
  expect(selectedNames(listbox)).toEqual(["A"]);
  getByRole("option", { name: "Thu" }).focus();
  await user.keyboard("{Tab}");
  expect(document.activeElement).toBe(getByRole("textbox", { name: "End" }));
});

test("inside a field: labelled, described, named and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(field);
  const listbox = getByRole("listbox", { name: "Size" });
  const root = getByTestId("size-root");
  expect(listbox.getAttribute("aria-describedby")).toBe(getByTestId("size-description").id);

  getByRole("option", { name: "Small" }).focus();
  await user.keyboard("{ArrowDown}");
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(root.hasAttribute("data-touched")).toBe(false);
  (document.activeElement as HTMLElement).blur();
  await expect.poll(() => root.hasAttribute("data-focused")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(true);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("size-error").textContent).toBe("Choose a size");
  expect(listbox.getAttribute("aria-invalid")).toBe("true");

  await user.click(getByRole("option", { name: "Large" }));
  expect(queryByTestId("size-error")).toBeNull();
  expect(root.hasAttribute("data-dirty")).toBe(true);
  expect(formValue(getByTestId("form"), "size")).toEqual(["l"]);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("size=l");
});

test("inside a disabled field: disabled", () => {
  const { getByRole } = mount(field);
  expect(getByRole("listbox", { name: "Locked" }).getAttribute("aria-disabled")).toBe("true");
});
