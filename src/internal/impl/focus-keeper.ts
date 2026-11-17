// Giving focus back to a control that was disabled while it had it. `../focus-keeper.d.rx` declares how `.rx` may
// call it.
import { createEffect, type Accessor } from "solid-js";

type MaybeElement = HTMLElement | undefined;

/** Whether focus is nowhere in particular: on the body, or on nothing. */
function unfocused(doc: Document): boolean {
  return doc.activeElement === null || doc.activeElement === doc.body;
}

/**
 * Focuses `element` again when it is re-enabled, if it had focus when it was disabled and focus hasn't gone
 * anywhere since. For a container that disables what is inside it (a <fieldset>), the element inside it that had
 * focus gets it back.
 *
 * A native control that becomes `disabled` loses focus, in all three engines, and focus falls to the body. That is
 * what happens to a control an app disables while its save is out (`disabled={pending? setting}`): the person who
 * just pressed it would have to find it again to carry on. Keeping it focusable instead (`aria-disabled`) would
 * give up `:disabled` and native form behaviour, so focus is given back when the save ends. `readOnly` avoids the
 * question: a read-only control keeps focus throughout.
 */
export function createFocusKeeper(element: Accessor<MaybeElement>, disabled: Accessor<boolean>): void {
  let lost: HTMLElement | undefined;
  // What inside the element last lost focus to nothing, and when: Chromium takes focus off an element inside a
  // <fieldset> as soon as the fieldset is disabled, before the effect below sees it.
  let dropped: { target: HTMLElement; at: number } | undefined;
  const out = (event: FocusEvent) => {
    dropped =
      event.relatedTarget === null && event.target instanceof HTMLElement
        ? { target: event.target, at: performance.now() }
        : undefined;
  };
  createEffect(
    () => element(),
    (el) => {
      if (!el) return;
      el.addEventListener("focusout", out);
      return () => el.removeEventListener("focusout", out);
    },
  );
  createEffect(
    () => [element(), disabled()] as const,
    ([el, isDisabled]) => {
      if (!el) return;
      const doc = el.ownerDocument;
      if (isDisabled) {
        // Checked before the browser moves focus off the disabled element, which it does at the next rendering.
        const active = doc.activeElement;
        const recent = dropped && performance.now() - dropped.at < 100 ? dropped.target : undefined;
        lost = active instanceof HTMLElement && el.contains(active) ? active : recent;
        dropped = undefined;
        return;
      }
      const target = lost;
      lost = undefined;
      if (target && el.contains(target) && unfocused(doc)) target.focus({ preventScroll: true });
    },
  );
}
