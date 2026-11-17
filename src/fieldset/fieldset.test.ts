import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is a group named by its legend", () => {
  const { getByRole, getByTestId } = mount(basic);
  const group = getByRole("group", { name: "Billing" });
  expect(group.tagName).toBe("FIELDSET");
  expect(group.getAttribute("aria-labelledby")).toBe(getByTestId("legend").id);
});

test("disabling it disables the fields inside", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const group = getByRole("group", { name: "Billing" }) as HTMLFieldSetElement;
  const input = getByRole("textbox", { name: "Company" }) as HTMLInputElement;
  expect(group.hasAttribute("data-disabled")).toBe(false);
  expect(input.disabled).toBe(false);

  await user.click(getByRole("button", { name: "Lock" }));
  expect(group.disabled).toBe(true);
  expect(group.hasAttribute("data-disabled")).toBe(true);
  expect(getByTestId("legend").hasAttribute("data-disabled")).toBe(true);
  expect(getByTestId("field").hasAttribute("data-disabled")).toBe(true);
  expect(input.disabled).toBe(true);
});
