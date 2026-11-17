// Sliders whose value is saved to a server (fixtures/async.rx): the app saves what is committed, the save
// succeeds, fails, is slow, saves cross, the slider is dragged while one is out. The fake server holds every save
// until the test answers it. Drags are dispatched pointer events, in all three engines: what is under test is
// what the slider does with them, and a real drag can't be paused halfway to look.
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
  const thumb = (name: string) => mounted.getByRole("slider", { name }) as HTMLInputElement;
  const now = (name: string) => thumb(name).getAttribute("aria-valuenow");
  const text = (id: string) => mounted.getByTestId(id).textContent;
  return { ...mounted, thumb, now, text };
}

function firePointer(type: string, x: number, y: number) {
  const target = document.elementFromPoint(x, y) ?? document.documentElement;
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      isPrimary: true,
      button: 0,
      buttons: type === "pointerup" ? 0 : 1,
      pointerType: "mouse",
      clientX: x,
      clientY: y,
    }),
  );
}

// A pointer on `control`, at a fraction of its width.
function pointerOn(control: HTMLElement) {
  const at = (fraction: number) => {
    const box = control.getBoundingClientRect();
    return [box.left + box.width * fraction, box.top + box.height / 2] as const;
  };
  return {
    async down(fraction: number) {
      firePointer("pointerdown", ...at(fraction));
      await frame();
    },
    async move(fraction: number) {
      firePointer("pointermove", ...at(fraction));
      await frame();
    },
    async up(fraction: number) {
      firePointer("pointerup", ...at(fraction));
      await frame();
    },
  };
}

test("a slider that saves only what is committed follows the drag, and saves once on release", async () => {
  const { getByTestId, now, text } = await setup();
  const pointer = pointerOn(getByTestId("volume-control"));
  await pointer.down(0.2);
  expect(now("Volume")).toBe("20");
  await pointer.move(0.3);
  expect(now("Volume")).toBe("30");
  // The owner's value is untouched until the commit, and nothing has been sent.
  expect(text("volume")).toBe("50");
  expect(waiting()).toEqual([]);
  await pointer.up(0.3);
  expect(waiting()).toEqual([30]);
  expect(now("Volume")).toBe("30");
  expect(text("volume")).toBe("30");
  expect(text("volume-saving")).toBe("saving");
  release(30);
  await answered();
  expect(now("Volume")).toBe("30");
  expect(text("volume-saving")).toBe("");
});

test("an optimistic save that fails: the thumb goes back, and the slider takes keys again", async () => {
  const { thumb, now, text, user } = await setup();
  thumb("Volume").focus();
  await user.keyboard("{ArrowRight}");
  expect(now("Volume")).toBe("51");
  refuse(51);
  await answered();
  expect(now("Volume")).toBe("50");
  expect(text("volume")).toBe("50");
  expect(text("volume-error")).toBe("failed");
  await user.keyboard("{ArrowRight}");
  expect(now("Volume")).toBe("51");
  expect(text("volume-error")).toBe("");
  release(51);
  await answered();
  expect(now("Volume")).toBe("51");
});

test("two committed saves answered out of order: the last choice wins", async () => {
  const { thumb, now, user } = await setup();
  thumb("Volume").focus();
  await user.keyboard("{ArrowRight}{ArrowRight}");
  // Each key went on from what the slider shows, not from the owner's value.
  expect(now("Volume")).toBe("52");
  expect(waiting()).toEqual([51, 52]);
  release(52);
  await answered();
  expect(now("Volume")).toBe("52");
  release(51);
  await answered();
  expect(now("Volume")).toBe("52");
});

