# Theming with `--sg-*` tokens

The grid reads every colour, size, and radius from CSS custom properties
named `--sg-*`. You re-theme by declaring those variables **above** the
grid - at `:root`, on a wrapper `<div>`, or inline on `<SvGrid>`. The
grid's own class names are Svelte-mangled and unstable; never target them.

```css
/* ❌ Incorrect - targeting internal nodes / a mangled class. */
.svelte-1abcxyz .cell { background: #eee; }

/* ✅ Correct - set the token; the grid inherits it. */
:root {
  --sg-bg:     #ffffff;
  --sg-fg:     #0f172a;
  --sg-border: #e2e8f0;
  --sg-accent: #6366f1;
}
```

Core tokens you will use most: `--sg-bg`, `--sg-fg`, `--sg-muted`,
`--sg-border`, `--sg-header-bg`, `--sg-header-fg`, `--sg-row-alt-bg`,
`--sg-row-hover-bg`, `--sg-selection-bg`, `--sg-accent`, `--sg-focus-ring`,
`--sg-radius`, `--sg-font`, `--sg-row-height`. Full list:
`https://svgrid.com/llms-full.txt` (Design tokens page).

## Per-instance theming

Because they are CSS variables, tokens cascade. Restyle one grid by
wrapping it:

```svelte
<div style="--sg-accent: #db2777; --sg-row-height: 36px">
  <SvGrid {data} {columns} />
</div>
```

## Dark mode

The library ships no built-in dark theme - it reads whatever the app
provides. Redeclare the same tokens under the app's dark selector. Match
the project's existing convention (`[data-theme='dark']` or `.dark`); don't
introduce a second one.

```css
[data-theme='dark'] {
  --sg-bg:           #0f172a;
  --sg-fg:           #f1f5f9;
  --sg-border:       #1e293b;
  --sg-header-bg:    #1e293b;
  --sg-row-hover-bg: rgba(148, 163, 184, 0.14);
}
```

The grid reads tokens at paint time, so a mid-session theme toggle repaints
it with no JS listener and no API call.

## Design-system presets (fastest path)

`@svgrid/grid` ships ready-made presets as plain stylesheets. Import one and
the grid re-skins, light and dark:

```css
@import '@svgrid/grid/themes/shadcn.css';
```

Available ids: `shadcn`, `tailwind`, `material`, `excel`, `fluent`,
`carbon`, `sap`, `salesforce`, `atlassian`, `github`, `antd`, `ag-alpine`,
`bootstrap`, `vercel`, `linear`, `notion`, `nord`, `dracula`, `catppuccin`.

## Inherit an existing design system's tokens

When the app already themes with a system's variables (e.g. shadcn's
`--background` / `--foreground` / `--primary`), bridge `--sg-*` to them so
there is one source of truth and dark mode flips for free. shadcn stores
bare HSL channels, so wrap each in `hsl()`:

```css
.sg-shadcn {
  --sg-bg:           hsl(var(--background));
  --sg-fg:           hsl(var(--foreground));
  --sg-border:       hsl(var(--border));
  --sg-header-bg:    hsl(var(--muted));
  --sg-row-hover-bg: hsl(var(--accent));
  --sg-selection-bg: hsl(var(--primary) / 0.15);
  --sg-accent:       hsl(var(--primary));
  --sg-radius:       var(--radius);
  --sg-font:         var(--font-sans, sans-serif);
}
```

```svelte
<div class="sg-shadcn"><SvGrid {data} {columns} /></div>
```

**Always wrap in the colour function.** `--sg-accent: var(--primary)`
without `hsl()` passes bare channels to the grid and produces an invalid
(usually transparent) colour. If the app's tokens are OKLCH, use
`oklch(var(--primary) / 0.15)` instead. Confirm in DevTools that the
computed `--sg-bg` is a real colour after any design-system upgrade.

## With Tailwind

Tailwind styles the page; the grid stays token-themed. `theme(...)` works
inside `--sg-*` declarations:

```css
:root {
  --sg-bg:     theme(colors.white);
  --sg-accent: theme(colors.indigo.600);
}
```

Don't put Tailwind utility classes on the grid's child nodes, and don't
`@apply` inside grid selectors - the grid lives outside the Tailwind purge
pass.
