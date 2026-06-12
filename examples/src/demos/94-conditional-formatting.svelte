<script lang="ts">
  /**
   * 94. Conditional formatting (color scale + data bars + icon sets)
   * ----------------------------------------------------------------
   * Excel-style cell visualisations driven by per-column `cellRenderer`
   * snippets. No library change: each renderer reads the column's
   * min/max from the displayed dataset and paints accordingly.
   *
   *   - colorScale   - red → yellow → green gradient
   *   - dataBar      - in-cell horizontal bar proportional to value
   *   - iconSet      - traffic-light icon based on threshold buckets
   *   - heatmap row  - background tint per cell mapped to value range
   *
   * Toggle each formatter via the side panel to compare on / off.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-community'

  type KPI = {
    region: 'Americas' | 'EMEA' | 'APAC'
    country: string
    revenue: number      // 0–500_000
    growth: number       // -25..+85 (%)
    churn: number        // 0..15 (%)
    nps: number          // -100..+100
    csat: number         // 0..100
    margin: number       // 0..60 (%)
  }

  const seed: KPI[] = [
    { region: 'Americas', country: 'United States', revenue: 480_000, growth:  62, churn:  3, nps:  58, csat: 88, margin: 42 },
    { region: 'Americas', country: 'Canada',        revenue: 192_000, growth:  44, churn:  5, nps:  47, csat: 84, margin: 38 },
    { region: 'Americas', country: 'Mexico',        revenue:  78_000, growth:  28, churn:  9, nps:  20, csat: 71, margin: 21 },
    { region: 'Americas', country: 'Brazil',        revenue: 124_000, growth:  18, churn: 11, nps:   8, csat: 64, margin: 19 },
    { region: 'Americas', country: 'Argentina',     revenue:  42_000, growth:  -8, churn: 14, nps: -12, csat: 58, margin: 12 },
    { region: 'EMEA',     country: 'United Kingdom',revenue: 246_000, growth:  37, churn:  4, nps:  43, csat: 82, margin: 35 },
    { region: 'EMEA',     country: 'Germany',       revenue: 312_000, growth:  41, churn:  3, nps:  51, csat: 86, margin: 39 },
    { region: 'EMEA',     country: 'France',        revenue: 178_000, growth:  22, churn:  6, nps:  29, csat: 75, margin: 28 },
    { region: 'EMEA',     country: 'Spain',         revenue:  92_000, growth:  11, churn:  8, nps:  12, csat: 66, margin: 22 },
    { region: 'EMEA',     country: 'Italy',         revenue: 104_000, growth:   6, churn: 10, nps:   2, csat: 60, margin: 17 },
    { region: 'EMEA',     country: 'UAE',           revenue:  58_000, growth:  78, churn:  2, nps:  66, csat: 91, margin: 47 },
    { region: 'EMEA',     country: 'South Africa',  revenue:  31_000, growth: -18, churn: 13, nps: -22, csat: 54, margin:  8 },
    { region: 'APAC',     country: 'Japan',         revenue: 268_000, growth:  19, churn:  4, nps:  31, csat: 78, margin: 33 },
    { region: 'APAC',     country: 'Australia',     revenue: 142_000, growth:  35, churn:  5, nps:  39, csat: 80, margin: 31 },
    { region: 'APAC',     country: 'Singapore',     revenue:  88_000, growth:  52, churn:  3, nps:  54, csat: 85, margin: 41 },
    { region: 'APAC',     country: 'India',         revenue: 154_000, growth:  74, churn:  6, nps:  44, csat: 76, margin: 26 },
    { region: 'APAC',     country: 'South Korea',   revenue:  96_000, growth:  29, churn:  5, nps:  35, csat: 79, margin: 32 },
  ]

  let rows = $state<KPI[]>(seed)

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  // ---- Per-formatter toggles -------------------------------------------
  let useColorScale = $state(true)
  let useDataBar    = $state(true)
  let useIconSet    = $state(true)
  let useHeatmap    = $state(true)

  // ---- Column min/max from the live data --------------------------------
  function range<K extends keyof KPI>(field: K): { min: number; max: number } {
    let min = Infinity; let max = -Infinity
    for (const r of rows) {
      const v = r[field] as number
      if (v < min) min = v
      if (v > max) max = v
    }
    return { min, max }
  }

  // ---- Color helpers ----------------------------------------------------
  type RGB = [number, number, number]
  const clamp01 = (t: number) => Math.max(0, Math.min(1, t))
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t

  /** Two-stop interpolation across a [min,max] range. */
  function ramp2(value: number, min: number, max: number, c1: RGB, c2: RGB): RGB {
    const t = clamp01((value - min) / (max - min || 1))
    return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]
  }

  /** Three-stop interpolation (low → mid → high). */
  function ramp3(value: number, min: number, max: number, c1: RGB, c2: RGB, c3: RGB): RGB {
    const t = clamp01((value - min) / (max - min || 1))
    const [a, b, k] = t < 0.5 ? [c1, c2, t * 2] : [c2, c3, (t - 0.5) * 2]
    return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)]
  }

  const rgb = ([r, g, b]: RGB) => `rgb(${r | 0} ${g | 0} ${b | 0})`

  /**
   * Pick a readable text color for a given chip background using the WCAG
   * relative-luminance formula. This is what keeps every chip legible in BOTH
   * light and dark themes - the text contrast is derived from the chip's own
   * fill, never from the page background.
   */
  function readableText([r, g, b]: RGB): string {
    const lin = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
    return L > 0.52 ? '#0b1220' : '#ffffff'
  }

  function chip(bg: RGB, text: string): string {
    return `<span class="cf-chip" style="background:${rgb(bg)};color:${readableText(bg)};">${text}</span>`
  }

  // ---- Cell renderers ---------------------------------------------------
  // Color scale (revenue) - red → amber → green, contrast-aware text.
  function ColorScaleCell(value: number, min: number, max: number) {
    if (!useColorScale) return `<span class="cf-plain">$${value.toLocaleString()}</span>`
    const bg = ramp3(value, min, max, [239, 68, 68], [245, 158, 11], [34, 197, 94])
    return chip(bg, `$${value.toLocaleString()}`)
  }

  // Heatmap (NPS / CSAT / Margin) - sequential emerald intensity ramp.
  function HeatmapCell(value: number, min: number, max: number, suffix = '') {
    if (!useHeatmap) return `<span class="cf-plain">${value}${suffix}</span>`
    const bg = ramp2(value, min, max, [224, 242, 233], [5, 122, 85])
    return chip(bg, `${value}${suffix}`)
  }

  // Data bar (growth) - signed bar from the centre; neutral, theme-aware label.
  function DataBarCell(value: number, min: number, max: number) {
    if (!useDataBar) return `<span class="cf-plain">${value}%</span>`
    const span = Math.max(Math.abs(min), Math.abs(max)) || 1
    const pct = Math.min(100, (Math.abs(value) / span) * 100)
    const positive = value >= 0
    const align = positive ? 'left:50%;' : 'right:50%;'
    const color = positive ? '#22c55e' : '#f43f5e'
    return `
      <span class="cf-bar-wrap">
        <span class="cf-bar" style="${align} width:${pct / 2}%; background:${color};"></span>
        <span class="cf-bar-mid"></span>
        <span class="cf-bar-label">${positive ? '+' : ''}${value}%</span>
      </span>`
  }

  // Icon set (churn) - clean status dot with a soft ring + neutral value.
  function IconSetCell(value: number) {
    if (!useIconSet) return `<span class="cf-plain">${value}%</span>`
    const color = value <= 4 ? '#22c55e' : value <= 8 ? '#f59e0b' : '#f43f5e'
    return `<span class="cf-icon"><span class="cf-dot" style="background:${color};box-shadow:0 0 0 4px ${color}26;"></span><span class="cf-icon-val">${value}%</span></span>`
  }

  const columns: ColumnDef<typeof features, KPI>[] = [
    { field: 'region',  header: 'Region',  width: 110 },
    { field: 'country', header: 'Country', width: 170 },
    {
      field: 'revenue', header: 'Revenue (color scale)', width: 180, align: 'right',
      cell: (ctx) => {
        const { min, max } = range('revenue')
        const html = ColorScaleCell(ctx.getValue() as number, min, max)
        return renderSnippet(rawHtml, { html })
      },
    },
    {
      field: 'growth', header: 'Growth (data bar)', width: 220, align: 'right',
      cell: (ctx) => {
        const { min, max } = range('growth')
        const html = DataBarCell(ctx.getValue() as number, min, max)
        return renderSnippet(rawHtml, { html })
      },
    },
    {
      field: 'churn', header: 'Churn (icon set)', width: 150, align: 'right',
      cell: (ctx) => renderSnippet(rawHtml, { html: IconSetCell(ctx.getValue() as number) }),
    },
    {
      field: 'nps', header: 'NPS (heatmap)', width: 130, align: 'right',
      cell: (ctx) => {
        const { min, max } = range('nps')
        return renderSnippet(rawHtml, { html: HeatmapCell(ctx.getValue() as number, min, max) })
      },
    },
    {
      field: 'csat', header: 'CSAT (heatmap)', width: 130, align: 'right',
      cell: (ctx) => {
        const { min, max } = range('csat')
        return renderSnippet(rawHtml, { html: HeatmapCell(ctx.getValue() as number, min, max) })
      },
    },
    {
      field: 'margin', header: 'Margin (heatmap)', width: 140, align: 'right',
      cell: (ctx) => {
        const { min, max } = range('margin')
        return renderSnippet(rawHtml, { html: HeatmapCell(ctx.getValue() as number, min, max, '%') })
      },
    },
  ]
