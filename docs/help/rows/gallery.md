# Gallery mode

Set the `gallery` prop and the grid renders its rows as **cards** instead of a
table: a cover image, a title and a few fields per row, in a wall that fills
the width. It is the same `<SvGrid>`, the same `data` and `columns`; the cards
are the rows the table would show, so the search box, column filters and the
sort carry over, and turning the prop off brings the table back in the same
order.

<div data-docs-demo="505-gallery-catalog" data-height="640"></div>

The gallery *renderer* ships in `@svgrid/enterprise`, so `enableGalleryView()`
(or `installEnterprise(api)`) is what lights it up. The `gallery` prop and the
`GalleryConfig` type are part of the free grid; without the renderer the grid
shows a short note where the cards would be.

```svelte
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'
  import { enableGalleryView } from '@svgrid/enterprise'

  enableGalleryView()

  type Product = { id: number; name: string; image: string; category: string; price: number }
  let { data }: { data: Product[] } = $props()

  const columns: GridColumns<Product> = [
    { field: 'name', header: 'Product' },
    { field: 'category', header: 'Category' },
    { field: 'price', header: 'Price', format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<SvGrid {data} {columns} getRowId={(r) => String(r.id)}
  gallery={{ coverField: 'image', titleField: 'name', cardFields: ['category', 'price'] }} />
```

## What a card shows

| Option | What it does |
|---|---|
| `coverField` | The field holding the cover: an image URL (`https:`, `blob:` or a `data:image/...` URL), or a list of files (`{ url, type, name, thumbnailUrl }`), whose first image is used. Omit it for cards without a cover. |
| `coverFit` | `'cover'` (default) crops the image to fill the cover's box; `'contain'` shows all of it. |
| `titleField` | The card's title. Defaults to the first column's field. |
| `cardFields` | The fields under the title, in this order. Defaults to the next columns, up to six, leaving out the title and the cover. |
| `showLabels` | Each value under its field's name (default `true`). |
| `cardSize` | `'small'` (180px), `'medium'` (240px, default), `'large'` (320px) or a width in pixels. The wall fits as many columns as the width holds. |
| `emptyText` | What the wall says when no row is shown (default "No records"). |
| `searchable`, `searchPlaceholder` | The search box above the cards (on by default); it is the grid's quick filter. |
| `cellGrid` | `(width) => grid`: what a field type's cell on a card gets as its grid. A base's gallery view sets it to the grid itself at the card's width, with editing off; without it a cell gets an object with `getColumnWidth` only. |

A value is written the way the table cell writes it: through the column's
`formatter`, else its `format` config (currency, percent, dates), else as
text. A column declared by field type (`@svgrid/enterprise/fields`) draws on
the card with its own cell: a select as its colored pill, a rating as stars, a
person with an avatar, and the field's type icon sits beside its name.

<div data-docs-demo="508-gallery-field-types" data-height="620"></div>

## Clicks

`onCardClick(row)` is called when a card is clicked, or when its title gets
Enter or Space from the keyboard (the title is the card's button). Without
it the cards are not clickable. Values on a card are read, not edited.

```ts
const gallery = { coverField: 'image', onCardClick: (row: Product) => (picked = row) }
```

## Your own card

`card` is a snippet that receives each row; the grid lays the cards out and
you draw what is inside.

```svelte
{#snippet profile(p: Person)}
  <article class="profile">
    <img src={p.photo} alt="" width="72" height="72" />
    <strong>{p.name}</strong>
    <span>{p.role}</span>
  </article>
{/snippet}

<SvGrid {data} {columns} gallery={{ card: profile, cardSize: 220 }} />
```

<div data-docs-demo="506-gallery-team-directory" data-height="620"></div>

## Filters, sort and search

The cards are the grid's filtered and sorted rows, so everything that shapes
the table shapes the wall: `api.setFilter`, `api.setSort`, the quick filter,
an advanced filter. A new filter or search starts the wall from the top.

<div data-docs-demo="507-gallery-listings" data-height="640"></div>

## Many rows

The wall draws its cards in batches: the first 120, then the next 120 a
little before the end comes into view. A gallery over thousands of rows costs
about the same to open as a small one. A cover can come from a computed
column (`fieldFn`), so the image need not be stored in the rows.

<div data-docs-demo="509-gallery-at-scale" data-height="620"></div>

## In a table with views

The [fields module](../fields.md)'s gallery view is this gallery, set up from
the view: the cover field, the primary field as the title, the fields the
grid shows as the card's fields, and a click that opens the record.
