# Starters & scaffolding

The fastest way to a working SvGrid app. One command scaffolds a project
with the grid already wired up - no copy-paste, no config archaeology.

![Running npm create @svgrid@latest scaffolds a SvelteKit project with SvGrid already wired into src/routes/+page.svelte and a template choice of minimal or admin-dashboard, then npm run dev starts the local server.](/docs-media/gs-starters.svg)

## `npm create @svgrid`

```bash
# npm
npm create @svgrid@latest

# pnpm
pnpm create @svgrid

# yarn
yarn create @svgrid
```

Run with no arguments and it walks you through a project name and a
template. Or pass them directly:

```bash
# Minimal Vite + Svelte 5 starter
npm create @svgrid@latest my-app -- --template minimal

# Full SvelteKit admin dashboard
npm create @svgrid@latest my-admin -- --template admin-dashboard
```

Then:

```bash
cd my-app
npm install
npm run dev
```

### Templates

| Template | Stack | Best for |
| --- | --- | --- |
| `minimal` | Vite + Svelte 5 + `@svgrid/grid`, one page | Dropping a grid into something quickly |
| `admin-dashboard` | SvelteKit + Tailwind + `@svgrid/grid`, deploy to Vercel | A real dashboard / internal tool |

### Options

| Flag | Alias | Description |
| --- | --- | --- |
| `--template <name>` | `-t` | `minimal` or `admin-dashboard` |
| `--force` | `-f` | Scaffold into a non-empty directory |
| `--help` | `-h` | Show usage |

Both templates use the free MIT `@svgrid/grid` core. Add
[`@svgrid/enterprise`](../enterprise/README.md) for export, import, print, pivot, and
the AI helpers.

## The admin dashboard starter

The `admin-dashboard` template is a production-shaped SvelteKit app you
can fork directly from
[the repo](https://github.com/sv-grid/sv-grid/tree/main/templates/sveltekit-admin-dashboard):

- **App shell** - sidebar nav + top bar (`src/routes/+layout.svelte`)
- **Overview** - KPI cards + a recent-orders grid (`src/routes/+page.svelte`)
- **Orders** - full grid: sort, filter, row selection, inline editing, pagination
- **Customers** - grid with column grouping (drag a column to the group bar)
- **Prerendered to static HTML** for SEO and instant first paint; grids
  hydrate on the client (`prerender = true` in `src/routes/+layout.ts`)
- **Sample data** in `src/lib/data.ts` - swap for your API or a
  SvelteKit `load` function

### Deploy to Vercel

The starter ships with `@sveltejs/adapter-vercel` and a one-click deploy
button in its README. From a forked or scaffolded copy:

```bash
npm run build    # static + serverless output
npm run preview  # preview the production build
```

If you're deploying the template straight from this monorepo's
subfolder, set the Vercel **Root Directory** to
`templates/sveltekit-admin-dashboard`. Scaffolding a standalone copy
first (above) avoids that step.

## Adding the grid to an existing app

Already have a Svelte or SvelteKit project? Skip the scaffolder and
install directly - see [Install](./1-install.md) and
[First grid](./2-first-grid.md).

## Frequently asked questions

### What's the fastest way to start a SvGrid project?

Run `npm create @svgrid@latest` (or `pnpm create @svgrid`). It scaffolds a
Vite + Svelte or SvelteKit project with the grid already wired up, then
`npm install` and `npm run dev`.

### Is there a SvelteKit admin dashboard template?

Yes. `npm create @svgrid@latest my-admin -- --template admin-dashboard`
scaffolds a SvelteKit + Tailwind admin with multiple grids, prerendered
for SEO, and a one-click Deploy-to-Vercel button.

### Do the starters require a Enterprise license?

No. Both templates use the free MIT `@svgrid/grid` core. Enterprise
features (export, import, print, pivot, AI) are an optional add-on that
runs in evaluation without a key.

## See also

- [Install](./1-install.md) - add SvGrid to an existing project
- [First grid](./2-first-grid.md) - the minimum runnable example
- [Going to production](./6-going-to-production.md) - SSR, virtualization, a11y
