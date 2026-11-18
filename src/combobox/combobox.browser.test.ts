import { expect, test } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import controlled from "./fixtures/controlled.rx";
import field from "./fixtures/field.rx";
import multiple from "./fixtures/multiple.rx";
import nested from "./fixtures/nested.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

function formValue(form: HTMLElement, name: string) {
  return new FormData(form as HTMLFormElement).getAll(name);
}

function optionNames(getAllByRole: (role: string) => HTMLElement[]) {
  return getAllByRole("option").map((option) => option.getAttribute("data-label") ?? option.textContent);
}

// Why the popup is `popover="manual"`: the browser's light dismiss closes an auto popover on a press on the input
// that opened it, in every engine. If this starts failing, the input may now be exempt and the popup could be
// `popover="auto"` (see the family's header comment).
test("the browser light-dismisses an auto popover on a press on its showPopover() source", async () => {
  const host = document.createElement("div");
  const input = document.createElement("input");
  const popup = document.createElement("div");
  popup.popover = "auto";
  popup.textContent = "List";
  host.append(input, popup);
  document.body.append(host);
  try {
    popup.showPopover({ source: input });
    await userEvent.click(input);
    expect(shown(popup)).toBe(false);
  } finally {
    host.remove();
  }
});

test("an input with role combobox controlling a listbox in a manual popover, closed", () => {
  const { getByRole, getByTestId } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  const popup = getByTestId("popup");
  expect(input.tagName).toBe("INPUT");
  expect(input.getAttribute("aria-autocomplete")).toBe("list");
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(input.getAttribute("aria-controls")).toBe(getByRole("listbox", { hidden: true }).id);
  expect(input.hasAttribute("aria-activedescendant")).toBe(false);
  expect(popup.getAttribute("popover")).toBe("manual");
  expect(shown(popup)).toBe(false);
  expect(getByTestId("value").textContent).toBe("none");
});

test("typing opens the list and filters it, case- and accent-insensitively", async () => {
  const { getByRole, getAllByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.type(input, "b");
  const popup = getByTestId("popup");
  expect(shown(popup)).toBe(true);
  expect(input.getAttribute("aria-expanded")).toBe("true");
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
  expect(popup.querySelectorAll("[role=option]").length).toBe(0);
  expect(getByTestId("empty").textContent).toBe("No fruit found");
  expect(popup.hasAttribute("data-empty")).toBe(true);
});

test("the browser places it below the input, start edges aligned, at least as wide as the input", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  await frame();
  const anchor = input.getBoundingClientRect();
  const placed = getByTestId("popup").getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(4);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
  expect(Math.round(placed.width)).toBeGreaterThanOrEqual(Math.round(anchor.width));
});

test("with chips, it is anchored to the chips container", async () => {
  const { getByRole, getByTestId, user } = mount(multiple);
  await user.click(getByRole("combobox", { name: "Languages" }));
  await frame();
  const anchor = getByTestId("chips").getBoundingClientRect();
  const placed = getByTestId("popup").getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(0);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
  expect(Math.round(placed.width)).toBeGreaterThanOrEqual(Math.round(anchor.width));
});

test("the browser flips it above the input when it can't fit below", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const input = getByRole("combobox", { name: "Low" });
  await user.click(input);
  await frame();
  const placed = getByTestId("low-popup").getBoundingClientRect();
  expect(placed.bottom).toBeLessThanOrEqual(input.getBoundingClientRect().top + 1);
  expect(placed.top).toBeGreaterThanOrEqual(0);
});

test("pressing and typing in the open input keeps it open; a press outside closes it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  const popup = getByTestId("popup");
  await user.click(input);
  expect(shown(popup)).toBe(true);
  await user.click(input);
  await user.type(input, "a");
  expect(shown(popup)).toBe(true);
  // A point of the page the popup doesn't cover.
  await user.click(document.body, { position: { x: 5, y: 5 } });
  expect(shown(popup)).toBe(false);
  expect(getByTestId("opens").textContent).toBe("open;close;");

  // On a button too, which Safari doesn't focus.
  await user.click(input);
  expect(shown(popup)).toBe(true);
  await user.click(getByRole("button", { name: "Elsewhere" }));
  expect(shown(popup)).toBe(false);
  expect(getByTestId("opens").textContent).toBe("open;close;open;close;");
});

test("arrow keys move the active descendant while focus stays in the input", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  expect(shown(getByTestId("popup"))).toBe(true);
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

test("the highlighted option is scrolled into view, also when the list opens on it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  const popup = getByTestId("popup");
  input.focus();
  // ArrowUp on the closed input opens on the last option, at the bottom of a list that scrolls.
  await user.keyboard("{ArrowUp}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Cherry" }).id);
  await expect.poll(() => popup.scrollTop).toBeGreaterThan(0);
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Apple" }).id);
  await expect
    .poll(() => getByRole("option", { name: "Apple" }).getBoundingClientRect().top)
    .toBeGreaterThanOrEqual(popup.getBoundingClientRect().top - 1);
});

