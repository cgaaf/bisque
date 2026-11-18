# Bisque

Headless, unstyled, accessible components for [ReactiveScript](https://reactivescript.dev/) (`.rx`), the
language from the Solid team that compiles to Solid 2.0, with the component families, ARIA and keyboard
behaviour you would expect from a headless library.

Experimental, like ReactiveScript 0.3 itself: expect the API to change.

## What is different about it

- **Platform first.** Anything the latest Chrome, Firefox and Safari all do natively is left to the browser. A
  dialog is a `<dialog>`, popups are `popover` elements placed with CSS anchor positioning, disclosures are
  `<details>`, checkboxes are checkboxes. There is no portal, focus trap, dismissal layer or positioning engine
  in the library, and no Portal, Positioner or Backdrop parts.
- **No runtime dependencies** beyond ReactiveScript and Solid.
- **Written in `.rx`**, with each part's behaviour also exported as a props function, so it can go on an element
  of your own.

## Components

Accordion, Alert Dialog, Autocomplete, Avatar, Button, Checkbox, Checkbox Group, Collapsible, Combobox, Context
Menu, Dialog, Drawer, Field, Fieldset, Form, Input, Menu, Menubar, Meter, Navigation Menu, Number Field,
Popover, Preview Card, Progress, Radio, Scroll Area, Select, Separator, Slider, Switch, Tabs, Toast, Toggle,
Toggle Group, Toolbar, Tooltip.

## Use

ReactiveScript 0.3 resolves an `.rx` import only by relative path, so the library is distributed as source that
is copied into the app. It isn't on npm yet, so install it from GitHub:

```bash
pnpm add github:cgaaf/bisque @reactivescript/runtime solid-js @solidjs/web
```

```bash
pnpm exec bisque copy src/bisque
```

Run `pnpm exec bisque copy` again after updating to refresh the copy. It replaces only a folder that holds nothing
but files it wrote, and refuses one holding anything else, such as a file you added.

```rx
import { DialogRoot, DialogTrigger, DialogPopup, DialogTitle, DialogClose } from "./bisque/dialog/dialog.rx"

export component Example() {
  <DialogRoot>
    <DialogTrigger>Open</DialogTrigger>
    <DialogPopup class="Dialog">
      <DialogTitle>Hello</DialogTitle>
      <DialogClose>Close</DialogClose>
    </DialogPopup>
  </DialogRoot>
}
```

Add `"exclude": ["**/*.d.rx"]` to the tsconfig that `rx-tsc` reads. Style parts with ordinary CSS: `[open]`,
`:popover-open`, `:checked`, `::backdrop`, `@starting-style`, and a `data-*` attribute where the platform has no
selector.

## Agent skill

The package ships a `bisque-ui` [agent skill](https://agentskills.io): how to set the library up, style, animate,
compose and wire it to a server, plus a reference for every component's parts, props and data attributes,
generated from the source. pnpm links a dependency's skills into your agent directories (`.claude/skills`,
`.agents/skills`, `.cursor/skills`, …) once you allow it. With pnpm 12.11 or later, run

```bash
pnpm approve
```

and choose `bisque-ui (git)`. pnpm records the approval for that exact commit in `pnpm-workspace.yaml`, so it asks
again after you update. To approve the repository instead, so updates keep the skill, write the key yourself:

```yaml
permissions:
  bisque-ui@git+https://github.com/cgaaf/bisque.git:
    skills: true
```

pnpm links only into agent directories that already exist at the workspace root, unless it detects the agent
running it. With another package manager, copy `node_modules/bisque-ui/skills/bisque-ui` into your agent's skills
directory.

## Documentation

The docs site is in `docs/`: a page per component with live demos, their source and CSS, and an API reference
generated from the components' source.

```bash
pnpm docs
```

```bash
pnpm build:docs
```

## Browsers

The current releases of Chrome, Firefox and Safari. There are no fallbacks for older ones. `pnpm baseline`
reports, from the Baseline project's data, which platform features qualify.

## Not there yet

- Exit animations for popovers in Firefox and Safari, which can't keep a closing top-layer element on screen.
  Dialogs, drawers and disclosures animate out everywhere.
- Some features: detached triggers, Drawer snap points, NavigationMenu's shared morphing viewport,
  drag-to-select in menus.
- Server rendering is untested.
- The components are tested for roles, ARIA, focus and keyboard behaviour in three engines; they have not been
  audited with screen readers.

## Develop

```bash
pnpm check
```

runs formatting (oxfmt), lint (oxlint), both type checks (`rx-tsc` for `.rx`, `tsrs` for `.ts`), the jsdom
tests, the tests in Chromium, Firefox and WebKit, and the docs build. `CLAUDE.md` and
`.claude/skills/bisque-components` describe how the library is written.

## Licence

MIT
