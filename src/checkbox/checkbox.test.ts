import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("toggles on press and from its label", async () => {
  const { getByRole, getByTestId, queryByTestId, getByText, user } = mount(basic);
  const box = getByRole("checkbox", { name: "Accept terms" });
  expect(box.getAttribute("aria-checked")).toBe("false");
  expect(box.hasAttribute("data-unchecked")).toBe(true);
  expect(queryByTestId("indicator")).toBeNull();

  await user.click(box);
  expect(box.getAttribute("aria-checked")).toBe("true");
  expect(box.hasAttribute("data-checked")).toBe(true);
  expect(getByTestId("indicator").hasAttribute("data-checked")).toBe(true);
  expect(getByTestId("agreed").textContent).toBe("yes");

  await user.click(getByText("Accept terms"));
  expect(box.getAttribute("aria-checked")).toBe("false");
});

test("toggles with Space", async () => {
  const { getByRole, user } = mount(basic);
  const box = getByRole("checkbox", { name: "Accept terms" });
  box.focus();
  await user.keyboard(" ");
  expect(box.getAttribute("aria-checked")).toBe("true");
});

test("submits its value with the form only while checked", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("terms")).toBeNull();
  await user.click(getByRole("checkbox", { name: "Accept terms" }));
  expect(new FormData(form).get("terms")).toBe("yes");
});

test("an indeterminate box is mixed and shows its indicator", () => {
  const { getByRole, getByTestId } = mount(basic);
  const box = getByRole("checkbox", { name: "Select all" });
  expect(box.getAttribute("aria-checked")).toBe("mixed");
  expect(box.hasAttribute("data-indeterminate")).toBe(true);
  expect(getByTestId("mixed")).toBeTruthy();
});

test("disabled and read-only boxes don't change", async () => {
  const { getByRole, user } = mount(basic);
  const locked = getByRole("checkbox", { name: "Locked" }) as HTMLButtonElement;
  expect(locked.disabled).toBe(true);
  await user.click(locked);
  expect(locked.getAttribute("aria-checked")).toBe("true");

  const fixed = getByRole("checkbox", { name: "Fixed" });
  expect(fixed.getAttribute("aria-readonly")).toBe("true");
  await user.click(fixed);
  expect(fixed.getAttribute("aria-checked")).toBe("false");
});