test("Enter chooses the highlighted option: the input shows its label, the list closes", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  await user.type(input, "ban");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(input.value).toBe("Banana");
  expect(getByTestId("changes").textContent).toBe("banana;");
  expect(getByTestId("typed").textContent).toBe("Banana");
  expect(getByTestId("value").textContent).toBe("Banana");
  await expect.poll(() => shown(getByTestId("popup"))).toBe(false);
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
  expect(shown(getByTestId("popup"))).toBe(false);

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
  // Playwright won't press an aria-disabled element unless forced.
  await user.click(blueberry, { force: true });
  expect(getByTestId("changes").textContent).toBe("");
  expect(shown(getByTestId("popup"))).toBe(true);
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
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  const popup = getByTestId("popup");
  await user.click(input);
  await user.click(getByRole("option", { name: "Apple" }));
  // Typed over the selection, never emptied (emptying would clear the selection).
  input.select();
  await user.keyboard("zz");
  expect(input.value).toBe("zz");
  expect(shown(popup)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  expect(input.value).toBe("Apple");
  expect(getByTestId("typed").textContent).toBe("Apple");
  expect(document.activeElement).toBe(input);

  await user.click(input);
  expect(shown(popup)).toBe(true);
  await user.tab();
  expect(shown(popup)).toBe(false);
  expect(document.activeElement).not.toBe(input);
});

test("ArrowDown on the closed input opens on the selected option", async () => {
  const { getByRole, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" });
  await user.click(input);
  await user.click(getByRole("option", { name: "Cherry" }));
  await user.keyboard("{ArrowDown}");
  expect(input.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "Cherry" }).id);
});

function pressChevron(trigger: HTMLElement, pointerType: string, button = 0) {
  trigger.dispatchEvent(
    new PointerEvent("pointerdown", { bubbles: true, pointerType, pointerId: 4, isPrimary: true, button }),
  );
}

test.each(["touch", "pen"])("the chevron waits for a completed %s tap", async (pointerType) => {
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Show fruits" });
  const popup = getByTestId("popup");
  pressChevron(trigger, pointerType);
  await frame();
  expect(shown(popup)).toBe(false);
  trigger.dispatchEvent(new PointerEvent("pointercancel", { bubbles: true, pointerType, pointerId: 4 }));
  await frame();
  expect(shown(popup)).toBe(false);
  pressChevron(trigger, pointerType);
  trigger.dispatchEvent(new MouseEvent("click", { detail: 1, bubbles: true }));
  await frame();
  expect(shown(popup)).toBe(true);
});

test("a cancelled primary mouse press can be followed by virtual activation", async () => {
  const { getByRole, getByTestId } = mount(basic);
  const trigger = getByRole("button", { name: "Show fruits" });
  const popup = getByTestId("popup");
  pressChevron(trigger, "mouse", 2);
  await frame();
  expect(shown(popup)).toBe(false);
  pressChevron(trigger, "mouse");
  await frame();
  expect(shown(popup)).toBe(true);
  trigger.dispatchEvent(
    new PointerEvent("pointercancel", { bubbles: true, pointerType: "mouse", pointerId: 4 }),
  );
  await frame();
  expect(shown(popup)).toBe(false);
  trigger.click();
  await frame();
  expect(shown(popup)).toBe(true);
  expect(getByTestId("changes").textContent).toBe("");
});

test("the trigger toggles the list and keeps focus in the input; Clear empties it", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  const popup = getByTestId("popup");
  expect(queryByRole("button", { name: "Clear" })).toBeNull();
  const trigger = getByRole("button", { name: "Show fruits" });
  expect(trigger.getAttribute("tabindex")).toBe("-1");
  expect(trigger.hasAttribute("popovertarget")).toBe(false);
  await user.click(trigger);
  expect(shown(popup)).toBe(true);
  expect(document.activeElement).toBe(input);
  await frame();
  // Anchored to the input, not to the trigger.
  expect(Math.round(popup.getBoundingClientRect().left)).toBe(Math.round(input.getBoundingClientRect().left));
  await user.click(trigger);
  expect(shown(popup)).toBe(false);

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
  const { getByRole, getAllByRole, getByTestId, user } = mount(controlled);
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
  await expect.poll(() => shown(getByTestId("popup"))).toBe(false);
});

