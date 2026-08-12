<script lang="ts">
  /**
   * 112. Barcode label cells (EAN-13)
   * ---------------------------------
   * A product / inventory grid that renders a real, scannable EAN-13 barcode
   * in every row - the daily reality of retail, warehouse, and logistics
   * tooling. The barcode is drawn as crisp Svelte SVG (no canvas, no eval, no
   * third-party dependency), so it stays sharp at any zoom, themes with the
   * grid, and prints perfectly.
   *
   * Because the grid virtualizes rows, only the barcodes in the visible window
   * are ever in the DOM - scroll through thousands of products and the cost
   * stays flat.
   *
   * Click any row to pop a shelf-label preview. The same SVG, scaled up.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- EAN-13 encoder ----------------------------------------------------
  // Three 7-module digit encodings + the parity table that lets the first
  // digit ride along in the parity of the left group. This is the actual
  // GS1 EAN-13 spec - the output scans with any barcode reader.
  const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011']
  const G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111']
  const R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
  const PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL']

  /** Mod-10 check digit for the first 12 digits of an EAN-13. */
  function ean13Check(d12: string): number {
    let odd = 0, even = 0
    for (let i = 0; i < 12; i++) (i % 2 === 0 ? (odd += +d12[i]!) : (even += +d12[i]!))
    return (10 - ((odd + 3 * even) % 10)) % 10
  }
  /** Turn a 12-digit prefix into a full, valid 13-digit EAN-13. */
  function ean13(prefix12: string): string { return prefix12 + ean13Check(prefix12) }

  type Bar = { x: number; h: number }
  type Barcode = { bars: Bar[]; width: number; quiet: number; first: string; left: string; right: string }

  // Render geometry, in module units (1 narrow bar = 1 unit). The SVG is
  // scaled up by `unit` px when drawn; viewBox keeps it razor-sharp.
  const QUIET = 9          // quiet zone each side
  const H_BAR = 24         // normal bar height
  const H_GUARD = 30       // guard bars run longer, into the digit row
  const VB_H = 38          // viewBox height (bars + human-readable digits)

  function isGuard(m: number): boolean {
    return m <= 2 || (m >= 45 && m <= 49) || m >= 92 // start / centre / end guards
  }

  /** Encode a 13-digit code into bar rects + digit groups for rendering. */
  function encode(code: string): Barcode {
    const first = +code[0]!
    const leftDigits = code.slice(1, 7)
    const rightDigits = code.slice(7, 13)
    let mods = '101' // start guard
    for (let i = 0; i < 6; i++) mods += PARITY[first]![i] === 'L' ? L[+leftDigits[i]!]! : G[+leftDigits[i]!]!
    mods += '01010' // centre guard
    for (let i = 0; i < 6; i++) mods += R[+rightDigits[i]!]!
    mods += '101' // end guard

    const bars: Bar[] = []
    for (let m = 0; m < mods.length; m++) if (mods[m] === '1') bars.push({ x: QUIET + m, h: isGuard(m) ? H_GUARD : H_BAR })
    return { bars, width: QUIET + 95 + QUIET, quiet: QUIET, first: code[0]!, left: leftDigits, right: rightDigits }
  }

  // ---- Data --------------------------------------------------------------
  type Product = {
    id: string
    sku: string
    name: string
    ean12: string   // 12-digit prefix; the grid renders the full EAN-13
    price: number
    stock: number
    bin: string
    category: string
  }

  // 12-digit prefixes start "50" (a GS1 UK prefix) so the codes look real.
  const rows = $state<Product[]>([
    { id: 'P-1001', sku: 'TOTE-RED-M',     name: 'Canvas tote bag - red',      ean12: '500100000017', price: 29.95, stock: 148,  bin: 'A-01-3', category: 'Apparel' },
    { id: 'P-1002', sku: 'TOTE-BLUE-M',    name: 'Canvas tote bag - blue',     ean12: '500100000024', price: 29.95, stock: 127,  bin: 'A-01-4', category: 'Apparel' },
    { id: 'P-1003', sku: 'HAT-BB-NAVY',    name: 'Baseball hat - navy',        ean12: '500100000031', price: 24.00, stock: 201,  bin: 'A-02-1', category: 'Apparel' },
    { id: 'P-1004', sku: 'HOODIE-GRY-L',   name: 'Pullover hoodie - grey, L',  ean12: '500100000048', price: 49.00, stock:  64,  bin: 'A-02-2', category: 'Apparel' },
    { id: 'P-1005', sku: 'SOCK-WOOL-3PK',  name: 'Merino socks (3-pack)',      ean12: '500100000055', price: 18.00, stock: 412,  bin: 'A-03-1', category: 'Apparel' },
    { id: 'P-1006', sku: 'MUG-LOGO-12OZ',  name: 'Logo mug 12 oz',             ean12: '500100000062', price: 14.50, stock: 482,  bin: 'B-01-1', category: 'Drinkware' },
    { id: 'P-1007', sku: 'BOTTLE-INSU-32', name: 'Insulated bottle 32 oz',     ean12: '500100000079', price: 34.00, stock:  92,  bin: 'B-01-2', category: 'Drinkware' },
    { id: 'P-1008', sku: 'TUMBLER-20OZ',   name: 'Steel tumbler 20 oz',        ean12: '500100000086', price: 27.50, stock: 173,  bin: 'B-01-3', category: 'Drinkware' },
    { id: 'P-1009', sku: 'FLASK-HIP-8OZ',  name: 'Hip flask 8 oz',             ean12: '500100000093', price: 22.00, stock:  58,  bin: 'B-02-1', category: 'Drinkware' },
    { id: 'P-1010', sku: 'PEN-CHISEL-2PK', name: 'Calligraphy pens (2-pack)',  ean12: '500100000109', price:  8.99, stock: 1240, bin: 'C-01-1', category: 'Stationery' },
    { id: 'P-1011', sku: 'NOTEBOOK-A5',    name: 'Hardcover notebook A5',      ean12: '500100000116', price: 18.50, stock: 365,  bin: 'C-01-2', category: 'Stationery' },
    { id: 'P-1012', sku: 'STICKER-PACK',   name: 'Sticker pack (10)',          ean12: '500100000123', price:  5.00, stock: 2895, bin: 'C-01-3', category: 'Stationery' },
    { id: 'P-1013', sku: 'MARKER-FINE-6',  name: 'Fineliner set (6 colours)',  ean12: '500100000130', price: 12.75, stock: 540,  bin: 'C-02-1', category: 'Stationery' },
    { id: 'P-1014', sku: 'PLANNER-2026',   name: 'Weekly planner 2026',        ean12: '500100000147', price: 21.00, stock: 230,  bin: 'C-02-2', category: 'Stationery' },
    { id: 'P-1015', sku: 'CABLE-USBC-2M',  name: 'USB-C cable 2 m',            ean12: '500100000154', price:  9.99, stock: 880,  bin: 'D-01-1', category: 'Electronics' },
    { id: 'P-1016', sku: 'CHRG-30W-USBC',  name: '30 W USB-C charger',         ean12: '500100000161', price: 24.99, stock: 311,  bin: 'D-01-2', category: 'Electronics' },
    { id: 'P-1017', sku: 'EARBUD-BT-BLK',  name: 'Bluetooth earbuds - black',  ean12: '500100000178', price: 59.00, stock: 142,  bin: 'D-02-1', category: 'Electronics' },
    { id: 'P-1018', sku: 'POWERBANK-10K',  name: 'Power bank 10,000 mAh',      ean12: '500100000185', price: 34.50, stock:  97,  bin: 'D-02-2', category: 'Electronics' },
    { id: 'P-1019', sku: 'MOUSE-WL-GRY',   name: 'Wireless mouse - grey',      ean12: '500100000192', price: 19.95, stock: 256,  bin: 'D-03-1', category: 'Electronics' },
    { id: 'P-1020', sku: 'COFFEE-250-DRK', name: 'Dark roast coffee 250 g',    ean12: '500100000208', price:  8.50, stock: 640,  bin: 'E-01-1', category: 'Grocery' },
    { id: 'P-1021', sku: 'TEA-GREEN-50',   name: 'Green tea (50 bags)',        ean12: '500100000215', price:  6.25, stock: 720,  bin: 'E-01-2', category: 'Grocery' },
    { id: 'P-1022', sku: 'HONEY-RAW-340',  name: 'Raw honey 340 g',            ean12: '500100000222', price:  9.75, stock: 188,  bin: 'E-02-1', category: 'Grocery' },
    { id: 'P-1023', sku: 'CHOC-DARK-85',   name: 'Dark chocolate 85 g',        ean12: '500100000239', price:  3.20, stock: 1530, bin: 'E-02-2', category: 'Grocery' },
    { id: 'P-1024', sku: 'OLIVE-XV-500',   name: 'Olive oil extra virgin 500 ml', ean12: '500100000246', price: 12.00, stock: 264, bin: 'E-03-1', category: 'Grocery' },
  ])

  // ---- View state --------------------------------------------------------
  type Scale = 'S' | 'M' | 'L'
  let scale = $state<Scale>('M')
  let showText = $state(true)
  const unitFor: Record<Scale, number> = { S: 1.3, M: 1.6, L: 2.0 }
  const unit = $derived(unitFor[scale])

  let selected = $state<Product | null>(null)

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const columns: ColumnDef<typeof features, Product>[] = [
    { field: 'sku',   header: 'SKU',     width: 150 },
    { field: 'name',  header: 'Product', width: 230 },
    {
      field: 'ean12', header: 'Barcode (EAN-13)', width: 260,
      cell: (c) => renderSnippet(BarcodeCell, { code: ean13(c.row.original.ean12) }),
    },
    { field: 'price', header: 'Price', width: 100, align: 'right', format: { type: 'currency', currency: 'USD' } },
    { field: 'stock', header: 'Stock', width: 90,  align: 'right' },
    { field: 'bin',   header: 'Bin',   width: 90 },
    { field: 'category', header: 'Category', width: 130 },
  ]
