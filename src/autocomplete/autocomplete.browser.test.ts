import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import fieldFixture from "./fixtures/field.rx";

const shown = (popup: HTMLElement) => popup.matches(":popover-open");

function input(getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) {
  return getByRole("combobox", { name }) as HTMLInputElement;
}

function visibleOptions(popup: HTMLElement) {
  return [...popup.querySelectorAll("[role=option]")].map((option) => option.textContent);
}

test("each mode is announced with aria-autocomplete; every popup is a closed manual popover", () => {
  const { getByRole, getByTestId } = mount(basic);
  for (const [name, mode] of [
    ["List", "list"],
    ["Both", "both"],
    ["Inline", "inline"],
    ["None", "none"],
  ]) {
    const field = input(getByRole, name);
    expect(field.getAttribute("aria-autocomplete")).toBe(mode);
    expect(field.getAttribute("aria-expanded")).toBe("false");
    const popup = getByTestId(`${mode}-popup`);
    expect(popup.getAttribute("popover")).toBe("manual");
    expect(shown(popup)).toBe(false);
  }
});

test("list: typing is the value, filters the suggestions, and choosing one fills the input", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  const popup = getByTestId("list-popup");
  // A click alone doesn't open an autocomplete.
  await user.click(field);
  expect(shown(popup)).toBe(false);

  await user.type(field, "f");
  expect(getByTestId("list-text").textContent).toBe("f");
  expect(getByTestId("list-value").textContent).toBe("f");
  expect(shown(popup)).toBe(true);
  expect(visibleOptions(popup)).toEqual(["feature", "fix", "refactor"]);
  // Suggestions aren't selected options.
  expect(getByRole("option", { name: "fix" }).hasAttribute("aria-selected")).toBe(false);

  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(field.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "fix" }).id);
  // Without inline completion the input keeps what was typed while navigating.
  expect(field.value).toBe("f");
  await user.keyboard("{Enter}");
  expect(field.value).toBe("fix");
  expect(getByTestId("list-text").textContent).toBe("fix");
  expect(shown(popup)).toBe(false);
  expect(document.activeElement).toBe(field);
});

test("the browser places it against the input: below, start edges aligned, as wide as the input", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  await user.type(field, "f");
  await frame();
  const anchor = field.getBoundingClientRect();
  const placed = getByTestId("list-popup").getBoundingClientRect();
  expect(Math.round(placed.top - anchor.bottom)).toBe(2);
  expect(Math.round(placed.left - anchor.left)).toBe(0);
  expect(Math.round(placed.width)).toBeGreaterThanOrEqual(Math.round(anchor.width));
});

test("a press in the input keeps it open; a press outside and Escape close it, keeping the text", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  const popup = getByTestId("list-popup");
  await user.type(field, "d");
  expect(shown(popup)).toBe(true);
  await user.click(field);
  expect(shown(popup)).toBe(true);
  await user.click(document.body, { position: { x: 5, y: 5 } });
  expect(shown(popup)).toBe(false);
  expect(field.value).toBe("d");

  await user.type(field, "o");
  expect(shown(popup)).toBe(true);
  await user.keyboard("{Escape}");
  expect(shown(popup)).toBe(false);
  expect(field.value).toBe("do");
  expect(getByTestId("list-opens").textContent).toBe("open;close;open;close;");
});

test("list: text that matches nothing shows the empty state; any text can be the value", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  await user.type(field, "chore");
  expect(getByTestId("list-empty").textContent).toBe("No suggestions");
  expect(getByTestId("list-popup").hasAttribute("data-empty")).toBe(true);
  await user.keyboard("{Enter}");
  expect(getByTestId("list-text").textContent).toBe("chore");
  expect(shown(getByTestId("list-popup"))).toBe(false);
});

test("inline: the highlighted suggestion is shown in the input; the list isn't filtered", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "Inline");
  const popup = getByTestId("inline-popup");
  await user.type(field, "d");
  expect(visibleOptions(popup)).toEqual(["feature", "fix", "docs", "refactor"]);
  await user.keyboard("{ArrowDown}");
  expect(field.value).toBe("feature");
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(field.value).toBe("docs");
  // Only shown: the value is still what was typed until a suggestion is chosen.
  expect(getByTestId("inline-text").textContent).toBe("d");
  await user.keyboard("{ArrowDown}");
  // Past the end (refactor is disabled): back to what was typed.
  expect(field.value).toBe("d");
  await user.keyboard("{ArrowUp}{Escape}");
  expect(shown(popup)).toBe(false);
  expect(field.value).toBe("d");

  await user.keyboard("{ArrowDown}");
  expect(shown(popup)).toBe(true);
  expect(field.value).toBe("feature");
  await user.keyboard("s");
  // Typing goes on from the shown suggestion, which becomes what was typed.
  expect(getByTestId("inline-text").textContent).toBe("features");
});

test("both: filters, and shows the highlighted suggestion; Enter chooses it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "Both");
  await user.type(field, "fe");
  expect(visibleOptions(getByTestId("both-popup"))).toEqual(["feature"]);
  await user.keyboard("{ArrowDown}");
  expect(field.value).toBe("feature");
  await user.keyboard("{Enter}");
  expect(getByTestId("both-text").textContent).toBe("feature");
});

test("none: neither filters nor shows the highlighted suggestion", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "None");
  await user.type(field, "zz");
  expect(visibleOptions(getByTestId("none-popup"))).toEqual(["feature", "fix", "docs", "refactor"]);
  await user.keyboard("{ArrowDown}");
  expect(field.value).toBe("zz");
  await user.click(getByRole("option", { name: "docs" }));
  expect(field.value).toBe("docs");
  expect(document.activeElement).toBe(field);
});

test("the trigger opens the suggestions; Clear empties the input", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  await user.click(getByRole("button", { name: "List suggestions" }));
  expect(shown(getByTestId("list-popup"))).toBe(true);
  expect(document.activeElement).toBe(field);
  await user.click(getByRole("option", { name: "docs" }));
  await user.click(getByRole("button", { name: "Clear List" }));
  expect(field.value).toBe("");
  expect(getByTestId("list-text").textContent).toBe("");
  expect(document.activeElement).toBe(field);
  expect(queryByRole("button", { name: "Clear List" })).toBeNull();
});

test("the input submits its text with the form", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("status")).toBe("draft");
  const field = input(getByRole, "List");
  await user.type(field, "do");
  await user.keyboard("{ArrowDown}{Enter}");
  expect(new FormData(form).get("list")).toBe("docs");
});

test("inside a field: required and validated on the input's text", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(fieldFixture);
  const tag = input(getByRole, "Tag");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("tag-error").textContent).toBe("Enter a tag");
  expect(tag.getAttribute("aria-invalid")).toBe("true");
  await user.type(tag, "al");
  await user.keyboard("{ArrowDown}{Enter}");
  // Enter chose the suggestion; it didn't submit the form.
  expect(getByTestId("submitted").textContent).toBe("");
  expect(tag.value).toBe("alpha");
  await user.clear(tag);
  await user.type(tag, "gamma");
  expect(queryByTestId("tag-error")).toBeNull();
  await user.keyboard("{Escape}");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("tag=gamma");
});
