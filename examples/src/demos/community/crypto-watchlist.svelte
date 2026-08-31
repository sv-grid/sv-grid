<!--
  title: Crypto watchlist
  author: SvGrid team
  github: sv-grid
  tags: sorting, sparklines, formatting
  discussion: 0
-->
<script lang="ts">
  /**
   * A compact market watchlist: symbol + name, live-style price, a coloured
   * 24h change, a 7-day sparkline, and a compact market cap. Click any header
   * to sort. Fully self-contained - inline data, only @svgrid/grid.
   */
  import { SvGrid, renderSnippet, tableFeatures, rowSortingFeature, type ColumnDef } from '@svgrid/grid'

  type Coin = { id: number; name: string; symbol: string; price: number; change: number; cap: number; spark: number[] }

  const features = tableFeatures({ rowSortingFeature })

  const rows: Coin[] = [
    { id: 1, name: 'Bitcoin',   symbol: 'BTC', price: 63120.44, change: 2.4,  cap: 1_240_000_000_000, spark: [61, 61.5, 60.8, 62, 62.4, 61.9, 63.1] },
    { id: 2, name: 'Ethereum',  symbol: 'ETH', price: 3094.1,   change: -1.2, cap: 372_000_000_000,   spark: [3.2, 3.15, 3.1, 3.05, 3.12, 3.08, 3.09] },
    { id: 3, name: 'Solana',    symbol: 'SOL', price: 146.72,   change: 5.8,  cap: 66_000_000_000,    spark: [132, 135, 139, 141, 138, 144, 147] },
    { id: 4, name: 'Cardano',   symbol: 'ADA', price: 0.452,    change: -0.6, cap: 16_000_000_000,    spark: [0.47, 0.46, 0.45, 0.46, 0.455, 0.45, 0.452] },
    { id: 5, name: 'Polkadot',  symbol: 'DOT', price: 6.83,     change: 1.1,  cap: 9_400_000_000,     spark: [6.7, 6.6, 6.75, 6.8, 6.72, 6.79, 6.83] },
    { id: 6, name: 'Chainlink', symbol: 'LINK', price: 13.9,    change: 3.2,  cap: 8_200_000_000,     spark: [13.1, 13.3, 13.0, 13.5, 13.6, 13.7, 13.9] },
    { id: 7, name: 'Avalanche', symbol: 'AVAX', price: 27.44,   change: -2.9, cap: 10_800_000_000,    spark: [29, 28.6, 28.1, 27.9, 28.2, 27.6, 27.44] },
    { id: 8, name: 'Litecoin',  symbol: 'LTC', price: 71.2,     change: 0.4,  cap: 5_300_000_000,     spark: [70, 70.5, 71, 70.8, 71.1, 70.9, 71.2] },
  ]

  const columns: ColumnDef<typeof features, Coin>[] = [
    { id: 'coin', header: 'Coin', width: 180, cell: (ctx) => renderSnippet(CoinCell, { row: ctx.row.original }) },
    { field: 'price', header: 'Price', width: 130, align: 'right', format: { type: 'currency', currency: 'USD' } },
    { field: 'change', header: '24h', width: 110, align: 'right', cell: (ctx) => renderSnippet(Change, { v: Number(ctx.getValue()) }) },
    { field: 'spark', header: '7d', width: 130, align: 'center', sparkline: { type: 'area' } },
    { id: 'cap', header: 'Market cap', field: 'cap', width: 150, align: 'right', cell: (ctx) => renderSnippet(Cap, { v: Number(ctx.getValue()) }) },
  ]

  const compact = (v: number) =>
    v >= 1e12 ? `$${(v / 1e12).toFixed(2)}T` : v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : `$${(v / 1e6).toFixed(0)}M`
</script>

{#snippet CoinCell(p: { row: Coin })}
  <span class="coin">
    <span class="coin-sym">{p.row.symbol}</span>
    <span class="coin-name">{p.row.name}</span>
  </span>
{/snippet}

{#snippet Change(p: { v: number })}
  <span class="chg {p.v >= 0 ? 'up' : 'down'}">{p.v >= 0 ? '▲' : '▼'} {Math.abs(p.v).toFixed(1)}%</span>
{/snippet}

{#snippet Cap(p: { v: number })}<span class="cap">{compact(p.v)}</span>{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="text-sm shrink-0" style="color: var(--sg-muted)">Click a header to sort. A community-contributed demo.</div>
  <div class="flex-1 min-h-0">
    <SvGrid data={rows} columns={columns} features={features} showRowNumbers={false} rowHeight={46} containerHeight="100%" fitColumns={true} />
  </div>
</section>

<style>
  .coin { display: inline-flex; flex-direction: column; line-height: 1.25; }
  .coin-sym { font-weight: 700; font-size: 12.5px; }
  .coin-name { font-size: 11px; color: var(--sg-muted); }
  .chg { font-weight: 600; font-size: 12.5px; font-variant-numeric: tabular-nums; }
  .chg.up { color: #16a34a; }
  .chg.down { color: #dc2626; }
  .cap { font-variant-numeric: tabular-nums; }
</style>
