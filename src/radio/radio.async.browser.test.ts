// Radio groups whose choice is saved to a server (fixtures/async.rx), as a setting that saves when it changes: the
// save succeeds, fails, is slow, and two saves cross. The fake server holds every save until the test answers it.
// The browser checks the pressed radio and unchecks the old one, without an event for the old one, before any
// handler runs: both must end on the group's state.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import {
  answered,
  recordWrites,
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

// Mounted, with the settings loaded.
async function setup() {
  const mounted = mount(fixture);
  await answered();
  const radio = (group: string, value: string) =>
    mounted
      .getByRole("radiogroup", { name: group })
      .querySelector(`input[value="${value}"]`) as HTMLInputElement;
  const checked = (group: string) =>
    (
      mounted
        .getByRole("radiogroup", { name: group })
        .querySelector("input:checked") as HTMLInputElement | null
    )?.value ?? null;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, radio, checked, text };
}

test("optimistic save that succeeds: the new radio is checked at once, and stays", async () => {
  const { radio, checked, text, user } = await setup();
  const free = recordWrites(radio("Plan", "free"), "checked");
  const pro = recordWrites(radio("Plan", "pro"), "checked");
  await user.click(radio("Plan", "pro"));
  expect(checked("Plan")).toBe("pro");
  expect(text("plan")).toBe("pro");
  expect(text("plan-saving")).toBe("saving");
  expect(waiting()).toEqual(["pro"]);
  release("pro");
  await answered();
  expect(checked("Plan")).toBe("pro");
  expect(text("plan-saving")).toBe("");
  // Never set back on the way.
  expect(free).not.toContain(true);
  expect(pro).not.toContain(false);
});

test("optimistic save that fails: back to the old radio, with the error, and it can be changed again", async () => {
  const { radio, checked, text, user } = await setup();
  await user.click(radio("Plan", "pro"));
  expect(checked("Plan")).toBe("pro");
  refuse("pro");
  await answered();
  expect(checked("Plan")).toBe("free");
  expect(radio("Plan", "pro").checked).toBe(false);
  expect(text("plan-error")).toBe("failed");
  await user.click(radio("Plan", "team"));
  expect(checked("Plan")).toBe("team");
  expect(text("plan-error")).toBe("");
  release("team");
  await answered();
  expect(checked("Plan")).toBe("team");
});

test("two optimistic saves in flight, answered out of order: the last choice wins", async () => {
  const { radio, checked, text, user } = await setup();
  await user.click(radio("Plan", "pro"));
  await user.click(radio("Plan", "team"));
  // Responsive throughout: the second press showed at once.
  expect(checked("Plan")).toBe("team");
  expect(waiting()).toEqual(["pro", "team"]);
  release("team");
  await answered();
  expect(checked("Plan")).toBe("team");
  release("pro");
  await answered();
  expect(checked("Plan")).toBe("team");
  expect(text("plan")).toBe("team");
});

test("a save that isn't optimistic: the old radio stays checked until the owner has the new value", async () => {
  const { radio, checked, text, user } = await setup();
  await user.click(radio("Shipping", "express"));
  await frame();
  // The owner hasn't accepted the change yet: the browser's choice is undone, the old radio checked again.
  expect(checked("Shipping")).toBe("standard");
  expect(text("shipping")).toBe("standard");
  release("express");
  await answered();
  expect(checked("Shipping")).toBe("express");
  expect(radio("Shipping", "standard").checked).toBe(false);
});

test("a save that isn't optimistic and fails: the group ends on the owner's value", async () => {
  const { radio, checked, text, user } = await setup();
  await user.click(radio("Shipping", "express"));
  refuse("express");
  await answered();
  expect(checked("Shipping")).toBe("standard");
  expect(text("shipping-error")).toBe("failed");
});

test("the arrow keys while a save is out: each choice shows and is sent, and the last one stays", async () => {
  const { radio, checked, text, user } = await setup();
  radio("Plan", "free").focus();
  await user.keyboard("{ArrowDown}");
  expect(checked("Plan")).toBe("pro");
  await user.keyboard("{ArrowDown}");
  expect(checked("Plan")).toBe("team");
  expect(document.activeElement).toBe(radio("Plan", "team"));
  expect(waiting()).toEqual(["pro", "team"]);
  release("team");
  release("pro");
  await answered();
  expect(checked("Plan")).toBe("team");
  expect(text("plan")).toBe("team");
});

test("disabled while saving: keeps focus, re-enables, and can be used again", async () => {
  const { radio, checked, user } = await setup();
  const dark = radio("Theme", "dark");
  radio("Theme", "light").focus();
  await user.keyboard("{ArrowDown}");
  expect(checked("Theme")).toBe("dark");
  expect(dark.disabled).toBe(true);
  release("dark");
  await answered();
  expect(dark.disabled).toBe(false);
  expect(checked("Theme")).toBe("dark");
  // Focus is back on the radio that was pressed, so the keyboard carries on.
  expect(document.activeElement).toBe(dark);
  await user.keyboard("{ArrowUp}");
  expect(checked("Theme")).toBe("light");
  refuse("light");
  await answered();
  expect(radio("Theme", "light").disabled).toBe(false);
  expect(checked("Theme")).toBe("dark");
});

test("read-only while saving: keeps focus, ignores choices, and takes them again after", async () => {
  const { radio, checked, user } = await setup();
  const medium = radio("Size", "m");
  radio("Size", "s").focus();
  await user.keyboard("{ArrowDown}");
  expect(checked("Size")).toBe("m");
  expect(document.activeElement).toBe(medium);
  // A choice while the save is out changes nothing and sends nothing.
  await user.keyboard("{ArrowUp}");
  expect(checked("Size")).toBe("m");
  expect(waiting()).toEqual(["m"]);
  release("m");
  await answered();
  medium.focus();
  await user.keyboard("{ArrowUp}");
  expect(checked("Size")).toBe("s");
});

test("the plainest optimistic save (guess, save, write) succeeds and fails", async () => {
  const { radio, checked, text, user } = await setup();
  const a = recordWrites(radio("Plain", "a"), "checked");
  await user.click(radio("Plain", "b"));
  expect(checked("Plain")).toBe("b");
  release("b");
  await answered();
  expect(checked("Plain")).toBe("b");
  expect(a).not.toContain(true);
  await user.click(radio("Plain", "a"));
  expect(checked("Plain")).toBe("a");
  refuse("a");
  await answered();
  expect(checked("Plain")).toBe("b");
  expect(text("plain-error")).toBe("failed");
});

test("a handler that writes what a loading question reads doesn't hold the group", async () => {
  const { radio, checked, text, user } = await setup();
  server.holdLoads = true;
  await user.click(radio("Preview", "y"));
  expect(checked("Preview")).toBe("y");
  // The group's own value moved at once, while the app's question is still loading.
  expect(text("state")).toBe("y");
  expect(text("preview")).toBe("x");
  await user.click(radio("Preview", "x"));
  expect(checked("Preview")).toBe("x");
  expect(text("state")).toBe("x");
  await user.click(radio("Preview", "y"));
  expect(checked("Preview")).toBe("y");
  releaseLoads();
  await answered();
  expect(checked("Preview")).toBe("y");
  expect(text("state")).toBe("y");
  expect(text("preview")).toBe("y");
});
