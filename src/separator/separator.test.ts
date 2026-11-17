import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is a horizontal separator by default and keeps the consumer's attributes", () => {
  const { getByTestId } = mount(basic);
  const line = getByTestId("default");
  expect(line.tagName).toBe("DIV");
  expect(line.getAttribute("role")).toBe("separator");
  expect(line.getAttribute("aria-orientation")).toBe("horizontal");
  expect(line.getAttribute("data-orientation")).toBe("horizontal");
  expect(line.className).toBe("line");
});

test("takes a vertical orientation, and follows it when it changes", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  expect(getByTestId("vertical").getAttribute("aria-orientation")).toBe("vertical");
  const flip = getByTestId("switch");
  expect(flip.getAttribute("data-orientation")).toBe("horizontal");
  await user.click(getByRole("button", { name: "Flip" }));
  expect(flip.getAttribute("aria-orientation")).toBe("vertical");
  expect(flip.getAttribute("data-orientation")).toBe("vertical");
});

test("its props work on an element the consumer owns", () => {
  const { getByTestId } = mount(basic);
  const hr = getByTestId("hr");
  expect(hr.tagName).toBe("HR");
  expect(hr.getAttribute("role")).toBe("separator");
  expect(hr.getAttribute("aria-orientation")).toBe("vertical");
});
