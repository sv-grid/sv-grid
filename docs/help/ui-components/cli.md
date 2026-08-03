# Add components with the CLI

`@svgrid/ui` gets a SvGrid UI component into your app - and lets you *see* it -
in one command.

**See it first, no project needed:**

```sh
npx @svgrid/ui try calendar     # spins up a sandbox and opens it in your browser
```

**Put it in your app:**

<div data-docs-add="add calendar"></div>

`add` writes the component and installs `@svgrid/grid` for you. Want to preview it
inside your own app? Add `--preview` (SvelteKit) - see [See it](#see-it) below.

## How it works

`@svgrid/ui` is a **recipe scaffolder**, not a second component library. `add`
writes a minimal, ready-to-edit `.svelte` starter into your project that imports
from [`@svgrid/grid`](./index.md), and installs the package for you.

The distinction matters: the components themselves live in `@svgrid/grid`, so you
get bug fixes and new features by bumping one version - while the file `add` drops
in is *yours* to restyle, rename and wire however you like. It is the fast start,
not a fork. Because each recipe is a self-contained demo, `try` and `--preview`
can render it immediately.

```
your-app/
  src/lib/components/ui/
    calendar.svelte        <- your copy, imports { SvCalendar } from '@svgrid/grid'
```

## See it

Two ways to render a component, not just drop its file in:

```sh
# zero setup: cached Vite + Svelte sandbox, opens http://localhost:5173
npx @svgrid/ui try button

# try several at once - they all render in the one sandbox
npx @svgrid/ui try button calendar slider

# or a whole family by its group id
npx @svgrid/ui try inputs

# inside a SvelteKit app: also writes a /preview/button route (+ a /preview index)
npx @svgrid/ui add button --preview
#   -> start your dev server, open http://localhost:5173/preview/button
```

`try` needs no project - it caches a tiny sandbox under your temp dir (so repeat
runs are instant) and opens the browser, with a theme picker (all 19 presets) and
a light/dark toggle so you can preview the component in your target theme. Pass
**several component ids** (or a group id) and they all render together in the same
sandbox - handy for comparing a set side by side. `--preview` drops a
`src/routes/preview/<id>` page into an existing SvelteKit app so it renders in your
running dev server. `add` also prints the exact `try` command for whatever you just
added, so the "see it" step is always one copy-paste away.

## Commands

```sh
# add one component (installs @svgrid/grid for you)
npx @svgrid/ui add calendar

# add several at once, into a folder you choose
npx @svgrid/ui add calendar time-picker --dir src/lib/ui

# add a whole family in one go
npx @svgrid/ui add date-time

# add + a /preview route you can open in your dev server (SvelteKit)
npx @svgrid/ui add calendar --preview

# just write the file, don't run the package manager
npx @svgrid/ui add calendar --no-install

# see it with zero setup (one component, several, or a whole family)
npx @svgrid/ui try calendar
npx @svgrid/ui try calendar time-picker date-range-input
npx @svgrid/ui try date-time

# list everything you can add
npx @svgrid/ui list
```

> Running an older CLI? `npx` caches by name - pin the latest with
> `npx @svgrid/ui@latest ...` (the `try` command and `--preview` flag arrived in 0.3.0).

## Options

| Flag             | Description                                                                                          |
| ---------------- | ---------------------------------------------------------------------------------------------------- |
| `--preview`, `-p`| (with `add`) Also write a `src/routes/preview/<id>` route so you can see it in your dev server. SvelteKit apps only. |
| `--dir <path>`   | Where to write files. Default: `src/lib/components/ui`, or the `componentsDir` in a project `svgrid.json`. |
| `--force`        | Overwrite files that already exist (otherwise existing files are left untouched).                    |
| `--no-install`   | Skip installing the dependency; just print the install command.                                      |

## Available components

The whole [catalogue](./index.md#the-catalogue) is available - every component id
maps to its tutorial page. Add them individually (`add calendar`), several at once
(`add calendar time-picker`), or a full family with its group id:

| Group        | Adds                                                              |
| ------------ | ---------------------------------------------------------------- |
| `date-time`  | calendar, time-picker, date-time-picker, date-range-input        |
| `buttons`    | button, button-group, repeat-button, toggle-button, switch-button, check-box, radio-group, rating |
| `inputs`     | text-input, text-area, number-input, password-input, masked-input, phone-input, color-input, otp-input, duration-input, tags-input |
| `selection`  | list-box, drop-down-list, combo-box, auto-complete, multi-select, tree-select, grid-select, country-input |
| `range`      | slider, gauge, progress, circular-progress, sparkline, stat      |
| `overlays`   | popover, tooltip, modal, drawer, toaster, context-menu, menu |
| `layout`     | tabs, accordion, splitter, dock-layout, dock-manager, card, divider, scroll-area, grid-chart, form, field, file-upload |
| `feedback`   | badge, skeleton, alert, empty-state, chip, timeline, avatar, avatar-group, carousel |
| `navigation` | breadcrumb, pagination, stepper, nav-pane, tree, command, tour, rich-text |

Run `npx @svgrid/ui list` for the full set with descriptions. Every component is
also a plain import from `@svgrid/grid` - the CLI is a convenience, never the only
way in.

## See also

- [SvGrid UI overview](./index.md) - the full component catalogue.
- [Headless editors](./headless-editors.md) - build fully custom markup on the same cores.
