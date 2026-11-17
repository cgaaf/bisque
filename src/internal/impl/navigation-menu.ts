// Behaviour of the navigation menu that needs the DOM: which way the active item moved, and the shared popup's size
// following the content shown in its viewport. `../navigation-menu.d.rx` declares how `.rx` may call these.
import { createEffect, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

/** Marks a viewport's content element; the one shown carries `data-open` too. */
const CONTENT = "data-rs-ui-navigation-content";

/**
 * The direction from the item at `from` to the item at `to`, for `data-activation-direction`: by document order,
 * so "right" (or "down" when vertical) when `to` comes later. Undefined without both.
 */
export function activationDirection(
  from: MaybeElement,
  to: MaybeElement,
  orientation: "horizontal" | "vertical",
): "left" | "right" | "up" | "down" | undefined {
  if (!from || !to || from === to) return undefined;
  const later = (from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
  if (orientation === "vertical") return later ? "down" : "up";
  return later ? "right" : "left";
}

/** Whether `target` (an event's related target) is inside one of `elements`. */
export function containsTarget(elements: MaybeElement[], target: EventTarget | null): boolean {
  return target instanceof Node && elements.some((element) => element?.contains(target));
}

/**
 * While `active`, sizes the popup to the content its viewport shows: writes `--popup-width` and `--popup-height`
 * on `popup` and `--positioner-width` and `--positioner-height` on `positioner`, in pixels, from the shown
 * content's size, and again whenever the shown content changes or resizes. A stylesheet animates between items'
 * sizes by transitioning `width: var(--popup-width)`.
 */
export function createViewportSize(
  active: Accessor<boolean>,
  popup: Accessor<MaybeElement>,
  positioner: Accessor<MaybeElement>,
  viewport: Accessor<MaybeElement>,
): void {
  createEffect(
    () => (active() ? ([popup(), positioner(), viewport()] as const) : undefined),
    (input) => {
      if (!input) return;
      const [popupEl, positionerEl, viewportEl] = input;
      if (!popupEl || !viewportEl) return;
      let observed: HTMLElement | undefined;
      const resize = typeof ResizeObserver === "function" ? new ResizeObserver(() => measure()) : undefined;
      function measure() {
        const shown = viewportEl!.querySelector<HTMLElement>(`[${CONTENT}][data-open]`);
        if (shown !== observed) {
          if (observed) resize?.unobserve(observed);
          if (shown) resize?.observe(shown);
          observed = shown ?? undefined;
        }
        if (!shown) return;
        const width = `${shown.offsetWidth}px`;
        const height = `${shown.offsetHeight}px`;
        popupEl!.style.setProperty("--popup-width", width);
        popupEl!.style.setProperty("--popup-height", height);
        positionerEl?.style.setProperty("--positioner-width", width);
        positionerEl?.style.setProperty("--positioner-height", height);
      }
      measure();
      const mutations = new MutationObserver(measure);
      mutations.observe(viewportEl, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ["data-open"],
      });
      return () => {
        mutations.disconnect();
        resize?.disconnect();
      };
    },
  );
}
