// Time fields whose value is saved to a server (fixtures/async.rx). The fake server holds every save until the test
// answers it. Date Field's async tests cover the shared segment behaviour in full.
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
  await user.click(segment("Alarm", "hour"));
  await user.keyboard("{ArrowUp}");
  expect(shown("Alarm")).toBe("10:30 AM");
  expect(waiting()).toEqual(["10:30"]);
  expect(text("alarm-saving")).toBe("saving");
  release("10:30");
  await answered();
  expect(shown("Alarm")).toBe("10:30 AM");
  expect(text("alarm")).toBe("10:30");
});

test("an optimistic save that fails: the time goes back, and the field takes keys again", async () => {
  const { segment, shown, text, user } = await setup();
  await user.click(segment("Alarm", "dayPeriod"));
  await user.keyboard("p");
  expect(shown("Alarm")).toBe("9:30 PM");
  refuse("21:30");
  await answered();
  expect(shown("Alarm")).toBe("9:30 AM");
  expect(text("alarm-error")).toBe("failed");
  await user.keyboard("{ArrowUp}");
  expect(shown("Alarm")).toBe("9:30 PM");
  release("21:30");
  await answered();
  expect(shown("Alarm")).toBe("9:30 PM");
});

test("disabled while saving: the segment takes focus back and keys work again", async () => {
  const { segment, group, shown, user } = await setup();
  const minute = segment("Locked", "minute");
  await user.click(minute);
  await user.keyboard("{ArrowUp}");
  expect(group("Locked").hasAttribute("data-disabled")).toBe(true);
  release("09:31");
  await answered();
  await expect.poll(() => document.activeElement).toBe(minute);
  await user.keyboard("{ArrowUp}");
  expect(shown("Locked")).toBe("9:32 AM");
  release("09:32");
  await answered();
});

test("a controlled field whose value a loading question reads keeps taking keys", async () => {
  const { segment, shown, text, user } = await setup();
  server.holdLoads = true;
  await user.click(segment("Picked", "minute"));
  // 4, then 45: the second digit is typed onto the first while the app's question for :04 is out.
  await user.keyboard("45");
  expect(shown("Picked")).toBe("9:45 AM");
  expect(text("summarizing")).toBe("loading");
  releaseLoads();
  await answered();
  expect(shown("Picked")).toBe("9:45 AM");
  expect(text("summary")).toBe("09:45");
});