</script>

{#snippet rawHtml(props: { html: string })}
  {@html props.html}
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="cf-toolbar shrink-0">
    <span class="cf-label">Conditional formatting:</span>
    <label class="cf-toggle">
      <input type="checkbox" bind:checked={useColorScale} />
      <span>Color scale</span>
    </label>
    <label class="cf-toggle">
      <input type="checkbox" bind:checked={useDataBar} />
      <span>Data bars</span>
    </label>
    <label class="cf-toggle">
      <input type="checkbox" bind:checked={useIconSet} />
      <span>Icon sets</span>
    </label>
    <label class="cf-toggle">
      <input type="checkbox" bind:checked={useHeatmap} />
      <span>Heatmap tint</span>
    </label>
    <div class="cf-divider"></div>
    <button class="cf-preset" onclick={() => { useColorScale = useDataBar = useIconSet = useHeatmap = true }}>
      P&amp;L preset
    </button>
    <button class="cf-preset alt" onclick={() => { useColorScale = useDataBar = useIconSet = useHeatmap = false }}>
      Plain numbers
    </button>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={36}
      containerHeight="100%"
      fitColumns={true}
    />
  </div>
</section>

<style>
  .cf-toolbar {
    display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 10px; padding: 11px 16px;
  }
  .cf-label {
    font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: var(--sg-muted, #64748b);
  }
  .cf-toggle {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 13px; color: var(--sg-fg, #0f172a); cursor: pointer;
    user-select: none;
  }
  .cf-toggle input {
    accent-color: #6366f1; width: 15px; height: 15px; cursor: pointer;
  }
  .cf-divider { width: 1px; height: 22px; background: var(--sg-border, #e2e8f0); }
  .cf-preset {
    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
    border: 0; border-radius: 7px; padding: 6px 12px; font-size: 12px;
    font-weight: 600; cursor: pointer;
    box-shadow: 0 1px 2px rgba(79,70,229,0.35);
    transition: transform 0.08s ease, filter 0.12s ease;
  }
  .cf-preset.alt {
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    border: 1px solid var(--sg-border, #cbd5e1); box-shadow: none;
  }
  .cf-preset:hover { filter: brightness(1.06); }
  .cf-preset:active { transform: translateY(1px); }

  /* ---- Cell visualisations (rendered via {@html} inside a snippet) ------
     These live inside .sv-grid-root, so var(--sg-fg) and friends resolve to
     the active theme. Filled chips derive their own text color from their
     background (see readableText) so they stay legible in light AND dark. */
  :global(.cf-chip) {
    display: inline-flex; align-items: center; justify-content: flex-end;
    padding: 3px 11px; border-radius: 7px; min-width: 70px;
    font-variant-numeric: tabular-nums; font-weight: 600; font-size: 12.5px;
    letter-spacing: 0.01em;
    box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.16);
  }
  :global(.cf-plain) {
    font-variant-numeric: tabular-nums; color: var(--sg-fg, #0f172a);
    opacity: 0.8;
  }
  :global(.cf-bar-wrap) {
    position: relative; display: block; width: 100%; height: 24px;
    background: rgba(148, 163, 184, 0.16);
    border-radius: 7px; overflow: hidden;
  }
  :global(.cf-bar) {
    position: absolute; top: 3px; bottom: 3px; border-radius: 4px;
    opacity: 0.9;
  }
  :global(.cf-bar-mid) {
    position: absolute; top: 0; bottom: 0; left: 50%;
    width: 1px; background: rgba(148, 163, 184, 0.45);
  }
  :global(.cf-bar-label) {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: flex-end;
    padding-right: 9px;
    font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums;
    color: var(--sg-fg, #0f172a);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.18);
  }
  :global(.cf-icon) {
    display: inline-flex; align-items: center; justify-content: flex-end;
    gap: 9px; width: 100%;
  }
  :global(.cf-dot) {
    width: 9px; height: 9px; border-radius: 50%; flex: none;
  }
  :global(.cf-icon-val) {
    color: var(--sg-fg, #0f172a); font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
</style>
