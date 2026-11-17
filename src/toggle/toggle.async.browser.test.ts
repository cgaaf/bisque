// Toggles whose change is saved to a server (fixtures/async.rx): the save succeeds, fails, is slow, two saves
// cross, a handler's write holds a loading question, a group's value saves, a toggle in a toolbar saves. The fake
// server holds every save until the test answers it.
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

// Records every value `aria-pressed` takes, so a test can tell whether it ever showed a state it shouldn't have.
function recordPressed(element: HTMLElement): (string | null)[] {
  const seen: (string | null)[] = [];
  const observer = new MutationObserver(() => seen.push(element.getAttribute("aria-pressed")));
  observer.observe(element, { attributes: true, attributeFilter: ["aria-pressed"] });
  return seen;
}

// Mounted, with the settings loaded.
async function setup() {
  const mounted = mount(fixture);
  await answered();
  const toggle = (name: string) => mounted.getByRole("button", { name });
  const pressed = (name: string) => toggle(name).getAttribute("aria-pressed");
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, toggle, pressed, text };
}

test("optimistic save that succeeds: pressed at once, and stays pressed", async () => {
  const { toggle, pressed, text, user } = await setup();
  const seen = recordPressed(toggle("Bold"));
  await user.click(toggle("Bold"));
  expect(pressed("Bold")).toBe("true");
  expect(toggle("Bold").hasAttribute("data-pressed")).toBe(true);
  expect(text("bold-saving")).toBe("saving");
  expect(waiting()).toEqual([true]);
  release(true);
  await answered();
  expect(pressed("Bold")).toBe("true");
  expect(text("bold-saving")).toBe("");
  expect(seen).not.toContain("false");
});

test("optimistic save that fails: released again, with the error, and it can be pressed again", async () => {
  const { toggle, pressed, text, user } = await setup();
  await user.click(toggle("Bold"));
  expect(pressed("Bold")).toBe("true");
  refuse(true);
  await answered();
  expect(pressed("Bold")).toBe("false");
  expect(toggle("Bold").hasAttribute("data-pressed")).toBe(false);
  expect(text("bold-error")).toBe("failed");
  await user.click(toggle("Bold"));
  expect(pressed("Bold")).toBe("true");
  expect(text("bold-error")).toBe("");
  release(true);
  await answered();
  expect(pressed("Bold")).toBe("true");
});

test("two optimistic saves in flight, answered out of order: the last choice wins", async () => {
  const { toggle, pressed, text, user } = await setup();
  await user.click(toggle("Bold"));
  await user.click(toggle("Bold"));
  expect(pressed("Bold")).toBe("false");
  expect(waiting()).toEqual([true, false]);
  release(false);
  await answered();
  expect(pressed("Bold")).toBe("false");
  release(true);
  await answered();
  expect(pressed("Bold")).toBe("false");
  expect(text("bold")).toBe("off");
});

test("a save that isn't optimistic: the toggle shows the owner's state until it is saved", async () => {
  const { toggle, pressed, user } = await setup();
  await user.click(toggle("Italic"));
  expect(pressed("Italic")).toBe("false");
  release(true);
  await answered();
  expect(pressed("Italic")).toBe("true");
  await user.click(toggle("Italic"));
  refuse(false);
  await answered();
  expect(pressed("Italic")).toBe("true");
});

test("the plainest optimistic save (guess, save, write) succeeds and fails", async () => {
  const { toggle, pressed, user } = await setup();
  const seen = recordPressed(toggle("Plain"));
  await user.click(toggle("Plain"));
  expect(pressed("Plain")).toBe("true");
  release(true);
  await answered();
  expect(pressed("Plain")).toBe("true");
  expect(seen).not.toContain("false");
  await user.click(toggle("Plain"));
  expect(pressed("Plain")).toBe("false");
  refuse(false);
  await answered();
  expect(pressed("Plain")).toBe("true");
});

test("disabled while saving: takes focus back when re-enabled", async () => {
  const { toggle, pressed, user } = await setup();
  const pin = toggle("Pin") as HTMLButtonElement;
  pin.focus();
  await user.keyboard(" ");
  expect(pressed("Pin")).toBe("true");
  expect(pin.disabled).toBe(true);
  release(true);
  await answered();
  expect(pin.disabled).toBe(false);
  expect(document.activeElement).toBe(pin);
  await user.keyboard(" ");
  expect(pressed("Pin")).toBe("false");
  release(false);
  await answered();
});

test("a handler that writes what a loading question reads doesn't hold the toggle", async () => {
  const { toggle, pressed, text, user } = await setup();
  server.holdLoads = true;
  await user.click(toggle("Preview"));
  expect(pressed("Preview")).toBe("true");
  expect(text("preview")).toBe("off");
  await user.click(toggle("Preview"));
  expect(pressed("Preview")).toBe("false");
  await user.click(toggle("Preview"));
  expect(pressed("Preview")).toBe("true");
  releaseLoads();
  await answered();
  expect(pressed("Preview")).toBe("true");
  expect(text("preview")).toBe("on");
});

test("a toggle group whose value saves: optimistic, crossing saves, a failure", async () => {
  const { toggle, pressed, text, user } = await setup();
  await user.click(toggle("Center"));
  expect(pressed("Center")).toBe("true");
  expect(pressed("Left")).toBe("false");
  await user.click(toggle("Right"));
  expect(pressed("Right")).toBe("true");
  expect(pressed("Center")).toBe("false");
  expect(waiting()).toEqual([["center"], ["right"]]);
  release(["right"]);
  await answered();
  release(["center"]);
  await answered();
  expect(pressed("Right")).toBe("true");
  expect(text("align")).toBe("right");
  await user.click(toggle("Left"));
  expect(pressed("Left")).toBe("true");
  refuse(["left"]);
  await answered();
  expect(pressed("Left")).toBe("false");
  expect(pressed("Right")).toBe("true");
});

test("a toggle in a toolbar saves and stays an item of the toolbar", async () => {
  const { toggle, pressed, user } = await setup();
  const wrap = toggle("Wrap");
  expect(wrap.hasAttribute("data-bisque-item")).toBe(true);
  await user.click(wrap);
  expect(pressed("Wrap")).toBe("true");
  refuse(true);
  await answered();
  expect(pressed("Wrap")).toBe("false");
  await user.click(wrap);
  release(true);
  await answered();
  expect(pressed("Wrap")).toBe("true");
});

test("a group handler that writes what a loading question reads doesn't hold the group", async () => {
  const { toggle, pressed, text, user } = await setup();
  server.holdLoads = true;
  await user.click(toggle("Grid"));
  expect(pressed("Grid")).toBe("true");
  expect(pressed("List")).toBe("false");
  expect(text("layout")).toBe("list");
  await user.click(toggle("List"));
  expect(pressed("List")).toBe("true");
  expect(pressed("Grid")).toBe("false");
  releaseLoads();
  await answered();
  expect(pressed("List")).toBe("true");
  expect(text("layout")).toBe("list");
});
