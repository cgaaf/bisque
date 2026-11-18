// Time pickers whose value is saved to a server (fixtures/async.rx). The fake server holds every save until the test
// answers it. Time Field's async tests cover the field's own side.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
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

async function setup() {
  const mounted = mount(fixture);
  await answered();
  const group = (name: string) => mounted.getByRole("group", { name });
  const shown = (name: string) =>
    Array.from(group(name).querySelectorAll("[data-bisque-segment]"))
      .map((s) => s.textContent)
      .join("");
  const popup = (name: string) => mounted.getByTestId(`${name}-popup`);
  const open = async (name: string) => {
    await mounted.user.click(mounted.getByRole("button", { name: `Open ${name}` }));
    await expect.poll(() => popup(name).matches(":popover-open")).toBe(true);
    await expect.poll(() => popup(name).contains(document.activeElement)).toBe(true);
  };
  const option = (name: string, column: string, value: string) =>
    popup(name).querySelector<HTMLElement>(`[role=listbox][aria-label="${column}"] [data-value="${value}"]`)!;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, group, shown, popup, open, option, text };
}

test("an optimistic save: a choice shows at once, and stays", async () => {
  const { open, option, shown, text, user } = await setup();
  await open("alarm");
  await user.click(option("alarm", "Minutes", "45"));
  expect(shown("Alarm")).toBe("9:45 AM");
  expect(option("alarm", "Minutes", "45").getAttribute("aria-selected")).toBe("true");
  expect(waiting()).toEqual(["09:45"]);
  expect(text("alarm-saving")).toBe("saving");
  // The popup takes more choices while the save is out.
  await user.click(option("alarm", "Hours", "10"));
  expect(shown("Alarm")).toBe("10:45 AM");
  release("09:45");
  release("10:45");
  await answered();
  expect(shown("Alarm")).toBe("10:45 AM");
  expect(text("alarm")).toBe("10:45");
});

test("an optimistic save that fails: the time goes back, and the popup takes choices again", async () => {
  const { open, option, shown, text, user } = await setup();
  await open("alarm");
  await user.click(option("alarm", "AM/PM", "1"));
  expect(shown("Alarm")).toBe("9:30 PM");
  refuse("21:30");
  await answered();
  expect(shown("Alarm")).toBe("9:30 AM");
  expect(option("alarm", "AM/PM", "0").getAttribute("aria-selected")).toBe("true");
  expect(text("alarm-error")).toBe("failed");
  await user.click(option("alarm", "Minutes", "15"));
  expect(shown("Alarm")).toBe("9:15 AM");
  release("09:15");
  await answered();
  expect(shown("Alarm")).toBe("9:15 AM");
});

test("disabled while saving: the trigger and the open columns are disabled until the save lands", async () => {
  const { getByRole, open, option, popup, shown, user } = await setup();
  await open("locked");
  await user.click(option("locked", "Minutes", "45"));
  const trigger = getByRole("button", { name: "Open locked" }) as HTMLButtonElement;
  const minutes = popup("locked").querySelector<HTMLElement>("[role=listbox][aria-label=Minutes]")!;
  await expect.poll(() => trigger.disabled).toBe(true);
  expect(minutes.getAttribute("aria-disabled")).toBe("true");
  // A choice while disabled does nothing (Playwright won't press an aria-disabled element unforced).
  await user.click(option("locked", "Minutes", "15"), { force: true });
  expect(shown("Locked")).toBe("9:45 AM");
  release("09:45");
  await answered();
  await expect.poll(() => trigger.disabled).toBe(false);
  // The same column: it isn't re-created when the save lands.
  expect(minutes.isConnected).toBe(true);
  await expect.poll(() => minutes.hasAttribute("aria-disabled")).toBe(false);
  await user.click(option("locked", "Minutes", "15"));
  expect(shown("Locked")).toBe("9:15 AM");
  release("09:15");
  await answered();
  expect(shown("Locked")).toBe("9:15 AM");
});

test("a controlled picker whose value a loading question reads keeps taking choices", async () => {
  const { open, option, shown, text, user } = await setup();
  server.holdLoads = true;
  await open("picked");
  await user.click(option("picked", "Minutes", "45"));
  expect(shown("Picked")).toBe("9:45 AM");
  expect(text("summarizing")).toBe("loading");
  await user.click(option("picked", "Hours", "11"));
  expect(shown("Picked")).toBe("11:45 AM");
  expect(option("picked", "Hours", "11").getAttribute("aria-selected")).toBe("true");
  releaseLoads();
  await answered();
  expect(shown("Picked")).toBe("11:45 AM");
  expect(text("summary")).toBe("11:45");
});
