<script lang="ts" module>
  /**
   * Feature bento block - a product feature section laid out as a bento grid:
   * one large tile with a mini results table, four smaller tiles with a bar
   * chart, a threshold line, team avatars and export files, all inline SVG or
   * CSS from tokens. Each tile's span comes from its data (`col`, `row`), and
   * its "Read the guide" link-button reports which feature was opened. An
   * SvBadge marks the new feature and an SvButton leads to the trial. Pure
   * UI-kit, --sg-* themed.
   *
   * Headless: createBentoFeatures() below owns the tiles, their spans and
   * phone order, and the open action with no markup. The component under it
   * is one styled render of that core; import createBentoFeatures from this
   * file (or `npx @svgrid/ui add bento-features --headless` for the core
   * alone) to draw your own.
   */
  export type BentoFeature = {
    id: string
    title: string
    line: string
    /** Columns and rows the tile spans on desktop (default 1). */
    col?: number
    row?: number
    /** Position in the one-column phone layout (default: list order). */
    order?: number
    badge?: string
  }
  export type BentoFeaturesOptions = {
    tiles?: BentoFeature[]
    /** Desktop column count; spans larger than this are clamped. */
    columns?: number
    /** A tile's "Read the guide" was pressed: navigate or open a panel here. */
    onOpen?: (tile: BentoFeature) => void
    idPrefix?: string
  }

  const SAMPLE: BentoFeature[] = [
    { id: 'query', title: 'Ask in plain English', line: 'Type "refunds by region last quarter" and get the SQL, the table and a chart you can edit.', col: 2, row: 2, badge: 'New' },
    { id: 'dashboards', title: 'Dashboards that refresh', line: 'Pin any result. It re-runs on your schedule, as often as every 5 minutes.' },
    { id: 'alerts', title: 'Threshold alerts', line: 'Get a chat or email message when a metric crosses the line you set.' },
    { id: 'sharing', title: 'Shared workspaces', line: 'Folders, roles and row-level access for each team.', order: 4 },
    { id: 'exports', title: 'CSV and PDF export', line: 'Send any table as a file, once or every Monday at 8:00.', order: 3 },
  ]

  export function createBentoFeatures(opts: BentoFeaturesOptions = {}) {
    const columns = opts.columns ?? 4
    const prefix = opts.idPrefix ?? 'bento-features'
    const tiles = $state<BentoFeature[]>(opts.tiles ?? SAMPLE)
    let opened = $state<string | null>(null)

    const titleId = (t: BentoFeature) => `${prefix}-${t.id}`
    function open(t: BentoFeature) {
      opened = t.id
      opts.onOpen?.(t)
    }

    return {
      tiles,
      columns,
      /** Id of the last tile whose guide was opened. */
      get opened() { return opened },
      open,
      titleId,
      /** Spread on the grid container (<ul>): sets the column count. */
      gridProps: () => ({ style: `--sv-bf-cols: ${columns}` }),
      /** Spread on a tile (<li>): its spans and phone order as CSS variables. */
      tileProps: (t: BentoFeature, i: number) => ({
        'aria-labelledby': titleId(t),
        style: `--sv-bf-col: ${Math.min(t.col ?? 1, columns)}; --sv-bf-row: ${t.row ?? 1}; --sv-bf-order: ${t.order ?? i}`,
      }),
      /** Spread on the tile's link-button. */
      openProps: (t: BentoFeature) => ({
        type: 'button' as const,
        'aria-describedby': titleId(t),
        onclick: () => open(t),
      }),
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvButton, SvToaster, toast } from '@svgrid/grid'

  const bento = createBentoFeatures({
    onOpen: (t) => toast(`Opening the ${t.title.toLowerCase()} guide`),
  })
  const rows = [['North', '412', '-8%'], ['South', '389', '+3%'], ['West', '277', '-12%'], ['East', '198', '+1%'], ['Central', '164', '-4%']]
</script>

<section class="sv-bf" aria-labelledby="sv-bf-title">
  <header class="sv-bf-head">
    <div>
      <h2 id="sv-bf-title">What your team gets in Lumen</h2>
      <p>From the first question to the report that goes out on Monday.</p>
    </div>
    <SvButton variant="primary" onclick={() => toast.success('Trial started for 14 days')}>Start a trial</SvButton>
  </header>

  <ul class="sv-bf-grid" {...bento.gridProps()}>
    {#each bento.tiles as t, i (t.id)}
      <li class="sv-bf-tile" class:sv-bf-tile-big={(t.row ?? 1) > 1} {...bento.tileProps(t, i)}>
        <div class="sv-bf-art" aria-hidden="true">
          {#if t.id === 'query'}
            <div class="sv-bf-ask">refunds by region last quarter</div>
            <div class="sv-bf-table">
              <span>Region</span><span>Refunds</span><span>Change</span>
              {#each rows as r (r[0])}{#each r as c, j (j)}<span class:sv-bf-hot={r[0] === 'West'}>{c}</span>{/each}{/each}
            </div>
          {:else if t.id === 'dashboards'}
            <svg viewBox="0 0 120 56">{#each [22, 34, 28, 44, 38, 52] as h, j (j)}<rect x={j * 20 + 4} y={56 - h} width="12" height={h} rx="2" class:sv-bf-on={j === 5} />{/each}</svg>
          {:else if t.id === 'alerts'}
            <svg viewBox="0 0 120 56"><line class="sv-bf-limit" x1="0" y1="18" x2="120" y2="18" /><polyline class="sv-bf-line" points="0,44 20,38 40,40 60,30 80,26 100,12 120,16" /><circle class="sv-bf-dot" cx="100" cy="12" r="4" /></svg>
          {:else if t.id === 'sharing'}
            <div class="sv-bf-faces">{#each ['AL', 'GH', 'KJ', '+6'] as f (f)}<span>{f}</span>{/each}</div>
          {:else}
            <svg viewBox="0 0 120 56"><rect class="sv-bf-doc" x="24" y="6" width="34" height="44" rx="4" /><rect class="sv-bf-doc" x="64" y="6" width="34" height="44" rx="4" /><text x="41" y="34">CSV</text><text x="81" y="34">PDF</text></svg>
          {/if}
        </div>
        <h3 id={bento.titleId(t)}>{t.title} {#if t.badge}<SvBadge variant="accent" size="sm">{t.badge}</SvBadge>{/if}</h3>
        <p>{t.line}</p>
        <button class="sv-bf-link" {...bento.openProps(t)}>Read the guide</button>
      </li>
    {/each}
  </ul>
</section>

<SvToaster position="bottom-right" />

<style>
  .sv-bf {
    width: 100%; box-sizing: border-box; padding: 36px 32px; min-height: 520px;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-bf-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px 24px; flex-wrap: wrap; margin-bottom: 22px; }
  .sv-bf-head h2 { margin: 0 0 6px; font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .sv-bf-head p { margin: 0; color: var(--sg-muted, #64748b); font-size: 14.5px; }
  .sv-bf-grid {
    display: grid; grid-template-columns: repeat(var(--sv-bf-cols, 4), minmax(0, 1fr)); grid-auto-rows: minmax(210px, auto);
    gap: 14px; margin: 0; padding: 0; list-style: none;
  }
  .sv-bf-tile {
    grid-column: span var(--sv-bf-col, 1); grid-row: span var(--sv-bf-row, 1);
    display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 18px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
  }
  .sv-bf-tile h3 { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 650; }
  .sv-bf-tile-big h3 { font-size: 19px; }
  .sv-bf-tile p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-bf-art { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 10px; min-height: 64px; margin-bottom: 8px; }
  .sv-bf-art svg { display: block; width: 100%; max-width: 180px; height: auto; }
  .sv-bf-art rect { fill: color-mix(in srgb, var(--sg-fg, #0f172a) 16%, transparent); }
  .sv-bf-art rect.sv-bf-on, .sv-bf-dot { fill: var(--sg-accent, #2563eb); }
  .sv-bf-limit { stroke: var(--sg-danger, #dc2626); stroke-width: 1.5; stroke-dasharray: 4 4; }
  .sv-bf-line { fill: none; stroke: var(--sg-fg, #0f172a); stroke-width: 2; stroke-linejoin: round; opacity: .55; }
  .sv-bf-art rect.sv-bf-doc { fill: var(--sg-bg, #fff); stroke: var(--sg-border, #cbd5e1); stroke-width: 1.5; }
  .sv-bf-art text { font-size: 10px; font-weight: 700; text-anchor: middle; fill: var(--sg-muted, #64748b); }
  .sv-bf-ask {
    align-self: flex-start; max-width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 13px;
    border: 1px solid var(--sg-input-border, #cbd5e1); border-radius: 999px; background: var(--sg-input-bg, #fff);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sv-bf-table {
    display: grid; grid-template-columns: 1.4fr 1fr 1fr; font-size: 12.5px; font-variant-numeric: tabular-nums;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px); overflow: hidden; background: var(--sg-bg, #fff);
  }
  .sv-bf-table span { padding: 7px 10px; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .sv-bf-table span:nth-child(-n + 3) { border-top: 0; font-weight: 600; background: var(--sg-header-bg, #f1f5f9); }
  .sv-bf-table span.sv-bf-hot { background: var(--sg-selection-bg, #dbeafe); }
  .sv-bf-faces { display: flex; }
  .sv-bf-faces span {
    display: grid; place-items: center; width: 38px; height: 38px; margin-right: -8px; border-radius: 50%;
    font-size: 12px; font-weight: 700; border: 2px solid var(--sg-bg, #fff);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 12%, var(--sg-bg, #fff));
  }
  .sv-bf-link {
    align-self: flex-start; margin-top: 4px; padding: 0; border: 0; background: none; cursor: pointer;
    font: inherit; font-size: 13px; font-weight: 600; color: var(--sg-fg, #0f172a); text-decoration: underline; text-underline-offset: 3px;
  }
  .sv-bf-link:hover { color: var(--sg-accent, #2563eb); }
  .sv-bf-link:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: 2px; border-radius: 3px; }

  @media (max-width: 900px) {
    .sv-bf-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .sv-bf-tile { grid-row: auto; }
  }
  @media (max-width: 560px) {
    .sv-bf { padding: 24px 16px; }
    .sv-bf-head h2 { font-size: 22px; }
    .sv-bf-grid { grid-template-columns: minmax(0, 1fr); grid-auto-rows: auto; }
    .sv-bf-tile { grid-column: auto; order: var(--sv-bf-order, 0); }
  }
</style>
