# Internationalisation & RTL

The grid is locale-agnostic by design: every text label is yours to
translate, every formatted value goes through `Intl`, and right-to-left
layout flips via standard CSS logical properties.

![A locale and message catalog drive the grid's strings and Intl formatting; an RTL locale mirrors columns, alignment, and the scrollbar.](/docs-media/grid-i18n-rtl.svg)

Try the live RTL + i18n demo - switch between six locales (en, de,
fr-CA, ja, ar, he); the headers, dates, currencies, and the grid's
own scrollbar position all flip:

<div data-docs-demo="38-rtl-i18n" data-height="540"></div>

## What ships translated

**Nothing.** The grid has no built-in strings to translate. Every
visible string in the grid comes from one of three places:

1. Your column `header` strings.
2. Your cell snippet content.
3. The `Intl.NumberFormat` / `Intl.DateTimeFormat` output the grid
   uses for `format: { type: 'number' | 'currency' | 'percent' | 'date' }`.

If you see an English string in the grid that isn't covered by one of
the three, it's a bug - please file it. (The unlicensed Enterprise
watermark and the console nudge are the only literal strings the
package itself emits, and both are off when a license key is set.)

## Number, currency, date formatting

The built-in `format` config calls `Intl` under the hood. Locale is
inherited from `<html lang="...">` by default; override per-column:

```ts
const columns: ColumnDef<F, Order>[] = [
  // Inherits the document locale (most apps want this).
  { field: 'total', header: 'Total',
    format: { type: 'currency', currency: 'USD' } },

  // Pin to a specific locale - useful for tables of money that should
  // ALWAYS read as USD-grouped regardless of viewer.
  { field: 'usdTotal', header: 'Total (USD)',
    format: { type: 'currency', currency: 'USD', locales: 'en-US' } },

  // Custom Intl options.
  { field: 'createdAt', header: 'Created',
    format: {
      type: 'date',
      pattern: 'long',
      options: { dateStyle: 'medium', timeStyle: 'short' },
    },
  },
]
```

`locales` accepts the same string or array the `Intl` constructors do.
For mixed-locale columns inside a single grid, pass an explicit
`locales`.

## Translating headers and cell content

Use whatever i18n library your app already runs. The grid's only
expectation is "a string, or a render template that returns one":

```svelte
<script lang="ts">
  import { t } from 'svelte-i18n'

  const columns: ColumnDef<F, Order>[] = [
    { field: 'orderId', header: $t('grid.orderId') },
    { field: 'total',   header: $t('grid.total') },
  ]
</script>
```

Because `header` is a string (or a snippet), the column definition
re-evaluates whenever your translation store updates - no extra
re-mount required.

For dynamically-translated cells, use `renderSnippet`:

```svelte
{#snippet StatusCell(props: { row: Order })}
  <span class={`status-${props.row.status}`}>
    {$t(`order.status.${props.row.status}`)}
  </span>
{/snippet}

const columns = [
  { field: 'status', header: $t('grid.status'),
    cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
]
```

## Right-to-left (RTL)

