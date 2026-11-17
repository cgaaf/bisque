# Draft issues for solidjs/reactivescript

Four sections, each written to be posted alone. Nothing here has been posted. The notes for the owner are at the
end and are not part of any issue.

---

## Issue A (bug)

**Title:** A JS import named like a prelude function (`fetch`, `map`, `filter`, `len`, `str`, `sum`, `every`, `indexOf`, `fail`, `log`) is bound to `__B.<name>`, not to the import

`@reactivescript/compiler` 0.3.1, through `@solidjs/vite-plugin` 3.0.0-next.57 (`vite` dev server, `plugins: [solid()]`),
mounted with `createApp` from `@reactivescript/runtime` 0.3.1, in Chromium.

`lib.js`:

```js
export const fetch = (key) => "lib.js got " + key;
```

`a.rx`:

```rx
import { fetch } from "./lib.js"

export default component App() {
  source out := "-"
  <div>
    <button onClick={() => { out := fetch("x") }}>go</button>
    <p>{out}</p>
  </div>
}
```

It compiles with no diagnostic. After a click the paragraph shows

```
{"key":"x","first":{},"queue":[],"waiters":[],"started":false}
```

Expected: `lib.js got x`. `guide/language.md`, "Imperative code": "anything else from JS comes in through an
import from a `.js` module." CP-4c (`spec/11-compiler.md`) lists `B.fetch` and `B.fail` as the scenario prelude:
"Compiled code calls them only in a conformance build".

The generated module has no import from `lib.js`. It binds the name to the prelude:

```js
const v$fetch = __B.fetch;
```

The same happens with:

- an alias: `import { fetch as get } from "./lib.js"` emits `const v$get = __B.fetch`;
- a declaration beside the module: `lib.d.rx` containing `export fn fetch(key: string): string` is accepted and
  changes nothing;
- each of the other nine names: the generated code binds every one to `__B.<name>`. Of those I ran only `fail`,
  where the call throws the prelude's panic.

In `compiler/src/emit.rs` on main (eab7356, read, not built) two places exclude these names for a JS import: line
361 filters them out of the emitted `import` list (`!builtin(&n.name) && n.name != "log"`), and line 679 chooses
the binding (`self.js_import(from) && !builtin(name) && name != "log"`), which falls through to the `__B` branch.

Not tested: an import of one of these names from another `.rx` module.

---

## Issue B (bug)

