import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("starts released and toggles when pressed", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const plain = getByRole("button", { name: "Plain" });
  expect(plain.getAttribute("type")).toBe("button");
  expect(plain.getAttribute("aria-pressed")).toBe("false");
  expect(plain.hasAttribute("data-pressed")).toBe(false);
  expect(plain.className).toBe("mine");

  await user.click(plain);
  expect(plain.getAttribute("aria-pressed")).toBe("true");
  expect(plain.hasAttribute("data-pressed")).toBe(true);

  plain.focus();
  await user.keyboard("{Enter}");
  expect(plain.getAttribute("aria-pressed")).toBe("false");
  await user.keyboard(" ");
  expect(plain.getAttribute("aria-pressed")).toBe("true");
  expect(getByTestId("log").textContent).toBe("+-+");
});

test("defaultPressed seeds the uncontrolled state", async () => {
  const { getByRole, user } = mount(basic);
  const preset = getByRole("button", { name: "Preset" });
  expect(preset.getAttribute("aria-pressed")).toBe("true");
  await user.click(preset);
  expect(preset.getAttribute("aria-pressed")).toBe("false");
});

test("follows a controlled `pressed` and reports changes", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const bold = getByRole("button", { name: "Bold" });
  await user.click(bold);
  expect(bold.getAttribute("aria-pressed")).toBe("true");
  expect(getByTestId("bold").textContent).toBe("on");

  const stuck = getByRole("button", { name: "Stuck" });
  await user.click(stuck);
  expect(stuck.getAttribute("aria-pressed")).toBe("false");
  expect(getByTestId("log").textContent).toBe("c");
});

test("does nothing while disabled", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const disabled = getByRole("button", { name: "Disabled" }) as HTMLButtonElement;
  expect(disabled.disabled).toBe(true);
  expect(disabled.hasAttribute("data-disabled")).toBe(true);
  await user.click(disabled);
  expect(disabled.getAttribute("aria-pressed")).toBe("false");
  expect(getByTestId("log").textContent).toBe("");
});

test("its props make a non-button element a toggle", async () => {
  const { getByTestId, user } = mount(basic);
  const span = getByTestId("span");
  expect(span.getAttribute("role")).toBe("button");
  expect(span.getAttribute("tabindex")).toBe("0");
  expect(span.hasAttribute("data-bisque-item")).toBe(false);
  span.focus();
  await user.keyboard("{Enter}");
  expect(span.getAttribute("aria-pressed")).toBe("true");
  await user.keyboard(" ");
  expect(span.getAttribute("aria-pressed")).toBe("false");
});
