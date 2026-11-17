// Keeping a native checkbox or radio showing the state its component decided, when the browser changes it first.
// `../checked-input.d.rx` declares how `.rx` may call it.
import { createEffect, untrack, type Accessor } from "solid-js";

type MaybeInput = HTMLInputElement | undefined;

/** Whether a `change` on `target` may have changed `input`: it is the input, or a radio of the same group. */
function touches(input: HTMLInputElement, target: EventTarget | null): boolean {
  if (target === input) return true;
  return (
    input.type === "radio" &&
    target instanceof HTMLInputElement &&
    target.type === "radio" &&
    target.name !== "" &&
    target.name === input.name &&
    target.form === input.form
  );
}

function show(input: HTMLInputElement, isChecked: boolean, isIndeterminate: boolean): void {
  if (input.checked !== isChecked) input.checked = isChecked;
  if (input.indeterminate !== isIndeterminate) input.indeterminate = isIndeterminate;
}

/**
 * Shows `checked` and `indeterminate` on a native checkbox or radio, and puts them back after the browser changes
 * the input on its own.
 *
 * A press toggles the input before any handler runs; the component then decides what it shows. That decision can
 * take more than one change: the component's own, then the owner's `onCheckedChange` in a change of its own, where
 * it may guess the new state (optimistic), write it, refuse it, or start a save and write it later. Writing the
 * state back in the component's change would show the old state for an instant before an optimistic owner's guess
 * lands. So the input is set back once, after the press's changes have all run (a microtask after `change`, before
 * the next paint), to whatever the state is then. A radio is set back after a change anywhere in its group: the
 * browser unchecked it without telling it.
 *
 * `revision` re-applies the state when it changes: after a form reset, which changes the inputs without a `change`.
 */
export function createCheckedInput(
  element: Accessor<MaybeInput>,
  checked: Accessor<boolean>,
  indeterminate: Accessor<boolean>,
  revision: Accessor<number>,
): void {
  createEffect(
    () => [element(), checked(), indeterminate(), revision()] as const,
    ([input, isChecked, isIndeterminate]) => {
      if (input) show(input, isChecked, isIndeterminate);
    },
  );
  createEffect(
    () => element(),
    (input) => {
      if (!input) return;
      const root = input.getRootNode() as Document | ShadowRoot;
      let queued = false;
      const changed = (event: Event) => {
        if (queued || !touches(input, event.target)) return;
        queued = true;
        queueMicrotask(() => {
          queued = false;
          show(input, untrack(checked), untrack(indeterminate));
        });
      };
      root.addEventListener("change", changed);
      return () => root.removeEventListener("change", changed);
    },
  );
}
