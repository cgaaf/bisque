import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

test("is a native group named by its native legend", () => {
  const { getByRole, getByTestId } = mount(basic);
  const group = getByRole("group", { name: "Billing" });
  expect(group.tagName).toBe("FIELDSET");
  expect(getByTestId("legend").tagName).toBe("LEGEND");
  expect(group.hasAttribute("aria-labelledby")).toBe(false);
});

test("disabling it disables the fields and controls inside, natively and in their Field state", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const group = getByRole("group", { name: "Billing" }) as HTMLFieldSetElement;
  const input = getByRole("textbox", { name: "Company" }) as HTMLInputElement;
  const box = getByRole("checkbox", { name: "Invoice by post" }) as HTMLInputElement;
  expect(group.matches(":disabled")).toBe(false);
  expect(input.disabled).toBe(false);

  await user.click(getByRole("button", { name: "Lock" }));
  expect(group.disabled).toBe(true);
  expect(group.matches(":disabled")).toBe(true);
  expect(input.disabled).toBe(true);
  // A checkbox outside any Field is disabled by the browser alone.
  expect(box.disabled).toBe(false);
  expect(box.matches(":disabled")).toBe(true);
  expect(getByTestId("field").hasAttribute("data-disabled")).toBe(true);

  await user.click(getByRole("button", { name: "Lock" }));
  expect(input.matches(":disabled")).toBe(false);
  expect(getByTestId("field").hasAttribute("data-disabled")).toBe(false);
});
