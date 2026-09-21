# migration-lab

A Svelte 4 app on `svelte-headless-table`, upgraded to Svelte 5 one step at a
time, with every diagnostic captured verbatim into `captured/`.

```bash
node tools/migration-lab/run.mjs   # about three minutes; installs from the npm registry
```

The guide [docs/help/svelte-5-upgrade-data-tables.md](../../docs/help/svelte-5-upgrade-data-tables.md)
quotes these files. Nothing in its code blocks is typed by hand;
`tools/migration-lab.test.ts` fails when a quoted block is not in the captured
file it names.

## What it runs

| Step | Capture | What it shows |
| --- | --- | --- |
| 01 | `01-svelte4-baseline.txt` | The pinned Svelte 4 install and a clean `svelte-check` |
| 02 | `02-npm-install-svelte5.txt` | `npm install svelte@5` with the table's `svelte@^4` peer range |
| 03 | `03-svelte5-legacy-component.txt` | Svelte 5 forced in; the untouched component checked |
| 04 | `04-svelte5-runes-component.txt` | The component ported to runes (`fixture/runes`), the table wiring left alone |
| 05 | `05-codemod.txt` | `packages/migrate` on the Svelte 4 original: preview, then `--write` |
| 06 | `06-after-codemod.txt` | The result checked, with `svelte-headless-table` removed and `@svgrid/grid` installed |
| 07 | `07-hand-edits.txt` | The two hand edits the codemod's warnings ask for, then the same check |

`captured/PeopleTable.after.svelte` is the component as it ends up.

## Why it is not a workspace package

It installs Svelte 4 and then Svelte 5 into its own `node_modules` with npm,
because npm's peer resolution is what a reader hits; pnpm would print a
different warning. `src/`, `node_modules/` and `package-lock.json` are
generated and gitignored; `fixture/` and `captured/` are the source of truth.

## Updating

Bump the pins in `package.json` (Svelte 4 line) and `run.mjs` (`SVELTE5`,
`GRID`), rerun, and read the diff of `captured/` before committing it. A
change in a captured file is a change in what the guide says.
