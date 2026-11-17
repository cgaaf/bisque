import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is a labelled progress bar with its value, range and status", () => {
  const { getByRole, getByTestId, getByText } = mount(basic);
  const bar = getByRole("progressbar", { name: "Uploading" });
  expect(bar).toBe(getByTestId("root"));
  expect(bar.className).toBe("mine");
  expect(bar.getAttribute("aria-valuemin")).toBe("0");
  expect(bar.getAttribute("aria-valuemax")).toBe("100");
  expect(bar.getAttribute("aria-valuenow")).toBe("25");
  expect(bar.getAttribute("aria-valuetext")).toBe("25%");
  expect(bar.getAttribute("aria-labelledby")).toBe(getByText("Uploading").id);
  expect(getByText("Uploading").getAttribute("role")).toBe("presentation");
  for (const id of ["root", "value", "track", "indicator"]) {
    const part = getByTestId(id);
    expect(part.hasAttribute("data-progressing")).toBe(true);
    expect(part.hasAttribute("data-complete")).toBe(false);
  }
  const value = getByTestId("value");
  expect(value.textContent).toBe("25%");
  expect(value.getAttribute("aria-hidden")).toBe("true");
  expect(getByTestId("indicator").style.width).toBe("25%");
});

test("follows the value: complete, indeterminate, clamped", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const bar = getByTestId("root");
  await user.click(getByRole("button", { name: "Finish" }));
  expect(bar.hasAttribute("data-complete")).toBe(true);
  expect(getByTestId("indicator").hasAttribute("data-complete")).toBe(true);
  expect(getByTestId("value").textContent).toBe("100%");

  await user.click(getByRole("button", { name: "Unknown" }));
  expect(bar.hasAttribute("data-indeterminate")).toBe(true);
  expect(bar.hasAttribute("aria-valuenow")).toBe(false);
  expect(bar.getAttribute("aria-valuetext")).toBe("indeterminate progress");
  expect(getByTestId("value").textContent).toBe("");
  expect(getByTestId("indicator").style.width).toBe("");

  await user.click(getByRole("button", { name: "Overflow" }));
  expect(bar.getAttribute("aria-valuenow")).toBe("100");
  expect(getByTestId("indicator").style.width).toBe("100%");
  expect(bar.hasAttribute("data-complete")).toBe(true);
});

test("min, max, format, locale, getAriaValueText and a label id of the consumer's", () => {
  const { getByRole, getByTestId } = mount(basic);
  const bar = getByRole("progressbar", { name: "Custom" });
  expect(bar.getAttribute("aria-labelledby")).toBe("custom-label");
  expect(bar.getAttribute("aria-valuemin")).toBe("1");
  expect(bar.getAttribute("aria-valuemax")).toBe("5");
  expect(bar.getAttribute("aria-valuenow")).toBe("3");
  expect(getByTestId("custom-value").textContent).toBe("3 kB");
  expect(bar.getAttribute("aria-valuetext")).toBe("3 kB of 5");
  expect(getByTestId("custom-indicator").style.width).toBe("50%");
});

test("the value's props work on an element the consumer owns", () => {
  const { getByTestId } = mount(basic);
  const own = getByTestId("own-value");
  expect(own.tagName).toBe("STRONG");
  expect(own.textContent).toBe("10 of 100");
  expect(own.getAttribute("aria-hidden")).toBe("true");
  expect(own.hasAttribute("data-progressing")).toBe(true);
});
