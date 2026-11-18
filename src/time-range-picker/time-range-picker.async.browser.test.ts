// A time range picker whose range is saved to a server (fixtures/async.rx). The fake server holds every save until
// the test answers it.
import { beforeEach, expect, test } from "vitest";
import { mount } from "../test/browser.ts";
import { answered, refuse, release, resetServer, server, waiting } from "../test/settings-server.ts";
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
  const popup = (id: string) => mounted.getByTestId(id);
  const open = async (name: string, id: string) => {
    await mounted.user.click(mounted.getByRole("button", { name }));
    await expect.poll(() => popup(id).matches(":popover-open")).toBe(true);
    await expect.poll(() => popup(id).contains(document.activeElement)).toBe(true);
  };
  const option = (id: string, column: string, value: string) =>
    popup(id).querySelector<HTMLElement>(`[role=listbox][aria-label="${column}"] [data-value="${value}"]`)!;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, group, shown, popup, open, option, text };
}

test("an optimistic save: both ends show at once, and stay", async () => {
  const { open, option, shown, text, user } = await setup();
  await open("Open start", "start-popup");
  await user.click(option("start-popup", "Minutes", "30"));
  expect(shown("Start time")).toBe("9:30 AM");
  expect(waiting()).toEqual(["09:30/17:00"]);
  expect(text("shift-saving")).toBe("saving");
  await user.keyboard("{Escape}");
  await open("Open end", "end-popup");
  await user.click(option("end-popup", "Hours", "18"));
  expect(shown("End time")).toBe("6:00 PM");
  expect(shown("Start time")).toBe("9:30 AM");
  release("09:30/17:00");
  release("09:30/18:00");
  await answered();
  expect(text("shift")).toBe("09:30/18:00");
  expect(shown("Start time")).toBe("9:30 AM");
  expect(shown("End time")).toBe("6:00 PM");
});

test("an optimistic save that fails: the range goes back, and the picker takes choices again", async () => {
  const { open, option, shown, text, user } = await setup();
  await open("Open start", "start-popup");
  await user.click(option("start-popup", "Hours", "8"));
  expect(shown("Start time")).toBe("8:00 AM");
  refuse("08:00/17:00");
  await answered();
  expect(shown("Start time")).toBe("9:00 AM");
  expect(text("shift-error")).toBe("failed");
  await user.click(option("start-popup", "Minutes", "45"));
  expect(shown("Start time")).toBe("9:45 AM");
  release("09:45/17:00");
  await answered();
  expect(shown("Start time")).toBe("9:45 AM");
});

test("disabled while saving: the triggers are disabled until the save lands", async () => {
  const { getByRole, open, option, shown, user } = await setup();
  await open("Open locked start", "locked-popup");
  await user.click(option("locked-popup", "Minutes", "15"));
  const trigger = getByRole("button", { name: "Open locked start" }) as HTMLButtonElement;
  await expect.poll(() => trigger.disabled).toBe(true);
  release("09:15/17:00");
  await answered();
  await expect.poll(() => trigger.disabled).toBe(false);
  expect(shown("Locked start")).toBe("9:15 AM");
  await user.click(option("locked-popup", "Minutes", "30"));
  expect(shown("Locked start")).toBe("9:30 AM");
  release("09:30/17:00");
  await answered();
  expect(shown("Locked start")).toBe("9:30 AM");
});
