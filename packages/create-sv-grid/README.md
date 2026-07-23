# @svgrid/create

Scaffold a [Svelte](https://svelte.dev) app powered by
[SvGrid](https://www.svgrid.com) - the modern Svelte 5 data grid - in one
command.

```bash
npm create @svgrid@latest
# or
pnpm create @svgrid
# or
yarn create @svgrid
```

Interactive by default. Or pass a directory and template directly:

```bash
npm create @svgrid@latest my-app -- --template admin-dashboard
pnpm create @svgrid my-app -t minimal
```

## Templates

| Template | Stack | Best for |
| --- | --- | --- |
| `minimal` | Vite + Svelte 5 + SvGrid | Dropping a grid into something quickly |
| `admin-dashboard` | SvelteKit + Tailwind + SvGrid, deploy to Vercel | A real dashboard / internal tool |

## Options

| Flag | Description |
| --- | --- |
| `--template`, `-t` | `minimal` or `admin-dashboard` |
| `--theme <id>` | `admin-dashboard` only. One of `@svgrid/grid`'s 19 built-in presets - shadcn, Tailwind, Material, Excel, Fluent, and more (default: `tailwind`) |
| `--dark` / `--light` | `admin-dashboard` only. Start in dark or light mode (default: `dark`) |
| `--force`, `-f` | Scaffold into a non-empty directory |
| `--help`, `-h` | Show usage |

Choosing `admin-dashboard` interactively also prompts for a theme and light/dark
mode - or skip the prompts with flags:

```bash
npm create @svgrid@latest my-app -- -t admin-dashboard --theme material --light
```

Then:

```bash
cd my-app
npm install
npm run dev
```

All templates use the free MIT `@svgrid/grid` core. Add
[`@svgrid/enterprise`](https://www.svgrid.com/pricing) for Excel/PDF export, import,
print, pivot, and AI helpers.

SvGrid(TM) is a trademark of jQWidgets Ltd. This package is MIT-licensed.
