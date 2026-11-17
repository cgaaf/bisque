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
