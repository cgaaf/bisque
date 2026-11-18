// A stand-in for a router in the link fixture: the page named by the URL's hash (`#page-3`), following
// `hashchange`. Link-based pagination reads its page from the URL like this.
import { createSignal, onCleanup, type Accessor } from "solid-js";

const read = (): number => Number(/^#page-(\d+)$/.exec(location.hash)?.[1] ?? 1);

export function createHashPage(): Accessor<number> {
  const [page, setPage] = createSignal(read());
  const update = () => setPage(read());
  window.addEventListener("hashchange", update);
  onCleanup(() => window.removeEventListener("hashchange", update));
  return page;
}