test("opened from outside its parts, with focus elsewhere, a press outside still closes it", async () => {
  const { getByRole, getByTestId, user } = mount(controlled);
  const popup = getByTestId("popup");
  await user.click(getByRole("button", { name: "Open from outside" }));
  await expect.poll(() => shown(popup)).toBe(true);
  expect(document.activeElement).not.toBe(getByRole("combobox", { name: "Fruit" }));
  await user.click(getByTestId("text"));
  await expect.poll(() => getByTestId("open").textContent).toBe("closed");
  expect(shown(popup)).toBe(false);
});

test("disabled and read-only", async () => {
  const { getByRole, user } = mount(controlled);
  const disabled = getByRole("combobox", { name: "Disabled" }) as HTMLInputElement;
  expect(disabled.disabled).toBe(true);
  expect(disabled.hasAttribute("data-disabled")).toBe(true);

  const readOnly = getByRole("combobox", { name: "Read only" }) as HTMLInputElement;
  // The label is read from the option once it has rendered, after the mount's flush (createItemLabels).
  await expect.poll(() => readOnly.value).toBe("Y");
  expect(readOnly.readOnly).toBe(true);
  await user.click(readOnly);
  await user.keyboard("{ArrowDown}");
  const popup = document.getElementById(readOnly.getAttribute("aria-controls")!)!.parentElement!;
  expect(shown(popup)).toBe(false);
});

test("multiple: options toggle, the input clears, chips remove, Backspace removes the last", async () => {
  const { getByRole, getAllByTestId, getByTestId, user } = mount(multiple);
  const form = getByTestId("form");
  const input = getByRole("combobox", { name: "Languages" }) as HTMLInputElement;
  const popup = getByTestId("popup");
  expect(getAllByTestId("chip").map((chip) => chip.firstChild?.textContent)).toEqual(["rx"]);
  expect(formValue(form, "langs")).toEqual(["rx"]);

  await user.type(input, "ty");
  const listbox = getByRole("listbox");
  expect(listbox.getAttribute("aria-multiselectable")).toBe("true");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(getByTestId("picked").textContent).toBe("rx,ts");
  expect(input.value).toBe("");
  expect(shown(popup)).toBe(true);
  expect(getByRole("option", { name: "TypeScript" }).getAttribute("aria-selected")).toBe("true");
  expect(formValue(form, "langs")).toEqual(["rx", "ts"]);

  await user.click(getByRole("option", { name: "ReactiveScript" }));
  expect(getByTestId("picked").textContent).toBe("ts");
  expect(document.activeElement).toBe(input);

  await user.click(getByRole("option", { name: "Rust" }));
  // A chip's remove button is inside the anchor: pressing it doesn't close the list.
  await user.click(getByRole("button", { name: "Remove ts" }));
  expect(getByTestId("picked").textContent).toBe("rs");
  expect(shown(popup)).toBe(true);
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
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("combobox", { name: "Fruit" }) as HTMLInputElement;
  await user.click(input);
  await user.click(getByRole("option", { name: "Apple" }));
  await user.clear(input);
  expect(getByTestId("changes").textContent).toBe("apple;null;");
  await user.keyboard("{Escape}");
  expect(shown(getByTestId("popup"))).toBe(false);
  expect(input.value).toBe("");
  expect(formValue(getByTestId("form"), "fruit")).toEqual([""]);
});

test("defaultOpen: shown at mount, anchored to the input", async () => {
  const { getByRole, getByTestId } = mount(nested);
  const popup = getByTestId("start-popup");
  await expect.poll(() => shown(popup)).toBe(true);
  await frame();
  const anchor = getByRole("combobox", { name: "Starts open" }).getBoundingClientRect();
  const placed = popup.getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(0);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
});

test("inside a modal dialog: Escape closes the list, not the dialog; a press in the dialog closes the list", async () => {
  const { getByRole, getByTestId, user } = mount(nested);
  const dialog = getByTestId("dialog") as HTMLDialogElement;
  await user.click(getByRole("button", { name: "Open dialog" }));
  await expect.poll(() => dialog.open).toBe(true);
  const input = getByRole("combobox", { name: "City" });
  const popup = getByTestId("city-popup");
  await user.type(input, "a");
  expect(shown(popup)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  expect(dialog.open).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => dialog.open).toBe(false);
  expect(getByTestId("dialog-open").textContent).toBe("closed");

  await user.click(getByRole("button", { name: "Open dialog" }));
  await expect.poll(() => dialog.open).toBe(true);
  await user.type(input, "b");
  expect(shown(popup)).toBe(true);
  await user.click(getByRole("heading", { name: "Settings" }));
  expect(shown(popup)).toBe(false);
  expect(dialog.open).toBe(true);
});
