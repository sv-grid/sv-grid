# Design tokens

Every visual property the grid exposes for theming is a CSS custom
property (`--sg-*`). Tokens cascade like any other CSS variable -
override at `:root`, on a wrapper element, or per-grid; the closest
declaration wins.
<div data-docs-demo="74-theme-integrations" data-height="540"></div>

> No build step. No theme provider. No design-system lock-in. Set a
> few `--sg-*` tokens and the grid re-skins immediately.

Live in [demo 74 (Theme integrations)](https://svgrid.com/demos/74-theme-integrations/)
- shows the same grid rendered through Ant Design, MUI, Fluent, Base
Web, and shadcn token sets.

## Core surface tokens

These are the tokens 95% of integrations override. Stable; safe to
ship in a corporate design system.

| Token                  | Default (light)        | Default (dark)         | What it paints                                                       |
| ---------------------- | ---------------------- | ---------------------- | -------------------------------------------------------------------- |
| `--sg-bg`              | `#ffffff`              | `#0f172a`              | Grid background / cell fill                                          |
| `--sg-fg`              | `#0f172a`              | `#f1f5f9`              | Primary text colour                                                  |
| `--sg-muted`           | `#64748b`              | `#94a3b8`              | Secondary text (header subtitles, placeholders, "no data" message)   |
| `--sg-border`          | `#e2e8f0`              | `#1e293b`              | Cell borders, separators                                             |
| `--sg-header-bg`       | `#f8fafc`              | `#1e293b`              | Column-header row background                                         |
| `--sg-header-fg`       | inherits `--sg-fg`     | inherits `--sg-fg`     | Column-header text                                                   |
| `--sg-header-border`   | inherits `--sg-border` | inherits `--sg-border` | Line under the column-header row only (body cell borders unaffected) |
| `--sg-row-alt-bg`      | inherits `--sg-bg`     | inherits `--sg-bg`     | Zebra-stripe background for even-indexed rows                        |
| `--sg-row-hover-bg`    | `rgba(148,163,184,.10)`| `rgba(148,163,184,.14)`| Hover row background                                                 |
| `--sg-selection-bg`    | `rgba(99,102,241,.10)` | `rgba(99,102,241,.18)` | Selected row / selected cell-range fill                              |
| `--sg-accent`          | `#6366f1`              | `#818cf8`              | Active-cell ring, primary buttons, sort indicator                    |
| `--sg-focus-ring`      | `0 0 0 2px rgba(99,102,241,.40)` | same | Box-shadow used for the focus outline                                |

## Layout tokens

| Token                  | Default     | What it controls                                                       |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| `--sg-row-height`      | `32px`      | Default row height. Per-grid override via the `rowHeight` prop wins.    |
| `--sg-radius`          | `6px`       | Border radius on rounded UI inside the grid (chips, badges, menus)      |
| `--sg-font`            | inherits    | Font family used inside the grid                                        |

## Header typography tokens

The column-header label is themeable on its own so a preset can match
its design system's grid header (bold, muted, small caps) without
touching the rest of the grid.

| Token                     | Default                | What it controls                                                    |
| ------------------------- | ---------------------- | ------------------------------------------------------------------- |
| `--sg-header-label-color` | inherits `--sg-header-fg` | Header label colour, when it should differ from the header text  |
| `--sg-header-weight`      | `600`                  | Header label font weight                                            |
| `--sg-header-size`        | inherits               | Header label font size                                              |
| `--sg-header-transform`   | `none`                 | Header label `text-transform` (e.g. `uppercase`)                    |
| `--sg-header-tracking`    | `normal`               | Header label `letter-spacing`                                       |
| `--sg-header-min-height`  | `auto`                 | Minimum height of a header cell                                     |

## Pinned-column tokens

| Token                  | Default     | What it paints                                                         |
| ---------------------- | ----------- | ---------------------------------------------------------------------- |
| `--sg-pinned-bg`       | inherits `--sg-bg` | Pinned-column cell background (must be opaque to cover scroll under) |
| `--sg-pinned-header-bg`| inherits `--sg-header-bg` | Pinned-column header background                              |
| `--sg-pinned-divider`  | `#cbd5e1`   | 2px separator between pinned and scrolling region                      |
| `--sg-pinned-border`   | `color-mix(in oklab, var(--sg-accent) 24%, transparent)` | Top/bottom border of pinned **rows** |
| `--sg-pinned-shadow-color` | `rgba(15,23,42,.22)` | Colour of the shadow a pinned column casts into the scroll area |

## Surface tokens

| Token                  | Default                   | What it paints                                                    |
| ---------------------- | ------------------------- | ------------------------------------------------------------------ |
| `--sg-bg-subtle`       | inherits `--sg-header-bg` | Inset surfaces such as the master-detail region behind a nested grid |

## Input + form tokens

| Token                  | Default                | What it paints                                                       |
| ---------------------- | ---------------------- | -------------------------------------------------------------------- |
| `--sg-input-bg`        | inherits `--sg-bg`     | Cell-editor `<input>` background                                     |
| `--sg-input-border`    | inherits `--sg-border` | Cell-editor border                                                   |
| `--sg-rating-on`       | `#f59e0b`              | Filled star colour in the rating editor                              |
| `--sg-rating-empty`    | `#cbd5e1`              | Empty star colour                                                    |
| `--sg-rating-hover`    | `#fbbf24`              | Star hover-state colour                                              |

## Scrollbar tokens

The grid uses a custom scrollbar so it looks consistent across OSes.

| Token                            | Default     |
| -------------------------------- | ----------- |
| `--sg-scrollbar-bg`              | `transparent` |
| `--sg-scrollbar-border`          | inherits `--sg-border` |
| `--sg-scrollbar-thumb`           | `rgba(148,163,184,.45)` |
| `--sg-scrollbar-thumb-hover`     | `rgba(148,163,184,.65)` |
| `--sg-scrollbar-thumb-active`    | `rgba(148,163,184,.85)` |
| `--sg-scrollbar-arrow`           | inherits `--sg-muted` |
| `--sg-scrollbar-arrow-hover`     | inherits `--sg-fg` |
| `--sg-scrollbar-arrow-hover-bg`  | inherits `--sg-row-hover-bg` |
| `--sg-scrollbar-arrow-active`    | inherits `--sg-accent` |
| `--sg-scrollbar-arrow-active-bg` | inherits `--sg-row-hover-bg` |
| `--sg-scrollbar-arrow-disabled`  | `rgba(148,163,184,.35)` |

## Pill / status tokens (gallery-defined)

These are used by several demos but live in the gallery, not the
library. Copy if you want the same convention; rename freely otherwise.

| Token                       | Used for                                |
| --------------------------- | --------------------------------------- |
| `--sg-pill-active`          | "Active" status chip background         |
| `--sg-pill-active-fg`       | "Active" status chip text               |
| `--sg-pill-pending`         | "Pending" status chip background        |
| `--sg-pill-pending-fg`      | "Pending" status chip text              |
| `--sg-pill-inactive`        | "Inactive" status chip background       |
| `--sg-pill-inactive-fg`     | "Inactive" status chip text             |

## How to override

### Globally (your app's stylesheet)

```css
:root {
  --sg-accent: #db2777;          /* hot pink everywhere */
  --sg-row-height: 36px;
  --sg-font: 'Inter', sans-serif;
}
```

### Per-grid (Tailwind / inline style)

```svelte
<div class="my-grid" style="--sg-accent: #16a34a">
  <SvGrid {data} {columns} features={features} />
</div>
```

### Dark mode

The library doesn't ship a built-in dark theme - it reads whatever
your app provides. Most apps gate via `[data-theme="dark"]` on
`<html>`; sv-grid's only requirement is that you override the same
token set under that selector:

```css
[data-theme="dark"] {
  --sg-bg:           #0f172a;
  --sg-fg:           #f1f5f9;
  --sg-border:       #1e293b;
  --sg-header-bg:    #1e293b;
  --sg-row-hover-bg: rgba(148, 163, 184, 0.14);
  --sg-selection-bg: rgba(99, 102, 241, 0.18);
}
```

Theme presets ship in
[demo 74](https://svgrid.com/demos/74-theme-integrations/) for Ant
Design, MUI, Fluent, Base Web, and shadcn - each with a light AND a
dark token bundle ready to copy.

### Built-in design-system presets

`@svgrid/grid` also ships 20 ready-made presets as plain stylesheets - import the
one you want and the grid re-skins immediately, light and dark both included
(toggle with the same `[data-theme="dark"]` attribute as above):

```css
@import '@svgrid/grid/themes/material.css';
```

Available ids: `ember`, `shadcn`, `tailwind`, `material`, `excel`, `fluent`,
`carbon`, `sap`, `salesforce`, `atlassian`, `github`, `antd`, `ag-alpine`,
`bootstrap`, `vercel`, `linear`, `notion`, `nord`, `dracula`, `catppuccin`.

`ember` is SvGrid's own theme rather than a copy of an external design system:
warm neutrals with Svelte orange as the single accent. It is the palette
svgrid.com runs on, so one import reproduces the look of the grids on the site.

## Stability promise

Core surface tokens (the first table) are **stable**: they will not
be renamed or removed in a minor version. New tokens may be added.
See [API stability](./api-stability.md) for the full policy.

Layout / pinned / scrollbar / input tokens follow the same promise.

Pill tokens are gallery-defined - the LIBRARY makes no promise about
them.

## See also

- [Tailwind integration](./tailwind.md) - how to wire tokens through
  Tailwind's theming layer
- [Custom cells + themes](https://svgrid.com/demos/10-custom-cells-and-themes/) demo - the canonical token-override example
- [Theme integrations](https://svgrid.com/demos/74-theme-integrations/) demo - five design-system presets side by side
