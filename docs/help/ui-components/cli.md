# Add components with the CLI

`@svgrid/ui` drops a working SvGrid UI component into your app in one command:

<div data-docs-add="add calendar"></div>

## How it works

`@svgrid/ui` is a **recipe scaffolder**, not a second component library. `add`
writes a minimal, ready-to-edit `.svelte` starter into your project that imports
from [`@svgrid/grid`](./index.md), makes sure the package is a dependency, and
prints the install command.

The distinction matters: the components themselves live in `@svgrid/grid`, so you
get bug fixes and new features by bumping one version - while the file `add` drops
in is *yours* to restyle, rename and wire however you like. It is the fast start,
not a fork.

```
your-app/
  src/lib/components/ui/
    calendar.svelte        <- your copy, imports { SvCalendar } from '@svgrid/grid'
```

## Commands

```sh
# add one component
npx @svgrid/ui add calendar

# add several at once, into a folder you choose
npx @svgrid/ui add calendar time-picker --dir src/lib/ui

# add a whole family in one go
npx @svgrid/ui add date-time

# install the dependency for you (default: it just prints the command)
npx @svgrid/ui add calendar --install

# list everything you can add
npx @svgrid/ui list
```

## Options

| Flag           | Description                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `--dir <path>` | Where to write files. Default: `src/lib/components/ui`, or the `componentsDir` in a project `svgrid.json`. |
| `--force`      | Overwrite files that already exist (otherwise existing files are left untouched).                    |
| `--install`    | Run your package manager (auto-detected from the lockfile) to install deps.                           |

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
