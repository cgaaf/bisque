import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

const NATIVE = "Constraints not satisfied"; // jsdom's message for every native constraint failure

test("wires the label, description and control together", () => {
  const { getByRole, getByTestId } = mount(basic);
  const input = getByRole("textbox", { name: "Email" });
  expect(getByTestId("email-label").getAttribute("for")).toBe(input.id);
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("email-description").id);
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  const root = getByTestId("email-root");
  expect(root.hasAttribute("data-valid")).toBe(false);
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(false);
});

test("tracks focused, touched, dirty and filled", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("textbox", { name: "Email" });
  const root = getByTestId("email-root");
  await user.click(input);
  expect(root.hasAttribute("data-focused")).toBe(true);
  expect(input.hasAttribute("data-focused")).toBe(true);
  await user.type(input, "a");
  expect(root.hasAttribute("data-dirty")).toBe(true);
  expect(root.hasAttribute("data-filled")).toBe(true);
  await user.clear(input);
  expect(root.hasAttribute("data-dirty")).toBe(false);
  expect(root.hasAttribute("data-filled")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(false);
  await user.tab();
  expect(root.hasAttribute("data-focused")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(true);
  expect(getByTestId("email-label").hasAttribute("data-touched")).toBe(true);
});

test("onBlur: validates native constraints when the control loses focus", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = getByRole("textbox", { name: "Email" });
  const root = getByTestId("email-root");
  await user.type(input, "nope");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  await user.tab();
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  const error = getByTestId("email-error");
  expect(error.textContent).toBe(NATIVE);
  expect(input.getAttribute("aria-describedby")).toBe(`${getByTestId("email-description").id} ${error.id}`);

  // A change retires the error until the next blur validates again (as Base UI does).
  await user.type(input, "@");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  await user.tab();
  expect(root.hasAttribute("data-invalid")).toBe(true);
  await user.type(input, "example.com");
  await user.tab();
  expect(root.hasAttribute("data-valid")).toBe(true);
  expect(queryByTestId("email-error")).toBeNull();
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("email-description").id);
});

test("a missing value counts only once the field was changed", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = getByRole("textbox", { name: "Email" });
  const root = getByTestId("email-root");
  await user.click(input);
  await user.tab();
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(root.hasAttribute("data-valid")).toBe(true);

  await user.type(input, "a");
  await user.clear(input);
  await user.tab();
  expect(root.hasAttribute("data-invalid")).toBe(true);

  // Filling it in retires a missing-value error at once.
  await user.type(input, "a@b.co");
  expect(root.hasAttribute("data-invalid")).toBe(false);
});

test("onChange: runs `validate` on every change and reports the value", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = getByRole("textbox", { name: "Username" }) as HTMLInputElement;
  expect(input.value).toBe("guest");
  expect(getByTestId("validity").textContent).toBe("unknown:");
  await user.clear(input);
  await user.type(input, "admin");
  expect(getByTestId("name-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("name-error").textContent).toBe("That name is taken");
  expect(getByTestId("validity").textContent).toBe("invalid:That name is taken");
  await user.type(input, "2");
  expect(queryByTestId("name-error")).toBeNull();
  expect(getByTestId("validity").textContent).toBe("valid:");
  expect(getByTestId("changes").textContent).toBe(",a,ad,adm,admi,admin,admin2");
});

test("an error with `match` shows only for that failure", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = getByRole("textbox", { name: "Code" });
  await user.type(input, "x");
  expect(getByTestId("code-pattern").textContent).toBe("Digits only");
  expect(queryByTestId("code-missing")).toBeNull();
  await user.clear(input);
  expect(getByTestId("code-missing").textContent).toBe("Enter a code");
  expect(queryByTestId("code-pattern")).toBeNull();
  await user.type(input, "42");
  expect(queryByTestId("code-missing")).toBeNull();
  expect(getByTestId("code-root").hasAttribute("data-valid")).toBe(true);
});

test("a disabled field disables its control", () => {
  const { getByRole, getByTestId } = mount(basic);
  const input = getByRole("textbox", { name: "Locked" }) as HTMLInputElement;
  expect(input.disabled).toBe(true);
  expect(getByTestId("locked-root").hasAttribute("data-disabled")).toBe(true);
  expect(getByTestId("locked-label").hasAttribute("data-disabled")).toBe(true);
});

test("several messages show as a list", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(getByRole("textbox", { name: "PIN" }), "1");
  const items = [...getByTestId("pin-error").querySelectorAll("li")].map((item) => item.textContent);
  expect(items).toEqual(["Too short", "Needs a letter"]);
});

test("`invalid` marks the field invalid from the start", () => {
  const { getByRole, getByTestId } = mount(basic);
  expect(getByTestId("flagged-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByRole("textbox", { name: "Flagged" }).getAttribute("aria-invalid")).toBe("true");
  expect(getByTestId("flagged-error").textContent).toBe("Flagged by the server");
});
