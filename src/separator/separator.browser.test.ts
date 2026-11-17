import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

test("is an <hr>: a horizontal separator with no attributes of its own, keeping the consumer's", () => {
  const { getByTestId, getAllByRole } = mount(basic);
  const line = getByTestId("default");
  expect(line.tagName).toBe("HR");
  expect(getAllByRole("separator")).toContain(line);
  expect(line.hasAttribute("role")).toBe(false);
  expect(line.hasAttribute("aria-orientation")).toBe(false);
  expect(line.className).toBe("line");
});

test("writes aria-orientation only when vertical, and follows it when it changes", async () => {
  const { getByTestId, getByRole, user } = mount(basic);
  expect(getByTestId("vertical").getAttribute("aria-orientation")).toBe("vertical");
  const flip = getByTestId("switch");
  expect(flip.hasAttribute("aria-orientation")).toBe(false);
  await user.click(getByRole("button", { name: "Flip" }));
  expect(flip.getAttribute("aria-orientation")).toBe("vertical");
  expect(flip.matches('[aria-orientation="vertical"]')).toBe(true);
  await user.click(getByRole("button", { name: "Flip" }));
  expect(flip.hasAttribute("aria-orientation")).toBe(false);
});

test("its props function gives another element the role and orientation", () => {
  const { getByTestId } = mount(basic);
  const div = getByTestId("div");
  expect(div.getAttribute("role")).toBe("separator");
  expect(div.getAttribute("aria-orientation")).toBe("vertical");
  expect(div.getAttribute("data-orientation")).toBe("vertical");
});