RTL is a single attribute. Set `dir="rtl"` on the `<html>` element (or
on the grid's container) and the layout flips:

```svelte
<html dir={locale.startsWith('ar') || locale.startsWith('he') ? 'rtl' : 'ltr'}>
```

The grid uses logical properties (`inset-inline-start`,
`inset-inline-end`, `padding-inline-start`, etc.) for every position
that depends on direction, including:

- The vertical scrollbar (slides to the left in RTL).
- Column pinning sticky positions.
- The filter row inputs.
- The fill handle on the active cell.
- Sort indicator + filter menu button alignment in headers.

No prop flips; no JS branch. If your layout doesn't flip, look at
your own CSS first - explicit `left` / `right` in your styles will
override the grid's logical-property choices.

### Mixed-direction text

Numbers, currency, and dates inside RTL cells often need an
`<bdi>` wrap so the writing direction doesn't get scrambled by the
surrounding RTL context:

```svelte
{#snippet AmountCell(props: { row: Order })}
  <bdi class="tabular-nums">{fmtMoney(props.row.amount)}</bdi>
{/snippet}
```

The built-in `format` configs already wrap their output - this only
matters for your custom snippets.

## Pluralisation + cardinal rules

`Intl.PluralRules` covers the cases ICU MessageFormat usually
handles. The grid never pluralises on your behalf - your i18n
library should. A common pattern in the gallery demos:

```ts
const status = api.getDisplayedRows().length === 1
  ? '1 result'
  : `${api.getDisplayedRows().length} results`
```

For more languages than "English", use a real plural-rules library:

```ts
const pr = new Intl.PluralRules(locale)
const key = pr.select(count)                    // 'one' | 'other' | ...
const message = i18n[locale][`result_${key}`]
```

## Column ordering by locale

A column called "Cancel" in English might be "Annuler" in French - or
"Stornieren" in German. If users want to find "Cancel" first when
sorting columns alphabetically, sort the column list with
`Intl.Collator`:

```ts
const collator = new Intl.Collator(locale)
const sorted = [...columns].sort((a, b) =>
  collator.compare(String(a.header ?? a.id), String(b.header ?? b.id)),
)
```

The grid never reorders columns on its own (except through
`api.addColumn(..., position)`), so locale-aware sorting is your call.

## CJK column widths

CJK glyphs (Chinese, Japanese, Korean) are roughly double the width
of Latin characters at the same point size. If your default
`columnWidth` was tuned for English, CJK columns will look cramped.

Two options:

1. **Set wider defaults when a CJK locale is active.** A `columnWidth`
   of 180 reads ~10 characters in CJK, vs ~20 in Latin.

   ```ts
   const isCJK = ['ja', 'zh', 'ko'].some((l) => locale.startsWith(l))
   const columns: ColumnDef<F, T>[] = baseColumns.map((c) => ({
     ...c,
     width: c.width ? c.width * (isCJK ? 1.3 : 1) : undefined,
   }))
   ```

2. **Let the user resize.** All grids ship with column resize handles;
   if you let the user save their layout (see [Saved views](./saved-views.md))
   you only need to get the default close, not perfect.

## Date / time picker editors

The `editorType: 'date'` editor uses the browser's native
`<input type="date">`. Locale + first-day-of-week + 24h vs 12h come
from the browser. If you need locked-down behaviour across locales,
swap in a custom editor via [Custom header components](./columns/custom-header-components.md)
+ a custom cell snippet for the editing path.

## A11y interaction with i18n

- Update `<html lang="...">` whenever the locale changes. Screen
  readers pick the right voice from this attribute.
- Update `<html dir="...">` whenever the script flips.
- Keep `aria-label`s in the user's locale; the grid never overrides
  yours.

## See also

- [Tailwind integration](./tailwind.md) - the `--sg-*` tokens and how
  they interact with `dir="rtl"`.
- [Accessibility](./accessibility.md) - all of the above respects
  forced-colors / reduced-motion / screen-reader announcements per
  locale.
- [Demo #38 RTL + i18n](https://svgrid.com/#/demos/38-rtl-i18n)
  - full locale + direction toggle reference.

## Frequently asked questions

### Does SvGrid support right-to-left (RTL) languages?

Yes. Layout flips via standard CSS logical properties, so setting `dir="rtl"` on
a container reverses the grid - columns, scrolling, and pinning included - with
no special configuration.

### How do I localize the grid?

The grid is locale-agnostic: every text label is yours to translate, and every
formatted value (number, currency, percent, date) goes through `Intl` with the
locale you pass. Wire your own i18n strings into headers and custom cells.

### Does SvGrid format numbers and dates per locale?

Yes, through cached `Intl` formatters. Set a column's `format` and the locale,
and values render with the correct separators, currency symbols, and date
patterns automatically.
