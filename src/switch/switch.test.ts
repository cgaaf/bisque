import { expect, test } from "vitest";
import { mount } from "../test/mount.ts";
import basic from "./fixtures/basic.rx";

test("toggles on press, from its label and with Space and Enter", async () => {
  const { getByRole, getByTestId, getByText, user } = mount(basic);
  const wifi = getByRole("switch", { name: "Wi-Fi" });
  const thumb = getByTestId("thumb");
  expect(wifi.getAttribute("aria-checked")).toBe("false");
  expect(wifi.hasAttribute("data-unchecked")).toBe(true);
  expect(thumb.hasAttribute("data-unchecked")).toBe(true);

  await user.click(wifi);
  expect(wifi.getAttribute("aria-checked")).toBe("true");
  expect(wifi.hasAttribute("data-checked")).toBe(true);
  expect(thumb.hasAttribute("data-checked")).toBe(true);
  expect(getByTestId("wifi").textContent).toBe("on");

  await user.click(getByText("Wi-Fi"));
  expect(wifi.getAttribute("aria-checked")).toBe("false");
  wifi.focus();
  await user.keyboard(" ");
  expect(wifi.getAttribute("aria-checked")).toBe("true");
  await user.keyboard("{Enter}");
  expect(wifi.getAttribute("aria-checked")).toBe("false");
});

test("uncontrolled: starts at defaultChecked", async () => {
  const { getByRole, user } = mount(basic);
  const bluetooth = getByRole("switch", { name: "Bluetooth" });
  expect(bluetooth.getAttribute("aria-checked")).toBe("true");
  await user.click(bluetooth);
  expect(bluetooth.getAttribute("aria-checked")).toBe("false");
});

test("submits its value with the form only while on", async () => {
  const { getByRole, getByTestId, user } = mount(basic);
  const form = getByTestId("form") as HTMLFormElement;
  expect(new FormData(form).get("wifi")).toBeNull();
  await user.click(getByRole("switch", { name: "Wi-Fi" }));
  expect(new FormData(form).get("wifi")).toBe("enabled");
});

test("disabled and read-only switches don't change", async () => {
  const { getByRole, user } = mount(basic);
  const airplane = getByRole("switch", { name: "Airplane" }) as HTMLButtonElement;
  expect(airplane.disabled).toBe(true);
  expect(airplane.hasAttribute("data-disabled")).toBe(true);
  await user.click(airplane);
  expect(airplane.getAttribute("aria-checked")).toBe("false");

  const roaming = getByRole("switch", { name: "Roaming" });
  expect(roaming.getAttribute("aria-readonly")).toBe("true");
  await user.click(roaming);
  expect(roaming.getAttribute("aria-checked")).toBe("false");
});

test("inside a field: labelled, described and validated by it", async () => {
  const { getByRole, getByTestId, queryByTestId, user } = mount(basic);
  const consent = getByRole("switch", { name: "Share usage data" });
  expect(consent.getAttribute("aria-describedby")).toBe(getByTestId("consent-description").id);

  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("consent-error").textContent).toBe("Required to continue");
  expect(consent.getAttribute("aria-invalid")).toBe("true");
  expect(document.activeElement).toBe(consent);

  await user.click(consent);
  expect(queryByTestId("consent-error")).toBeNull();
  expect(getByTestId("consent-root").hasAttribute("data-filled")).toBe(true);
  await user.click(getByRole("button", { name: "Submit" }));
  expect(getByTestId("submitted").textContent).toBe("consent=true");

  expect((getByRole("switch", { name: "Locked" }) as HTMLButtonElement).disabled).toBe(true);
});
