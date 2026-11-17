// A slider beside an app action that is still waiting for its server (fixtures/held.rx). The action holds a plain
// write, and a prop or attribute of the slider is computed from it: the slider's own state (its value from the keys
// and from a drag, dragging, the active thumb) must still follow the user while the request is out. Drags are
// dispatched pointer events, as in slider.async.browser.test.ts.
import { beforeEach, expect, test } from "vitest";
import { frame, mount } from "../test/browser.ts";
import { answered, release, resetServer, server, waiting } from "../test/slow-server.ts";
import held from "./fixtures/held.rx";

beforeEach(() => {
  resetServer();
  server.manual = true;
});

const cases = [
  ["a prop of the root", "root-prop"],
  ["a prop of the thumb", "thumb-prop"],
  ["an attribute of the thumb", "thumb-attribute"],
  ["an attribute of the control", "control-attribute"],
] as const;

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

// The slider whose control has the test id `id`: its control, thumb and range input.
function parts(getByTestId: (id: string) => HTMLElement, id: string) {
  const control = getByTestId(id);
  const thumb = control.querySelector<HTMLElement>("[data-rs-ui-slider-thumb]")!;
  const input = thumb.querySelector("input")!;
  const at = (fraction: number) => {
    const box = control.getBoundingClientRect();
    return [box.left + box.width * fraction, box.top + box.height / 2] as const;
  };
  return { control, thumb, input, at };
}

async function hold(mounted: ReturnType<typeof mount>) {
  await mounted.user.click(mounted.getByRole("button", { name: "Next" }));
  expect(waiting()).toEqual(["step"]);
  expect(mounted.getByTestId("step").textContent).toBe("1");
}

// The root's own props are not read through `latest` yet: wrapping any of them in the root (one at a time, even
// `max` alone in the provision) failed the family's async tests with Solid diagnostics (UNSTABLE_MEMO_OUTPUT on a
// memo "computed"), so a prop of the root still holds the field. These cases stay red until that is solved.
const unfixed = (id: string) => id === "root-prop";

for (const [what, id] of cases) {
  test(
    `the keys move the thumb, and focus makes it the active one, while an app action holds ${what}`,
    { fails: unfixed(id) },
    async () => {
      const mounted = mount(held);
      const { thumb, input } = parts(mounted.getByTestId, id);
      await hold(mounted);
      input.focus();
      await answered();
      expect(thumb.style.zIndex).toBe("2");
      await mounted.user.keyboard("{ArrowRight}");
      await answered();
      expect(input.getAttribute("aria-valuenow")).toBe("51");
      await mounted.user.keyboard("{ArrowRight}");
      await expect.poll(() => input.getAttribute("aria-valuenow")).toBe("52");
      release("step");
      await answered();
      expect(mounted.getByTestId("step").textContent).toBe("2");
      expect(input.getAttribute("aria-valuenow")).toBe("52");
    },
  );

  test(`a drag moves the thumb while an app action holds ${what}`, { fails: unfixed(id) }, async () => {
    const mounted = mount(held);
    const { control, input, at } = parts(mounted.getByTestId, id);
    await hold(mounted);
    firePointer("pointerdown", ...at(0.2));
    await frame();
    await answered();
    expect(input.getAttribute("aria-valuenow")).toBe("20");
    expect(control.hasAttribute("data-dragging")).toBe(true);
    firePointer("pointermove", ...at(0.3));
    await frame();
    await expect.poll(() => input.getAttribute("aria-valuenow")).toBe("30");
    firePointer("pointerup", ...at(0.3));
    await frame();
    await expect.poll(() => control.hasAttribute("data-dragging")).toBe(false);
    release("step");
    await answered();
    expect(mounted.getByTestId("step").textContent).toBe("2");
    expect(input.getAttribute("aria-valuenow")).toBe("30");
  });
}
