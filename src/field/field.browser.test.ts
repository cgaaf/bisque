import { expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";
import native from "./fixtures/native.rx";
import reset from "./fixtures/reset.rx";

const textbox = (getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) =>
  getByRole("textbox", { name }) as HTMLInputElement;

test("wires the label, description and control together", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Email");
  const label = getByTestId("email-label") as HTMLLabelElement;
  expect(label.htmlFor).toBe(input.id);
  expect(input.labels?.[0]).toBe(label);
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("email-description").id);
  expect(input.hasAttribute("aria-invalid")).toBe(false);
  const root = getByTestId("email-root");
  expect(root.hasAttribute("data-valid")).toBe(false);
  expect(root.hasAttribute("data-invalid")).toBe(false);
  expect(root.hasAttribute("data-touched")).toBe(false);
  // The label is native: a press on it focuses the control.
  await user.click(label);
  expect(document.activeElement).toBe(input);
});

test("tracks focused, touched, dirty and filled", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Email");
  const root = getByTestId("email-root");
  await user.click(input);
  expect(root.hasAttribute("data-focused")).toBe(true);
  // On the input itself that is `:focus`: a native control carries no data-focused.
  expect(input.matches(":focus")).toBe(true);
  expect(input.hasAttribute("data-focused")).toBe(false);
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

test("onBlur: validates native constraints when the control loses focus, with the browser's message", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Email");
  const root = getByTestId("email-root");
  await user.type(input, "nope");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  await user.tab();
  expect(root.hasAttribute("data-invalid")).toBe(true);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(input.validity.typeMismatch).toBe(true);
  expect(input.matches(":user-invalid")).toBe(true);
  const error = getByTestId("email-error");
  expect(error.textContent).toBe(input.validationMessage);
  expect(error.textContent).not.toBe("");
  expect(input.getAttribute("aria-describedby")).toBe(`${getByTestId("email-description").id} ${error.id}`);

  // A change retires the error until the next blur validates again (as Base UI does).
  await user.type(input, "@");
  expect(root.hasAttribute("data-invalid")).toBe(false);
  await user.tab();
  expect(root.hasAttribute("data-invalid")).toBe(true);
  await user.type(input, "example.com");
  await user.tab();
  expect(root.hasAttribute("data-valid")).toBe(true);
  expect(input.matches(":user-invalid")).toBe(false);
  expect(queryByTestId("email-error")).toBeNull();
  expect(input.getAttribute("aria-describedby")).toBe(getByTestId("email-description").id);
});

test("a missing value counts only once the field was changed", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Email");
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

test("onChange: runs `validate` on every change, installs its message on the input, and reports the value", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Username");
  expect(input.value).toBe("guest");
  expect(getByTestId("validity").textContent).toBe("unknown:");
  await user.clear(input);
  await user.type(input, "admin");
  expect(getByTestId("name-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("name-error").textContent).toBe("That name is taken");
  expect(getByTestId("validity").textContent).toBe("invalid:That name is taken");
  // So the browser's own :invalid agrees with the field.
  expect(input.validationMessage).toBe("That name is taken");
  expect(input.matches(":invalid")).toBe(true);
  await user.type(input, "2");
  expect(queryByTestId("name-error")).toBeNull();
  expect(getByTestId("validity").textContent).toBe("valid:");
  expect(input.matches(":invalid")).toBe(false);
  expect(getByTestId("changes").textContent).toBe(",a,ad,adm,admi,admin,admin2");
});

test("an error with `match` shows only for that failure", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const input = textbox(getByRole, "Code");
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
  const input = textbox(getByRole, "Locked");
  expect(input.disabled).toBe(true);
  expect(input.hasAttribute("data-disabled")).toBe(false);
  expect(getByTestId("locked-root").hasAttribute("data-disabled")).toBe(true);
  expect(getByTestId("locked-label").hasAttribute("data-disabled")).toBe(true);
});

test("several messages show as a list", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  await user.type(textbox(getByRole, "PIN"), "1");
  const items = [...getByTestId("pin-error").querySelectorAll("li")].map((item) => item.textContent);
  expect(items).toEqual(["Too short", "Needs a letter"]);
});

test("`invalid` marks the field invalid from the start", () => {
  const { getByRole, getByTestId } = mount(basic);
  expect(getByTestId("flagged-root").hasAttribute("data-invalid")).toBe(true);
  expect(textbox(getByRole, "Flagged").getAttribute("aria-invalid")).toBe("true");
  expect(getByTestId("flagged-error").textContent).toBe("Flagged by the server");
});

const STATE = ["data-invalid", "data-valid", "data-touched", "data-dirty"];
const stateOf = (root: HTMLElement) => STATE.filter((name) => root.hasAttribute(name));
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

