# Getting started with SvGrid

SvGrid is a modern, production-ready data grid for Svelte 5 - a headless
core engine paired with a Svelte render component (`<SvGrid>`). It
scales from a 10-row read-only table to a virtualized
100,000-row × 100-column editing surface with grouping, multi-column
filtering, server-side data, and full keyboard and screen-reader support.

This guide is six short pages. Read them in order if you're new; jump
straight to the one you need if you're not.

> In a hurry? `npm create sv-grid@latest` scaffolds a working project in
> one command - see [Starters & scaffolding](./getting-started/starters.md).

| #   | Page                                                          | What it covers                                                              |
| --- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 0   | [Starters & scaffolding](./getting-started/starters.md)       | `npm create sv-grid`, the minimal + SvelteKit admin templates, Deploy to Vercel. |
| 1   | [Install](./getting-started/1-install.md)                     | `pnpm add sv-grid-community`, requirements, smoke-test.                     |
| 2   | [First grid](./getting-started/2-first-grid.md)               | The minimum runnable example, explained line by line.                       |
| 3   | [Data and columns](./getting-started/3-data-and-columns.md)   | What goes in `data` and `columns`. Custom cells via `renderSnippet`.        |
| 4   | [Features](./getting-started/4-features.md)                   | Opt into sort, filter, pagination, grouping, selection, editing.            |
| 5   | [Theme and density](./getting-started/5-theme-and-density.md) | `--sg-*` tokens, dark mode, row height, sizing the grid in a flex layout.   |
| 6   | [Going to production](./getting-started/6-going-to-production.md) | Server-side data, virtualization, a11y, SSR, CSP, TypeScript notes.     |

Estimated reading time: 15 minutes across all six pages.

## Companion reads

- [Why headless?](./why-headless.md) - the architecture decision behind
  the `createSvGrid` core vs. the `<SvGrid>` render component.
- [Tailwind integration](./help/tailwind.md) - how the `--sg-*` custom
  properties, Tailwind v4, and dark mode fit together.
- [Web Components & Custom Elements](./help/web-components.md) - use SvGrid
  as a framework-agnostic `<sv-grid>` element in React, Vue, Angular, or
  plain HTML.
- [Pro features](./pro/README.md) - the paid feature pack: data export,
  data import, AI assistant, and pivot tables.

## One-page version

Prefer a single 800-line file? See
[getting-started-full.md](./getting-started-full.md). The content is
identical; the split exists for sidebar nav and faster mobile loads.

## License

`sv-grid-community` is published under the **MIT License** - permissive
for commercial use, redistribution, and modification. The paid
companion `sv-grid-pro` ships under a separate commercial license. See
[LICENSE](../LICENSE) and
[packages/sv-grid-pro/LICENSE](../packages/sv-grid-pro/LICENSE).

## Frequently asked questions

### How do I add a data grid to a Svelte 5 app?

Install `sv-grid-community`, import `SvGrid`, and pass `data` and `columns`.
A complete grid is about 15 lines - keyboard navigation and accessibility are
on by default, and you opt into sort/filter/edit/group/paging with one boolean
shortcut each (`sortable`, `filterable`, ...). See
[First grid](./getting-started/2-first-grid.md) and
[Features](./getting-started/4-features.md#capability-shortcuts-the-quick-way).

### Does SvGrid work with SvelteKit?

Yes. It renders meaningful HTML before hydration, so it works under SvelteKit
SSR and static builds. Drive large datasets with controlled, server-side state.

### Is SvGrid free for commercial use?

Yes. `sv-grid-community` is MIT-licensed, including commercial use, with no row
cap or license key. The optional `sv-grid-pro` pack (export, pivot, import, AI)
ships under a separate paid license.

### What do I need to run SvGrid?

Svelte 5 (runes) and any Vite-based toolchain. There are no other required
dependencies for the Community core; Pro export/import features lazy-load their
own dependencies only when used.