</script>

<!-- One barcode cell. Reads `unit` + `showText` so the toolbar re-renders it. -->
{#snippet Barcode(code: string, u: number, withText: boolean)}
  {@const bc = encode(code)}
  <svg
    class="bc-svg"
    viewBox={`0 0 ${bc.width} ${VB_H}`}
    width={bc.width * u}
    height={VB_H * u}
    role="img"
    aria-label={`EAN-13 barcode ${code}`}
  >
    <rect x="0" y="0" width={bc.width} height={VB_H} fill="#ffffff" />
    {#each bc.bars as bar}
      <rect x={bar.x} y="0" width="1" height={bar.h} fill="#000000" shape-rendering="crispEdges" />
    {/each}
    {#if withText}
      <g font-family="ui-monospace, Menlo, Consolas, monospace" font-size="8.5" fill="#000000">
        <text x={bc.quiet - 8} y="36" text-anchor="start">{bc.first}</text>
        {#each bc.left.split('') as d, i}
          <text x={bc.quiet + 6.5 + i * 7} y="36" text-anchor="middle">{d}</text>
        {/each}
        {#each bc.right.split('') as d, i}
          <text x={bc.quiet + 53.5 + i * 7} y="36" text-anchor="middle">{d}</text>
        {/each}
      </g>
    {/if}
  </svg>
{/snippet}

{#snippet BarcodeCell(props: { code: string })}
  <div class="bc-cell">{@render Barcode(props.code, unit, showText)}</div>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info shrink-0">
    <p>
      <strong>Every row renders a real, scannable EAN-13 barcode</strong> drawn as crisp SVG -
      no canvas, no <code>eval</code>, no dependency. Point a phone barcode scanner at your screen
      and it reads the digits below the bars. Row virtualization means only the visible barcodes
      are in the DOM.
    </p>
    <p class="info-hint">
      <strong>Click a row</strong> to pop a shelf-label preview. Use the controls to scale the bars
      or hide the human-readable digits.
    </p>
  </div>

  <div class="toolbar shrink-0">
    <span class="tb-label">Bar size</span>
    {#each ['S', 'M', 'L'] as const as s}
      <button type="button" class="tb-btn" class:active={scale === s} onclick={() => (scale = s)}>{s}</button>
    {/each}
    <label class="tb-check">
      <input type="checkbox" bind:checked={showText} />
      Human-readable digits
    </label>
  </div>

  <div class="grid-host flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      showPagination={false}
      rowHeight={62}
      containerHeight="100%"
      fitColumns={true}
      onRowClick={(e) => (selected = e.row)}
    />
  </div>

  {#if selected}
    {@const sel = selected}
    <div class="label-panel shrink-0">
      <div class="label-card">
        <div class="label-head">
          <div>
            <div class="label-name">{sel.name}</div>
            <div class="label-sub">{sel.sku} · Bin {sel.bin} · {sel.category}</div>
          </div>
          <div class="label-price">${sel.price.toFixed(2)}</div>
        </div>
        <div class="label-bc">{@render Barcode(ean13(sel.ean12), 2.6, true)}</div>
      </div>
      <button type="button" class="label-close" onclick={() => (selected = null)} aria-label="Close label">×</button>
    </div>
  {/if}
</section>

<style>
  .info {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: color-mix(in oklab, var(--sg-accent, #6366f1) 5%, transparent);
    border-radius: 8px; padding: 10px 14px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .info p { margin: 0; }
  .info p + p { margin-top: 4px; color: var(--sg-muted, #64748b); }
  .info code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
               background: color-mix(in oklab, var(--sg-accent, #6366f1) 10%, transparent);
               padding: 1px 5px; border-radius: 3px;
               color: var(--sg-accent, #4338ca); font-size: 12px; }

  .toolbar {
    display: flex; align-items: center; gap: 8px;
    font-size: 13px; color: var(--sg-fg, #0f172a);
  }
  .tb-label { font-weight: 600; color: var(--sg-muted, #64748b); }
  .tb-btn {
    min-width: 30px; padding: 4px 8px; border-radius: 6px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    font-weight: 600; cursor: pointer;
  }
  .tb-btn.active {
    background: var(--sg-accent, #4338ca);
    border-color: var(--sg-accent, #4338ca);
    color: var(--sg-on-accent, #fff);
  }
  .tb-check { display: inline-flex; align-items: center; gap: 6px; margin-left: 8px;
              color: var(--sg-muted, #64748b); cursor: pointer; }

  /* Barcode cell ------------------------------------------------- */
  .bc-cell { display: flex; align-items: center; height: 100%; }
  :global(.bc-svg) { display: block; }

  /* Shelf-label preview ------------------------------------------ */
  .label-panel { position: relative; }
  .label-card {
    display: flex; flex-direction: column; gap: 10px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px; padding: 14px 16px;
    background: var(--sg-bg, #ffffff); color: var(--sg-fg, #0f172a);
    box-shadow: 0 10px 30px rgba(15,23,42,0.10);
    max-width: 460px;
  }
  .label-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .label-name { font-size: 16px; font-weight: 700; }
  .label-sub  { font-size: 12px; color: var(--sg-muted, #64748b); margin-top: 2px; }
  .label-price { font-size: 22px; font-weight: 800; color: var(--sg-accent, #4338ca); }
  .label-bc { display: flex; justify-content: center; padding-top: 4px; }
  .label-close {
    position: absolute; top: -8px; right: -8px;
    width: 26px; height: 26px; border-radius: 50%;
    border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-muted, #475569);
    font-size: 16px; line-height: 1; cursor: pointer;
    box-shadow: 0 2px 6px rgba(15,23,42,0.12);
  }
</style>
