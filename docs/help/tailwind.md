# Tailwind integration

SvGrid was built alongside Tailwind v4 (the gallery is the proof). The
two compose cleanly because they have **non-overlapping concerns**:
<div data-docs-demo="10-custom-cells-and-themes" data-height="540"></div>

- Tailwind styles your *page* - controls, buttons, sidebar, modal,
  spacing, typography.
- SvGrid ships its own scoped class names (`.sv-grid-*`) and reads
  every visual value from a small set of CSS custom properties
  (`--sg-*`) - so you re-theme it with **CSS variables**, not Tailwind
  utilities.

You don't put `class="bg-slate-50"` on grid internals. You set
`--sg-bg: theme(colors.slate.50)` once and the grid inherits.

## Install

```bash
pnpm add -D tailwindcss @tailwindcss/postcss autoprefixer postcss
```

`postcss.config.cjs`:

```js
module.exports = {
  plugins: {
    '@tailwindcss/postcss': {},
    autoprefixer: {},
  },
}
```

`tailwind.config.cjs`:

```js
module.exports = {
  content: ['./index.html', './src/**/*.{ts,svelte}'],
  theme: { extend: {} },
  plugins: [],
}
```

Your global stylesheet (`src/index.css`):

```css
@import 'tailwindcss';

/* See "Dark mode" below - Tailwind's `dark:` follows whatever attribute
 * your app uses for theme. The gallery uses html[data-theme='dark']. */
@custom-variant dark (&:where(html[data-theme='dark'], html[data-theme='dark'] *));
```

That's it - the grid's class names ship as part of the component; you
don't need a Tailwind plugin or a `safelist` entry.

## The theming surface: `--sg-*` custom properties

SvGrid's stylesheet uses CSS custom properties everywhere a colour, a
size, or a hover effect appears. The defaults live in the published
CSS; you override by declaring the variables at any level **above** the
grid (`:root` for the whole app, or on a wrapper `<div>` for one grid
instance).

The full surface (see the gallery's
[`src/index.css`](../../examples/src/index.css) for live values):

| Token | What it paints |
| ----- | -------------- |
| `--sg-bg` | Cell background |
| `--sg-fg` | Cell text |
| `--sg-muted` | Secondary text (footers, subtitles) |
| `--sg-border` | Cell + header borders, scrollbar separators |
| `--sg-header-bg` / `--sg-header-fg` | Header row |
| `--sg-row-alt-bg` | Zebra rows |
| `--sg-row-hover-bg` | Row + cell hover |
| `--sg-selection-bg` | Selected cell / row tint |
| `--sg-accent` | Sort indicator, focus ring, primary buttons |
| `--sg-focus-ring` | Keyboard focus outline |
| `--sg-input-bg` / `--sg-input-border` | Inline editor + filter inputs |
| `--sg-pill-active`, `--sg-pill-pending`, `--sg-pill-inactive` (+ `-fg` variants) | Status pills |
| `--sg-scrollbar-*` | The custom-painted scrollbars (10+ tokens for arrow / thumb / hover) |

Tailwind's `theme(...)` works inside these declarations, so you can
keep your design tokens in the Tailwind config and reference them once:

```css
:root {
  --sg-bg:          theme(colors.white);
  --sg-fg:          theme(colors.slate.900);
  --sg-border:      theme(colors.slate.200);
  --sg-header-bg:   theme(colors.slate.100);
  --sg-row-alt-bg:  theme(colors.slate.50);
  --sg-row-hover-bg: theme(colors.indigo.50);
  --sg-accent:      theme(colors.blue.600);
}
```

## Dark mode

The grid is dark-mode-aware by re-declaring the same tokens under a
selector for "dark":

```css
html[data-theme='dark'] {
  --sg-bg:          theme(colors.slate.900);
  --sg-fg:          theme(colors.slate.100);
  --sg-border:      theme(colors.slate.700);
  --sg-header-bg:   theme(colors.slate.800);
  --sg-row-alt-bg:  theme(colors.slate.800);
  --sg-row-hover-bg: theme(colors.slate.700);
  --sg-accent:      theme(colors.blue.400);
  color-scheme: dark;
}
```

