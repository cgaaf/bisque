import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is a labelled meter with its value and range", () => {
  const { getByRole, getByTestId, getByText } = mount(basic);
  const meter = getByRole("meter", { name: "Battery" });
  expect(meter).toBe(getByTestId("root"));
  expect(meter.className).toBe("mine");
  expect(meter.getAttribute("aria-valuemin")).toBe("0");
  expect(meter.getAttribute("aria-valuemax")).toBe("100");
  expect(meter.getAttribute("aria-valuenow")).toBe("40");
  expect(meter.getAttribute("aria-valuetext")).toBe("40%");
  expect(meter.getAttribute("aria-labelledby")).toBe(getByText("Battery").id);
  const value = getByTestId("value");
  expect(value.textContent).toBe("40%");
  expect(value.getAttribute("aria-hidden")).toBe("true");
  expect(getByTestId("track").tagName).toBe("DIV");
  expect(getByTestId("indicator").style.width).toBe("40%");
});

test("clamps a value outside the range", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const meter = getByTestId("root");
  await user.click(getByRole("button", { name: "Overflow" }));
  expect(meter.getAttribute("aria-valuenow")).toBe("100");
  expect(getByTestId("indicator").style.width).toBe("100%");
  expect(getByTestId("value").textContent).toBe("100%");
  await user.click(getByRole("button", { name: "Underflow" }));
  expect(meter.getAttribute("aria-valuenow")).toBe("0");
  expect(getByTestId("indicator").style.width).toBe("0%");
});

test("min, max, format, locale, getAriaValueText and a label id of the consumer's", () => {
  const { getByRole, getByTestId } = mount(basic);
  const meter = getByRole("meter", { name: "Disk" });
  expect(meter.getAttribute("aria-labelledby")).toBe("disk-label");
  expect(meter.getAttribute("aria-valuemin")).toBe("2");
  expect(meter.getAttribute("aria-valuemax")).toBe("10");
  expect(meter.getAttribute("aria-valuenow")).toBe("6");
  expect(getByTestId("disk-value").textContent).toBe("6 GB");
  expect(meter.getAttribute("aria-valuetext")).toBe("6 GB used");
  expect(getByTestId("disk-indicator").style.width).toBe("50%");
});
