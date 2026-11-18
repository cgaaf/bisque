// Splitters beside app actions still waiting for their server (fixtures/held.rx). `onSizesCommit` commonly saves a
// layout: while that save is out, the keys and a drag must still resize. And where a prop or attribute of a
// splitter is computed from a write an app action holds, the splitter's own state must still follow the user.
// Drags are dispatched pointer events, as in splitter.browser.test.ts.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, release, releaseAll, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

function firePointer(target: Element | Document, type: string, x: number, y: number) {
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

/** Presses `handle`, moves the pointer `dx` pixels in two steps, and checks the drag shows while it lasts. */
async function drag(handle: HTMLElement, root: HTMLElement, dx: number) {
  const box = handle.getBoundingClientRect();
  const x = box.left + box.width / 2;
  const y = box.top + box.height / 2;
  firePointer(handle, "pointerdown", x, y);
  await frame();
  await answered();
  await expect.poll(() => root.hasAttribute("data-dragging")).toBe(true);
  firePointer(document, "pointermove", x + dx / 2, y);
  await frame();
  firePointer(document, "pointermove", x + dx, y);
  await frame();
  await answered();
  firePointer(document, "pointerup", x + dx, y);
  await frame();
  await expect.poll(() => root.hasAttribute("data-dragging")).toBe(false);
}

test("while onSizesCommit's save is out, the keys and a drag still resize, four times in a row", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  await frame();
  const handle = getByRole("separator", { name: "Commit" });
  handle.focus();
  await user.keyboard("{ArrowRight}");
  await answered();
  expect(waiting()).toEqual(["layout"]);
  expect(handle.getAttribute("aria-valuenow")).toBe("60");
  await user.keyboard("{ArrowRight}");
  await answered();
  expect(handle.getAttribute("aria-valuenow")).toBe("70");
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe("60");
  await user.keyboard("{ArrowLeft}");
  await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe("50");
  await drag(handle, getByTestId("commit"), 40);
  await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe("60");
  releaseAll();
  await answered();
  releaseAll();
  await answered();
  await expect.poll(() => getByTestId("saved").textContent).toBe("60,40");
  expect(handle.getAttribute("aria-valuenow")).toBe("60");
});

test("controlled: while the commit's save is out, the keys and a drag still resize through the owner", async () => {
  const { getByRole, getByTestId, user } = mount(held);
  await frame();
  const handle = getByRole("separator", { name: "Controlled" });
  handle.focus();
  await user.keyboard("{ArrowRight}");
  await answered();
  expect(waiting()).toEqual(["controlled"]);
  expect(getByTestId("layout").textContent).toBe("60,40");
  await user.keyboard("{ArrowRight}");
  await expect.poll(() => getByTestId("layout").textContent).toBe("70,30");
  expect(handle.getAttribute("aria-valuenow")).toBe("70");
  await user.keyboard("{ArrowLeft}{ArrowLeft}");
  await expect.poll(() => getByTestId("layout").textContent).toBe("50,50");
  await drag(handle, getByTestId("controlled"), -40);
  await expect.poll(() => getByTestId("layout").textContent).toBe("40,60");
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
  releaseAll();
  await answered();
  expect(handle.getAttribute("aria-valuenow")).toBe("40");
});

// The values after one arrow, two arrows and a drag 80px (20%) back. The root prop is `keyboardStep`, 10 before the
// app's write and 20 after it: read through `latest`, the splitter already steps by 20 while the write is held.
const cases = [
  ["a prop of the root", "root-prop", "Root prop", ["70", "90", "70"]],
  ["a prop of a panel", "panel-prop", "Panel prop", ["60", "70", "50"]],
  ["an attribute of the handle", "handle-attribute", "Handle attribute", ["60", "70", "50"]],
  ["an attribute of the root", "root-attribute", "Root attribute", ["60", "70", "50"]],
] as const;

async function hold(mounted: ReturnType<typeof mount>) {
  await mounted.user.click(mounted.getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  expect(mounted.getByTestId("step").textContent).toBe("1");
}

for (const [what, id, label, [one, two, dragged]] of cases) {
  test(`the keys and a drag resize while an app action holds ${what}`, async () => {
    const mounted = mount(held);
    await frame();
    const handle = mounted.getByRole("separator", { name: label });
    await hold(mounted);
    handle.focus();
    await mounted.user.keyboard("{ArrowRight}");
    await answered();
    expect(handle.getAttribute("aria-valuenow")).toBe(one);
    await mounted.user.keyboard("{ArrowRight}");
    await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe(two);
    await drag(handle, mounted.getByTestId(id), -80);
    await expect.poll(() => handle.getAttribute("aria-valuenow")).toBe(dragged);
    release("step");
    await answered();
    expect(mounted.getByTestId("step").textContent).toBe("2");
    expect(handle.getAttribute("aria-valuenow")).toBe(dragged);
  });
}
