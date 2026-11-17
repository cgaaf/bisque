import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

const textbox = (getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) =>
  getByRole("textbox", { name }) as HTMLInputElement;

test("controlled: shows the value and reports each change", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Search");
  expect(input.tagName).toBe("INPUT");
  expect(input.value).toBe("initial");
  await user.clear(input);
  await user.type(input, "rx");
  expect(getByTestId("query").textContent).toBe("rx");
  expect(input.value).toBe("rx");
});

test("uncontrolled: starts at defaultValue and submits with its form", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Notes");
  expect(input.value).toBe("draft");
  await user.type(input, "!");
  const data = new FormData(getByTestId("form") as HTMLFormElement);
  expect(data.get("notes")).toBe("draft!");
  expect(data.get("q")).toBe("initial");
});

test("inside a field: labelled, described, named and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = textbox(getByRole, "City");
  expect(input.name).toBe("city");
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("city-description").id);
  await user.type(input, "a");
  expect(input.hasAttribute("data-dirty")).toBe(true);
  await user.clear(input);
  expect(getByTestId("city-error").textContent).toBe("Enter a city");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.hasAttribute("data-invalid")).toBe(true);
  // The browser's :user-invalid waits for the edit to be committed (a blur); an "onChange" field doesn't.
  expect(input.matches(":invalid")).toBe(true);
  await user.type(input, "Oslo");
  expect(queryByTestId("city-error")).toBeNull();
  expect(input.hasAttribute("data-valid")).toBe(true);
  expect(input.matches(":invalid")).toBe(false);
});

test("inside a disabled field: disabled", () => {
  const { getByRole } = mount(basic);
  expect(textbox(getByRole, "Country").disabled).toBe(true);
});

test("a form reset returns an uncontrolled input to its default, reported once, and keeps a controlled one", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const notes = textbox(getByRole, "Notes");
  const search = textbox(getByRole, "Search");
  expect(notes.defaultValue).toBe("draft");
  await user.type(notes, "!");
  await user.clear(search);
  await user.type(search, "new");
  expect(getByTestId("notes-changes").textContent).toBe("draft!");
  (getByTestId("form") as HTMLFormElement).reset();
  // The browser's reset alone already restores the default.
  expect(notes.value).toBe("draft");
  await expect.poll(() => getByTestId("notes-changes").textContent).toBe("draft!|draft");
  await expect.poll(() => search.value).toBe("new");
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(getByTestId("query").textContent).toBe("new");
  expect(getByTestId("notes-changes").textContent).toBe("draft!|draft");
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("q")).toBe("new");
});

test("after a form reset, an input in a field keeps its default when the field's state changes", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const city = textbox(getByRole, "City");
  await user.type(city, "Oslo");
  await user.click(getByRole("button", { name: "Reset" }));
  await new Promise((resolve) => setTimeout(resolve, 20));
  expect(city.value).toBe("");
  // Leaving it marks the field touched, which renders the input's props again.
  await user.click(city);
  await user.tab();
  expect(getByTestId("city-root").hasAttribute("data-touched")).toBe(true);
  expect(city.value).toBe("");
});
