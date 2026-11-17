// What the docs' pages need from the browser and the build: the route, the navigation, demo sources and the
// generated API records (both loaded on demand), the page's headings, the theme and the clipboard.
import { createSignal, onCleanup, type Accessor } from "solid-js";
import { highlight } from "./highlight.ts";

const BASE = import.meta.env.BASE_URL;

/** The page's path without the site's base or slashes at its ends: "" for the home page. */
export function pagePath(): string {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : location.pathname;
  return path.replace(/^\/+|\/+$|\/index\.html$/g, "");
}

/** The URL of a page of the site, from its path ("components/popover"). */
export function href(path: string): string {
  return path === "" ? BASE : `${BASE}${path}/`;
}

export type NavItem = { title: string; path: string; href: string; current: boolean };
export type NavGroup = { title: string; items: NavItem[] };

const COMPONENTS = [
  "accordion",
  "alert-dialog",
  "autocomplete",
  "avatar",
  "button",
  "checkbox",
  "checkbox-group",
  "collapsible",
  "combobox",
  "context-menu",
  "dialog",
  "drawer",
  "field",
  "fieldset",
  "form",
  "input",
  "menu",
  "menubar",
  "meter",
  "navigation-menu",
  "number-field",
  "popover",
  "preview-card",
  "progress",
  "radio",
  "scroll-area",
  "select",
  "separator",
  "slider",
  "switch",
  "tabs",
  "toast",
  "toggle",
  "toggle-group",
  "toolbar",
  "tooltip",
];

const titled = (slug: string) =>
  slug
    .split("-")
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");

const GROUPS: { title: string; pages: [title: string, path: string][] }[] = [
  {
    title: "Overview",
    pages: [
      ["Quick start", "overview/quick-start"],
      ["Platform first", "overview/platform-first"],
      ["Accessibility", "overview/accessibility"],
      ["About", "overview/about"],
    ],
  },
  {
    title: "Handbook",
    pages: [
      ["Styling", "handbook/styling"],
      ["Animation", "handbook/animation"],
      ["Composition", "handbook/composition"],
      ["Forms", "handbook/forms"],
    ],
  },
  { title: "Components", pages: COMPONENTS.map((slug) => [titled(slug), `components/${slug}`]) },
];

export function navigation(): NavGroup[] {
  const current = pagePath();
  return GROUPS.map((group) => ({
    title: group.title,
    items: group.pages.map(([title, path]) => ({ title, path, href: href(path), current: path === current })),
  }));
}

/** The pages before and after this one in the navigation's order. */
export function neighbours(): { previous: NavItem | undefined; next: NavItem | undefined } {
  const all = navigation().flatMap((group) => group.items);
  const index = all.findIndex((item) => item.current);
  return { previous: index > 0 ? all[index - 1] : undefined, next: index >= 0 ? all[index + 1] : all[0] };
}

const rawSources = import.meta.glob<string>("../../demos/**/*.{rx,css,txt}", {
  query: "?text",
  import: "default",
});

/** A value that is `initial` until `load` resolves. */
function lazy<T>(initial: T, load: (() => Promise<T>) | undefined): Accessor<T> {
  // Boxed: a signal given a function takes it for a computation.
  const [box, setBox] = createSignal({ value: initial });
  let live = true;
  onCleanup(() => {
    live = false;
  });
  void load?.().then((value) => {
    if (live) setBox({ value });
  });
  return () => box().value;
}

/** The text of a file under docs/demos ("popover/hero.rx"), "" until it has loaded. */
export function sourceOf(path: string): Accessor<string> {
  return lazy("", rawSources[`../../demos/${path}`]);
}

/** The same, highlighted as HTML. A `.txt` snippet is highlighted as the language its name ends with before it. */
export function highlightedSourceOf(path: string): Accessor<string> {
  const load = rawSources[`../../demos/${path}`];
  const name = path.replace(/\.txt$/, "");
  const lang = name.endsWith(".css") ? "css" : name.endsWith(".rx") ? "rx" : "text";
  return lazy("", load && (() => load().then((text) => highlight(text.trimEnd(), lang))));
}

type Api = { family: string; parts: unknown[] };
const apis = import.meta.glob<Api>("../../generated/api/*.json", { import: "default" });

/** A family's generated API record (scripts/gen-api.mjs); no parts until it has loaded. */
export function apiOf(family: string): Accessor<Api> {
  return lazy({ family, parts: [] }, apis[`../../generated/api/${family}.json`]);
}

export type Heading = { id: string; text: string; level: number };

const sameHeadings = (a: Heading[], b: Heading[]) =>
  a.length === b.length && a.every((heading, index) => heading.id === b[index].id);

/** The page's section headings (`h2[id]`, `h3[id]` inside the article), kept current as content arrives. */
export function headings(): Accessor<Heading[]> {
  const [found, setFound] = createSignal<Heading[]>([]);
  const scan = () => {
    // A demo's own headings (a popover's title) are not sections of the page.
    const sections = [...document.querySelectorAll<HTMLElement>("article h2[id], article h3[id]")].filter(
      (heading) => !heading.closest(".demo"),
    );
    const next = sections.map((heading) => ({
      id: heading.id,
      text: heading.textContent ?? "",
      level: heading.tagName === "H2" ? 2 : 3,
    }));
    if (!sameHeadings(found(), next)) setFound(next);
  };
  const observer = new MutationObserver(scan);
  queueMicrotask(() => {
    scan();
    observer.observe(document.body, { childList: true, subtree: true });
    // A link to a section of a page whose content arrived after the browser tried to scroll to it.
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
  });
  onCleanup(() => observer.disconnect());
  return found;
}

export function setTitle(title: string): void {
  document.title = `${title} · rs-ui`;
}

export function toggleTheme(): void {
  const rootElement = document.documentElement;
  const dark = rootElement.dataset.theme
    ? rootElement.dataset.theme === "dark"
    : matchMedia("(prefers-color-scheme: dark)").matches;
  rootElement.dataset.theme = dark ? "light" : "dark";
  try {
    localStorage.setItem("rs-ui-theme", rootElement.dataset.theme);
  } catch {
    // Storage can be unavailable (private mode); the theme then lasts for this page.
  }
}

export function copyText(text: string): void {
  void navigator.clipboard?.writeText(text);
}
