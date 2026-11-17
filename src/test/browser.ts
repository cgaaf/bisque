// Mounts an `.rx` fixture for a `*.browser.test.ts`, which runs in Chromium, Firefox and WebKit.
//
// The difference from ./mount.ts is `user`: here it is Vitest's, which drives the real browser, so its key
// presses and clicks are trusted events. Native behaviour (Escape closing a <dialog>, a popover's light dismiss,
// focus moving on Tab) only responds to those; synthetic events from a DOM library do nothing to it.
import { createApp, flush } from "@reactivescript/runtime";
import { getQueriesForElement, type BoundFunctions, type queries } from "@testing-library/dom";
import { afterEach } from "vitest";
import { userEvent } from "vitest/browser";

type Mounted = BoundFunctions<typeof queries> & {
  /** The element the fixture is rendered into. */
  container: HTMLElement;
  user: typeof userEvent;
  unmount: () => void;
};

const mounted = new Set<() => void>();

export function mount(fixture: (app: unknown) => () => unknown): Mounted {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ root: container });
  const dispose = app.mount(fixture(app)) as () => void;
  flush();
  const unmount = () => {
    mounted.delete(unmount);
    dispose();
    container.remove();
  };
  mounted.add(unmount);
  return { ...getQueriesForElement(document.body), container, user: userEvent, unmount };
}

afterEach(() => {
  for (const unmount of mounted) unmount();
});

/** Resolves after the browser has painted, so styles and top-layer changes have applied. */
export function frame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

export { flush };
