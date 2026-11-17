import { expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import basic from "./fixtures/basic.rx";

const control = (getByRole: (role: string, options: { name: string }) => HTMLElement, name: string) =>
  getByRole("switch", { name }) as HTMLInputElement;

test("is a native checkbox with the switch role that toggles on press, from its label and with Space", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  const wifi = control(getByRole, "Wi-Fi");
  expect(wifi.type).toBe("checkbox");
  expect(wifi.checked).toBe(false);
  // The browser exposes the checked state: no aria-checked is written.
  expect(wifi.hasAttribute("aria-checked")).toBe(false);
  const thumb = getByTestId("thumb");
  expect(wifi.nextElementSibling).toBe(thumb);
  expect(thumb.getAttribute("aria-hidden")).toBe("true");

  await user.click(wifi);
  expect(wifi.matches(":checked")).toBe(true);
  expect(getByTestId("wifi").textContent).toBe("on");

  await user.click(getByText("Wi-Fi"));
  expect(wifi.checked).toBe(false);
  wifi.focus();
  await user.keyboard(" ");
  expect(wifi.checked).toBe(true);
  expect(getByTestId("wifi").textContent).toBe("on");
  // As a native checkbox, Enter doesn't toggle it.
  await user.keyboard("{Enter}");
  expect(wifi.checked).toBe(true);
});

test("uncontrolled: starts at defaultChecked", async () => {
  const { getByRole, user } = mount(basic);
  const bluetooth = control(getByRole, "Bluetooth");
  expect(bluetooth.checked).toBe(true);
  await user.click(bluetooth);
  expect(bluetooth.checked).toBe(false);
});

test("controlled: an owner that refuses the change keeps it on", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const pinned = control(getByRole, "Pinned");
  expect(pinned.checked).toBe(true);
  await user.click(pinned);
  await frame();
  expect(getByTestId("refusals").textContent).toBe("1");
  expect(pinned.checked).toBe(true);
});

test("submits its value with the form only while on", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("wifi")).toBeNull();
  await user.click(control(getByRole, "Wi-Fi"));
  expect(new FormData(form).get("wifi")).toBe("enabled");
});

test("disabled switches are natively disabled; read-only switches don't change", async () => {
  const { getByRole, user } = mount(basic);
  const airplane = control(getByRole, "Airplane");
  expect(airplane.disabled).toBe(true);
  expect(airplane.matches(":disabled")).toBe(true);

  const roaming = control(getByRole, "Roaming");
  expect(roaming.getAttribute("aria-readonly")).toBe("true");
  expect(roaming.hasAttribute("data-readonly")).toBe(true);
  await user.click(roaming);
  expect(roaming.checked).toBe(false);
  roaming.focus();
  await user.keyboard(" ");
  expect(roaming.checked).toBe(false);
});

test("inside a field: labelled, described and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const consent = control(getByRole, "Share usage data");
  expect(consent.getAttribute("aria-describedby")).toBe(getByTestId("consent-description").id);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("consent-error").textContent).toBe("Required to continue");
  expect(consent.getAttribute("aria-invalid")).toBe("true");
  expect(consent.validity.valueMissing).toBe(true);
  expect(document.activeElement).toBe(consent);

  await user.click(consent);
  expect(queryByTestId("consent-error")).toBeNull();
  expect(getByTestId("consent-root").hasAttribute("data-filled")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("consent=true");

  expect(control(getByRole, "Locked").disabled).toBe(true);
});

test("a form reset returns an uncontrolled switch to its default, reported once, and keeps a controlled one", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const bluetooth = control(getByRole, "Bluetooth");
  const wifi = control(getByRole, "Wi-Fi");
  expect(bluetooth.defaultChecked).toBe(true);
  await user.click(bluetooth);
  await user.click(wifi);
  // The browser's reset alone already restores the default.
  (getByTestId("form") as HTMLFormElement).reset();
  expect(bluetooth.checked).toBe(true);
  await expect.poll(() => getByTestId("bluetooth-changes").textContent).toBe("off,on");
  await expect.poll(() => wifi.checked).toBe(true);
  await frame();
  expect(getByTestId("wifi").textContent).toBe("on");
  expect(getByTestId("bluetooth-changes").textContent).toBe("off,on");
});

test("a form reset returns a switch's field to untouched", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const consent = control(getByRole, "Share usage data");
  await user.click(consent);
  consent.focus();
  await user.tab();
  const root = getByTestId("consent-root");
  expect(root.hasAttribute("data-touched")).toBe(true);
  consent.form!.reset();
  await expect.poll(() => root.hasAttribute("data-touched")).toBe(false);
  expect(consent.checked).toBe(false);
  expect(root.hasAttribute("data-dirty")).toBe(false);
});
