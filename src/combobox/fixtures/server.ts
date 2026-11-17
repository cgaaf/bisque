// A stand-in for a server that searches a list of fruits, for the async fixtures of combobox, autocomplete and
// select. A test imports this same module and steers it through `server`: how long an answer takes, which queries
// fail, and, with `manual`, answers that wait until the test releases them, in whatever order it likes.
const FRUITS = [
  "Apple",
  "Apricot",
  "Banana",
  "Blackberry",
  "Blueberry",
  "Cherry",
  "Fig",
  "Grape",
  "Lemon",
  "Lime",
  "Mango",
  "Peach",
  "Pear",
  "Plum",
].map((label) => ({ value: label.toLowerCase(), label }));

type Fruit = { value: string; label: string; query: string };
type Waiting = { query: string; settle: () => void };

export const server: {
  delay: number;
  failing: string[];
  hide: string[];
  manual: boolean;
  calls: string[];
  waiting: Waiting[];
} = {
  // Milliseconds before an answer.
  delay: 0,
  // Queries whose request fails.
  failing: [],
  // Values left out of every answer.
  hide: [],
  // Answers wait for `release` instead of the delay.
  manual: false,
  // Every query asked, in order.
  calls: [],
  // Requests waiting for `release` (manual mode).
  waiting: [],
};

export function resetServer(): void {
  server.delay = 0;
  server.failing = [];
  server.hide = [];
  server.manual = false;
  server.calls = [];
  server.waiting = [];
}

const answer = (query: string): Fruit[] => {
  if (server.failing.includes(query)) throw new Error(`Search failed for "${query}"`);
  const q = query.trim().toLowerCase();
  // Each answer is new objects carrying the query, as a search API's rows carry their score or matched text: a
  // `for` over a new answer renders new options even for the values it already showed.
  return FRUITS.filter(
    (fruit) => fruit.label.toLowerCase().includes(q) && !server.hide.includes(fruit.value),
  ).map((fruit) => Object.assign({ query }, fruit));
};

const settle = (query: string, resolve: (fruits: Fruit[]) => void, reject: (error: unknown) => void) => {
  try {
    resolve(answer(query));
  } catch (error) {
    reject(error);
  }
};

/** The fruits whose name contains `query`. */
export function search(query: string): Promise<Fruit[]> {
  server.calls.push(query);
  return new Promise<Fruit[]>((resolve, reject) => {
    if (server.manual) server.waiting.push({ query, settle: () => settle(query, resolve, reject) });
    else setTimeout(() => settle(query, resolve, reject), server.delay);
  });
}

/** Every fruit: a list that loads once. */
export function loadAll(): Promise<Fruit[]> {
  return search("");
}

/** Answers the waiting request for `query` (the first one asked, if several). */
export function release(query: string): void {
  const index = server.waiting.findIndex((request) => request.query === query);
  if (index === -1)
    throw new Error(`No request waiting for "${query}": ${server.waiting.map((r) => r.query)}`);
  const [request] = server.waiting.splice(index, 1);
  request.settle();
}

/** Answers every waiting request, oldest first. */
export function releaseAll(): void {
  for (const request of server.waiting.splice(0)) request.settle();
}
