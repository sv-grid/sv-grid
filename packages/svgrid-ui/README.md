# @svgrid/ui

Add [SvGrid UI](https://www.svgrid.com/docs/help/ui-components) components to your
app - and see them - in one command:

```sh
npx @svgrid/ui try calendar     # open it in a throwaway sandbox, no project needed
npx @svgrid/ui add calendar     # write the recipe into your app + install the dep
```

## How it works

`@svgrid/ui` is a **recipe scaffolder**, not a component library. `add` writes a
minimal, ready-to-edit `.svelte` starter into your project that imports from
[`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid), and installs the
package for you. The components themselves live in `@svgrid/grid` - you get bug
fixes and new features by bumping the package, while the file `add` drops in is
yours to style and wire however you like. Each recipe is a self-contained demo, so
`try` and `--preview` can render it immediately.

## See it immediately

```sh
# zero setup: spins up a sandbox and opens the component in your browser
npx @svgrid/ui try button

# try several at once (or a whole family) - they share one sandbox
npx @svgrid/ui try button calendar slider
npx @svgrid/ui try inputs

# in your own SvelteKit app: also writes a /preview/button route
npx @svgrid/ui add button --preview
#   -> start your dev server, open http://localhost:5173/preview/button
```

`try` needs no project - it caches a tiny Vite + Svelte sandbox under your temp
dir (so repeat runs are instant) and opens the browser, with a **theme picker
(all 19 presets) and a light/dark toggle** so you can see the component in your
target theme. Pass **several component ids** (or a group id) to render them
together in the same sandbox. `--preview` drops a `src/routes/preview/<id>` page
(plus a `/preview` index) into an existing SvelteKit app so it renders in your
running dev server.

## Usage

```sh
# add one component (installs @svgrid/grid)
npx @svgrid/ui add calendar

# add several, into a custom folder
npx @svgrid/ui add calendar time-picker --dir src/lib/ui

# add a whole family
npx @svgrid/ui add date-time

# just write files, don't run the package manager
npx @svgrid/ui add calendar --no-install

# see what you can add
npx @svgrid/ui list
```

### Options

| Flag             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `--preview`, `-p`| (with `add`) Also write a `src/routes/preview/<id>` route so you can see it in your dev server. SvelteKit apps only. |
| `--dir <path>`   | Where to write files. Default: `src/lib/components/ui` (or `componentsDir` in a project `svgrid.json`). |
| `--force`        | Overwrite files that already exist.                                      |
| `--no-install`   | Skip installing the dependency; just print the install command.          |

## Components

The whole SvGrid UI catalogue is available - 70+ components across `date-time`,
`buttons`, `inputs`, `selection`, `range`, `overlays`, `layout`, `feedback` and
`navigation`. Add one by id, several at once, or a whole family by its group id
(e.g. `npx @svgrid/ui add inputs`). Run `npx @svgrid/ui list` for the full set.

MIT © jQWidgets Ltd
