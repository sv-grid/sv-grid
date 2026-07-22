<script lang="ts">
  /**
   * 00. Trading desk - hero demo
   * ----------------------------
   * The first demo a prospect sees. Ten thousand live securities with
   * sparklines, sector chips, pinned P&L, and a 500 ms tick stream that
   * flashes cells on price moves. Built on the same SvGrid primitives as
   * every other demo - no special hero APIs.
   *
   * Highlights:
   *   - Row virtualization keeps 10,000 rows scrolling at 60 fps
   *   - Symbol pinned LEFT, P&L pinned RIGHT (sticky horizontal scroll)
   *   - Live tick: ~5 % of rows update every 500 ms, cells pulse green/red
   *   - Sparklines re-rendered from each row's rolling 30-point buffer
   *   - KPI strip recomputes across all 10k rows on every tick via $derived
   *   - Sector filter chips above the grid drive a $derived row slice
   *
   * Implementation notes:
   *   - Rows live in `$state.raw` so the grid sees one new array reference
   *     per tick instead of 10k per-cell mutations
   *   - `pulses` map is replaced (not appended to) each tick - pulses GC
   *     themselves by being absent from the next tick's map
   *   - Sparkline path is recomputed only when the row reference changes
   *     (i.e. only ticked rows), so static rows pay no SVG cost
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from "@svgrid/grid";

  type Sector =
    | "Technology"
    | "Financials"
    | "Healthcare"
    | "Energy"
    | "Consumer"
    | "Industrials"
    | "Materials"
    | "Utilities"
    | "Communication"
    | "Real Estate";

  type RiskTier = "Low" | "Med" | "High";

  type Security = {
    symbol: string;
    name: string;
    sector: Sector;
    last: number;
    open: number;
    change: number;
    pctChange: number;
    bid: number;
    ask: number;
    spread: number;
    volume: number;
    history: number[]; // rolling 30-point trail used for the sparkline
    position: number; // current shares held
    positionCap: number; // risk cap in shares (for the % bar)
    pnl: number; // mark-to-market P&L in USD
    risk: RiskTier;
  };

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature });

  // ---- Deterministic PRNG so the seed is identical every load. Same
  // pattern as 20-industrial-dashboard so screenshots are reproducible.
  let prng = 0xc0ffee15;
  function rand(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0;
    return prng / 0xffffffff;
  }
  function pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(rand() * arr.length)]!;
  }
  function round(n: number, p = 2): number {
    const m = 10 ** p;
    return Math.round(n * m) / m;
  }

  const SECTORS: readonly Sector[] = [
    "Technology",
    "Financials",
    "Healthcare",
    "Energy",
    "Consumer",
    "Industrials",
    "Materials",
    "Utilities",
    "Communication",
    "Real Estate",
  ];

  // Three-letter ticker pool - combined with two-letter suffixes to
  // generate 10k unique tickers without repeats.
  const TICKER_LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  const COMPANY_PREFIXES = [
    "Nordic",
    "Pacific",
    "Atlas",
    "Vertex",
    "Quantum",
    "Helios",
    "Stellar",
    "Apex",
    "Crescent",
    "Sigma",
    "Pioneer",
    "Aurora",
    "Granite",
    "Cobalt",
    "Hyperion",
    "Meridian",
    "Polaris",
    "Sentinel",
    "Tessera",
    "Vanguard",
    "Cascade",
    "Frontier",
    "Lumen",
    "Beacon",
    "Citadel",
    "Orion",
    "Solstice",
  ];
  const COMPANY_SUFFIXES = [
    "Holdings",
    "Industries",
    "Group",
    "Capital",
    "Partners",
    "Systems",
    "Dynamics",
    "Resources",
    "Networks",
    "Logistics",
    "Technologies",
    "Bio",
    "Mining",
    "Energy",
    "Labs",
    "Materials",
    "Solutions",
    "Trust",
  ];

  function makeRow(i: number): Security {
    // Tickers: AAA, AAB ... ZZZ ~ 17k combos. Tracking the cursor lets us
    // emit unique tickers up to 10k+ without collisions.
    const a = Math.floor(i / (26 * 26)) % 26;
    const b = Math.floor(i / 26) % 26;
    const c = i % 26;
    const symbol = `${TICKER_LETTERS[a]}${TICKER_LETTERS[b]}${TICKER_LETTERS[c]}`;
    const sector = SECTORS[i % SECTORS.length]!;
    const name = `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`;
    // Price range tuned so big-cap-ish names live near the top of the seed.
    const basePrice = round(8 + rand() * 990, 2);
    const open = basePrice;
    // Pre-seed the trail with a small random walk so sparklines render
    // immediately, not after 30 ticks.
    const history: number[] = [];
    let h = basePrice;
    for (let k = 0; k < 30; k++) {
      h = Math.max(0.5, h + (rand() - 0.5) * basePrice * 0.01);
      history.push(round(h, 2));
    }
    const last = history[history.length - 1]!;
    const change = round(last - open, 2);
    const pctChange = round((change / open) * 100, 2);
    const spread = Math.max(round(last * 0.0006, 2), 0.01);
    const positionCap = 500 + Math.floor(rand() * 9500);
    const position = Math.floor(positionCap * (0.1 + rand() * 0.85));
    const riskRoll = rand();
    const risk: RiskTier =
      riskRoll < 0.55 ? "Low" : riskRoll < 0.88 ? "Med" : "High";
    return {
      symbol,
      name,
      sector,
      last,
      open,
      change,
      pctChange,
      bid: round(last - spread, 2),
      ask: round(last + spread, 2),
      spread,
      volume: Math.floor(50_000 + rand() * 5_000_000),
      history,
      position,
      positionCap,
      pnl: round(position * change, 0),
      risk,
    };
  }

  function makeSeed(n: number): Security[] {
    const out: Security[] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = makeRow(i);
    return out;
  }

  // ---- State

  const ROW_COUNT = 10_000;
  let rows = $state.raw<Security[]>(makeSeed(ROW_COUNT));
  let pulses = $state.raw<Record<string, "up" | "down">>({});
  let paused = $state(false);
  let ticks = $state(0);
  let sectorFilter = $state<Sector | "All">("All");

  // Columns that should flash on tick. Symbol / Name / Sector are static
  // so they're excluded - pulsing them is misleading.
  const PULSED_COLS = [
    "last",
    "change",
    "pctChange",
    "bid",
    "ask",
    "volume",
    "spread",
    "pnl",
  ];

  function tick() {
    const nextPulses: Record<string, "up" | "down"> = {};
    // Update ~5 % of rows per tick. Touching every row each tick is
    // expensive AND distracting visually - 500 active rows per tick is
    // the sweet spot for "feels alive but readable".
    const touchCount = Math.floor(ROW_COUNT * 0.05);
    const touchSet = new Set<number>();
    while (touchSet.size < touchCount) {
      touchSet.add(Math.floor(rand() * ROW_COUNT));
    }

    const nextRows = rows.slice();
    for (const idx of touchSet) {
      const row = rows[idx]!;
      const drift = (rand() - 0.5) * row.last * 0.006; // up to ±0.3 %
      const newLast = Math.max(round(row.last + drift, 2), 0.01);
      if (newLast === row.last) continue;
      const direction: "up" | "down" = newLast > row.last ? "up" : "down";
      const change = round(newLast - row.open, 2);
      const pctChange = round((change / row.open) * 100, 2);
      const spread = Math.max(round(newLast * 0.0006, 2), 0.01);
      const history = row.history.slice(1);
      history.push(newLast);
      const next: Security = {
        ...row,
        last: newLast,
        change,
        pctChange,
        bid: round(newLast - spread, 2),
        ask: round(newLast + spread, 2),
        spread,
        volume: row.volume + Math.floor(50 + rand() * 4_000),
        history,
        pnl: round(row.position * change, 0),
      };
      for (const col of PULSED_COLS) {
        nextPulses[`${row.symbol}:${col}`] = direction;
      }
      nextRows[idx] = next;
    }
    rows = nextRows;
    pulses = nextPulses;
    ticks += 1;
  }

  $effect(() => {
    if (paused) return;
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  });

  function pulseClass(
    row: Security,
    colId: string,
  ): "sv-pulse-up" | "sv-pulse-down" | "" {
    const dir = pulses[`${row.symbol}:${colId}`];
    return dir === "up" ? "sv-pulse-up" : dir === "down" ? "sv-pulse-down" : "";
  }

  // Pipe user edits back into the parent `rows` state. Without this, every
  // 500 ms tick replaces `rows` with a fresh array (and the grid re-syncs
  // its internalData + drops `editedCellValues`) - wiping the user's input.
  // We also recompute pnl on a position change so the value the user just
  // typed shows updated P&L immediately, not on the next price tick.
  function onCellValueChange(args: {
    rowIndex: number;
    columnId: string;
    newValue: unknown;
  }): void {
    const visible = visibleRows;
    const target = visible[args.rowIndex];
    if (!target) return;
    const sourceIdx = rows.indexOf(target);
    if (sourceIdx < 0) return;
    const updated: Security = { ...target };
    if (args.columnId === "position") {
      const n = Number(args.newValue);
      if (!Number.isFinite(n)) return;
      updated.position = Math.max(0, Math.floor(n));
      updated.pnl = round(updated.position * updated.change, 0);
    } else if (args.columnId === "risk") {
      const v = String(args.newValue);
      if (v !== "Low" && v !== "Med" && v !== "High") return;
      updated.risk = v as RiskTier;
    } else if (args.columnId === "sector") {
      const v = String(args.newValue);
      if (!SECTORS.includes(v as Sector)) return;
      updated.sector = v as Sector;
    } else {
      return;
    }
    const next = rows.slice();
    next[sourceIdx] = updated;
    rows = next;
  }

  // ---- Derived: filtered rows + KPI strip
  const visibleRows = $derived(
    sectorFilter === "All"
      ? rows
      : rows.filter((r) => r.sector === sectorFilter),
  );

  const kpis = $derived.by(() => {
    let pnl = 0;
    let exposure = 0;
    let volume = 0;
    let spreadSum = 0;
    let advancers = 0;
    let decliners = 0;
    for (const r of visibleRows) {
      pnl += r.pnl;
      exposure += r.position * r.last;
      volume += r.volume;
      spreadSum += r.spread;
      if (r.change > 0) advancers += 1;
      else if (r.change < 0) decliners += 1;
    }
    const avgSpread = visibleRows.length ? spreadSum / visibleRows.length : 0;
    return {
      pnl,
      exposure,
      volume,
      avgSpread,
      advancers,
      decliners,
      count: visibleRows.length,
    };
  });

  // ---- Sparkline helpers

  function sparkPath(history: number[], w: number, h: number): string {
    const min = Math.min(...history);
    const max = Math.max(...history);
    const range = Math.max(1e-6, max - min);
    const step = w / (history.length - 1);
    let d = "";
    for (let i = 0; i < history.length; i++) {
      const x = round(i * step, 2);
      const y = round(h - ((history[i]! - min) / range) * h, 2);
      d += `${i === 0 ? "M" : "L"}${x} ${y} `;
    }
    return d.trim();
  }

  // ---- Formatters
  function fmtUsd(n: number, frac = 2): string {
    return n.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: frac,
      maximumFractionDigits: frac,
    });
  }
  function fmtUsdShort(n: number): string {
    const abs = Math.abs(n);
    if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)} B`;
    if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} M`;
    if (abs >= 1_000) return `${(n / 1_000).toFixed(1)} K`;
    return n.toFixed(0);
  }
  function fmtPnl(n: number): string {
    const sign = n >= 0 ? "+" : "-";
    return `${sign}${fmtUsdShort(Math.abs(n))}`;
  }
</script>

<!-- ─────────────────────────  CELL SNIPPETS  ───────────────────────── -->

{#snippet SymbolCell(props: { row: Security })}
  {@const slug = props.row.sector.toLowerCase().replace(/\s+/g, "-")}
  {@const initials = props.row.symbol.slice(0, 2)}
  <span class="td-symbol">
    <span class={`td-sym-logo td-sym-${slug}`} aria-hidden="true"
      >{initials}</span
    >
    <span class="td-sym-ticker">{props.row.symbol}</span>
  </span>
{/snippet}

{#snippet SectorChip(props: { row: Security })}
  <span
    class="td-sector td-sec-{props.row.sector
      .toLowerCase()
      .replace(/\s+/g, '-')}"
  >
    {props.row.sector}
  </span>
{/snippet}

{#snippet LastCell(props: { row: Security })}
  <span class={`td-tick ${pulseClass(props.row, "last")}`}>
    {fmtUsd(props.row.last)}
  </span>
{/snippet}

{#snippet ChangeCell(props: { row: Security })}
  {@const positive = props.row.change >= 0}
  <span
    class={`td-tick ${pulseClass(props.row, "change")} ${positive ? "td-up" : "td-down"}`}
  >
    <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden="true">
      {#if positive}
        <path d="M6 2 L11 9 L1 9 Z" fill="currentColor" />
      {:else}
        <path d="M6 10 L1 3 L11 3 Z" fill="currentColor" />
      {/if}
    </svg>
    {Math.abs(props.row.change).toFixed(2)}
  </span>
{/snippet}

{#snippet PctChangeCell(props: { row: Security })}
  {@const positive = props.row.pctChange >= 0}
  <span
    class={`td-tick ${pulseClass(props.row, "pctChange")} ${positive ? "td-up" : "td-down"}`}
  >
    {positive ? "+" : ""}{props.row.pctChange.toFixed(2)}%
  </span>
{/snippet}

{#snippet TrendCell(props: { row: Security })}
  {@const h = props.row.history}
  {@const positive = h[h.length - 1]! >= h[0]!}
  <svg
    class="td-spark"
    viewBox="0 0 120 24"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <path
      d={sparkPath(h, 120, 24)}
      fill="none"
      stroke="currentColor"
      stroke-width="1.4"
    />
    <path
      d={`${sparkPath(h, 120, 24)} L 120 24 L 0 24 Z`}
      fill="currentColor"
      opacity="0.10"
    />
  </svg>
  <span class={`td-spark-pct ${positive ? "td-up" : "td-down"}`}>
    {positive ? "+" : ""}{(((h[h.length - 1]! - h[0]!) / h[0]!) * 100).toFixed(
      1,
    )}%
  </span>
{/snippet}

{#snippet BidCell(props: { row: Security })}
  <span class={`td-tick ${pulseClass(props.row, "bid")}`}
    >{props.row.bid.toFixed(2)}</span
  >
{/snippet}

{#snippet AskCell(props: { row: Security })}
  <span class={`td-tick ${pulseClass(props.row, "ask")}`}
    >{props.row.ask.toFixed(2)}</span
  >
{/snippet}

{#snippet SpreadCell(props: { row: Security })}
  {@const tight = props.row.spread < 0.05}
  <span
    class={`td-tick ${pulseClass(props.row, "spread")} ${tight ? "td-up" : "td-down"}`}
  >
    {props.row.spread.toFixed(3)}
  </span>
{/snippet}

{#snippet VolumeCell(props: { row: Security })}
  <span class={`td-tick ${pulseClass(props.row, "volume")} td-vol`}>
    {fmtUsdShort(props.row.volume)}
  </span>
{/snippet}

{#snippet PositionCell(props: { row: Security })}
  {@const pct = props.row.positionCap
    ? props.row.position / props.row.positionCap
    : 0}
  {@const tone = pct >= 0.85 ? "hot" : pct >= 0.6 ? "warm" : "cool"}
  <div class="td-pos">
    <div class="td-pos-bar">
      <div
        class={`td-pos-fill td-pos-${tone}`}
        style="width: {Math.min(100, pct * 100)}%"
      ></div>
    </div>
    <span class="td-pos-text">{Math.round(pct * 100)}%</span>
  </div>
{/snippet}

{#snippet RiskCell(props: { row: Security })}
  <span class="td-risk td-risk-{props.row.risk.toLowerCase()}"
    >{props.row.risk}</span
  >
{/snippet}

{#snippet PnlCell(props: { row: Security })}
  {@const positive = props.row.pnl >= 0}
  <span
    class={`td-tick td-pnl ${pulseClass(props.row, "pnl")} ${positive ? "td-up" : "td-down"}`}
  >
    {fmtPnl(props.row.pnl)}
  </span>
{/snippet}

<!-- ─────────────────────────  LAYOUT  ───────────────────────── -->

<section class="td-shell flex flex-col flex-1 min-h-0 gap-3">
  <!-- KPI strip -->
  <div class="td-kpi-strip">
    <div class="td-kpi">
      <div class="td-kpi-label">P&amp;L (book)</div>
      <div
        class={`td-kpi-value tabular-nums ${kpis.pnl >= 0 ? "td-up" : "td-down"}`}
      >
        {fmtPnl(kpis.pnl)}
      </div>
      <div class="td-kpi-foot">
        <span class="td-up">▲ {kpis.advancers.toLocaleString()}</span>
        &nbsp;·&nbsp;
        <span class="td-down">▼ {kpis.decliners.toLocaleString()}</span>
      </div>
    </div>
    <div class="td-kpi">
      <div class="td-kpi-label">Gross exposure</div>
      <div class="td-kpi-value tabular-nums">{fmtUsdShort(kpis.exposure)}</div>
      <div class="td-kpi-foot">
        {kpis.count.toLocaleString()} active symbols
      </div>
    </div>
    <div class="td-kpi">
      <div class="td-kpi-label">Daily volume</div>
      <div class="td-kpi-value tabular-nums">{fmtUsdShort(kpis.volume)}</div>
      <div class="td-kpi-foot">shares traded</div>
    </div>
    <div class="td-kpi">
      <div class="td-kpi-label">Avg spread</div>
      <div class="td-kpi-value tabular-nums">${kpis.avgSpread.toFixed(3)}</div>
      <div class="td-kpi-foot">across visible book</div>
    </div>
    <div class="td-kpi">
      <div class="td-kpi-label">Tick stream</div>
      <div class="td-kpi-value tabular-nums">{paused ? "PAUSED" : "LIVE"}</div>
      <div class="td-kpi-foot">
        <span class={paused ? "" : "td-pulse-dot"}></span>
        {ticks.toLocaleString()} ticks · 500 ms
      </div>
    </div>
  </div>

  <!-- Toolbar: sector chips + pause -->
  <div class="td-toolbar">
    <button
      type="button"
      class="td-chip td-chip-all"
      class:td-chip-active={sectorFilter === "All"}
      onclick={() => (sectorFilter = "All")}
      >All <span class="td-chip-count">{rows.length.toLocaleString()}</span
      ></button
    >
    {#each SECTORS as s (s)}
      <button
        type="button"
        class={`td-chip td-sec-${s.toLowerCase().replace(/\s+/g, "-")}`}
        class:td-chip-active={sectorFilter === s}
        onclick={() => (sectorFilter = s)}>{s}</button
      >
    {/each}
    <div class="td-toolbar-spacer"></div>
    <span class="td-hint">
      Editable: <strong>Position</strong> · <strong>Sector</strong> ·
      <strong>Risk</strong>
    </span>
    <button type="button" class="td-btn" onclick={() => (paused = !paused)}
      >{paused ? "▶ Resume" : "⏸ Pause"}</button
    >
  </div>

  <!-- Grid -->
  <div class="flex-1 min-h-0">
    <SvGrid
      data={visibleRows}
      columns={[
        {
          field: "symbol",
          header: "Symbol",
          width: 180,
          editable: false,
          cell: (ctx) => renderSnippet(SymbolCell, { row: ctx.row.original }),
        },
        { field: "name", header: "Company", width: 230, editable: false, hideBelow: 700 },
        {
          field: "sector",
          header: "Sector",
          width: 140,
          hideBelow: 700,
          editorType: "list",
          editorOptions: SECTORS as unknown as ReadonlyArray<string>,
          cell: (ctx) => renderSnippet(SectorChip, { row: ctx.row.original }),
        },
        {
          field: "last",
          header: "Last",
          editorType: "number",
          width: 110,
          editable: false,
          cell: (ctx) => renderSnippet(LastCell, { row: ctx.row.original }),
        },
        {
          field: "change",
          header: "Δ",
          editorType: "number",
          width: 95,
          editable: false,
          cell: (ctx) => renderSnippet(ChangeCell, { row: ctx.row.original }),
        },
        {
          field: "pctChange",
          header: "Δ %",
          editorType: "number",
          width: 90,
          editable: false,
          cell: (ctx) =>
            renderSnippet(PctChangeCell, { row: ctx.row.original }),
        },
        {
          field: "history",
          header: "Trend (30 ticks)",
          width: 180,
          editable: false,
          hideBelow: 700,
          cell: (ctx) => renderSnippet(TrendCell, { row: ctx.row.original }),
        },
        {
          field: "bid",
          header: "Bid",
          editorType: "number",
          width: 90,
          editable: false,
          hideBelow: 700,
          cell: (ctx) => renderSnippet(BidCell, { row: ctx.row.original }),
        },
        {
          field: "ask",
          header: "Ask",
          editorType: "number",
          width: 90,
          editable: false,
          hideBelow: 700,
          cell: (ctx) => renderSnippet(AskCell, { row: ctx.row.original }),
        },
        {
          field: "spread",
          header: "Spread",
          editorType: "number",
          width: 95,
          editable: false,
          hideBelow: 700,
          cell: (ctx) => renderSnippet(SpreadCell, { row: ctx.row.original }),
        },
        {
          field: "volume",
          header: "Volume",
          editorType: "number",
          width: 115,
          editable: false,
          hideBelow: 700,
          cell: (ctx) => renderSnippet(VolumeCell, { row: ctx.row.original }),
        },
        // The only editable column. Trader sets share count; the tick stream
        // never touches it, and our onCellValueChange handler pushes the
        // change back into the parent `rows` state so subsequent ticks pick
        // up the new value when they recompute P&L.
        {
          field: "position",
          header: "Position",
          editorType: "number",
          width: 160,
          cell: (ctx) => renderSnippet(PositionCell, { row: ctx.row.original }),
        },
        {
          field: "risk",
          header: "Risk",
          width: 95,
          hideBelow: 700,
          editorType: "list",
          editorOptions: ["Low", "Med", "High"] as const,
          cell: (ctx) => renderSnippet(RiskCell, { row: ctx.row.original }),
        },
        {
          field: "pnl",
          header: "P&L",
          editorType: "number",
          width: 130,
          editable: false,
          cell: (ctx) => renderSnippet(PnlCell, { row: ctx.row.original }),
        },
      ] satisfies ColumnDef<typeof features, Security>[]}
      {features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={34}
      containerHeight="100%"
      fitColumns={false}
      columnVirtualization={false}
      initialColumnPinning={{ left: ["symbol"], right: ["pnl"] }}
      responsive={true}
      {onCellValueChange}
    />
  </div>
</section>

<style>
  /* ─── KPI strip ──────────────────────────────────────────────── */
  .td-kpi-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 10px;
    flex-shrink: 0;
  }
  .td-kpi {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--sg-bg, #ffffff) 100%, transparent) 0%,
      color-mix(in srgb, var(--sg-header-bg, #f8fafc) 100%, transparent) 100%
    );
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 0 rgba(0, 0, 0, 0.02);
  }
  .td-kpi-label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin-bottom: 6px;
  }
  .td-kpi-value {
    font-size: 22px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.01em;
  }
  .td-kpi-foot {
    margin-top: 6px;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .td-pulse-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #16a34a;
    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
    animation: td-dot-pulse 1.6s ease-out infinite;
  }
  @keyframes td-dot-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.45);
    }
    70% {
      box-shadow: 0 0 0 8px rgba(22, 163, 74, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(22, 163, 74, 0);
    }
  }

  /* ─── Toolbar / sector chips ──────────────────────────────────── */
  .td-toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
  .td-toolbar-spacer {
    flex: 1 1 auto;
  }
  .td-btn {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 4px 12px;
    font-size: 12px;
    cursor: pointer;
  }
  .td-btn:hover {
    background: var(--sg-header-bg, #f1f5f9);
  }

  .td-hint {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
  }
  .td-hint strong {
    color: var(--sg-fg, #1e293b);
    font-weight: 600;
  }

  .td-chip {
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 999px;
    padding: 3px 10px;
    font-size: 11.5px;
    font-weight: 500;
    cursor: pointer;
    line-height: 1.6;
    transition:
      transform 80ms ease-out,
      box-shadow 120ms;
  }
  .td-chip:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.07);
  }
  .td-chip-active {
    border-color: transparent;
    box-shadow: 0 0 0 2px var(--site-accent, #2563eb) inset;
    font-weight: 600;
  }
  .td-chip-count {
    margin-left: 6px;
    font-size: 10px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }

  /* ─── Sector tints (chips + inline pills) ─────────────────────── */
  :global(.td-sector) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
    white-space: nowrap;
  }
  :global(.td-sec-technology) {
    background: #dbeafe;
    color: #1d4ed8;
  }
  :global(.td-sec-financials) {
    background: #dcfce7;
    color: #166534;
  }
  :global(.td-sec-healthcare) {
    background: #fce7f3;
    color: #9d174d;
  }
  :global(.td-sec-energy) {
    background: #fef3c7;
    color: #92400e;
  }
  :global(.td-sec-consumer) {
    background: #ede9fe;
    color: #5b21b6;
  }
  :global(.td-sec-industrials) {
    background: #e2e8f0;
    color: #334155;
  }
  :global(.td-sec-materials) {
    background: #fee2e2;
    color: #b91c1c;
  }
  :global(.td-sec-utilities) {
    background: #ccfbf1;
    color: #115e59;
  }
  :global(.td-sec-communication) {
    background: #e0e7ff;
    color: #3730a3;
  }
  :global(.td-sec-real-estate) {
    background: #ffedd5;
    color: #9a3412;
  }
  :global([data-theme="dark"] .td-sec-technology) {
    background: rgba(59, 130, 246, 0.18);
    color: #93c5fd;
  }
  :global([data-theme="dark"] .td-sec-financials) {
    background: rgba(34, 197, 94, 0.18);
    color: #4ade80;
  }
  :global([data-theme="dark"] .td-sec-healthcare) {
    background: rgba(236, 72, 153, 0.18);
    color: #f9a8d4;
  }
  :global([data-theme="dark"] .td-sec-energy) {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }
  :global([data-theme="dark"] .td-sec-consumer) {
    background: rgba(139, 92, 246, 0.18);
    color: #c4b5fd;
  }
  :global([data-theme="dark"] .td-sec-industrials) {
    background: rgba(148, 163, 184, 0.18);
    color: #cbd5e1;
  }
  :global([data-theme="dark"] .td-sec-materials) {
    background: rgba(239, 68, 68, 0.18);
    color: #fca5a5;
  }
  :global([data-theme="dark"] .td-sec-utilities) {
    background: rgba(20, 184, 166, 0.18);
    color: #5eead4;
  }
  :global([data-theme="dark"] .td-sec-communication) {
    background: rgba(99, 102, 241, 0.18);
    color: #a5b4fc;
  }
  :global([data-theme="dark"] .td-sec-real-estate) {
    background: rgba(249, 115, 22, 0.18);
    color: #fdba74;
  }

  /* ─── Symbol cell ─────────────────────────────────────────────── */
  :global(.td-symbol) {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    width: 100%;
  }
  :global(.td-sym-logo) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo,
      monospace;
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: #ffffff;
    text-shadow: 0 1px 0 rgba(0, 0, 0, 0.18);
    /* Default; per-sector classes override the gradient */
    background: linear-gradient(135deg, #64748b, #475569);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.18),
      inset 0 -2px 0 rgba(0, 0, 0, 0.12);
    user-select: none;
  }
  /* Sector-tinted logo gradients - match the chip palette */
  :global(.td-sym-technology) {
    background: linear-gradient(135deg, #6366f1, #4338ca);
  }
  :global(.td-sym-financials) {
    background: linear-gradient(135deg, #10b981, #059669);
  }
  :global(.td-sym-energy) {
    background: linear-gradient(135deg, #f59e0b, #b45309);
  }
  :global(.td-sym-healthcare) {
    background: linear-gradient(135deg, #ef4444, #b91c1c);
  }
  :global(.td-sym-consumer) {
    background: linear-gradient(135deg, #ec4899, #be185d);
  }
  :global(.td-sym-industrials) {
    background: linear-gradient(135deg, #0ea5e9, #0369a1);
  }
  :global(.td-sym-utilities) {
    background: linear-gradient(135deg, #14b8a6, #0f766e);
  }
  :global(.td-sym-materials) {
    background: linear-gradient(135deg, #a855f7, #7e22ce);
  }
  :global(.td-sym-communications) {
    background: linear-gradient(135deg, #8b5cf6, #6d28d9);
  }
  :global(.td-sym-real-estate) {
    background: linear-gradient(135deg, #f97316, #c2410c);
  }

  :global(.td-sym-ticker) {
    font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo,
      monospace;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--sg-fg, #0f172a);
    font-size: 13px;
  }

  /* ─── Pulse + change tints ────────────────────────────────────── */
  :global(.td-tick) {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 3px;
    border-radius: 3px;
    font-variant-numeric: tabular-nums;
  }
  :global(.td-up) {
    color: #16a34a;
    font-weight: 600;
  }
  :global(.td-down) {
    color: #dc2626;
    font-weight: 600;
  }
  :global([data-theme="dark"] .td-up) {
    color: #4ade80;
  }
  :global([data-theme="dark"] .td-down) {
    color: #f87171;
  }

  :global(.td-vol) {
    color: var(--sg-muted, #64748b);
  }

  :global(.td-pulse-up) {
    animation: td-pulse-up 320ms ease-out;
  }
  :global(.td-pulse-down) {
    animation: td-pulse-down 320ms ease-out;
  }
  @keyframes td-pulse-up {
    0% {
      background: rgba(34, 197, 94, 0.55);
    }
    100% {
      background: transparent;
    }
  }
  @keyframes td-pulse-down {
    0% {
      background: rgba(239, 68, 68, 0.55);
    }
    100% {
      background: transparent;
    }
  }

  /* ─── Sparkline ───────────────────────────────────────────────── */
  :global(.td-spark) {
    width: 120px;
    height: 24px;
    color: #2563eb;
    vertical-align: middle;
  }
  :global([data-theme="dark"] .td-spark) {
    color: #60a5fa;
  }
  :global(.td-spark-pct) {
    margin-left: 6px;
    font-size: 11px;
    font-variant-numeric: tabular-nums;
    vertical-align: middle;
  }

  /* ─── Position bar ────────────────────────────────────────────── */
  :global(.td-pos) {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  :global(.td-pos-bar) {
    position: relative;
    flex: 1 1 auto;
    height: 6px;
    background: var(--sg-border, #e2e8f0);
    border-radius: 3px;
    overflow: hidden;
  }
  :global(.td-pos-fill) {
    position: absolute;
    inset: 0 auto 0 0;
    transition: width 500ms ease-out;
  }
  :global(.td-pos-cool) {
    background: #2563eb;
  }
  :global(.td-pos-warm) {
    background: #ca8a04;
  }
  :global(.td-pos-hot) {
    background: #dc2626;
  }
  :global([data-theme="dark"] .td-pos-cool) {
    background: #60a5fa;
  }
  :global([data-theme="dark"] .td-pos-warm) {
    background: #fbbf24;
  }
  :global([data-theme="dark"] .td-pos-hot) {
    background: #f87171;
  }
  :global(.td-pos-text) {
    font-size: 11px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
    min-width: 28px;
    text-align: right;
  }

  /* ─── Risk pill ───────────────────────────────────────────────── */
  :global(.td-risk) {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    line-height: 1.5;
  }
  :global(.td-risk-low) {
    background: #dcfce7;
    color: #166534;
  }
  :global(.td-risk-med) {
    background: #fef3c7;
    color: #92400e;
  }
  :global(.td-risk-high) {
    background: #fee2e2;
    color: #b91c1c;
  }
  :global([data-theme="dark"] .td-risk-low) {
    background: rgba(34, 197, 94, 0.18);
    color: #4ade80;
  }
  :global([data-theme="dark"] .td-risk-med) {
    background: rgba(245, 158, 11, 0.18);
    color: #fbbf24;
  }
  :global([data-theme="dark"] .td-risk-high) {
    background: rgba(239, 68, 68, 0.18);
    color: #f87171;
  }

  /* ─── P&L ─────────────────────────────────────────────────────── */
  :global(.td-pnl) {
    font-weight: 700;
  }
</style>
