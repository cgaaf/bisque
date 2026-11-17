// Checkboxes whose change is saved to a server (fixtures/async.rx), as a setting that saves when it changes: the
// save succeeds, fails, is slow, and two saves cross. The fake server holds every save until the test answers it.
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
  const control = (name: string) => mounted.getByRole("checkbox", { name }) as HTMLInputElement;
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, control, text };
}

test("optimistic save that succeeds: on at once, and stays on", async () => {
  const { control, text, user } = await setup();
  const wifi = control("Wi-Fi");
  const writes = recordWrites(wifi, "checked");
  await user.click(wifi);
  expect(wifi.checked).toBe(true);
  expect(text("wifi")).toBe("on");
  expect(text("wifi-saving")).toBe("saving");
  expect(waiting()).toEqual([true]);
  release(true);
  await answered();
  expect(wifi.checked).toBe(true);
  expect(text("wifi-saving")).toBe("");
  // Never set back to off on the way.
  expect(writes).not.toContain(false);
});

test("optimistic save that fails: back to off, with the error, and it can be changed again", async () => {
  const { control, text, user } = await setup();
  const wifi = control("Wi-Fi");
  await user.click(wifi);
  expect(wifi.checked).toBe(true);
  refuse(true);
  await answered();
  expect(wifi.checked).toBe(false);
  expect(text("wifi")).toBe("off");
  expect(text("wifi-error")).toBe("failed");
  await user.click(wifi);
  expect(wifi.checked).toBe(true);
  expect(text("wifi-error")).toBe("");
  release(true);
  await answered();
  expect(wifi.checked).toBe(true);
});

test("two optimistic saves in flight, answered out of order: the last choice wins", async () => {
  const { control, text, user } = await setup();
  const wifi = control("Wi-Fi");
  await user.click(wifi);
  await user.click(wifi);
  // Responsive throughout: the second press showed at once.
  expect(wifi.checked).toBe(false);
  expect(waiting()).toEqual([true, false]);
  release(false);
  await answered();
  expect(wifi.checked).toBe(false);
  release(true);
  await answered();
  expect(wifi.checked).toBe(false);
  expect(text("wifi")).toBe("off");
});

test("a save that isn't optimistic: the checkbox shows the owner's value, then the saved one", async () => {
  const { control, text, user } = await setup();
  const backup = control("Backup");
  await user.click(backup);
  await frame();
  // The owner hasn't accepted the change yet: the browser's toggle is undone.
  expect(backup.checked).toBe(false);
  expect(text("backup")).toBe("off");
  release(true);
  await answered();
  expect(backup.checked).toBe(true);
  expect(text("backup")).toBe("on");
});

test("a save that isn't optimistic and fails: the checkbox ends on the owner's value", async () => {
  const { control, text, user } = await setup();
  const backup = control("Backup");
  await user.click(backup);
  refuse(true);
  await answered();
  expect(backup.checked).toBe(false);
  expect(text("backup-error")).toBe("failed");
});

test("disabled while saving: keeps focus, re-enables, and can be used again", async () => {
  const { control, user } = await setup();
  const sync = control("Sync");
  sync.focus();
  await user.keyboard(" ");
  expect(sync.checked).toBe(true);
  expect(sync.disabled).toBe(true);
  release(true);
  await answered();
  expect(sync.disabled).toBe(false);
  expect(sync.checked).toBe(true);
  // Focus is still on the checkbox, so the keyboard carries on.
  expect(document.activeElement).toBe(sync);
  await user.keyboard(" ");
  expect(sync.checked).toBe(false);
  refuse(false);
  await answered();
  expect(sync.disabled).toBe(false);
  expect(sync.checked).toBe(true);
});

test("the plainest optimistic save (guess, save, write) succeeds and fails", async () => {
  const { control, text, user } = await setup();
  const plain = control("Plain");
  const writes = recordWrites(plain, "checked");
  await user.click(plain);
  expect(plain.checked).toBe(true);
  release(true);
  await answered();
  expect(plain.checked).toBe(true);
  expect(writes).not.toContain(false);
  await user.click(plain);
  expect(plain.checked).toBe(false);
  refuse(false);
  await answered();
  expect(plain.checked).toBe(true);
  expect(text("plain-error")).toBe("failed");
});

test("read-only while saving: keeps focus, ignores presses, and takes them again after", async () => {
  const { control, user } = await setup();
  const locked = control("Locked");
  locked.focus();
  await user.keyboard(" ");
  expect(locked.checked).toBe(true);
  expect(locked.getAttribute("aria-readonly")).toBe("true");
  expect(document.activeElement).toBe(locked);
  // A press while the save is out changes nothing and sends nothing.
  await user.keyboard(" ");
  expect(locked.checked).toBe(true);
  expect(waiting()).toEqual([true]);
  release(true);
  await answered();
  expect(locked.hasAttribute("aria-readonly")).toBe(false);
  expect(document.activeElement).toBe(locked);
  await user.keyboard(" ");
  expect(locked.checked).toBe(false);
});

test("a handler that writes what a loading question reads doesn't hold the checkbox", async () => {
  const { control, text, user } = await setup();
  server.holdLoads = true;
  const notifications = control("Notifications");
  await user.click(notifications);
  expect(notifications.checked).toBe(true);
  // The checkbox's own state moved at once, while the app's question is still loading.
  expect(text("state")).toBe("on");
  expect(text("preview")).toBe("off");
  await user.click(notifications);
  expect(notifications.checked).toBe(false);
  expect(text("state")).toBe("off");
  await user.click(notifications);
  expect(notifications.checked).toBe(true);
  expect(text("state")).toBe("on");
  releaseLoads();
  await answered();
  expect(notifications.checked).toBe(true);
  expect(text("state")).toBe("on");
  expect(text("preview")).toBe("on");
});

test("a mixed box whose save isn't optimistic: mixed until the owner has the new value", async () => {
  const { control, user } = await setup();
  const everything = control("Everything");
  expect(everything.indeterminate).toBe(true);
  await user.click(everything);
  await frame();
  // The press cleared `indeterminate` and checked the box; the owner hasn't accepted it, so both are put back.
  expect(everything.indeterminate).toBe(true);
  expect(everything.checked).toBe(false);
  release(true);
  await answered();
  expect(everything.indeterminate).toBe(false);
  expect(everything.checked).toBe(true);
});
