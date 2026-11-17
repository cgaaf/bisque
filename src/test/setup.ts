import { afterEach } from "vitest";
import { cleanup } from "./mount.ts";

// jsdom has no layout, so it leaves these out. Positioning code only needs them to exist.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}
globalThis.ResizeObserver ??= NoopObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver ??= NoopObserver as unknown as typeof IntersectionObserver;

afterEach(cleanup);
