// Mounts an `.rx` fixture for a test. A fixture is an entry module: `export default component Fixture() { … }`,
// in the component's `fixtures/` folder, imported by the test as `import fixture from "./fixtures/basic.rx"`.
import { createApp, flush } from "@reactivescript/runtime";
import { getQueriesForElement, type BoundFunctions, type queries } from "@testing-library/dom";
import userEvent, { type UserEvent } from "@testing-library/user-event";

type Mounted = BoundFunctions<typeof queries> & {
  /** The element the fixture is rendered into. */
  container: HTMLElement;
  /** `@testing-library/user-event`, set up for this document. */
  user: UserEvent;
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
  // Queries cover the whole document, so content a part renders in a portal is found too.
  return { ...getQueriesForElement(document.body), container, user: userEvent.setup(), unmount };
}

/** Unmounts everything `mount` rendered. Runs after each test (`src/test/setup.ts`). */
export function cleanup(): void {
  for (const unmount of mounted) unmount();
}

/** Applies pending reactive updates now. `user` events are awaited, so most tests never need it. */
export { flush };
