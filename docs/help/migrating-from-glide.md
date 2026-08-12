# Migrating from Glide Data Grid

Glide Data Grid is the canvas-rendered, ultra-high-performance choice
for very wide datasets (100k+ rows, 100+ columns). Sv-grid renders to
DOM with virtualization, which trades peak FPS for
accessibility + standards-compliant HTML.

> Estimated effort: **3-6 hours** per grid. Glide's getCellContent /
> onCellEdited cell-data model is the opposite of sv-grid's
> data-array model; the mental flip takes the most time.

## Mental-model flip

Glide gives you a **canvas + a `getCellContent` callback**: the grid
asks you for each visible cell on demand. Sv-grid wants the
**whole data array up front** (`<SvGrid data={rows}>`); the engine
slices for virtualization.

```diff
- function getCellContent([col, row]) {
-   const r = rows[row]
-   if (col === 0) return { kind: 'text', data: r.name,    displayData: r.name,    allowOverlay: true }
-   if (col === 1) return { kind: 'number', data: r.amount, displayData: fmt(r.amount), allowOverlay: true }
- }
- <DataEditor columns={[...]} getCellContent={getCellContent} rows={rows.length} />

+ const columns: ColumnDef<typeof features, Row>[] = [
+   { field: 'name',   header: 'Name',   editorType: 'text' },
+   { field: 'amount', header: 'Amount', editorType: 'number',
+     format: { type: 'currency', currency: 'USD' } },
+ ]
+ <SvGrid data={rows} columns={columns} features={features} />
```

This change is **good** for 99% of apps: it's less code, less risk
of typos in cell coordinates, full TypeScript type checking on the
row shape. For the 1% of apps with rows that don't fit in memory,
see "Out-of-memory data" below.

## Cell editing

```diff
- function onCellEdited([col, row], newValue) {
-   rows[row] = { ...rows[row], [colToField(col)]: newValue.data }
- }
- <DataEditor onCellEdited={onCellEdited} />

+ <SvGrid
+   data={rows} columns={columns} features={features}
+   onCellValueChange={(e) => {
+     rows[e.rowIndex] = { ...rows[e.rowIndex], [e.columnId]: e.newValue }
+   }}
+ />
```

You can also rely on sv-grid's built-in write-back if `data` is a
Svelte 5 `$state` array - mutations propagate automatically.

## Sorting + filtering

Glide doesn't ship sort / filter UI; you wrap your own. Sv-grid
ships them:

```diff
- // Build your own sort buttons in the toolbar; sort rows yourself.

+ const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
+ <SvGrid data={rows} columns={columns} features={features} filterMode="menu" />
```

## Frozen columns / row markers

| Glide                                  | sv-grid                                       |
| -------------------------------------- | --------------------------------------------- |
| `freezeColumns={1}`                    | `api.setColumnPinning({ left: ['firstColId'] })` |
| `rowMarkers="number"`                  | `showRowNumbers={true}` prop                  |
| `rowMarkers="checkbox"`                | `selectionMode="row"` prop                    |

## Custom drawing → custom snippets

Glide's `drawCustomCell` lets you render anything via canvas. The
sv-grid equivalent is a Svelte snippet (DOM):

```diff
- drawCustomCell(args) {
-   const ctx = args.ctx
-   ctx.fillStyle = args.cell.data.color
-   ctx.fillRect(args.rect.x, args.rect.y, args.rect.width, args.rect.height)
-   return true
- }

+ {
+   field: 'color',
+   cell: (ctx) => renderSnippet(ColorChip, { color: ctx.row.original.color }),
+ }
```

```svelte
{#snippet ColorChip(props)}
  <span style="display: inline-block; width: 18px; height: 18px; background: {props.color};"></span>
{/snippet}
```

## Out-of-memory data

For "10M rows, fetched on scroll" workloads (the only case Glide
genuinely beats sv-grid on), use sv-grid's
[server-side / infinite-scroll pattern](./server-side-data.md):

```svelte
<SvGrid
  data={loadedSlice}
  columns={columns} features={features}
  externalSort={true}
  externalFilter={true}
  onSortingChange={async (s) => { loadedSlice = await fetchPage({ sort: s, offset: 0, limit: 200 }) }}
/>
```

You'll cap practical perf at ~100k rendered rows; for true 10M+
datasets Glide's canvas approach has a perf edge sv-grid won't
match. Most apps don't need 10M rows on screen at once - they need
fast server-side filtering, which both libraries support equally.

## Theming

Glide: huge `theme` prop object. Sv-grid: CSS custom properties (`--sg-*`).

```diff
- <DataEditor theme={{
-   accentColor: '#4F5DFF',
-   accentLight: 'rgba(62, 116, 253, 0.2)',
-   bgCell: '#1c1c20',
-   /* …40 more properties… */
- }} />

+ <div style="--sg-accent: #4F5DFF; --sg-bg: #1c1c20;">
+   <SvGrid {data} {columns} features={features} />
+ </div>
```

See [design tokens](./tokens.md) for the full list (≤ 30 tokens
covers everything; Glide's theme has ~40).

## What you get for free vs Glide

- **Accessibility.** Glide's canvas is invisible to screen readers
  unless you build an off-screen ARIA buffer. Sv-grid is WAI-ARIA
  1.2 grid pattern out of the box; demo 17 covers axe-core CI.
- **Standard HTML.** SEO crawlers, browser Find-in-Page, browser
  zoom, OS-level text scaling - all work because the grid emits
  actual `<table><tr><td>`.
- **Familiar editing.** Browser-native `<input>` / `<select>` for
  cells, with autofill / clipboard / autocorrect intact.
- **Built-in sort / filter / pagination UI.**

## What you give up

- **Peak FPS on >200k visible rows.** Canvas wins here. For most
  apps the gap is invisible; if you've actually measured it on real
  hardware and need the FPS, Glide remains the right call.
- **Per-pixel cell drawing.** DOM cells are sub-pixel-uniform but
  not arbitrarily drawn.

## See also

- [SvGrid vs Glide Data Grid](https://svgrid.com/compare/glide-data-grid) - the side-by-side comparison
- [Performance benchmarks](./benchmarks.md) - measured numbers
- [Server-side data](./server-side-data.md) - the >100k-row pattern
- [Accessibility](./accessibility.md) - the standards compliance Glide doesn't ship

## Frequently asked questions

### Should I move from Glide Data Grid to SvGrid?

Move if you need accessibility, standards-compliant HTML, SEO-friendly markup,
or DOM-based custom cells. Stay on Glide only if you have measured a need for
peak canvas FPS on 200k+ simultaneously visible rows. For most apps the
performance gap is invisible, and SvGrid virtualizes comfortably to 100k+ rows.

### How long does a Glide migration take?

About 3-6 hours per grid. The biggest shift is conceptual: Glide's
`getCellContent` / `onCellEdited` cell-data model is the inverse of SvGrid's
plain data-array model, so the mental flip takes the most time, not the code.

### Does SvGrid render to canvas or DOM?

DOM, with row and column virtualization. That is what gives you WAI-ARIA roles,
keyboard navigation, screen-reader support, and selectable/indexable text -
things a canvas grid like Glide cannot offer.