The gallery's `App.svelte` writes the active theme into
`document.documentElement.dataset.theme`, and the `@custom-variant`
declaration above makes Tailwind's `dark:` modifier follow the same
attribute. Result: Tailwind utilities and SvGrid tokens flip together.

```svelte
<button class="bg-white dark:bg-slate-900">  <!-- Tailwind -->
  switch theme
</button>
<SvGrid {...props} />  <!-- inherits --sg-* from html[data-theme] -->
```

## Per-instance theming

Because the tokens are CSS custom properties they cascade. To restyle
a single grid, wrap it in a `<div>` that sets its own values:

```svelte
<div style="--sg-bg: #ffffff; --sg-accent: #db2777;">
  <SvGrid {data} {columns} features={features} />
</div>
```

The [`10-custom-cells-and-themes` demo](../../examples/src/demos/10-custom-cells-and-themes.svelte)
shows this pattern with three full palettes (light / dark / high-contrast)
applied via a `style="..."` per the user's pick.

## When you *do* need to override a class

Some things aren't tokens - column-resize handle width, the funnel
button hover opacity, pill paddings. The grid's class names are
deliberately stable so you can target them from your global CSS
(NOT through `@apply` - the grid lives outside the Tailwind
purge pass):

```css
.sv-grid-resize-handle {
  width: 8px;            /* default is 5px */
}

.sv-grid-col-filter-btn {
  opacity: 0;            /* hide funnels unless hovered */
}
.sv-grid-column:hover .sv-grid-col-filter-btn,
.sv-grid-col-filter-btn.is-active {
  opacity: 1;
}

.sv-grid-cell[data-align='right'] {
  font-variant-numeric: tabular-nums;
}
```

Add these rules to your global stylesheet, *after* `@import 'tailwindcss';`,
so Tailwind's preflight + utilities load first and your overrides win
on equal-specificity ties.

## Anti-patterns

**Don't put Tailwind utility classes on the grid's children.** The
default renderer owns those nodes; your classes will get clobbered on
re-render or row-virtualisation recycle. Use the `--sg-*` tokens or
target the stable `.sv-grid-*` class names.

**Don't `@apply` inside grid selectors.** `@apply` reads Tailwind's
preflight scope. Mixed with the grid's component-scoped CSS the
specificity gets weird. Plain property declarations (`background:
theme(colors.slate.50)`) are more predictable.

**Don't fight the column widths in CSS.** Set them in your
`ColumnDef`s. The wrapper uses `style="width: Npx; min-width: Npx;
max-width: Npx;"` and the layout will not respond to a Tailwind utility
on the `<th>`.

## See also

- [Why headless?](../why-headless.md) - the architectural reason the
  theming surface looks like this
- [Getting started](../getting-started.md) - end-to-end gallery setup
- [Styling cells](./cells/styling-cells.md) - cell-level overrides
- [Styling rows](./rows/styling-rows.md) - row-level overrides
- Demo [`10-custom-cells-and-themes`](../../examples/src/demos/10-custom-cells-and-themes.svelte) -
  three palettes applied via `style="--sg-*: ..."`

## Frequently asked questions

### Does SvGrid work with Tailwind CSS?

Yes - it was built alongside Tailwind v4. They compose cleanly because they have
non-overlapping concerns: Tailwind styles your layout and custom cell content,
while the grid's internals are themed through `--sg-*` CSS variables.

### How do I theme or re-skin the grid?

Set the `--sg-*` custom properties - per instance via `style="--sg-bg: ..."` or
globally in your CSS. They control borders, header background, zebra rows, hover,
selection, and density, including dark mode.

### Do I need Tailwind to use SvGrid?

No. The grid ships a default theme and depends only on its own CSS variables.
Tailwind is one convenient way to style around it, not a requirement.
