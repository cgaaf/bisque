// A stand-in for a server, for the fixtures that show a component against slow, failing and out-of-order requests
// (dialogs whose content loads, menus whose items load, toasts that follow a request). A fixture imports
// ./slow-server.js (declared for .rx by ./slow-server.d.rx); a test imports this module and steers it through
// `server`: how long an answer takes, which keys fail, and, with `manual`, answers that wait until the test releases
// them, in whatever order it likes.
type Waiting = { key: string; settle: () => void };

export const server: {
  delay: number;
  failing: string[];
  manual: boolean;
  calls: string[];
  waiting: Waiting[];
  lists: Record<string, string[]>;
} = {
  // Milliseconds before an answer.
  delay: 0,
  // Keys whose request fails.
  failing: [],
  // Answers wait for `release` instead of the delay.
  manual: false,
  // Every key asked, in order.
  calls: [],
  // Requests waiting for `release` (manual mode).
  waiting: [],
  // What `fetchList` answers for a key. Default: three items named after the key.
  lists: {},
};

export function resetServer(): void {
  server.delay = 0;
  server.failing = [];
  server.manual = false;
  server.calls = [];
  server.waiting = [];
  server.lists = {};
}

function ask<T>(key: string, answer: () => T): Promise<T> {
  server.calls.push(key);
  return new Promise<T>((resolve, reject) => {
    const settle = () => {
      if (server.failing.includes(key)) reject(new Error(`Request failed: ${key}`));
      else resolve(answer());
    };
    if (server.manual) server.waiting.push({ key, settle });
    else setTimeout(settle, server.delay);
  });
}

/** A line of text about `key`: "Details of <key>". */
export function fetchText(key: string): Promise<string> {
  return ask(key, () => `Details of ${key}`);
}

/** The items listed under `key`. */
export function fetchList(key: string): Promise<string[]> {
  return ask(key, () => [...(server.lists[key] ?? [`${key} one`, `${key} two`, `${key} three`])]);
}

/** Saves under `key`: answers `key` when it is accepted. */
export function save(key: string): Promise<string> {
  return ask(key, () => key);
}

/** Answers the waiting request for `key` (the first one asked, if several). */
export function release(key: string): void {
  const index = server.waiting.findIndex((request) => request.key === key);
  if (index === -1)
    throw new Error(`No request waiting for "${key}": ${server.waiting.map((r) => r.key).join(", ")}`);
  const [request] = server.waiting.splice(index, 1);
  request.settle();
}

/** Answers every waiting request, oldest first. */
export function releaseAll(): void {
  for (const request of server.waiting.splice(0)) request.settle();
}

/** The keys of the requests waiting for `release`, oldest first. */
export function waiting(): string[] {
  return server.waiting.map((request) => request.key);
}

/** Resolves once an answer has had time to reach the screen. */
export function answered(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

/**
 * Resolves after longer than a `loading` fallback must show for. Solid reports a fallback that appeared and vanished
 * within 150ms (`FALLBACK_FLASH`), which fails a browser test: wait for this before releasing an answer a fallback is
 * shown for, as a real server would take.
 */
export function held(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 160));
}
