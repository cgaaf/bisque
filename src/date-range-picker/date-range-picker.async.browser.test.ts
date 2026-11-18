// Range pickers whose value is saved to a server (fixtures/async.rx), as a setting that saves when it changes: the
// save succeeds, fails, is slow, and the app's own questions are slow. The fake server holds every save until the
// test answers it. The picker must keep opening, closing, picking and taking keys throughout.
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
  const group = (id: string) => mounted.getByTestId(`${id}-root`);
  const popup = (id: string) => mounted.getByTestId(`${id}-root-popup`);
  const trigger = (id: string) => group(id).querySelector<HTMLButtonElement>(":scope > button")!;
  const day = (id: string, iso: string) =>
    popup(id).querySelector<HTMLButtonElement>(`button[data-date="${iso}"]:not([data-outside-month])`)!;
  const shown = (id: string) =>
    Array.from(group(id).querySelectorAll<HTMLElement>("[data-bisque-segment]"))
      .map((s) => s.textContent)
      .join("");
  const isOpen = (id: string) => popup(id).matches(":popover-open");
  const text = (id: string) => mounted.getByTestId(id).textContent;
  /** Opens a picker from the keyboard and picks the two days after the focused one. */
  async function pickNext(id: string, from: string) {
    trigger(id).focus();
    await mounted.user.keyboard("{Enter}");
    await expect.poll(() => document.activeElement).toBe(day(id, from));
    await mounted.user.keyboard("{ArrowRight}{Enter}{ArrowRight}{Enter}");
    await expect.poll(() => isOpen(id)).toBe(false);
  }
  return { ...mounted, group, popup, trigger, day, shown, isOpen, text, pickNext };
}

test("optimistic save that succeeds: the range shows at once, closes the popup, and stays", async () => {
  const { pickNext, shown, text, trigger } = await setup();
  await pickNext("stay", "2030-05-08");
  expect(shown("stay")).toBe("5/9/20305/10/2030");
  expect(text("stay-saving")).toBe("saving");
  expect(document.activeElement).toBe(trigger("stay"));
  expect(waiting()).toEqual(["2030-05-09/2030-05-10"]);
  release("2030-05-09/2030-05-10");
  await answered();
  expect(shown("stay")).toBe("5/9/20305/10/2030");
  expect(text("stay-saving")).toBe("");
});

test("optimistic save that fails: back to the old range, and the picker picks again", async () => {
  const { pickNext, shown, text } = await setup();
  await pickNext("stay", "2030-05-08");
  refuse("2030-05-09/2030-05-10");
  await answered();
  expect(shown("stay")).toBe("5/8/20305/10/2030");
  expect(text("stay-error")).toBe("failed");
  await pickNext("stay", "2030-05-08");
  expect(shown("stay")).toBe("5/9/20305/10/2030");
  expect(text("stay-error")).toBe("");
  release("2030-05-09/2030-05-10");
  await answered();
  expect(shown("stay")).toBe("5/9/20305/10/2030");
});

test("a second range while the first save is out", async () => {
  const { pickNext, shown } = await setup();
  await pickNext("stay", "2030-05-08");
  await pickNext("stay", "2030-05-09");
  expect(shown("stay")).toBe("5/10/20305/11/2030");
  for (const value of waiting()) {
    release(value);
    // oxlint-disable-next-line no-await-in-loop -- each answer must land before the next is released
    await answered();
  }
  expect(shown("stay")).toBe("5/10/20305/11/2030");
});

test("a save that isn't optimistic: the old range stays until the owner has the new one", async () => {
  const { pickNext, shown, text } = await setup();
  await pickNext("trip", "2030-05-08");
  expect(shown("trip")).toBe("5/8/20305/10/2030");
  release("2030-05-09/2030-05-10");
  await answered();
  expect(text("trip")).toBe("2030-05-09/2030-05-10");
  expect(shown("trip")).toBe("5/9/20305/10/2030");
  await pickNext("trip", "2030-05-09");
  refuse("2030-05-10/2030-05-11");
  await answered();
  expect(text("trip-error")).toBe("failed");
  expect(shown("trip")).toBe("5/9/20305/10/2030");
});

test("disabled while saving: the trigger is disabled, then opens again", async () => {
  const { pickNext, trigger, user, isOpen } = await setup();
  await pickNext("locked", "2030-05-08");
  expect(trigger("locked").matches(":disabled")).toBe(true);
  release("2030-05-09/2030-05-10");
  await answered();
  expect(trigger("locked").matches(":disabled")).toBe(false);
  trigger("locked").focus();
  await user.keyboard("{Enter}");
  await expect.poll(() => isOpen("locked")).toBe(true);
  await user.keyboard("{Escape}");
  await expect.poll(() => isOpen("locked")).toBe(false);
});

test("a handler that writes what a loading question reads doesn't hold the picker", async () => {
  const { pickNext, shown, text } = await setup();
  server.holdLoads = true;
  await pickNext("preview", "2030-05-08");
  await pickNext("preview", "2030-05-09");
  expect(shown("preview")).toBe("5/10/20305/11/2030");
  expect(text("preview")).toBe("2030-05-08/2030-05-10");
  releaseLoads();
  await answered();
  expect(shown("preview")).toBe("5/10/20305/11/2030");
  expect(text("preview")).toBe("2030-05-10/2030-05-11");
});
