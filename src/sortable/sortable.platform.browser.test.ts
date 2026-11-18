// What the platform does for a sortable list, measured in each engine with real input. These are the facts the
// family's design rests on (see the header of ./sortable.rx); if one of them changes after a browser upgrade, the
// design needs another look.
import { afterEach, expect, test } from "vitest";
import { server, userEvent } from "vitest/browser";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));

function render(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

const cleanups: (() => void)[] = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) cleanup();
  document.body.replaceChildren();
  await userEvent.pointer({ keys: "[/MouseLeft]" }).catch(() => undefined);
});

function listen<K extends keyof DocumentEventMap>(type: K, listener: (event: DocumentEventMap[K]) => void) {
  document.addEventListener(type, listener);
  cleanups.push(() => document.removeEventListener(type, listener));
}

function center(element: Element) {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

// A real mouse drag: press, several moves, release.
async function mouseDrag(from: { x: number; y: number }, to: { x: number; y: number }, steps = 8) {
  const path = Array.from({ length: steps }, (_, i) => ({
    coords: {
      x: from.x + ((to.x - from.x) * (i + 1)) / steps,
      y: from.y + ((to.y - from.y) * (i + 1)) / steps,
    },
  }));
  await userEvent.pointer([{ coords: from }, { keys: "[MouseLeft>]" }, ...path, { keys: "[/MouseLeft]" }]);
}

test("pointer events and pointer capture follow a mouse drag from press to release", async () => {
  const host = render(
    `<div id="a" style="width:80px;height:40px;touch-action:none">A</div><div style="height:120px"></div>`,
  );
  const a = host.querySelector<HTMLElement>("#a")!;
  const seen: string[] = [];
  let captured = false;
  a.addEventListener("pointerdown", (event) => {
    a.setPointerCapture(event.pointerId);
    captured = a.hasPointerCapture(event.pointerId);
  });
  for (const type of ["pointermove", "pointerup", "pointercancel"])
    a.addEventListener(type, () => seen.push(type));
  const start = center(a);
  await mouseDrag(start, { x: start.x, y: start.y + 120 });
  expect(captured).toBe(true);
  // Every move reached the captured element, though the pointer left it.
  expect(seen.filter((type) => type === "pointermove").length).toBeGreaterThanOrEqual(6);
  expect(seen.at(-1)).toBe("pointerup");
  expect(seen).not.toContain("pointercancel");
});

// The HTML Drag and Drop API is in all three engines, but its drag is the browser's: once it starts, the page gets
// no more pointer events for that pointer, so a sortable built on it can't follow the pointer with its own code,
// only react to `dragover` on whatever is under it.
test("a native drag cancels the pointer: no pointermove reaches the page once dragstart has fired", async () => {
  const host = render(
    `<div id="a" draggable="true" style="width:80px;height:40px">A</div>` +
      `<div id="b" style="width:80px;height:80px;margin-top:40px">B</div>`,
  );
  const a = host.querySelector<HTMLElement>("#a")!;
  const b = host.querySelector<HTMLElement>("#b")!;
  const seen: string[] = [];
  let dragging = false;
  let movesDuringDrag = 0;
  a.addEventListener("dragstart", (event) => {
    dragging = true;
    event.dataTransfer?.setData("text/plain", "a");
    seen.push("dragstart");
  });
  a.addEventListener("dragend", () => {
    dragging = false;
    seen.push("dragend");
  });
  b.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (!seen.includes("dragover")) seen.push("dragover");
  });
  b.addEventListener("drop", (event) => {
    event.preventDefault();
    seen.push("drop");
  });
  listen("pointercancel", () => seen.push("pointercancel"));
  listen("pointermove", () => {
    if (dragging) movesDuringDrag += 1;
  });
  await mouseDrag(center(a), center(b), 10);
  await frame();
  // Every engine runs the native drag from mouse input and ends it with a drop on the target, and from dragstart on
  // the page sees no pointermove: Chromium and Firefox send pointercancel, WebKit just stops sending them.
  expect(seen.filter((type) => type !== "pointercancel")).toEqual([
    "dragstart",
    "dragover",
    "drop",
    "dragend",
  ]);
  expect(seen.includes("pointercancel")).toBe(server.browser !== "webkit");
  expect(movesDuringDrag).toBe(0);
});

test("moving the focused element with insertBefore blurs it, in every engine", async () => {
  const host = render(
    `<ul><li><button id="one">One</button></li><li><button id="two">Two</button></li></ul>`,
  );
  const list = host.querySelector("ul")!;
  const one = host.querySelector<HTMLElement>("#one")!;
  one.focus();
  expect(document.activeElement).toBe(one);
  // What a keyed list does when its first row moves to the end.
  list.append(one.parentElement!);
  expect(list.lastElementChild).toBe(one.parentElement);
  expect(document.activeElement).not.toBe(one);
});

test("moving the other rows past the focused one keeps its focus", async () => {
  const host = render(
    `<ul><li><button id="one">One</button></li><li><button id="two">Two</button></li></ul>`,
  );
  const list = host.querySelector("ul")!;
  const one = host.querySelector<HTMLElement>("#one")!;
  one.focus();
  list.prepend(host.querySelector("#two")!.parentElement!);
  expect(list.lastElementChild).toBe(one.parentElement);
  expect(document.activeElement).toBe(one);
});

// Only that one runs: how a transition behaves while the pointer drags was not measured.
test("same-document view transitions run in every engine", async () => {
  expect(typeof document.startViewTransition).toBe("function");
  const host = render(`<p id="p">Before</p>`);
  const transition = document.startViewTransition(() => {
    host.querySelector("#p")!.textContent = "After";
  });
  await transition.updateCallbackDone;
  expect(host.textContent).toBe("After");
  await transition.finished.catch(() => undefined);
});
