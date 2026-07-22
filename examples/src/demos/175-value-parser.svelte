<!-- Documented in: docs/help/editing/parsing-values.md -->
<script lang="ts">
  /**
   * 175. valueParser - transform edits on commit
   * ---------------------------------------------
   * Each column's `valueParser({ newValue, oldValue, rawInput, data, columnId })`
   * refines the committed value AFTER the built-in per-`editorType` coercion,
   * before it is written to the row. Uppercase a SKU, parse a currency string
   * into a number, clamp a discount, round a weight - the grid stores the
   * normalized value, not the raw keystrokes. The log shows raw input -> stored.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    type ColumnDef,
    type ValueParserParams,
  } from '@svgrid/grid'

  type Product = {
    sku: string
    name: string
    price: number
    discount: number
    weight: number
  }

  let rows = $state<Product[]>([
    { sku: 'KB-101', name: 'Mechanical Keyboard', price: 129.99, discount: 15, weight: 1.23 },
    { sku: 'MS-202', name: 'Wireless Mouse', price: 49.5, discount: 0, weight: 0.21 },
    { sku: 'HD-303', name: 'Noise-Cancelling Headphones', price: 299, discount: 20, weight: 0.33 },
    { sku: 'WC-404', name: '4K Webcam', price: 89.9, discount: 10, weight: 0.15 },
    { sku: 'DK-505', name: 'Standing Desk', price: 549, discount: 5, weight: 24.5 },
  ])

  const features = tableFeatures({ rowSortingFeature })

  type LogEntry = { seq: number; col: string; raw: string; stored: string }
  let log = $state<LogEntry[]>([])
  let seq = 0

  // Wrap a parser so the demo can show "what you typed -> what got stored".
  function logged(col: string, fn: (p: ValueParserParams<Product>) => unknown) {
    return (p: ValueParserParams<Product>) => {
      const out = fn(p)
      seq += 1
      log = [{ seq, col, raw: p.rawInput, stored: String(out) }, ...log].slice(0, 9)
      return out
    }
  }

  const columns: ColumnDef<typeof features, Product>[] = [
    {
      field: 'sku',
      header: 'SKU → UPPER-CASE',
      editorType: 'text',
      width: 170,
      valueParser: logged('sku', ({ newValue }) =>
        String(newValue).trim().toUpperCase().replace(/\s+/g, '-'),
      ),
    },
    {
      field: 'name',
      header: 'Name → Title Case',
      editorType: 'text',
      width: 240,
      valueParser: logged('name', ({ newValue }) =>
        String(newValue)
          .trim()
          .replace(/\s+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase()),
      ),
    },
    {
      field: 'price',
      header: 'Price → parse "$1,299.9"',
      editorType: 'text',
      width: 200,
      align: 'right',
      format: { type: 'currency', currency: 'USD' },
      // Accepts "$1,299.90", "1299.9", "1,299" -> a number rounded to 2dp.
      valueParser: logged('price', ({ newValue, oldValue }) => {
        const n = Number(String(newValue).replace(/[^0-9.\-]/g, ''))
        return Number.isFinite(n) ? Math.round(n * 100) / 100 : oldValue
      }),
    },
    {
      field: 'discount',
      header: 'Discount % → clamp 0–100',
      editorType: 'number',
      width: 190,
      align: 'right',
      valueParser: logged('discount', ({ newValue }) =>
        Math.max(0, Math.min(100, Math.round(Number(newValue) || 0))),
      ),
    },
    {
      field: 'weight',
      header: 'Weight kg → round 2dp',
      editorType: 'number',
      width: 170,
      align: 'right',
      valueParser: logged('weight', ({ newValue }) =>
        Math.round((Number(newValue) || 0) * 100) / 100,
      ),
    },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <p class="text-sm shrink-0" style="color: var(--sg-fg);">
    Double-click a cell (or press <kbd>F2</kbd>) and type freely - a lowercase SKU,
    <code>$1,299.90</code> in Price, <code>250</code> in Discount. On commit each
    column's <code>valueParser</code> normalizes the value before it is stored.
  </p>

  <div class="shrink-0 rounded-lg border" style="border-color: var(--sg-border); background: var(--sg-header-bg);">
    <div class="px-3 py-2 border-b text-xs font-semibold uppercase tracking-wider"
      style="border-color: var(--sg-border); color: var(--sg-muted);">
      valueParser log &nbsp; <span style="text-transform: none; font-weight: 400;">raw input → stored value</span>
    </div>
    <div class="max-h-28 overflow-y-auto px-3 py-2">
      {#if log.length === 0}
        <p class="text-xs italic" style="color: var(--sg-muted);">Nothing edited yet.</p>
      {:else}
        <ul class="space-y-1">
          {#each log as e (e.seq)}
            <li class="text-xs flex flex-wrap gap-x-2" style="color: var(--sg-fg);">
              <code style="color: var(--site-accent-2, #22d3ee);">{e.col}</code>
              <code style="color: var(--sg-fg);">"{e.raw}"</code>
              <span style="color: var(--sg-muted);">→</span>
              <code style="color: #34d399; font-weight: 600;">{e.stored}</code>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid responsive={true}
      data={rows}
      columns={columns}
      features={features}
      showRowNumbers={true}
      enableInlineEditing={true}
      enableCellSelection={true}
      rowHeight={38}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>
