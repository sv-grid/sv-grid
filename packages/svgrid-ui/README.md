# @svgrid/ui

Add [SvGrid UI](https://www.svgrid.com/docs/help/ui-components) components to your
app in one command:

```sh
npx @svgrid/ui add calendar
```

## How it works

`@svgrid/ui` is a **recipe scaffolder**, not a component library. `add` writes a
minimal, ready-to-edit `.svelte` starter into your project that imports from
[`@svgrid/grid`](https://www.npmjs.com/package/@svgrid/grid), then makes sure the
package is a dependency and prints the install command. The components themselves
live in `@svgrid/grid` - you get bug fixes and new features by bumping the package,
while the file `add` drops in is yours to style and wire however you like.

## Usage

```sh
# add one component
npx @svgrid/ui add calendar

# add several, into a custom folder
npx @svgrid/ui add calendar time-picker --dir src/lib/ui

# add a whole family
npx @svgrid/ui add date-time

# install the dependency automatically (default: just prints the command)
npx @svgrid/ui add calendar --install

# see what you can add
npx @svgrid/ui list
```

### Options

| Flag             | Description                                                              |
| ---------------- | ------------------------------------------------------------------------ |
| `--dir <path>`   | Where to write files. Default: `src/lib/components/ui` (or `componentsDir` in a project `svgrid.json`). |
| `--force`        | Overwrite files that already exist.                                      |
| `--install`      | Run your package manager to install deps instead of just printing it.    |

## Components

The whole SvGrid UI catalogue is available - 70+ components across `date-time`,
`buttons`, `inputs`, `selection`, `range`, `overlays`, `layout`, `feedback` and
`navigation`. Add one by id, several at once, or a whole family by its group id
(e.g. `npx @svgrid/ui add inputs`). Run `npx @svgrid/ui list` for the full set.

MIT © jQWidgets Ltd