test("dragged while a save is out: the thumb follows the pointer, and the drag's value wins", async () => {
  const { getByTestId, thumb, now, user } = await setup();
  thumb("Volume").focus();
  await user.keyboard("{ArrowRight}");
  const pointer = pointerOn(getByTestId("volume-control"));
  await pointer.down(0.7);
  await pointer.move(0.8);
  expect(now("Volume")).toBe("80");
  release(51);
  await answered();
  // The first save's answer lands mid-drag and doesn't move the thumb.
  expect(now("Volume")).toBe("80");
  await pointer.up(0.8);
  expect(waiting()).toEqual([80]);
  release(80);
  await answered();
  expect(now("Volume")).toBe("80");
});

test("a save that isn't optimistic: the slider shows the owner's value, and ends on it", async () => {
  const { thumb, now, text, user } = await setup();
  thumb("Brightness").focus();
  await user.keyboard("{ArrowRight}");
  await frame();
  // The owner hasn't taken 51 yet: the thumb shows its 50 until it does.
  expect(now("Brightness")).toBe("50");
  expect(waiting()).toEqual([51]);
  release(51);
  await answered();
  expect(text("brightness")).toBe("51");
  expect(now("Brightness")).toBe("51");
  // A save that fails: the slider stays on what the owner has.
  await user.keyboard("{ArrowRight}");
  await frame();
  expect(now("Brightness")).toBe("51");
  refuse(52);
  await answered();
  expect(now("Brightness")).toBe("51");
  expect(text("brightness-error")).toBe("failed");
});

test("an optimistic save shows the new value without going back to the old one on the way", async () => {
  const { thumb, now, user } = await setup();
  const volume = thumb("Volume");
  const shown: (string | null)[] = [];
  const observer = new MutationObserver(() => shown.push(volume.getAttribute("aria-valuenow")));
  observer.observe(volume, { attributes: true, attributeFilter: ["aria-valuenow"] });
  volume.focus();
  await user.keyboard("{ArrowRight}");
  await frame();
  expect(now("Volume")).toBe("51");
  release(51);
  await answered();
  observer.disconnect();
  expect(now("Volume")).toBe("51");
  expect(shown).not.toContain("50");
});

test("the plainest optimistic save (guess, save, write) succeeds and fails", async () => {
  const { thumb, now, user } = await setup();
  thumb("Contrast").focus();
  await user.keyboard("{ArrowLeft}");
  expect(now("Contrast")).toBe("49");
  release(49);
  await answered();
  expect(now("Contrast")).toBe("49");
  await user.keyboard("{ArrowLeft}");
  expect(now("Contrast")).toBe("48");
  refuse(48);
  await answered();
  expect(now("Contrast")).toBe("49");
});

test("disabled while saving: the thumb takes focus back and keys work again", async () => {
  const { thumb, now, user } = await setup();
  const warmth = thumb("Warmth");
  warmth.focus();
  await user.keyboard("{ArrowRight}");
  expect(now("Warmth")).toBe("51");
  expect(warmth.disabled).toBe(true);
  release(51);
  await answered();
  expect(warmth.disabled).toBe(false);
  expect(document.activeElement).toBe(warmth);
  await user.keyboard("{ArrowRight}");
  expect(now("Warmth")).toBe("52");
  release(52);
  await answered();
});

test("an app that follows every change but saves on commit sends one save per drag", async () => {
  const { getByTestId, now, text } = await setup();
  const pointer = pointerOn(getByTestId("balance-control"));
  await pointer.down(0.2);
  await pointer.move(0.25);
  await pointer.move(0.3);
  expect(text("balance")).toBe("30");
  expect(now("Balance")).toBe("30");
  await pointer.up(0.3);
  expect(waiting()).toEqual([30]);
  release(30);
  await answered();
  expect(now("Balance")).toBe("30");
});

test("a handler that writes what a loading question reads doesn't hold the slider", async () => {
  const { thumb, now, text, user } = await setup();
  server.holdLoads = true;
  thumb("Preview").focus();
  await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
  expect(now("Preview")).toBe("53");
  expect(text("preview-value")).toBe("53");
  expect(text("preview")).toBe("50");
  releaseLoads();
  await answered();
  expect(now("Preview")).toBe("53");
  expect(text("preview")).toBe("53");
});
