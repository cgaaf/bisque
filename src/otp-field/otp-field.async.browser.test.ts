// OTP fields used against a server (fixtures/async.rx): a code checked once complete (the check succeeds, fails,
// is slow), a code saved as it changes, and typing while an answer the value asks for is out. The fake server holds
// every save until the test answers it.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import {
  answered,
  refuse,
  release,
  releaseLoads,
  resetServer,
  server,
  waiting,
} from "../test/settings-server.ts";
import fixture from "./fixtures/async.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

// The slots of the field whose first slot has this id.
function slots(id: string): HTMLInputElement[] {
  return [
    ...document
      .getElementById(id)!
      .closest('[role="group"]')!
      .querySelectorAll<HTMLInputElement>("[data-bisque-otp-slot]"),
  ];
}

function values(id: string): string {
  return slots(id)
    .map((slot) => slot.value)
    .join("");
}

async function setup() {
  const mounted = mount(fixture);
  await answered();
  await frame();
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, text };
}

test("a code checked once complete: read-only while the check is out, kept when it passes", async () => {
  const { text, user } = await setup();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("1234");
  expect(values("code")).toBe("1234");
  await expect.poll(() => waiting()).toEqual(["1234"]);
  await expect.poll(() => code.every((slot) => slot.readOnly)).toBe(true);
  // Read-only: a key changes nothing, and focus stays.
  await user.keyboard("{Backspace}");
  expect(values("code")).toBe("1234");
  expect(document.activeElement).toBe(code[3]);
  release("1234");
  await answered();
  expect(text("verified")).toBe("1234");
  expect(code.every((slot) => !slot.readOnly)).toBe(true);
  expect(values("code")).toBe("1234");
});

test("a code whose check fails is cleared by its owner; focus goes back to the first slot and it takes a new code", async () => {
  const { text, user } = await setup();
  const code = slots("code");
  await user.click(code[0]);
  await user.keyboard("1234");
  await expect.poll(() => waiting()).toEqual(["1234"]);
  refuse("1234");
  await answered();
  expect(text("verify-error")).toBe("wrong");
  expect(values("code")).toBe("");
  expect(document.activeElement).toBe(code[0]);
  await user.keyboard("5678");
  expect(values("code")).toBe("5678");
  expect(text("verify-error")).toBe("");
  await expect.poll(() => waiting()).toEqual(["5678"]);
  release("5678");
  await answered();
  expect(text("verified")).toBe("5678");
});

test("disabled while its check is out: focus comes back to the slot when it ends", async () => {
  const { user } = await setup();
  const pin = slots("pin");
  await user.click(pin[0]);
  await user.keyboard("123");
  await expect.poll(() => pin.every((slot) => slot.disabled)).toBe(true);
  refuse("123");
  await answered();
  expect(values("pin")).toBe("");
  expect(pin.every((slot) => !slot.disabled)).toBe(true);
  await expect.poll(() => pin).toContain(document.activeElement);
  await user.click(pin[0]);
  await user.keyboard("456");
  expect(values("pin")).toBe("456");
  release("456");
  await answered();
});

test("a code saved optimistically on every change keeps every keystroke, whatever order the saves end in", async () => {
  const { user } = await setup();
  const draft = slots("draft");
  await user.click(draft[0]);
  await user.keyboard("1234");
  expect(values("draft")).toBe("1234");
  expect(document.activeElement).toBe(draft[3]);
  expect(waiting()).toEqual(["1", "12", "123", "1234"]);
  release("12");
  await answered();
  expect(values("draft")).toBe("1234");
  release("1");
  release("123");
  release("1234");
  await answered();
  expect(values("draft")).toBe("1234");
});

test("an optimistic save that fails puts the code back", async () => {
  const { user } = await setup();
  const draft = slots("draft");
  await user.click(draft[0]);
  await user.keyboard("1");
  release("1");
  await answered();
  await user.keyboard("2");
  expect(values("draft")).toBe("12");
  refuse("12");
  await answered();
  expect(values("draft")).toBe("1");
});

test("a controlled code whose value a loading question reads keeps every keystroke", async () => {
  const { text, user } = await setup();
  server.holdLoads = true;
  const typed = slots("typed");
  await user.click(typed[0]);
  await user.keyboard("123");
  expect(values("typed")).toBe("123");
  expect(document.activeElement).toBe(typed[2]);
  expect(text("checking")).toBe("checking");
  releaseLoads();
  await answered();
  expect(values("typed")).toBe("123");
  expect(text("check")).toBe("123");
});

test("a handler that writes what a loading question reads doesn't hold the field", async () => {
  const { text, getByTestId, user } = await setup();
  server.holdLoads = true;
  const wanted = slots("wanted");
  await user.click(wanted[0]);
  await user.keyboard("123");
  expect(values("wanted")).toBe("123");
  expect(document.activeElement).toBe(wanted[2]);
  expect(getByTestId("wanted-root").hasAttribute("data-complete")).toBe(true);
  expect(text("preview")).toBe("");
  releaseLoads();
  await answered();
  expect(values("wanted")).toBe("123");
  expect(text("preview")).toBe("123");
});
