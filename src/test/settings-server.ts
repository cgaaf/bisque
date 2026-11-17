// A stand-in for a server that stores settings, for the async fixtures of the form controls (switch, checkbox,
// radio, toggle, slider, number field, button). A fixture saves through `save`; a test imports this same module and
// steers it through `server`: how long a save takes, which values fail, and, with `manual`, saves that wait until
// the test answers them, in whatever order it likes.
type Waiting = { key: string; value: unknown; resolve: () => void; reject: () => void };
type Call = { key: string; value: unknown; refused: boolean };

export const server: {
  delay: number;
  failing: unknown[];
  manual: boolean;
  calls: unknown[];
  waiting: Waiting[];
  log: Call[];
  holdLoads: boolean;
  loads: (() => void)[];
  failingLoads: string[];
} = {
  // Milliseconds before an answer.
  delay: 0,
  // Values whose save fails.
  failing: [],
  // Saves wait for `release` or `refuse` instead of the delay.
  manual: false,
  // Every value sent, in order.
  calls: [],
  // Saves waiting for an answer (manual mode).
  waiting: [],
  // Every save, for what `load` answers.
  log: [],
  // Loads wait for `releaseLoads` instead of answering.
  holdLoads: false,
  // Loads waiting for `releaseLoads`.
  loads: [],
  // Keys whose load fails.
  failingLoads: [],
};

export function resetServer(): void {
  server.delay = 0;
  server.failing = [];
  server.manual = false;
  server.calls = [];
  server.waiting = [];
  server.log = [];
  server.holdLoads = false;
  server.loads = [];
  server.failingLoads = [];
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What the server holds for `key`: the last value sent to it whose save didn't fail. A server applies writes in
 * the order they arrive, which is the order they were sent; their answers can come back in any order.
 */
export function stored(key: string, fallback?: unknown): unknown {
  const last = server.log.findLast((call) => call.key === key && !call.refused);
  return last ? last.value : fallback;
}

/**
 * What the server holds for `key`, `fallback` if nothing was saved to it, after the delay (at once in manual mode:
 * only saves wait).
 */
export function load<T>(key: string, fallback: T): Promise<T> {
  return new Promise((resolve, reject) => {
    const answer = () =>
      server.failingLoads.includes(key)
        ? reject(new Error(`Couldn't load ${key}`))
        : resolve(stored(key, fallback) as T);
    if (server.holdLoads) server.loads.push(answer);
    else setTimeout(answer, server.manual ? 0 : server.delay);
  });
}

/** Stores `value` under `key` as if someone else had saved it: what the next `load` answers. */
export function put(key: string, value: unknown): void {
  server.log.push({ key, value, refused: false });
}

/** Answers every load waiting while `holdLoads` is set. */
export function releaseLoads(): void {
  for (const answer of server.loads.splice(0)) answer();
}

/** Stores `value` under `key`; resolves to it. Rejects, storing nothing, for a value in `server.failing`. */
export function save<T>(key: string, value: T): Promise<T> {
  server.calls.push(value);
  const call: Call = { key, value, refused: server.failing.some((v) => same(v, value)) };
  server.log.push(call);
  return new Promise<T>((resolve, reject) => {
    const fail = () => {
      call.refused = true;
      reject(new Error(`Couldn't save ${JSON.stringify(value)}`));
    };
    if (server.manual) server.waiting.push({ key, value, resolve: () => resolve(value), reject: fail });
    else setTimeout(() => (call.refused ? fail() : resolve(value)), server.delay);
  });
}

function take(value: unknown): Waiting {
  const index = server.waiting.findIndex((request) => same(request.value, value));
  if (index === -1)
    throw new Error(
      `No save waiting for ${JSON.stringify(value)}: ${server.waiting.map((r) => JSON.stringify(r.value)).join(", ")}`,
    );
  return server.waiting.splice(index, 1)[0];
}

/** Answers the waiting save of `value` (the first one sent, if several) with success. */
export function release(value: unknown): void {
  take(value).resolve();
}

/** Fails the waiting save of `value` (the first one sent, if several). */
export function refuse(value: unknown): void {
  take(value).reject();
}

/** The values of the saves waiting for an answer, oldest first. */
export function waiting(): unknown[] {
  return server.waiting.map((request) => request.value);
}

/** An answer reaches the screen a little after the save settles. */
export function answered(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

/**
 * Records every value the program writes to `element[property]` (a native input's `checked` or `value`), so a
 * test can tell whether the element ever showed a state it shouldn't have, however briefly.
 */
export function recordWrites(element: object, property: string): unknown[] {
  const writes: unknown[] = [];
  let proto: object | null = Object.getPrototypeOf(element);
  let descriptor: PropertyDescriptor | undefined;
  while (proto && !(descriptor = Object.getOwnPropertyDescriptor(proto, property)))
    proto = Object.getPrototypeOf(proto);
  if (!descriptor?.set || !descriptor.get) throw new Error(`${property} is not an accessor`);
  const { get, set } = descriptor;
  Object.defineProperty(element, property, {
    configurable: true,
    get() {
      return get.call(this);
    },
    set(value: unknown) {
      writes.push(value);
      set.call(this, value);
    },
  });
  return writes;
}
