// Date fields whose value is saved to a server (fixtures/async.rx): the app saves each change; the save succeeds,
// fails, is slow, saves cross, the field is typed into while one is out. The fake server holds every save until the
// test answers it.
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

// Mounted, with the settings loaded.
async function setup() {
  const mounted = mount(fixture);
  await answered();
  const group = (name: string) => mounted.getByRole("group", { name });
  const segment = (name: string, kind: string) =>
    group(name).querySelector<HTMLElement>(`[role=spinbutton][data-type=${kind}]`)!;
  const shown = (name: string) =>
    Array.from(group(name).querySelectorAll("[data-bisque-segment]"))
      .map((s) => s.textContent)
      .join("");
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, group, segment, shown, text };
}

test("an optimistic save: shows at once, and stays", async () => {
  const { segment, shown, text, user } = await setup();
  await user.click(segment("Due", "day"));
  await user.keyboard("{ArrowUp}");
  expect(shown("Due")).toBe("11/18/2026");
  expect(waiting()).toEqual(["2026-11-18"]);
  expect(text("due-saving")).toBe("saving");
  release("2026-11-18");
  await answered();
  expect(shown("Due")).toBe("11/18/2026");
  expect(text("due")).toBe("2026-11-18");
  expect(text("due-saving")).toBe("");
});

test("two saves answered out of order: the last choice wins", async () => {
  const { segment, shown, user } = await setup();
  await user.click(segment("Due", "day"));
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(shown("Due")).toBe("11/19/2026");
  expect(waiting()).toEqual(["2026-11-18", "2026-11-19"]);
  release("2026-11-19");
  await answered();
  expect(shown("Due")).toBe("11/19/2026");
  release("2026-11-18");
  await answered();
  expect(shown("Due")).toBe("11/19/2026");
});

test("an optimistic save that fails: the date goes back, and the field takes keys again", async () => {
  const { segment, shown, text, user } = await setup();
  await user.click(segment("Due", "day"));
  await user.keyboard("{ArrowUp}");
  expect(shown("Due")).toBe("11/18/2026");
  refuse("2026-11-18");
  await answered();
  expect(shown("Due")).toBe("11/17/2026");
  expect(text("due-error")).toBe("failed");
  await user.keyboard("{ArrowDown}");
  expect(shown("Due")).toBe("11/16/2026");
  release("2026-11-16");
  await answered();
  expect(shown("Due")).toBe("11/16/2026");
});

test("typed into while a save is out: the answer doesn't overwrite what is being typed", async () => {
  const { segment, shown, user } = await setup();
  await user.click(segment("Due", "day"));
  await user.keyboard("{ArrowUp}");
  await user.click(segment("Due", "year"));
  await user.keyboard("20");
  expect(shown("Due")).toBe("11/18/20");
  release("2026-11-18");
  await answered();
  expect(shown("Due")).toBe("11/18/20");
  await user.keyboard("27");
  expect(shown("Due")).toBe("11/18/2027");
  // One at a time, each answer landing before the next: answering them all at once would abandon the app's reloads.
  for (const value of waiting()) {
    release(value);
    // oxlint-disable-next-line no-await-in-loop -- each answer must land before the next is released
    await answered();
    expect(shown("Due")).toBe("11/18/2027");
  }
});

test("a partial edit while a save is out stays when the answer lands", async () => {
  const { segment, shown, user } = await setup();
  await user.click(segment("Due", "day"));
  await user.keyboard("{ArrowUp}");
  await user.keyboard("{Backspace}{Backspace}");
  expect(shown("Due")).toBe("11/––/2026");
  release("2026-11-18");
  await answered();
  expect(shown("Due")).toBe("11/––/2026");
  release("");
  await answered();
  expect(shown("Due")).toBe("11/––/2026");
  await user.keyboard("5");
  expect(shown("Due")).toBe("11/5/2026");
  release("2026-11-05");
  await answered();
});