**Title:** An unread equation over two sources makes a write to one wait for an action that holds the other (E-3 against CP-4b's `createMemo`)

`@reactivescript/compiler` 0.3.1 through `@solidjs/vite-plugin` 3.0.0-next.57 on a Vite dev server, mounted with
`const app = createApp({ root }); app.mount(main(app))` from `@reactivescript/runtime` 0.3.1, in Chromium, on
`solid-js` 2.0.0-rc.22 and on 2.0.0. A Playwright script clicks the buttons and reads the text of the `<p>`
elements.

`api.js`:

```js
export const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
```

`b.rx`:

```rx
import { wait } from "./api.js"

export default component App() {
  source open := true
  source page := 1
  both = { open: open, page: page }
  action go() {
    page := 2
    try { await wait(300, 0) } catch (e) { }
  }
  <div>
    <button onClick={() => { go() }}>go</button>
    <button onClick={() => { open := false }}>close</button>
    <p>open: {open ? "yes" : "no"}</p>
    <p>page: {page}</p>
  </div>
}
```

| step              | `b.rx`                 | `b.rx` without the `both` line |
| ----------------- | ---------------------- | ------------------------------ |
| mount             | `open: yes`, `page: 1` | `open: yes`, `page: 1`         |
| click go          | `open: yes`, `page: 1` | `open: yes`, `page: 1`         |
| click close       | `open: yes`, `page: 1` | `open: no`, `page: 1`          |
| 100 ms later      | `open: yes`, `page: 1` | `open: no`, `page: 1`          |
| the wait resolves | `open: no`, `page: 2`  | `open: no`, `page: 2`          |

Expected: the right-hand column for both. Nothing reaches `both`: no reader, no effect, no other equation.

- E-3 (`spec/02-core.md`): "An equation's body is evaluated only when a reader, an effect's compute half, or
  another demanded equation reaches it in the current instant. Unreached equations have no observable cost or
  effect."
- V-4 (`spec/00-vocabulary.md`): "An equation counts only through the readers that reach it; an effect, a
  snapshot read (V-11), or an unread equation is never a reader."
- H-3 (`spec/05-holds.md`) makes a join a reader's: "a reader that consumes a value derived from `c`'s held
  writes, or a landed answer of `c`, **joins** `c`".
- `guide/language.md`, "Declarations": "Equations are lazy and exact".

The compiler does what CP-4b (`spec/11-compiler.md`) pins: `memo(name, fn, opts)` lowers "an equation (E-1)" over
`createMemo`, and the runtime's `memo` is `createMemo(named(name, fn), opts2)`. That memo is eager, so the conflict
is between E-3 and CP-4b. `ref/compile/rt.ts` has the same `createMemo` call; I did not run `ref/`.

The page below is the same program on `solid-js` alone, with the same clicks. As written it gives the left-hand
column. With `?lazy` in the URL it gives the right-hand column.

```html
<!doctype html> <button>go</button><button>close</button>
<p></p>
<p></p>
<script type="module">
  import { createRoot, createSignal, createMemo, createRenderEffect, action } from "solid-js";
  const lazy = new URLSearchParams(location.search).has("lazy");
  const [go, close] = document.querySelectorAll("button");
  const [openText, pageText] = document.querySelectorAll("p");
  createRoot(() => {
    const [open, setOpen] = createSignal(true);
    const [page, setPage] = createSignal(1);
    createMemo(() => ({ open: open(), page: page() }), lazy ? { lazy: true } : undefined); // never read
    const run = action(function* () {
      setPage(2);
      yield new Promise((r) => setTimeout(r, 300));
    });
    go.onclick = () => run();
    close.onclick = () => setOpen(false);
    createRenderEffect(open, (v) => {
      openText.textContent = "open: " + (v ? "yes" : "no");
    });
    createRenderEffect(page, (v) => {
      pageText.textContent = "page: " + v;
    });
  });
</script>
```

(Served by the same Vite server, which resolves the `solid-js` import.)

Not tested: what else changes if an equation is emitted with `{ lazy: true }`. Solid's cheatsheet says a lazy memo
will "autodispose when unobserved", and `spec/02-core.md` already records one lazy-memo divergence, for `pre`.

---

## Issue C (guide)

**Title:** guide: a write waits for an action when a displayed equation reads its source together with a source the action holds, from `onFlush` too

The guide shipped in `@reactivescript/compiler` 0.3.1. Run as: compiler 0.3.1 through `@solidjs/vite-plugin`
3.0.0-next.57 on a Vite dev server, mounted with `const app = createApp({ root }); app.mount(main(app))` from
`@reactivescript/runtime` 0.3.1, in Chromium, on `solid-js` 2.0.0-rc.22 and on 2.0.0. A Playwright script clicks
the buttons and reads the text of the `<p>` elements.

`api.js`:

```js
export const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
```

`b-shown.rx`:

```rx
import { wait } from "./api.js"

export default component App() {
  source open := true
  source page := 1
  both = { open: open, page: page }
  action go() {
    page := 2
    try { await wait(300, 0) } catch (e) { }
  }
  <div>
    <button onClick={() => { go() }}>go</button>
    <button onClick={() => { open := false }}>close</button>
    <p>open: {open ? "yes" : "no"}</p>
    <p>page: {page}</p>
    <p>both.open: {both.open ? "yes" : "no"}</p>
  </div>
}
```

| step              | screen                                   |
| ----------------- | ---------------------------------------- |
| mount             | `open: yes`, `page: 1`, `both.open: yes` |
| click go          | `open: yes`, `page: 1`, `both.open: yes` |
| click close       | `open: yes`, `page: 1`, `both.open: yes` |
| 100 ms later      | `open: yes`, `page: 1`, `both.open: yes` |
| the wait resolves | `open: no`, `page: 2`, `both.open: no`   |

The first paragraph reads `open` alone and waits with the third. The action never writes `open`. With the close
button removed and `onFlush(() => { open := false })` added after `page := 2` in `go`, the screen is the same at
every step: the `onFlush` write waits too.

This is H-3 (`both` is derived from the held `page`, and its reader joins), and S-solid-4's `sum` variant is the
nearest scenario, there with a flight in place of an action's write.

The guide gives two cases and two remedies, and `b-shown.rx` is neither case and gets no help from either remedy:

- `guide/async.md` §4: "**A click waits for an action it has nothing to do with.** A plain write to a source an
  action in flight has written or guessed joins that action's hold (H-2): a click that clears the action's error
  waits for the server. Keep such a write off the action's sources, or make it an `onFlush` run."
- `guide/async.md` §3, the table: "Land a UI write now and keep it (close a menu, clear a message) |
  `onFlush(() => { x := v })` (EF-8)".
- `guide/reference.md`, "Actions": "`onFlush(() => { … })`: runs right after this run's instant, even while the
  action holds it. Use it for a write that must land now, such as clearing an input or an error (EF-8)."

One view expression over the same two values does not join. With the `both` line and its paragraph replaced by
`<p>{(open ? "open" : "closed") + " on " + page}</p>`, the click on close shows `open: no` and `closed on 1`. That
fits H-3, which serves "a reader of a source written by another open change" and says "An **equation** never
serves". It does not fit EF-8's parenthesis, "(H-2, D-8; a write to a held slot, or a reader of
both)", read literally: this is a reader of both and its write commits alone. V-1 and E-2 also make `{e}` a reader
"with equation `e`", so nothing in the guide or the spec's surface rules tells an author that giving the
expression a name changes when the write lands.

Suggested sentence, in "What lands together, and what waits" or in §4 after "or make it an `onFlush` run": a write
also waits when an equation the view reads depends on its source and on a source the action holds, from an
`onFlush` run too; one view expression that reads both does not wait.

---

## Issue D (question)

**Title:** Is an object provision meant to couple its fields? A part's write to its own state waits for the app's action when the provision also reads a prop the action holds

`@reactivescript/compiler` 0.3.1 through `@solidjs/vite-plugin` 3.0.0-next.57 on a Vite dev server, mounted with
`const app = createApp({ root }); app.mount(main(app))` from `@reactivescript/runtime` 0.3.1, in Chromium, on
`solid-js` 2.0.0-rc.22 and on 2.0.0. A Playwright script clicks the buttons and reads the text of the `<p>`
elements.

https://github.com/solidjs/reactivescript/issues/20 was closed with:

> When a write should land now, for example clearing an input, the guide covers it under "What lands together, and what waits" in `guide/async.md`, with `onFlush` (EF-8).

and asked for "a case where plain Solid and the lowered .rx actually behave differently". This is a case `onFlush`
does not reach, in a component library whose root part provides its state to the other parts, and the Solid
comparison is at the end.

`api.js`:

```js
export const wait = (ms, value) => new Promise((resolve) => setTimeout(() => resolve(value), ms));
```

`c.rx`:

```rx
import { wait } from "./api.js"

context menu: { open: boolean; disabled: boolean }

component Popup() {
  <p>open: {(use menu).open ? "yes" : "no"}</p>
}

component Menu(props: { disabled: boolean }) {
  source open := false
  provide menu = { open: open, disabled: props.disabled }
  <div>
    <button onClick={() => { open := !open }}>toggle</button>
    <Popup />
  </div>
}

export default component App() {
  source step := 1
  action next() {
    step := 2
    try { await wait(300, 0) } catch (e) { }
  }
  <div>
    <button onClick={() => { next() }}>next</button>
    <p>step: {step}</p>
    <Menu disabled={step == 2} />
  </div>
}
```

| step              | screen                 |
| ----------------- | ---------------------- |
| mount             | `step: 1`, `open: no`  |
| click toggle      | `step: 1`, `open: yes` |
| click toggle      | `step: 1`, `open: no`  |
| click next        | `step: 1`, `open: no`  |
| click toggle      | `step: 1`, `open: no`  |
| 100 ms later      | `step: 1`, `open: no`  |
| the wait resolves | `step: 2`, `open: yes` |

The provision is one equation over `open` and `props.disabled`, and `Popup` reads it, so the menu's `open := !open`
joins the app's hold on `step` (H-3). `Menu` and `Popup` have no `await` and no action; `App` does not contain the
provision. In a library they are in different packages. The compiler reports nothing.

Each row is one change to `c.rx`, then click next, click toggle:

| change                                                                                                                                                                         | at the toggle click                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| In `Menu`'s handler, `let o = !open; onFlush(() => { open := o })`                                                                                                             | `open: no` until the wait resolves                                                                                                                                                                          |
| `context menuOpen: boolean` and `context menuDisabled: boolean`, `provide menuOpen = open`, `provide menuDisabled = props.disabled`, and `Popup` reads `use menuOpen`          | `open: yes`                                                                                                                                                                                                 |
| `context menu: { open: () => boolean; disabled: () => boolean }`, `provide menu = { open: () => open, disabled: () => props.disabled }`, and `Popup` reads `(use menu).open()` | `open: yes`                                                                                                                                                                                                 |
| `provide menu = { open: open, disabled: latest props.disabled }`                                                                                                               | `open: yes`. With `<p>disabled: {(use menu).disabled ? "yes" : "no"}</p>` added to `Popup`, that paragraph shows `disabled: yes` from the click on next, beside `step: 1` (this addition ran on rc.22 only) |
| In `App`, `source step = 1` and `guess step := 2` in place of `source step := 1` and `step := 2`                                                                               | `step: 2` at the click on next, then `open: yes` at the toggle                                                                                                                                              |

An app avoids the wait by not holding a plain write, which AC-1c allows on purpose: "A write meant to be held — a
transition […] is written in a declared action".

In Solid a context value is usually an object of getters or accessors, and that shape does not couple. The page
below, on `solid-js` alone with the same clicks, shows `open: no` at the toggle click as written (one memo over the
object, which is what `provide` emits) and `open: yes` with `?getters` in the URL:

```html
<!doctype html> <button>next</button><button>toggle</button>
<p></p>
<p></p>
<script type="module">
  import { createRoot, createSignal, createMemo, createRenderEffect, action } from "solid-js";
  const getters = new URLSearchParams(location.search).has("getters");
  const [next, toggle] = document.querySelectorAll("button");
  const [stepText, openText] = document.querySelectorAll("p");
  createRoot(() => {
    const [step, setStep] = createSignal(1);
    const [open, setOpen] = createSignal(false);
    const disabled = () => step() === 2;
    // the context value: an object of getters, or one memo over the whole object (what `provide` emits)
    const menu = getters
      ? () => ({
          get open() {
            return open();
          },
          get disabled() {
            return disabled();
          },
        })
      : createMemo(() => ({ open: open(), disabled: disabled() }));
    const hold = action(function* () {
      setStep(2);
      yield new Promise((r) => setTimeout(r, 300));
    });
    next.onclick = () => hold();
    toggle.onclick = () => setOpen((o) => !o);
    createRenderEffect(step, (v) => {
      stepText.textContent = "step: " + v;
    });
    createRenderEffect(
      () => menu().open,
      (v) => {
        openText.textContent = "open: " + (v ? "yes" : "no");
      },
    );
  });
</script>
```

The question: is `provide name = { … }` meant to couple its fields, so that a write to the source behind one waits
for a hold on another? If yes, which row of the table should a component library use?

If no, one way: an object literal on the right of `provide` lowers each field to a getter, which is the functions
row written by the compiler. CP-6b says the compiler's facts already record "a read of one field of props or a
store"; that is compile-time knowledge, not an existing lowering. The cost, as far as I can see it:

- the provision stops being one value (RG-7b: "makes `e` the context's value"), so a consumer of the whole object
  (an `effect (use name)`, an argument to JS, a spread) needs a rule;
- each field is evaluated per reader unless it gets its own memo, which adds nodes;
- the literal form then differs from `x = { a: e1, b: e2 }` followed by `provide name = x`, against E-2;
- which right-hand sides qualify (nested literals, spreads, computed keys, a conditional of two literals) has to
  be decided.

Not tested: any of the `.rx` programs against `ref/`.

---

---

# For the owner only (not part of any issue)

## Short answer

- **Bugs:** two, neither in the hold semantics themselves. Issue A (imports named like a built-in), found by
  accident. Issue B (an unread equation affects holds: spec rule E-3 against the spec's own lowering table, CP-4b; plain
  Solid's eager memo does it, so the fix is the maintainers' choice between the two).
- **Guide gap:** one. Issue C.
- **Design question:** one. Issue D. It is also a live problem in rs-ui (see below).
- **Our mistakes:** observations 1 and 3 were wrong as written; observation 2 was attributed to the wrong causes;
  observation 4 was right and is documented, and the JavaScript workaround was not needed for it.

## Verdicts on the four observations

Probe names in parentheses are files in `node_modules/.cache/hold-probe/`. All ran on Solid 2.0.0-rc.22 (the
project's install). Those marked † also ran in a scratch install on `solid-js` 2.0.0 (one version in the tree,
checked with `pnpm why`) with the same result. 0.3.1 is the newest published ReactiveScript. Main's unreleased
changes (#50, #51, #52) rewrite the §3 example's `catch` and touch nothing tested here; I ran the 0.3.1 guide's
text.

1. **"An `onFlush` write to a source the action writes after its `await` never shows." Does not reproduce.**
   The guide's §3 example behaves as the guide says (`g1`: clicking a failing save twice, the old error clears at
   the second click though the `catch` writes it again later). A `busy` flag set in `onFlush` and cleared after
   the `await` shows as set for the whole wait (`o1b`†), also when the callback writes other sources the action
   writes later (`o1f`). Two things do make it wait:
   - the callback also writes a source the action wrote _before_ its `await`: the callback is one instant and
     joins the hold (`o1d`). Documented: EF-8, H-2.
   - an equation reads the flag beside a source the action holds (`o1i`†), even an equation nothing reads (`o1j`).
     Issues C and B.
     The original test most likely had the second: the Form's context provision.
2. **"A child's writes to its own sources are held while a parent's action is in flight." Reproduces only with a
   specific cause, and not either of the two the brief named.** A child with no link to the action is live
   (`o2a`). Reading a context derived from a source the action writes _after_ its `await` does not hold it, with
   or without an equation over both, with or without `affects` (`o2b`, `o2c`†, `o2m`, `o2n`). A library setter
   the action calls behaves like a source write, no worse (`o2h`, `o2j`). The child's write is held when the
   action's run wrote that same source before its `await`, for instance through an action the child registered
   (`o2k`; H-2, documented), or when an equation in the child reads its source beside something the action holds
   (`o2f`†, and `o2i` for a library signal; H-3). I found no third case, and did not prove there is none.
3. **"A context whose provision reads `pending? x` must be declared `lane`, and every reader then waits." Half
   right.** `ROW_NARROWER_THAN_INFERRED` appears only for an _exported_ context (`o3c`); a module's own context
   infers the row (`o3a`). That is RG-7e, and `diagnostics.md` lists the code. With `lane` declared, readers do
   not wait: the `pending?` field shows at once, another field of the same provision updates during the action,
   and a child's own write shows at once (`o3d`†). Nothing to report.
4. **"Calling a handler prop that is an action freezes the caller's state." Reproduces; documented (AC-1).** The
   component's write in the launching handler is held, and later writes to that source join (`o4a`†,
   `report/d.rx`). The component's other sources stay live. Two in-language fixes work: the component's write in
   `onFlush` (`o4c`†), or the call in `onFlush`, `onFlush(() => { props.onPick(n) })` (`o4d`†,
   `report/d-onflush.rx`). `guide/language.md`, "Components", shows the direct call and says nothing about this;
   that could be a fifth, one-line guide issue, which I left out to keep the set short.

