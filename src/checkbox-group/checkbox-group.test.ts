import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const checked = (box: HTMLElement) => box.getAttribute("aria-checked");

test("each box is checked while the group's value holds its value", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  expect(getByRole("group", { name: "Toppings" })).toBe(getByTestId("toppings"));
  const cheese = getByRole("checkbox", { name: "Cheese" });
  const ham = getByRole("checkbox", { name: "Ham" });
  expect(checked(cheese)).toBe("true");
  expect(checked(ham)).toBe("false");

  await user.click(ham);
  expect(checked(ham)).toBe("true");
  expect(getByTestId("last").textContent).toBe("cheese,ham");
  await user.click(cheese);
  expect(checked(cheese)).toBe("false");
  expect(getByTestId("last").textContent).toBe("ham");
});

test("submits each checked box's value under its name", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.click(getByRole("checkbox", { name: "Olives" }));
  expect(new FormData(getByTestId("form") as HTMLFormElement).getAll("toppings")).toEqual([
    "cheese",
    "olives",
  ]);
});

test("the parent box is mixed while some are checked, and cycles all, none, then the mixed selection", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const all = getByRole("checkbox", { name: "All toppings" });
  const boxes = ["Cheese", "Ham", "Olives"].map((name) => getByRole("checkbox", { name }));
  expect(checked(all)).toBe("mixed");
  expect(all.hasAttribute("data-parent")).toBe(true);

  await user.click(all);
  expect(checked(all)).toBe("true");
  expect(boxes.map(checked)).toEqual(["true", "true", "true"]);
  await user.click(all);
  expect(checked(all)).toBe("false");
  expect(boxes.map(checked)).toEqual(["false", "false", "false"]);
  await user.click(all);
  expect(checked(all)).toBe("mixed");
  expect(boxes.map(checked)).toEqual(["true", "false", "false"]);
  expect(getByTestId("last").textContent).toBe("cheese");

  // Checking the rest by hand makes the parent checked, and the cycle starts from there.
  await user.click(boxes[1]);
  await user.click(boxes[2]);
  expect(checked(all)).toBe("true");
  await user.click(all);
  expect(boxes.map(checked)).toEqual(["false", "false", "false"]);
});

test("inside a field: labelled by it, its value is the field's, disabled with it", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const group = getByRole("group", { name: "Colors" });
  expect(group.hasAttribute("data-dirty")).toBe(false);
  await user.click(getByRole("checkbox", { name: "Blue" }));
  expect(getByTestId("colors-root").hasAttribute("data-dirty")).toBe(true);
  expect(group.hasAttribute("data-filled")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe('["red","blue"]');

  expect((getByRole("checkbox", { name: "Small" }) as HTMLButtonElement).disabled).toBe(true);
  expect(getByRole("group", { name: "Sizes" }).hasAttribute("data-disabled")).toBe(true);
});
