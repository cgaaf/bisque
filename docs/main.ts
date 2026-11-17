// The docs site's one entry. Every page is its own ReactiveScript program under ./pages, loaded on demand: the
// URL's path picks the file. Links between pages are plain <a> elements, so each navigation is a page load.
import { createApp } from "@reactivescript/runtime";
import { pagePath } from "./lib/impl/site.ts";
// oxlint-disable-next-line import/no-unassigned-import -- a stylesheet is imported for its effect
import "./site.css";

// Demo stylesheets are plain CSS, each scoped by its demo's root class.
import.meta.glob("./demos/**/*.css", { eager: true });

type Page = { default: (app: unknown) => unknown };
const pages = import.meta.glob<Page>("./pages/**/*.rx");

const path = pagePath();
const load = pages[`./pages/${path === "" ? "index" : path}.rx`] ?? pages["./pages/not-found.rx"];
const page = await load();
const app = createApp({ root: document.getElementById("app")! });
app.mount(page.default(app) as never);
