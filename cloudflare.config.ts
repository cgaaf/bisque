// The docs site on Cloudflare: `pnpm deploy:docs` builds dist/docs and uploads it as an assets-only Worker
// (no server code, so it runs on the free plan). Read by the `cf` CLI; a plain object, so the repo needs no
// `cf` dependency to hold it.
export default {
  worker: {
    name: "bisque-ui-docs",
    compatibilityDate: "2026-11-18",
    domains: ["bisque-ui.dev"],
    assets: {
      // The build writes a page's index.html into a folder per route, and the site links to `route/`.
      htmlHandling: "auto-trailing-slash",
      // The build copies the entry to 404.html, so an unknown path still gets the site and its not-found page.
      notFoundHandling: "404-page",
    },
  },
};
