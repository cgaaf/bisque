import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const checked = (radio: HTMLElement) => radio.getAttribute("aria-checked");

test("checks a radio on press and from its label", async () => {
  const { getByRole, getByTestId, getByText, queryByTestId, user } = mount(basic);
  expect(getByRole("radiogroup", { name: "Fruit" })).toBeTruthy();
  const apple = getByRole("radio", { name: "Apple" });
  const banana = getByRole("radio", { name: "Banana" });
  expect(checked(apple)).toBe("true");
  expect(apple.hasAttribute("data-checked")).toBe(true);
  expect(getByTestId("apple-indicator")).toBeTruthy();

  await user.click(banana);
  expect(checked(banana)).toBe("true");
  expect(checked(apple)).toBe("false");
  expect(apple.hasAttribute("data-unchecked")).toBe(true);
  expect(queryByTestId("apple-indicator")).toBeNull();
  expect(getByTestId("fruit").textContent).toBe("banana");

  await user.click(getByText("Date"));
  expect(checked(getByRole("radio", { name: "Date" }))).toBe("true");
});

test("is one Tab stop, on the checked radio", async () => {
  const { getByRole, user } = mount(basic);
  const apple = getByRole("radio", { name: "Apple" });
  expect(apple.getAttribute("tabindex")).toBe("0");
  expect(getByRole("radio", { name: "Banana" }).getAttribute("tabindex")).toBe("-1");
  await user.tab();
  expect(document.activeElement).toBe(apple);
  await user.tab();
  expect(document.activeElement).toBe(getByRole("button", { name: "After" }));
});

test("the arrow keys move focus and check, skipping disabled radios and wrapping", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const apple = getByRole("radio", { name: "Apple" });
  const banana = getByRole("radio", { name: "Banana" });
  const date = getByRole("radio", { name: "Date" });
  apple.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(banana);
  expect(checked(banana)).toBe("true");
  await user.keyboard("{ArrowRight}");
  expect(document.activeElement).toBe(date);
  expect(checked(date)).toBe("true");
  expect(getByTestId("fruit").textContent).toBe("date");
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(apple);
  expect(checked(apple)).toBe("true");
  await user.keyboard("{ArrowUp}");
  expect(document.activeElement).toBe(date);
  await user.keyboard("{ArrowLeft}");
  expect(document.activeElement).toBe(banana);
  expect(checked(banana)).toBe("true");
  expect(banana.getAttribute("tabindex")).toBe("0");
});

test("Tab into a group with nothing checked focuses the first radio without checking it; Space checks", async () => {
  const { getByRole, user } = mount(basic);
  const small = getByRole("radio", { name: "Small" });
  getByRole("button", { name: "After" }).focus();
  await user.tab();
  expect(document.activeElement).toBe(small);
  expect(checked(small)).toBe("false");
  await user.keyboard("{Enter}");
  expect(checked(small)).toBe("false");
  await user.keyboard(" ");
  expect(checked(small)).toBe("true");
});

test("disabled radios and read-only groups don't change", async () => {
  const { getByRole, user } = mount(basic);
  const cherry = getByRole("radio", { name: "Cherry" }) as HTMLButtonElement;
  expect(cherry.disabled).toBe(true);
  expect(cherry.hasAttribute("data-disabled")).toBe(true);

  const locked = getByRole("radiogroup", { name: "Locked" });
  expect(locked.getAttribute("aria-readonly")).toBe("true");
  const a = getByRole("radio", { name: "A" });
  const b = getByRole("radio", { name: "B" });
  await user.click(b);
  expect(checked(b)).toBe("false");
  a.focus();
  await user.keyboard("{ArrowDown}");
  expect(document.activeElement).toBe(b);
  expect(checked(a)).toBe("true");
});

test("submits the checked value under its name", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("fruit")).toBe("apple");
  expect(new FormData(form).get("size")).toBeNull();
  await user.click(getByRole("radio", { name: "Large" }));
  expect(new FormData(form).get("size")).toBe("l");
});

test("inside a field: labelled and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const group = getByRole("radiogroup", { name: "Plan" });
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("plan-error").textContent).toBe("Choose a plan");
  expect(group.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(getByRole("radio", { name: "Free" }));

  const root = getByTestId("plan-root");
  expect(root.hasAttribute("data-focused")).toBe(true);
  await user.keyboard("{ArrowDown}");
  expect(checked(getByRole("radio", { name: "Pro" }))).toBe("true");
  expect(queryByTestId("plan-error")).toBeNull();
  // Moving between radios keeps the field focused; leaving the group blurs and touches it.
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(root.hasAttribute("data-touched")).toBe(false);
  await user.tab();
  expect(root.hasAttribute("data-focused")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("plan=pro");
});
