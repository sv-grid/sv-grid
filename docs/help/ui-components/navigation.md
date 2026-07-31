# Navigation

Wayfinding components for admin apps and Studio-generated screens. Pure,
keyboard-accessible, theme-token driven.

## Installation

Add any component with the CLI (drops a ready-to-edit starter into your app) - or
add the whole family at once:

<div data-docs-add="add navigation"></div>

They all ship free in the `@svgrid/grid` package, so you can also install it and
import them directly:

<div data-docs-install="@svgrid/grid"></div>

## SvBreadcrumb

A navigation trail. Each item is a link (`href`), a button (`onClick`), or plain
text; the last item is the current page and is never interactive. Long trails
collapse the middle to an expandable ellipsis.

```svelte
<SvBreadcrumb items={[
  { label: 'Home', href: '/' },
  { label: 'Orders', href: '/orders' },
  { label: '#1024' },
]} />
```

Props: `items` (`BreadcrumbItem[]`), `separator`, `maxItems` (collapse when
exceeded), `ariaLabel`. `BreadcrumbItem`: `{ label, href?, onClick?, icon? }`.

## SvPagination

A standalone pager: page numbers with ellipsis plus prev/next and optional
first/last. The page-range math lives in the pure `paginationRange` helper.

```svelte
<SvPagination page={p} pageCount={20} onChange={(n) => (p = n)} showFirstLast />
```

Props: `page` (1-based), `pageCount`, `onChange(page)`, `siblingCount`,
`boundaryCount`, `showFirstLast`, `showPrevNext`, `size` (`sm` | `md` | `lg`),
`disabled`, `ariaLabel`. `paginationRange({ page, pageCount, siblingCount?,
boundaryCount? })` returns the `(number | 'ellipsis-left' | 'ellipsis-right')[]`
sequence and is exported for custom pagers.

## SvStepper

A progress stepper for wizards / multi-step forms: completed, active and upcoming
steps, horizontal or vertical. In `linear` mode only reached steps are clickable.

```svelte
<SvStepper steps={[
  { label: 'Cart' },
  { label: 'Shipping', description: 'Where to send it' },
  { label: 'Payment', optional: true },
]} current={i} onChange={(n) => (i = n)} />
```

Props: `steps` (`StepItem[]`), `current` (0-based), `onChange(index)`, `linear`,
`orientation` (`horizontal` | `vertical`). `StepItem`: `{ label, description?,
optional? }`.

## Component guides

Each component has its own full tutorial with props, keyboard behaviour and
recipes:

- [SvBreadcrumb](./sv-breadcrumb.md) - a collapsing navigation trail.
- [SvPagination](./sv-pagination.md) - a standalone page-number pager.
- [SvStepper](./sv-stepper.md) - a progress stepper for wizards.
- [SvNavPane](./sv-nav-pane.md) - an Outlook-style app-shell sidebar.
- [SvTree](./sv-tree.md) - a WAI-ARIA tree view with checkboxes.
- [SvCommand](./sv-command.md) - a Cmd+K fuzzy command palette.
- [SvTour](./sv-tour.md) - a guided, spotlighted product tour.
- [SvRichText](./sv-rich-text.md) - a lightweight WYSIWYG HTML editor.
