// An OTP field inside a FieldRoot and a Form (fixtures/field.rx): labelled and described through the field,
// validated on blur and on submit, submitted under the field's name.
import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import field from "./fixtures/field.rx";

async function setup() {
  const mounted = mount(field);
  await frame();
  const root = mounted.getByTestId("otp-root");
  const slots = [...root.querySelectorAll<HTMLInputElement>("[data-bisque-otp-slot]")];
  return { ...mounted, root, slots };
}

test("labelled by the field's label (the first slot natively), described on the group", async () => {
  const { root, slots, getByTestId, getAllByLabelText } = await setup();
  const label = getByTestId("label");
  expect(label.getAttribute("for")).toBe(slots[0].id);
  expect(slots[0].labels?.[0]).toBe(label);
  expect(slots.map((slot) => slot.getAttribute("aria-labelledby"))).toEqual(Array(4).fill(label.id));
  expect(root.getAttribute("aria-labelledby")).toBe(label.id);
  expect(root.getAttribute("aria-describedby")).toBe(getByTestId("description").id);
  expect(slots.every((slot) => !slot.hasAttribute("aria-describedby"))).toBe(true);
  const locked = getAllByLabelText("Locked").find((element) => element.matches("input")) as HTMLInputElement;
  expect(locked.disabled).toBe(true);
  expect(locked.closest("[role=group]")!.hasAttribute("data-disabled")).toBe(true);
});

test("a submit with the code missing marks it invalid and focuses the first empty slot", async () => {
  const { root, slots, getByTestId, getByRole, user } = await setup();
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(slots.map((slot) => slot.getAttribute("aria-invalid"))).toEqual(Array(4).fill("true"));
  expect(getByTestId("error").textContent).not.toBe("");
  expect(document.activeElement).toBe(slots[0]);
  await user.keyboard("1234");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(slots.every((slot) => !slot.hasAttribute("aria-invalid"))).toBe(true);
  expect(getByTestId("submitted").textContent).toBe("code=1234");
});

test("validated when focus leaves the group, not when it moves between slots", async () => {
  const { root, slots, getByTestId, user } = await setup();
  const fieldRoot = getByTestId("field");
  await user.click(slots[0]);
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(fieldRoot.hasAttribute("data-focused")).toBe(true);
  await user.keyboard("12");
  expect(fieldRoot.hasAttribute("data-dirty")).toBe(true);
  expect(root.hasAttribute("data-filled")).toBe(true);
  await user.keyboard("{ArrowLeft}");
  // Moving between slots isn't leaving the field.
  expect(fieldRoot.hasAttribute("data-touched")).toBe(false);
  expect(root.hasAttribute("data-invalid")).toBe(false);
  await user.keyboard("{Tab}");
  expect(fieldRoot.hasAttribute("data-touched")).toBe(true);
  expect(root.hasAttribute("data-focused")).toBe(false);
  // Two characters of four don't match the code's pattern.
  expect(root.hasAttribute("data-invalid")).toBe(true);
  await user.click(slots[2]);
  await user.keyboard("34");
  await user.keyboard("{Tab}");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(root.hasAttribute("data-valid")).toBe(true);
});
