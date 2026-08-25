# @svgrid/sv

The [Svelte CLI](https://svelte.dev/docs/cli) add-on for [SvGrid](https://svgrid.com).

```bash
npx sv add @svgrid
```

That resolves to this package (`@svgrid/sv`), adds `@svgrid/grid` to your
dependencies, and optionally drops in a working demo grid.

You can combine it with official add-ons in one command:

```bash
npx sv add eslint prettier @svgrid
```

On PowerShell, quote the argument: `npx sv add '@svgrid'`.

## What it asks

| Prompt | Default | Effect |
| --- | --- | --- |
| Add a demo grid so you can see it working? | yes | Writes `src/routes/svgrid-demo/+page.svelte` in a SvelteKit project, or `src/lib/SvGridDemo.svelte` otherwise |
| Add the Enterprise pack? | no | Also adds `@svgrid/enterprise` (Excel/PDF export, pivot, Kanban, scheduler). Needs a [paid license key](https://svgrid.com/pricing/) |

The demo is written in whichever language the project already uses. It never
overwrites a file that already exists.

## Requirements

SvGrid is Svelte 5 only. The add-on reports itself unsupported on a Svelte 4
project rather than installing a grid that cannot run.

## Stability

Community add-ons are still marked **experimental** by the Svelte CLI, and the
authoring API can change between `sv` minors. This add-on is written and tested
against `sv@0.17.0`. If `npx sv add @svgrid` misbehaves after an `sv` upgrade,
`npm install @svgrid/grid` does the same job with no CLI involved.

## License

MIT. See [LICENSE](./LICENSE).