test("a form reset clears the errors a submit showed and returns the form to before its first submit", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(reset);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("email-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("terms-error").textContent).toBe("Accept the terms");

  await user.click(getByRole("button", { name: "Reset" }));
  await settle();
  expect(queryByTestId("email-error")).toBeNull();
  expect(queryByTestId("terms-error")).toBeNull();
  for (const name of ["email-root", "code-root", "terms-root", "plan-root"]) {
    expect({ [name]: stateOf(getByTestId(name)) }).toEqual({ [name]: [] });
  }
  expect(textbox(getByRole, "Email").hasAttribute("aria-invalid")).toBe(false);

  // Before a submit, an "onSubmit" field doesn't validate on change.
  await user.type(textbox(getByRole, "Email"), "x");
  expect(getByTestId("email-root").hasAttribute("data-invalid")).toBe(false);
});

test("a form reset is not a change: the restored value isn't validated and the field is untouched", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(reset);
  const code = textbox(getByRole, "Code");
  // "abc" passes; the default "ab" would not.
  await user.type(code, "c");
  await user.tab();
  expect(stateOf(getByTestId("code-root"))).toEqual(["data-valid", "data-touched", "data-dirty"]);
  await user.click(getByRole("checkbox", { name: "Accept terms" }));
  await user.click(getByRole("radio", { name: "Pro" }));

  await user.click(getByRole("button", { name: "Reset" }));
  await settle();
  expect(code.value).toBe("ab");
  expect(queryByTestId("code-error")).toBeNull();
  for (const name of ["code-root", "terms-root", "plan-root"]) {
    expect({ [name]: stateOf(getByTestId(name)) }).toEqual({ [name]: [] });
  }
  expect((getByRole("radio", { name: "Free" }) as HTMLInputElement).checked).toBe(true);

  // The next change validates as before.
  await user.type(code, "{Backspace}");
  expect(getByTestId("code-error").textContent).toBe("Too short");
});

test("a form reset retires an error the server returned, also for a value the reset leaves as it was", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(reset);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  await user.type(textbox(getByRole, "Code"), "c");
  await user.click(getByRole("checkbox", { name: "Accept terms" }));
  await user.click(getByRole("button", { name: "Submit" }));
  await expect.poll(() => queryByTestId("handle-error")?.textContent).toBe("That handle is taken");
  await user.click(getByRole("button", { name: "Reset" }));
  await settle();
  expect(textbox(getByRole, "Handle").value).toBe("studio");
  expect(queryByTestId("handle-error")).toBeNull();
  expect(getByTestId("handle-root").hasAttribute("data-invalid")).toBe(false);
  expect(getByTestId("sent").textContent).toBe("");
});

test("outside a Form, the browser's check on a native submit shows the field's error", async () => {
  const { getByRole, getByTestId, user } = mount(native);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submits").textContent).toBe("0");
  const email = textbox(getByRole, "Email");
  expect(getByTestId("email-root").hasAttribute("data-invalid")).toBe(true);
  expect(getByTestId("email-error").textContent).toBe(email.validationMessage);
  expect(email.getAttribute("aria-invalid")).toBe("true");
});

test("after a form reset, a required field that was emptied doesn't count as missing until changed again", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(native);
  const email = textbox(getByRole, "Email");
  await user.type(email, "a");
  await user.clear(email);
  await user.tab();
  expect(getByTestId("email-error").textContent).toBe(email.validationMessage);
  await user.click(getByRole("button", { name: "Reset" }));
  await settle();
  expect(queryByTestId("email-error")).toBeNull();
  // Tabbing through it is not a change.
  await user.click(email);
  await user.tab();
  expect(queryByTestId("email-error")).toBeNull();
  expect(getByTestId("email-root").hasAttribute("data-invalid")).toBe(false);
});

test("outside a Form, a field validates on blur by default", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(native);
  await user.type(textbox(getByRole, "Username"), "admin");
  expect(queryByTestId("name-error")).toBeNull();
  await user.tab();
  expect(getByTestId("name-error").textContent).toBe("That name is taken");
});

test("outside a Form, a blurred field's `validate` message blocks a native submit", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(native);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  const username = textbox(getByRole, "Username");
  await user.type(username, "admin");
  await user.click(getByRole("textbox", { name: "Other" }));
  await expect.poll(() => username.validationMessage).toBe("That name is taken");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submits").textContent).toBe("0");
  expect(getByTestId("name-error").textContent).toBe("That name is taken");

  await user.type(username, "2");
  expect(queryByTestId("name-error")).toBeNull();
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submits").textContent).toBe("1");
});

test("outside a Form, a press on the submit button right after typing blocks the submit too", async () => {
  const { getByRole, getByTestId, user } = mount(native);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  await user.type(textbox(getByRole, "Username"), "admin");
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submits").textContent).toBe("0");
  expect(getByTestId("name-error").textContent).toBe("That name is taken");
});

test("outside a Form, Enter in a field validates it before the browser submits", async () => {
  const { getByRole, getByTestId, user } = mount(native);
  await user.type(textbox(getByRole, "Email"), "a@b.co");
  await user.type(textbox(getByRole, "Username"), "admin{Enter}");
  expect(getByTestId("submits").textContent).toBe("0");
  expect(getByTestId("name-error").textContent).toBe("That name is taken");
  await user.keyboard("{ArrowRight}2{Enter}");
  expect(getByTestId("submits").textContent).toBe("1");
});
