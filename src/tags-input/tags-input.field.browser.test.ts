// TagsInput inside a FieldRoot and a Form (fixtures/field.rx): labelled and described by the field, `required`
// meaning at least one tag, the tags submitted as the field's value, and a form reset.
import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import field from "./fixtures/field.rx";

function setup() {
  const mounted = mount(field);
  const input = mounted.getByLabelText<HTMLInputElement>("Topics");
  const tags = () =>
    [...mounted.getByTestId("root").querySelectorAll("[data-testid=tag] span")].map((tag) => tag.textContent);
  return { ...mounted, input, tags };
}

test("labelled and described by the field", () => {
  const { input, getByTestId } = setup();
  expect(input.type).toBe("text");
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("description").id);
  expect(input.getAttribute("aria-required")).toBe("true");
});

test("required: a submit with no tag is refused; one tag makes it valid, and the tags are submitted", async () => {
  const { input, tags, getByRole, getByTestId, queryByTestId, user } = setup();
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("error").textContent).toBe("Add a topic");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(getByTestId("field").hasAttribute("data-invalid")).toBe(true);
  expect(document.activeElement).toBe(input);

  await user.keyboard("news{Enter}");
  // Enter added the tag; it didn't submit the form.
  expect(tags()).toEqual(["news"]);
  expect(getByTestId("submitted").textContent).toBe("");
  expect(queryByTestId("error")).toBeNull();
  expect(input.required).toBe(false);
  await user.keyboard("sport{Enter}");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe('topics=["news","sport"]');
});

// The input is natively required only while there is no tag, so text typed but not yet added fills it.
test("required: text typed but not added counts as filled, and nothing is submitted for it", async () => {
  const { input, getByRole, getByTestId, user } = setup();
  await user.click(input);
  await user.keyboard("news");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("topics=[]");
});

test("removing the last tag makes the field required again", async () => {
  const { input, getByTestId, user } = setup();
  await user.click(input);
  await user.keyboard("news{Enter}{Backspace}{Backspace}");
  expect(input.required).toBe(true);
  await user.click(document.body.querySelector<HTMLButtonElement>("button[type=submit]")!);
  expect(getByTestId("error").textContent).toBe("Add a topic");
});

test("a form reset empties the tags and the field's state", async () => {
  const { input, tags, getByRole, getByTestId, user } = setup();
  await user.click(input);
  await user.keyboard("news{Enter}");
  expect(getByTestId("field").hasAttribute("data-dirty")).toBe(true);
  await user.click(getByRole("button", { name: "Reset" }));
  await expect.poll(() => tags()).toEqual([]);
  expect(getByTestId("field").hasAttribute("data-dirty")).toBe(false);
});

test("inside a disabled field: disabled", () => {
  const { getByLabelText } = mount(field);
  const locked = getByLabelText<HTMLInputElement>("Locked");
  expect(locked.disabled).toBe(true);
  const remove = locked.closest("div")!.querySelector("button")!;
  expect(remove.disabled).toBe(true);
});
