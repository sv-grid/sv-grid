# Barcode cells in a Svelte data grid (EAN-13)

Render a real, scannable EAN-13 barcode in every row of your Svelte data grid -
drawn as crisp SVG with no canvas, no `eval`, and no third-party dependency.
This is the retail, warehouse, and inventory pattern: a product table where each
row carries its own barcode label, sharp at any zoom and ready to print.

<div data-docs-demo="112-barcode-cells" data-height="640"></div>

## When to use it

- Product catalogs, inventory, and stock-keeping grids (UPC / EAN).
- Warehouse pick lists, shelf labels, and asset tags.
- Any grid where a row maps to a physical item that needs a barcode.

## How it works

A barcode is a pure function from a code to a set of bars. Encode the 13-digit
value once, then render the bars as SVG through `renderSnippet` - the same way
you would render any custom cell. Because it is SVG (not a canvas bitmap) it
stays crisp when zoomed, themes with the grid, prints perfectly, and keeps your
CSP-clean runtime intact.

```svelte
<script lang="ts">
  import { SvGrid, renderSnippet, type ColumnDef } from 'sv-grid-core'

  // --- EAN-13 encoder (the actual GS1 spec - the output scans) ----------
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
  const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
  const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
  const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

  /** Mod-10 check digit for the first 12 digits. */
  function ean13Check(d12: string): number {
    let odd = 0, even = 0
    for (let i = 0; i < 12; i++) (i % 2 === 0 ? (odd += +d12[i]!) : (even += +d12[i]!))
    return (10 - ((odd + 3 * even) % 10)) % 10
  }
  /** 12-digit prefix -> full, valid 13-digit EAN-13. */
  const ean13 = (prefix12: string) => prefix12 + ean13Check(prefix12)

  const QUIET = 9, H_BAR = 24, H_GUARD = 30, VB_H = 38
  const isGuard = (m: number) => m <= 2 || (m >= 45 && m <= 49) || m >= 92

  /** Encode a 13-digit code into 1-module-wide bar rects. */
  function encode(code: string) {
    const first = +code[0]!, left = code.slice(1, 7), right = code.slice(7, 13)
    let mods = '101'
    for (let i = 0; i < 6; i++) mods += PARITY[first]![i] === 'L' ? L[+left[i]!]! : G[+left[i]!]!
    mods += '01010'
    for (let i = 0; i < 6; i++) mods += R[+right[i]!]!
    mods += '101'
    const bars: { x: number; h: number }[] = []
    for (let m = 0; m < mods.length; m++) if (mods[m] === '1') bars.push({ x: QUIET + m, h: isGuard(m) ? H_GUARD : H_BAR })
    return { bars, width: QUIET + 95 + QUIET }
  }

  type Product = { sku: string; name: string; ean12: string }
  const rows: Product[] = [
    { sku: 'TOTE-RED-M', name: 'Canvas tote bag - red', ean12: '500100000017' },
    { sku: 'MUG-LOGO-12OZ', name: 'Logo mug 12 oz', ean12: '500100000062' },
  ]

  const columns: ColumnDef<{}, Product>[] = [
    { field: 'sku', header: 'SKU', width: 150 },
    { field: 'name', header: 'Product', width: 230 },
    {
      field: 'ean12', header: 'Barcode', width: 220,
      cell: (c) => renderSnippet(BarcodeCell, { code: ean13(c.row.original.ean12) }),
    },
  ]
</script>

{#snippet BarcodeCell(props: { code: string })}
  {@const bc = encode(props.code)}
  <svg viewBox={`0 0 ${bc.width} ${VB_H}`} width={bc.width * 1.6} height={VB_H * 1.6}
       role="img" aria-label={`EAN-13 ${props.code}`}>
    <rect x="0" y="0" width={bc.width} height={VB_H} fill="#fff" />
    {#each bc.bars as bar}
      <rect x={bar.x} y="0" width="1" height={bar.h} fill="#000" shape-rendering="crispEdges" />
    {/each}
  </svg>
{/snippet}

<SvGrid data={rows} columns={columns} rowHeight={62} />
```

Notes that matter in production:

- **It scans.** EAN-13 uses three 7-module digit encodings (L / G / R) plus a
  parity table that lets the first digit ride along in the parity of the left
  group. The check digit is mod-10. Point a phone scanner at the screen to
  confirm.
- **No dependency, CSP-clean.** The bars are Svelte SVG rects - no `eval`, no
  `new Function`, no canvas. Keep the encoder out of your shared bundle if only
  a few grids need it.
- **Virtualization keeps it cheap.** Only the barcodes in the visible row
  window are ever in the DOM, so it scales to thousands of products. See
  [Cell components](../help/cells/cell-components.md) for the rendering model.

## Print-ready labels

Because every code is SVG, the same markup scales to a shelf label or asset tag
and prints razor-sharp. The [demo](https://svgrid.com/demos/112-barcode-cells)
pops a label preview on row click; pair it with the
[Pro print / export pack](../help/export.md) to generate pick lists or label
sheets from the grid.

## What about QR codes?

QR codes follow the same cell-renderer pattern, but a correct QR encoder needs
Reed-Solomon error correction and mask selection, so reach for a small library
(for example `qrcode`) rather than hand-rolling it, then render its SVG output
through `renderSnippet` exactly as above.

## Frequently asked questions

### Can SvGrid render barcodes in a data grid cell?

Yes. A column's `cell` renderer can return any Svelte markup, including an
inline SVG barcode. The example above renders a scannable EAN-13 per row with no
third-party library.

### Does rendering barcodes need a barcode library?

No, not for EAN-13 / UPC and other linear symbologies - the encoder is a small
pure function and the bars are SVG rects. QR codes are the exception: use a
library for the Reed-Solomon error correction.

### Will the rendered barcodes actually scan?

Yes. The encoder implements the GS1 EAN-13 specification (L/G/R digit encodings,
the first-digit parity table, and the mod-10 check digit), so a standard barcode
reader decodes it.

### Is it fast with thousands of rows?

Yes. The grid virtualizes rows, so only the barcodes in the visible window are
in the DOM regardless of how many products the grid holds.

## See also

- [Demo 112-barcode-cells source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/112-barcode-cells.svelte)
- [Cell components](../help/cells/cell-components.md) - the custom-cell rendering model
- [Sparkline cell renderer](./sparkline-cells.md) - the same SVG-in-a-cell pattern
- [Data export and printing - Pro](../help/export.md) - print labels and pick lists
- [Recipes index](./index.md)
