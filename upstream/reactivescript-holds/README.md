# ReactiveScript holds: issues filed upstream

Four issues filed on `solidjs/reactivescript` on 2026-11-17, with the programs that back them. They came out of
finding why a part's own state froze while an app's action was in flight.

## The issues

| Issue                                                         | Kind     | What it says                                                                                                                        | Programs in `probe/report/`                                                                    |
| ------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [#74](https://github.com/solidjs/reactivescript/issues/74)    | bug      | A JS import named like a prelude function (`fetch`, `map`, `filter`, `len`, `str`, `sum`, `every`, `indexOf`, `fail`, `log`) is bound to the prelude, not the import. | `a.rx`, `lib.js`                                                                               |
| [#75](https://github.com/solidjs/reactivescript/issues/75)    | question | `provide x = { … }` is one equation over all its fields, so a part's write to its own state waits for an app action that holds a prop the provision also reads. Is that meant? | `c.rx`, `c-onflush.rx`, `c-two-contexts.rx`, `c-closures.rx`, `c-latest.rx`, `c-guess.rx`, `solid-d.html` |
| [#76](https://github.com/solidjs/reactivescript/issues/76)    | bug      | An equation nothing reads still makes a write to one of its sources wait for an action holding the other (spec E-3 against the lowering in CP-4b). | `b.rx`, `b-no-equation.rx`, `solid.html`                                                       |
| [#77](https://github.com/solidjs/reactivescript/issues/77)    | guide    | The guide's `onFlush` remedy doesn't help when a displayed equation reads the written source beside a held one.                     | `b-shown.rx`, `b-shown-onflush.rx`, `b-view-reader.rx`                                         |

The issue text is on GitHub. `drafts.md` is the report as it was written before posting (the four drafts and the
notes this page was organised from), kept unchanged. Each program in an issue is byte-identical to its file in
`probe/report/`, which is why `upstream/` is excluded from the formatter and the linter.

Related, already closed: [#20](https://github.com/solidjs/reactivescript/issues/20), whose closing comment #75
answers.

## When this folder can be deleted

When all four issues are closed and whatever the answer to #75 is has been applied to the library (next section).
Until then the programs here are how a maintainer's follow-up question gets answered quickly. Nothing else in the
repository depends on this folder; removing it also means removing `"upstream"` from the ignore lists in
`.oxfmtrc.json` and `.oxlintrc.json`.

## What depends on the answers

- **#75 decides how contexts are written here.** Every root part provides its state as an object, which is the
  coupling the issue describes. The library works around it by reading props with `latest` (the `c-latest.rx`
  row of the issue's table), wherever a family's tests stayed green. The cases that still freeze are the expected
  failures (`test.fails`) in each family's `*.held.browser.test.ts`.
- **`latest` has a cost** the issue records: the part shows the prop's new value while the rest of the app still
  shows the old one.
- **An app that writes with `guess` is not affected** (`c-guess.rx`). It takes an app that holds a plain write in
  a declared action.
- **If #76 is fixed** (equations become lazy), an unread equation stops coupling, but a provision that a part
  reads still couples: #75 stands on its own.
- **#77's wording depends on #75 and #76.** If either changes the behaviour, the suggested guide sentence changes.

## How the four original observations turned out

The investigation started from four things observed while writing Form and Field. Probe names in parentheses are
files in `probe/`. All ran on Solid 2.0.0-rc.22; those marked † also ran on `solid-js` 2.0.0 with the same result.

1. **"An `onFlush` write to a source the action writes after its `await` never shows." Does not reproduce.** The
   guide's example behaves as the guide says (`g1`), and a `busy` flag set in `onFlush` shows for the whole wait
   (`o1b`†, `o1f`). Two things do make such a write wait:
   - the callback also writes a source the action wrote before its `await` (`o1d`; documented, EF-8 and H-2);
   - an equation reads the flag beside a source the action holds (`o1i`†), even an equation nothing reads (`o1j`).
     These became #77 and #76. The original test most likely had this one: the Form's context provision.
2. **"A child's writes to its own sources are held while a parent's action is in flight." Only with a specific
   cause.** A child with no link to the action is live (`o2a`). Reading a context derived from a source the action
   writes after its `await` does not hold it (`o2b`, `o2c`†, `o2m`, `o2n`). A library setter the action calls
   behaves like a source write (`o2h`, `o2j`). The child's write is held when the action's run wrote that same
   source before its `await` (`o2k`; documented, H-2), or when an equation in the child reads its source beside
   something the action holds (`o2f`†, `o2i`; H-3). No third case was found; that there is none was not proved.
3. **"A context whose provision reads `pending? x` must be declared `lane`, and every reader then waits." Half
   right.** `ROW_NARROWER_THAN_INFERRED` appears only for an exported context (`o3c`); a module's own context
   infers the row (`o3a`). With `lane` declared, readers do not wait (`o3d`†). Nothing to report upstream.
4. **"Calling a handler prop that is an action freezes the caller's state." Reproduces, and is documented
   (AC-1).** The component's write in the launching handler is held (`o4a`†, `report/d.rx`). Two fixes work in the
   language: the component's write in `onFlush` (`o4c`†), or the call in `onFlush` (`o4d`†,
   `report/d-onflush.rx`). The guide's "Components" section shows the direct call and doesn't mention this; that
   could be a fifth, one-line guide issue, which was left out.

## What this corrected in the skill notes

These sentences were in `.claude/skills/rs-ui-components/references/language-notes.md` and were wrong. They are no
longer there; the reasons are kept because the code they led to still exists.

- **"A component does not put an `await` in its own handlers."** A form written only in `.rx` that awaits its
  handler prop works for an accepted, a refused and a failed request (`d2`, rc.22 only). The real rule: nothing
  the handler's run writes before the `await` may be state that must stay live, including writes made by actions
  it calls. `HELD_WRITE` does not see those (`h1`).
- **"Work that takes time goes in a TypeScript primitive."** The language does not require it. `createSubmission`
  in `src/internal/impl/field.ts` works and can stay; the reason first given for it does not hold.
- **"Everything that reads a `lane` context then waits."** It doesn't (`o3d`). `lane` is needed because the
  context is exported.
- **"A source the action writes after its `await` is held for the whole action, including an earlier `onFlush`
  write."** It isn't (`o1b`, `o1f`); the two real causes are in observation 1.

Confirmed on a real component (`lib1`): on Accordion with `loopFocus={step == 1}` and an app action holding
`step`, clicking a trigger does not open the item until the action ends. `lib1` does not isolate which of the
Accordion's equations causes it.

## Running the programs

From the project root, start a server on the folder, then run the script in a second terminal:

```bash
pnpm exec vite upstream/reactivescript-holds/probe --config vite.config.ts --port 5195 --strictPort --force
```

```bash
sh upstream/reactivescript-holds/probe/report/all.sh
```

`all.sh` runs every program in the issues and prints the frames in their tables. Its output should match
`probe/results/report-run-4.txt` (it did on 2026-11-17, just before the issues were posted). One probe alone, from
inside `probe/`: `node run.mjs <probe> click:<id> wait:<ms> snap`. Pass `--force` to Vite after editing an `.rx`
file: it served stale output once during this work.

## What is in `probe/`

- `report/`: the exact programs in the issues (table above), plus `d.rx` and `d-onflush.rx` for observation 4,
  `all.sh`, and its own `run.mjs` and `index.html`.
- `g1`, `o1b`…`o1j`, `o2a`…`o2n`, `o3a`…`o3d` and `o3/`, `o4a`…`o4d`: the probes for the four observations.
- `d1a`…`d1h`, `d1latest`, `d2`: provision shapes and the all-`.rx` form.
- `h1`…`h6` and `h6/`: what `HELD_WRITE` sees, and imports named like built-ins.
- `lib1.rx`, `lib1.mjs`: the Accordion case. `lib1.rx` imports `../../../src/accordion/accordion.rx`, so it
  depends on this folder staying three levels below the project root.
- `solid1.html`: an earlier plain-Solid page (`?unread`, `?unread&lazy`, `?split`).
- `results/`: raw output of each run. `report-run-4.txt` (rc.22) and `report-solid-2.0.0.txt` (2.0.0) are the last
  full runs of `all.sh` and are identical to each other.

## Not tested

- None of the `.rx` programs was run against the upstream reference implementation in `ref/`, which is the
  project's own check.
- #74: an import of one of those names from another `.rx` module. Of the ten names only `fetch` and `fail` were
  run; the rest were read in the generated code.
- #76: what else changes if an equation is emitted as a lazy memo.
- The Solid 2.0.0 runs used a scratch install that was not kept.
