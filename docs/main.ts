// The docs site's one entry. Every page is its own ReactiveScript program under ./pages, loaded on demand: the
// URL's path picks the file. Links between pages are plain <a> elements, so each navigation is a page load.
import { createApp } from "@reactivescript/runtime";
import { pagePath, syncThemeColor } from "./lib/impl/site.ts";
// oxlint-disable-next-line import/no-unassigned-import -- a stylesheet is imported for its effect
import "./site.css";

// Demo stylesheets are plain CSS, each scoped by its demo's root class.
import.meta.glob("./demos/**/*.css", { eager: true });

type Page = { default: (app: unknown) => unknown };
const pages = import.meta.glob<Page>("./pages/**/*.rx");

// The date and time parts use the global Temporal, which the library doesn't polyfill. Safari 27.2 lacks it, so
// the site loads one there (and only there: it is a separate chunk) before any page runs. The full build carries
// the non-ISO calendars the calendar demos use.
if (globalThis.Temporal === undefined) {
  // oxlint-disable-next-line import/no-unassigned-import -- the polyfill is loaded for its effect
  await import("temporal-polyfill/full/global");
}

syncThemeColor();
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", syncThemeColor);
const path = pagePath();
const load = pages[`./pages/${path === "" ? "index" : path}.rx`] ?? pages["./pages/not-found.rx"];
const page = await load();
const app = createApp({ root: document.getElementById("app")! });
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a compiled `.rx` page has no TypeScript type here
app.mount(page.default(app) as never);