test("a save that isn't optimistic: the field shows the edit while it is out, and keeps it", async () => {
  const { segment, shown, text, user } = await setup();
  await user.click(segment("Start", "day"));
  await user.keyboard("{ArrowUp}");
  await frame();
  // The owner still holds the 17th; the field shows what was chosen until the owner takes it.
  expect(text("start")).toBe("2026-11-17");
  expect(shown("Start")).toBe("11/18/2026");
  release("2026-11-18");
  await answered();
  expect(text("start")).toBe("2026-11-18");
  expect(shown("Start")).toBe("11/18/2026");
  await user.keyboard("{ArrowUp}");
  refuse("2026-11-19");
  await answered();
  expect(text("start-error")).toBe("failed");
  // An owner that never takes the value leaves the edit showing: the field can't tell a refusal from a slow save.
  expect(shown("Start")).toBe("11/19/2026");
  await user.keyboard("{ArrowDown}{ArrowDown}");
  expect(shown("Start")).toBe("11/17/2026");
  for (const value of waiting()) release(value);
  await answered();
});

test("disabled while saving: the segment takes focus back and keys work again", async () => {
  const { segment, group, shown, user } = await setup();
  const day = segment("Locked", "day");
  await user.click(day);
  await user.keyboard("{ArrowUp}");
  expect(shown("Locked")).toBe("11/18/2026");
  expect(group("Locked").hasAttribute("data-disabled")).toBe(true);
  expect(day.hasAttribute("tabindex")).toBe(false);
  release("2026-11-18");
  await answered();
  expect(group("Locked").hasAttribute("data-disabled")).toBe(false);
  await expect.poll(() => document.activeElement).toBe(day);
  await user.keyboard("{ArrowUp}");
  expect(shown("Locked")).toBe("11/19/2026");
  release("2026-11-19");
  await answered();
});

test("read-only while saving: keeps focus, ignores keys, and takes them again after", async () => {
  const { segment, group, shown, user } = await setup();
  const day = segment("Frozen", "day");
  await user.click(day);
  await user.keyboard("{ArrowUp}");
  expect(shown("Frozen")).toBe("11/18/2026");
  expect(group("Frozen").hasAttribute("data-readonly")).toBe(true);
  await user.keyboard("{ArrowUp}5");
  expect(shown("Frozen")).toBe("11/18/2026");
  expect(waiting()).toEqual(["2026-11-18"]);
  release("2026-11-18");
  await answered();
  expect(document.activeElement).toBe(day);
  await user.keyboard("{ArrowUp}");
  expect(shown("Frozen")).toBe("11/19/2026");
  release("2026-11-19");
  await answered();
});

// Two changes each: a fetch keyed on every keystroke abandons a flight per change, which Solid reports from three.
test("a controlled field whose value a loading question reads keeps taking keys", async () => {
  const { segment, shown, text, user } = await setup();
  server.holdLoads = true;
  await user.click(segment("Picked", "month"));
  // 1, then 12: the second digit is typed onto the first while the app's question for 1 is out.
  await user.keyboard("12");
  expect(shown("Picked")).toBe("12/17/2026");
  expect(text("summarizing")).toBe("loading");
  await user.keyboard("{ArrowRight}{ArrowLeft}");
  expect(shown("Picked")).toBe("12/17/2026");
  releaseLoads();
  await answered();
  expect(shown("Picked")).toBe("12/17/2026");
  expect(text("summary")).toBe("2026-12-17");
});

test("a handler that writes what a loading question reads doesn't hold the field", async () => {
  const { segment, shown, text, user } = await setup();
  server.holdLoads = true;
  await user.click(segment("Preview", "day"));
  await user.keyboard("{ArrowUp}{ArrowUp}");
  expect(shown("Preview")).toBe("11/19/2026");
  expect(text("preview")).toBe("2026-11-17");
  releaseLoads();
  await answered();
  expect(shown("Preview")).toBe("11/19/2026");
  expect(text("preview")).toBe("2026-11-19");
});
