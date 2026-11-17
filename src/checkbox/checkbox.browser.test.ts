import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import field from "./fixtures/field.rx";

const box = (getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) =>
  getByRole("checkbox", { name }) as HTMLInputElement;

test("is a native checkbox that toggles on press and from its label", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  const terms = box(getByRole, "Accept terms");
  expect(terms.type).toBe("checkbox");
  expect(terms.checked).toBe(false);
  // The indicator is the box's next sibling, always present, and not part of the name.
  const indicator = getByTestId("indicator");
  expect(terms.nextElementSibling).toBe(indicator);
  expect(indicator.getAttribute("aria-hidden")).toBe("true");
  expect(indicator.matches("input:checked + span")).toBe(false);

  await user.click(terms);
  expect(terms.checked).toBe(true);
  expect(terms.matches(":checked")).toBe(true);
  expect(indicator.matches("input:checked + span")).toBe(true);
  expect(getByTestId("agreed").textContent).toBe("yes");

  await user.click(getByText("Accept terms"));
  expect(terms.checked).toBe(false);
  expect(getByTestId("agreed").textContent).toBe("no");
});

test("toggles with Space, not Enter", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const terms = box(getByRole, "Accept terms");
  terms.focus();
  await user.keyboard(" ");
  expect(terms.checked).toBe(true);
  expect(getByTestId("agreed").textContent).toBe("yes");
  await user.keyboard("{Enter}");
  expect(terms.checked).toBe(true);
});

test("uncontrolled: starts at defaultChecked", async () => {
  const { getByRole, user } = mount(basic);
  const news = box(getByRole, "News");
  expect(news.checked).toBe(true);
  await user.click(news);
  expect(news.checked).toBe(false);
});

test("controlled: follows its owner, also after a press", async () => {
  const { getByRole, user } = mount(basic);
  const terms = box(getByRole, "Accept terms");
  await user.click(terms);
  expect(terms.checked).toBe(true);
  await user.click(getByRole("button", { name: "Agree from outside" }));
  expect(terms.checked).toBe(false);
});

test("controlled: an owner that refuses the change keeps the box as it was", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const refused = box(getByRole, "Refused");
  await user.click(refused);
  await frame();
  expect(getByTestId("changes").textContent).toBe("1");
  expect(refused.checked).toBe(false);
  await user.click(refused);
  await frame();
  expect(getByTestId("changes").textContent).toBe("2");
  expect(refused.checked).toBe(false);
});

test("submits its value with the form only while checked", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("terms")).toBeNull();
  expect(new FormData(form).get("news")).toBe("on");
  await user.click(box(getByRole, "Accept terms"));
  expect(new FormData(form).get("terms")).toBe("yes");
});

test("indeterminate is set on the element, and a controlled one stays set after a press", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const all = box(getByRole, "Select all");
  expect(all.indeterminate).toBe(true);
  expect(all.matches(":indeterminate")).toBe(true);
  expect(getByTestId("mark").matches("input:indeterminate + span")).toBe(true);
  expect(getByTestId("mark").textContent).toBe("–");

  await user.click(all);
  expect(all.checked).toBe(true);
  expect(all.indeterminate).toBe(true);
  await user.click(getByRole("button", { name: "Toggle mixed" }));
  expect(all.indeterminate).toBe(false);
  expect(all.matches(":checked")).toBe(true);
  expect(getByTestId("mark").textContent).toBe("✓");
});

test("disabled boxes are natively disabled; read-only boxes don't change", async () => {
  const { getByRole, user } = mount(basic);
  const locked = box(getByRole, "Locked");
  expect(locked.disabled).toBe(true);
  expect(locked.matches(":disabled:checked")).toBe(true);

  const fixed = box(getByRole, "Fixed");
  expect(fixed.getAttribute("aria-readonly")).toBe("true");
  expect(fixed.hasAttribute("data-readonly")).toBe(true);
  await user.click(fixed);
  expect(fixed.checked).toBe(false);
  fixed.focus();
  await user.keyboard(" ");
  expect(fixed.checked).toBe(false);
});

test("a form reset leaves the box showing its state", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const terms = box(getByRole, "Accept terms");
  await user.click(terms);
  await user.click(getByRole("button", { name: "Reset" }));
  await frame();
  expect(terms.checked).toBe(true);
  expect(getByTestId("agreed").textContent).toBe("yes");
});

test("inside a field: labelled, described, named and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(field);
  const terms = box(getByRole, "Accept terms");
  expect(terms.getAttribute("aria-describedby")).toBe(getByTestId("terms-description").id);
  expect(terms.name).toBe("terms");

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("");
  expect(getByTestId("terms-error").textContent).toBe("Accept the terms to go on");
  expect(terms.getAttribute("aria-invalid")).toBe("true");
  expect(terms.validity.valueMissing).toBe(true);
  expect(getByTestId("terms-root").hasAttribute("data-invalid")).toBe(true);
  expect(document.activeElement).toBe(terms);

  // The label is a native <label for>: a press on it toggles the box.
  await user.click(getByTestId("terms-root").querySelector("label")!);
  expect(terms.checked).toBe(true);
  expect(queryByTestId("terms-error")).toBeNull();
  expect(getByTestId("terms-root").hasAttribute("data-dirty")).toBe(true);
  expect(new FormData(getByTestId("form") as HTMLFormElement).get("terms")).toBe("yes");

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("terms=true");
});

test("inside a disabled field: disabled, styled by :disabled", () => {
  const { getByRole } = mount(field);
  const locked = box(getByRole, "Locked");
  expect(locked.disabled).toBe(true);
  expect(locked.hasAttribute("data-disabled")).toBe(false);
});
