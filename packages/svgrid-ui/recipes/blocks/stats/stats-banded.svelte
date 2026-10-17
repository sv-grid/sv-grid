<script lang="ts" module>
  /**
   * Banded stats block - a status board on a full-width tinted band: a
   * heading with an SvBadge for overall health, then a bordered, table-like
   * grid of six cells, each with a value, a label, a status dot and the
   * change since an hour ago (lower-is-better metrics color the other way).
   * An SvSwitchButton turns on live updates, polling every 3 seconds.
   * Three columns become one on phones. Values are raw numbers formatted with
   * Intl.NumberFormat. Pure UI-kit, --sg-* themed.
   *
   * Headless: createStatusBoard() below owns the cells, the good/bad and
   * threshold rules, the warning count and the live polling timer with no
   * markup. The component under it is one styled render of that core; import
   * createStatusBoard from this file (or `npx @svgrid/ui add stats-banded
   * --headless` for the core alone) to draw your own.
   */
  export type BoardCell = {
    id: string; label: string; value: number; hourAgo: number
    format: Intl.NumberFormatOptions; lowerIsBetter?: boolean; warnAbove?: number
  }
  export type BoardView = BoardCell & { diff: number; good: boolean; warn: boolean; shown: string; diffText: string }
  export type StatusBoardOptions = {
    cells?: BoardCell[]
    /** Returns the next cells; defaults to a random nudge. Point it at your metrics endpoint. */
    poll?: (cells: BoardCell[]) => BoardCell[] | Promise<BoardCell[]>
    /** Milliseconds between polls while live. */
    interval?: number
    live?: boolean
    locale?: string
  }

  const SAMPLE_CELLS: BoardCell[] = [
    { id: 'p95', label: 'API latency, p95', value: 182, hourAgo: 196, lowerIsBetter: true, warnAbove: 300, format: { style: 'unit', unit: 'millisecond', unitDisplay: 'short' } },
    { id: 'err', label: 'Error rate', value: 0.0004, hourAgo: 0.0006, lowerIsBetter: true, warnAbove: 0.01, format: { style: 'percent', maximumFractionDigits: 2 } },
    { id: 'rpm', label: 'Requests per minute', value: 48_200, hourAgo: 45_900, format: { notation: 'compact', maximumFractionDigits: 1 } },
    { id: 'queue', label: 'Ingest queue depth', value: 1240, hourAgo: 310, lowerIsBetter: true, warnAbove: 1000, format: {} },
    { id: 'sessions', label: 'Active sessions', value: 9840, hourAgo: 9615, format: {} },
    { id: 'deploys', label: 'Deploys today', value: 7, hourAgo: 6, format: {} },
  ]

  /** Stand-in for polling your metrics endpoint: nudges each value a little. */
  function nudge(cells: BoardCell[]): BoardCell[] {
    return cells.map((c) => {
      if (c.id === 'deploys') return c
      const next = c.value * (1 + (Math.random() - 0.5) * 0.06)
      return { ...c, value: Number.isInteger(c.hourAgo) ? Math.round(next) : next }
    })
  }

  /**
   * Call during component init: live polling is an `$effect` interval that
   * runs while `live` is true and is cleared when it goes false or on unmount.
   */
  export function createStatusBoard(opts: StatusBoardOptions = {}) {
    // cells holds raw values; view adds the diff, the good and warn flags and the text.
    let cells = $state<BoardCell[]>(opts.cells ?? SAMPLE_CELLS)
    let live = $state(opts.live ?? false)

    const formatters = new Map<string, Intl.NumberFormat>()
    const fmt = (c: BoardCell, signed = false) => {
      const key = c.id + (signed ? '+' : '')
      if (!formatters.has(key)) formatters.set(key, new Intl.NumberFormat(opts.locale, { ...c.format, ...(signed ? { signDisplay: 'exceptZero' } : {}) }))
      return formatters.get(key)!
    }

    const view = $derived<BoardView[]>(cells.map((c) => {
      const diff = c.value - c.hourAgo
      const good = diff === 0 || (c.lowerIsBetter ? diff < 0 : diff > 0)
      return {
        ...c, diff, good,
        warn: c.warnAbove != null && c.value > c.warnAbove,
        shown: fmt(c).format(c.value),
        diffText: fmt(c, true).format(diff),
      }
    }))
    const warnings = $derived(view.filter((c) => c.warn).length)

    async function poll() {
      cells = await (opts.poll ?? nudge)(cells)
    }

    $effect(() => {
      if (!live) return
      const timer = setInterval(poll, opts.interval ?? 3000)
      return () => clearInterval(timer)
    })

    return {
      get cells() { return view },
      get warnings() { return warnings },
      get live() { return live },
      set live(v: boolean) { live = v },
      poll,
    }
  }
