import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";
import fieldFixture from "./fixtures/field.rx";

function input(getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) {
  return getByRole("combobox", { name }) as HTMLInputElement;
}

function visibleOptions(listbox: HTMLElement) {
  return [...listbox.querySelectorAll("[role=option]")].map((option) => option.textContent);
}

test("each mode is announced with aria-autocomplete; nothing is open at first", () => {
  const { getByRole, queryByRole } = mount(basic);
  for (const [name, mode] of [
    ["List", "list"],
    ["Both", "both"],
    ["Inline", "inline"],
    ["None", "none"],
  ]) {
    const field = input(getByRole, name);
    expect(field.getAttribute("aria-autocomplete")).toBe(mode);
    expect(field.getAttribute("aria-expanded")).toBe("false");
  }
  expect(queryByRole("listbox")).toBeNull();
});

test("list: typing is the value, filters the suggestions, and choosing one fills the input", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  // A click alone doesn't open an autocomplete.
  await user.click(field);
  expect(queryByRole("listbox")).toBeNull();

  await user.type(field, "f");
  expect(getByTestId("list-text").textContent).toBe("f");
  expect(getByTestId("list-value").textContent).toBe("f");
  const listbox = getByRole("listbox");
  expect(visibleOptions(listbox)).toEqual(["feature", "fix", "refactor"]);
  // Suggestions aren't selected options.
  expect(getByRole("option", { name: "fix" }).hasAttribute("aria-selected")).toBe(false);

  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(field.getAttribute("aria-activedescendant")).toBe(getByRole("option", { name: "fix" }).id);
  // Without inline completion the input keeps what was typed while navigating.
  expect(field.value).toBe("f");
  await user.keyboard("{Enter}");
  expect(field.value).toBe("fix");
  expect(getByTestId("list-text").textContent).toBe("fix");
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(document.activeElement).toBe(field);
});

test("list: text that matches nothing shows the empty state; any text can be the value", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  await user.type(field, "chore");
  expect(getByTestId("list-empty").textContent).toBe("No suggestions");
  await user.keyboard("{Enter}");
  expect(getByTestId("list-text").textContent).toBe("chore");
});

test("inline: the highlighted suggestion is shown in the input; the list isn't filtered", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "Inline");
  await user.type(field, "d");
  expect(visibleOptions(getByRole("listbox"))).toEqual(["feature", "fix", "docs", "refactor"]);
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
  await expect.poll(() => queryByRole("listbox")).toBeNull();
  expect(field.value).toBe("d");

  await user.keyboard("{ArrowDown}");
  expect(field.value).toBe("feature");
  await user.type(field, "s");
  // Typing goes on from the shown suggestion, which becomes what was typed.
  expect(getByTestId("inline-text").textContent).toBe("features");
});

test("both: filters, and shows the highlighted suggestion; Enter chooses it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "Both");
  await user.type(field, "fe");
  expect(visibleOptions(getByRole("listbox"))).toEqual(["feature"]);
  await user.keyboard("{ArrowDown}");
  expect(field.value).toBe("feature");
  await user.keyboard("{Enter}");
  expect(getByTestId("both-text").textContent).toBe("feature");
});

test("none: neither filters nor shows the highlighted suggestion", async () => {
  const { getByRole, user } = mount(basic);
  const field = input(getByRole, "None");
  await user.type(field, "zz");
  expect(visibleOptions(getByRole("listbox"))).toEqual(["feature", "fix", "docs", "refactor"]);
  await user.keyboard("{ArrowDown}");
  expect(field.value).toBe("zz");
  await user.click(getByRole("option", { name: "docs" }));
  expect(field.value).toBe("docs");
});

test("the trigger opens the suggestions; Clear empties the input", async () => {
  const { getByRole, queryByRole, getByTestId, user } = mount(basic);
  const field = input(getByRole, "List");
  await user.click(getByRole("button", { name: "List suggestions" }));
  expect(getByRole("listbox")).toBeTruthy();
  expect(document.activeElement).toBe(field);
  await user.click(getByRole("option", { name: "docs" }));
  await user.click(getByRole("button", { name: "Clear List" }));
  expect(field.value).toBe("");
  expect(getByTestId("list-text").textContent).toBe("");
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
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("tag=gamma");
});
