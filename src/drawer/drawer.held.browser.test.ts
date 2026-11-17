// A drawer beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the drawer is computed from it: the drawer's own state (open or closed, and
// the swipe while it is dragged) must still follow the user while the request is out.
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { flush, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

afterEach(() => {
  vi.useRealTimers();
});

/** A touch drag that takes its time (100ms a point), so its speed never dismisses; returns the let-go. */
function slowDrag(target: Element, path: [number, number][]) {
  vi.useFakeTimers({ toFake: ["Date"] });
  const box = target.getBoundingClientRect();
  const at = (type: string, [x, y]: [number, number]) =>
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        pointerId: 1,
        button: 0,
        pointerType: "touch",
        clientX: box.left + x,
        clientY: box.top + y,
      }),
    );
  const [first, ...rest] = path;
  at("pointerdown", first);
  flush();
  for (const point of rest) {
    vi.advanceTimersByTime(100);
    at("pointermove", point);
    flush();
  }
  return (point: [number, number]) => {
    at("pointerup", point);
    flush();
  };
}

test("it opens and closes while an app action holds an attribute of the popup", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const popup = getByTestId<HTMLDialogElement>("popup-attribute");
  const trigger = getByRole("button", { name: "Popup attribute" });
  await user.click(getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
  await user.click(trigger);
  await answered();
  expect(popup.open).toBe(true);
  await user.click(getByRole("button", { name: "Close" }));
  await expect.poll(() => popup.open).toBe(false);
  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
  expect(popup.open).toBe(false);
});

test("a drag moves it while an app action holds an attribute of the popup", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  const popup = getByTestId<HTMLDialogElement>("popup-attribute");
  // Opened first, then the action started from inside: the drag is what is tested against the held change.
  await user.click(getByRole("button", { name: "Popup attribute" }));
  expect(popup.open).toBe(true);
  await user.click(getByRole("button", { name: "Next inside" }));
  expect(waiting()).toEqual(["step"]);
  expect(getByTestId("step").textContent).toBe("1");
  const letGo = slowDrag(getByTestId("popup-attribute-handle"), [
    [50, 10],
    [50, 40],
    [50, 70],
  ]);
  expect(popup.hasAttribute("data-swiping")).toBe(true);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("60px");
  letGo([50, 70]);
  expect(popup.hasAttribute("data-swiping")).toBe(false);
  expect(popup.style.getPropertyValue("--drawer-swipe-movement-y")).toBe("0px");
  expect(popup.open).toBe(true);
  release("step");
  await answered();
  expect(getByTestId("step").textContent).toBe("2");
  expect(popup.open).toBe(true);
});