## Corrections for `language-notes.md`, "Actions, holds and components" (not edited)

- "a component does not put an `await` in its own handlers": wrong. A form written only in `.rx` that awaits its
  handler prop, shows `busy`, takes typing during the request and writes the returned error afterwards works for
  an accepted, a refused and a failed request (`d2`, rc.22 only). The real rule: nothing the handler's run writes
  before the `await` may be state that must stay live, and that includes writes made by actions it calls.
  `HELD_WRITE` does not see those (`h1`: a called action's write is held with no diagnostic; AC-1b's "own
  statements" excludes them, so this is as specified).
- "A source the action writes after its `await` is held for the whole action, including an earlier write to it
  through `onFlush`": wrong (`o1b`, `o1f`). Replace with the two causes in verdict 1.
- "everything that reads the context then waits": wrong (`o3d`). `lane` is needed because the context is exported.
- "An action started inside a handler's run takes that run's writes with it": right. Add the fix:
  `onFlush(() => { props.onX(v) })`.
- "So work that takes time goes in a TypeScript primitive": the language does not require it. `createSubmission`
  works and can stay; the reason given for it does not hold.
- Missing, and the one that matters most for the library: **an equation over a prop and local state, which is
  what `provide x = { … }` is, freezes the local state while an app action holds a plain write to a source behind
  the prop.** On the real Accordion (`lib1`): with `loopFocus={step == 1}` and an app action holding `step`,
  clicking a trigger does not open the item until the action ends (`details.open` stays `false`); with no action
  in flight it opens. `lib1` does not isolate which of the Accordion's equations causes it. `src/` has 48
  `provide` statements; I did not count how many mix props with local state. It needs an app that holds a plain
  write in a declared action (an app that uses `guess` is not affected: `report/c-guess.rx`), so it is real but
  not the common path. This is follow-up work for the library whatever the maintainers answer.

## What I recommend posting, in order

The draft was read twice by a fresh agent briefed as a maintainer, once before and once after Issue B was split
out; every quotation was checked against its file by script, and every code block is byte-identical to the file
that was run.

1. **Issue A.** Certain, small, unrelated to the rest.
2. **Issue D.** The one that decides how the library is written. Post it before B and C so the answer can shape
   them.
3. **Issue B.** Two spec rules disagree (E-3 and CP-4b) and the compiled output follows CP-4b; the reproduction
   is short. They may answer that eager memos are accepted and amend E-3; the issue is still worth their minute.
4. **Issue C.** Post last or fold into D as one sentence: if D or B changes the behaviour, C's wording changes.

## Where the reproductions are

All under `node_modules/.cache/hold-probe/` (outside git, nothing else in the repository was touched except this
file):

- `report/`: the exact programs in the issues. `a.rx`, `lib.js`; `b.rx`, `b-no-equation.rx`, `solid.html`;
  `b-shown.rx`, `b-shown-onflush.rx`, `b-view-reader.rx`; `c.rx`, `c-onflush.rx`, `c-two-contexts.rx`, `c-closures.rx`, `c-latest.rx`, `c-guess.rx`;
  `solid-d.html` (Issue D's page); `d.rx`, `d-onflush.rx` (verdict 4). `report/all.sh` runs them all and prints the frames in the tables.
- the folder itself: the probes named above (`g1`, `o1b`…`o1j`, `o2a`…`o2n`, `o3a`…`o3d`, `o4a`…`o4d`,
  `d1a`…`d1h`, `d1latest`, `d2`, `h1`…`h6`, `lib1`), `solid1.html` (an earlier plain-Solid page: `?unread`, `?unread&lazy`, `?split`), and `results/` with the raw output of each run, including
  `solid-2.0.0.txt`, and `report-run-4.txt` (rc.22) and `report-solid-2.0.0.txt` (2.0.0), the last full runs of
  `report/all.sh`, identical to each other. After editing an `.rx` file restart Vite with `--force`: it served
  stale output once during this work.
- To run: from the project root,
  `pnpm exec vite node_modules/.cache/hold-probe --config vite.config.ts --port 5195 --strictPort`, then
  `node_modules/.cache/hold-probe/report/all.sh`; or, in the probe folder,
  `node run.mjs <probe> click:<id> wait:<ms> snap`.
- The Solid 2.0.0 scratch install was in the session's scratchpad and is not kept.