</script>

<script lang="ts">
  import { SvBadge, SvSwitchButton } from '@svgrid/grid'

  const board = createStatusBoard()
</script>

<section class="sv-stats-banded" aria-labelledby="stats-banded-title">
  <div class="sv-stats-banded-inner">
    <header class="sv-stats-banded-head">
      <div class="sv-stats-banded-title">
        <h2 id="stats-banded-title">Platform status</h2>
        {#if board.warnings}
          <SvBadge variant="warning" dot>{board.warnings} {board.warnings === 1 ? 'metric needs' : 'metrics need'} attention</SvBadge>
        {:else}
          <SvBadge variant="success" dot>All metrics normal</SvBadge>
        {/if}
      </div>
      <div class="sv-stats-banded-live">
        <label for="stats-banded-live">Live updates</label>
        <SvSwitchButton id="stats-banded-live" checked={board.live} onChange={(v) => (board.live = v)} />
      </div>
    </header>

    <dl class="sv-stats-banded-board">
      {#each board.cells as c (c.id)}
        <div class="sv-stats-banded-cell">
          <dt>
            <span class="sv-stats-banded-dot" class:sv-stats-banded-warn={c.warn} aria-hidden="true"></span>
            {c.label}
            {#if c.warn}<span class="sv-stats-banded-sr">(above threshold)</span>{/if}
          </dt>
          <dd class="sv-stats-banded-value">{c.shown}</dd>
          <dd class="sv-stats-banded-change" class:sv-stats-banded-bad={!c.good}>{c.diffText} <span class="sv-stats-banded-since">vs 1 h ago</span></dd>
        </div>
      {/each}
    </dl>
    <p class="sv-stats-banded-note">Production, eu-west and us-east combined.</p>
  </div>
</section>

<style>
  .sv-stats-banded {
    width: 100%; box-sizing: border-box;
    padding: 48px 32px;
    color: var(--sg-fg, #0f172a);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 5%, var(--sg-bg, #fff));
    border-block: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-stats-banded-inner { max-width: 1040px; margin: 0 auto; }
  .sv-stats-banded-head { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; flex-wrap: wrap; margin-bottom: 22px; }
  .sv-stats-banded-title { display: flex; align-items: center; flex-wrap: wrap; gap: 10px 14px; }
  h2 { margin: 0; font-size: 26px; font-weight: 700; line-height: 1.2; letter-spacing: -.02em; }
  .sv-stats-banded-live { display: flex; align-items: center; gap: 10px; font-size: 14px; }
  .sv-stats-banded-live label { color: var(--sg-muted, #64748b); cursor: pointer; }

  /* 1px gaps over a border-colored backdrop draw the inner rules. */
  .sv-stats-banded-board {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; margin: 0;
    background: var(--sg-border, #e2e8f0);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px); overflow: hidden;
  }
  .sv-stats-banded-cell { display: flex; flex-direction: column; gap: 6px; min-width: 0; padding: 22px 24px; background: var(--sg-bg, #fff); }
  dt { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--sg-muted, #64748b); }
  .sv-stats-banded-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--sg-success, #16a34a); }
  .sv-stats-banded-dot.sv-stats-banded-warn { background: var(--sg-warning, #d97706); }
  .sv-stats-banded-value { margin: 0; font-size: 34px; font-weight: 700; line-height: 1.1; letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
  .sv-stats-banded-change { margin: 0; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; color: var(--sg-success, #16a34a); }
  .sv-stats-banded-change.sv-stats-banded-bad { color: var(--sg-danger, #dc2626); }
  .sv-stats-banded-since { font-weight: 400; color: var(--sg-muted, #64748b); }
  .sv-stats-banded-note { margin: 14px 0 0; font-size: 12.5px; color: var(--sg-muted, #64748b); }
  .sv-stats-banded-sr {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }

  @media (max-width: 720px) {
    .sv-stats-banded { padding: 32px 16px; }
    h2 { font-size: 22px; }
    .sv-stats-banded-board { grid-template-columns: minmax(0, 1fr); }
    .sv-stats-banded-cell { padding: 18px 18px; }
    .sv-stats-banded-value { font-size: 30px; }
  }
</style>
