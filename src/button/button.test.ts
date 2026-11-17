import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("is a native button that runs the consumer's handler", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const plain = getByRole("button", { name: "Plain" });
  expect(plain.getAttribute("type")).toBe("button");
  expect(plain.className).toBe("mine");
  expect(plain.hasAttribute("data-disabled")).toBe(false);
  expect(plain.hasAttribute("aria-disabled")).toBe(false);
  await user.click(plain);
  plain.focus();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(getByTestId("clicks").textContent).toBe("ppp");
});

test("disabled: the native attribute, out of the Tab order, no handlers", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const button = getByRole("button", { name: "Disabled" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(button.hasAttribute("data-disabled")).toBe(true);
  expect(button.hasAttribute("aria-disabled")).toBe(false);
  await user.click(button);
  expect(getByTestId("clicks").textContent).toBe("");
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "Plain" }));
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "Focusable" }));
});

test("focusableWhenDisabled: stays focusable, announces disabled, ignores activation but not focus", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const button = getByRole("button", { name: "Focusable" }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  expect(button.getAttribute("aria-disabled")).toBe("true");
  expect(button.hasAttribute("data-disabled")).toBe(true);
  await user.click(button);
  await user.tab();
  await user.tab();
  expect(document.activeElement).toBe(button);
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(getByTestId("clicks").textContent).toBe("F");
});

test("follows a disabled prop that changes", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const button = getByRole("button", { name: "Toggled" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  await user.click(getByTestId("enable"));
  expect(button.disabled).toBe(false);
  expect(button.hasAttribute("data-disabled")).toBe(false);
  await user.click(button);
  expect(getByTestId("clicks").textContent).toBe("t");
});

test("a non-button element gets button semantics and keyboard activation", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const span = getByRole("button", { name: "Span" });
  expect(span.tagName).toBe("SPAN");
  expect(span.getAttribute("tabindex")).toBe("0");
  expect(span.hasAttribute("type")).toBe(false);
  span.focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("clicks").textContent).toBe("s");
  await user.keyboard(" ");
  expect(getByTestId("clicks").textContent).toBe("ss");
  await user.click(span);
  expect(getByTestId("clicks").textContent).toBe("sss");
});

test("a disabled non-button element is announced, unfocusable and inert", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const span = getByRole("button", { name: "Off span" });
  expect(span.getAttribute("aria-disabled")).toBe("true");
  expect(span.getAttribute("tabindex")).toBe("-1");
  expect(span.hasAttribute("data-disabled")).toBe(true);
  await user.click(span);
  span.focus();
  await user.keyboard("{Enter}");
  await user.keyboard(" ");
  expect(getByTestId("clicks").textContent).toBe("");
});

test("a link acting as a button activates once on Enter and on Space", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const link = getByRole("button", { name: "Link" });
  expect(link.tagName).toBe("A");
  link.focus();
  await user.keyboard("{Enter}");
  expect(getByTestId("clicks").textContent).toBe("l");
  await user.keyboard(" ");
  expect(getByTestId("clicks").textContent).toBe("ll");
});
