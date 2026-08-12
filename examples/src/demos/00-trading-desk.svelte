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

  // Give every symbol its OWN brand colour + emblem (deterministic from the
  // ticker), so the logo tiles read like distinct real company marks instead of
  // ten repeated sector tints. A curated palette of vivid brand colours (not raw
  // HSL, which turns muddy at low lightness) keeps them crisp and varied.
  const EXCHANGES = ["NASDAQ", "NYSE", "LSE", "TSX", "XETRA", "HKEX"] as const;
  // Vivid, visually distinct base colours - the kind real logos use.
  const BRAND_COLORS = [
    "#4f46e5", "#2563eb", "#0ea5e9", "#0891b2", "#0d9488", "#059669",
    "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#e11d48", "#db2777",
    "#c026d3", "#9333ea", "#7c3aed", "#0284c7", "#334155",
  ] as const;
  function symbolHash(sym: string): number {
    let h = 2166136261;
    for (let i = 0; i < sym.length; i++) {
      h ^= sym.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function brandColor(sym: string): string {
    return BRAND_COLORS[symbolHash(sym) % BRAND_COLORS.length]!;
  }
  function companyInitials(name: string, fallback: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    const ini = parts.slice(0, 2).map((w) => w[0] ?? "").join("");
    return (ini || fallback.slice(0, 2)).toUpperCase();
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

  // Per-sector accent, matching the inline chip palette. Fed to the list editor
  // as `editorOptions` so the dropdown paints each choice as a coloured pill.
  const SECTOR_COLORS: Record<Sector, string> = {
    Technology: "#2563eb",
    Financials: "#16a34a",
    Healthcare: "#db2777",
    Energy: "#d97706",
    Consumer: "#7c3aed",
    Industrials: "#475569",
    Materials: "#dc2626",
    Utilities: "#0d9488",
    Communication: "#4f46e5",
    "Real Estate": "#ea580c",
  };
  const SECTOR_OPTIONS = SECTORS.map((s) => ({
    value: s,
    label: s,
    color: SECTOR_COLORS[s],
  }));
  const RISK_OPTIONS = [
    { value: "Low", label: "Low", color: "#16a34a" },
    { value: "Med", label: "Med", color: "#d97706" },
    { value: "High", label: "High", color: "#dc2626" },
  ];

  // Fictional but real-sounding companies. A large first x descriptor x type
  // space so 10,000 rows rarely repeat a name, and the ticker is an abbreviation
  // of that name (deduped to stay unique) the way a real listing symbol is - so
  // you get BEAC / VRTX / NRDC, not AAA / AAB / AAC.
  const FIRST_WORDS = [
    "Nordic", "Pacific", "Atlas", "Vertex", "Quantum", "Helios", "Stellar", "Apex",
    "Crescent", "Sigma", "Pioneer", "Aurora", "Granite", "Cobalt", "Hyperion", "Meridian",
    "Polaris", "Sentinel", "Tessera", "Vantage", "Cascade", "Frontier", "Lumen", "Beacon",
    "Cardinal", "Orion", "Solstice", "Summit", "Ironwood", "Redwood", "Silverline", "Keystone",
    "Northwind", "Brightwater", "Copper", "Everest", "Halcyon", "Kestrel", "Nimbus", "Onyx",
    "Pinnacle", "Rampart", "Seabright", "Thornton", "Vega", "Westford", "Ashford", "Belmont",
    "Corvus", "Delphi", "Ember", "Fairmont", "Grayson", "Harborview", "Ridgeline", "Sable",
    "Trident", "Ridgewood", "Wexford", "Auric", "Blackpine", "Clearwater", "Dunmore", "Larkspur",
  ];
  const DESCRIPTORS = [
    "Bio", "Energy", "Materials", "Logistics", "Dynamics", "Robotics", "Analytics",
    "Semiconductor", "Pharma", "Mining", "Aerospace", "Digital", "Capital", "Metals",
    "Renewables", "Health", "Foods", "Grid", "Cloud", "Data", "Motors", "Chemical",
    "Petroleum", "Software", "Devices", "Textiles", "Beverage", "Freight", "Payments", "Media",
    "Security", "Instruments", "Optics", "Marine", "Storage", "Gaming", "Networks", "Systems",
  ];
  const CORP_TYPES = [
    "Holdings", "Group", "Partners", "Corp", "Inc", "Industries", "Technologies", "Labs",
    "Ventures", "Trust", "Global", "Enterprises", "Solutions", "Company", "International", "Resources",
  ];

  /** A mostly-unique, real-sounding company name as its component words. */
  function makeName(usedNames: Set<string>): string[] {
    for (let t = 0; t < 12; t++) {
      const first = pick(FIRST_WORDS);
      const roll = rand();
      const words =
        roll < 0.45
          ? [first, pick(DESCRIPTORS), pick(CORP_TYPES)]
          : roll < 0.75
            ? [first, pick(DESCRIPTORS)]
            : [first, pick(CORP_TYPES)];
      const key = words.join(" ");
      if (!usedNames.has(key)) {
        usedNames.add(key);
        return words;
      }
    }
    const words = [pick(FIRST_WORDS), pick(DESCRIPTORS), pick(CORP_TYPES)];
    usedNames.add(words.join(" "));
    return words;
  }

  /** An abbreviation-style ticker for a name, unique across the seed. */
  function makeTicker(words: string[], used: Set<string>): string {
    const parts = words.map((w) => w.toUpperCase().replace(/[^A-Z]/g, ""));
    const f = parts[0] ?? "CO";
    const s = parts[1] ?? "";
    const th = parts[2] ?? "";
    const candidates = [
      f.slice(0, 4),
      f.slice(0, 3),
      f.slice(0, 2) + s.slice(0, 2),
      f.slice(0, 3) + s.slice(0, 1),
      f.slice(0, 1) + s.slice(0, 1) + th.slice(0, 1),
      f.slice(0, 2) + s.slice(0, 1) + th.slice(0, 1),
    ];
    for (const c of candidates) {
      if (c.length >= 3 && c.length <= 4 && !used.has(c)) {
        used.add(c);
        return c;
      }
    }
    const base = f.slice(0, 3) || "COR";
    for (let k = 0; k < 26; k++) {
      const c = base + String.fromCharCode(65 + k);
      if (!used.has(c)) {
        used.add(c);
        return c;
      }
    }
    let n = 1;
    while (used.has(`X${n}`)) n++;
    used.add(`X${n}`);
    return `X${n}`;
  }

  function makeRow(
    i: number,
    usedNames: Set<string>,
    usedTickers: Set<string>,
  ): Security {
    const words = makeName(usedNames);
    const name = words.join(" ");
    const symbol = makeTicker(words, usedTickers);
    const sector = SECTORS[i % SECTORS.length]!;
    // Price range tuned so big-cap-ish names live near the top of the seed.
    const basePrice = round(8 + rand() * 990, 2);
    const open = basePrice;
    // Pre-seed the 30-point trail. Each name gets its OWN trend + volatility so
    // the sparklines read like distinct real charts - steady climbers, choppy
    // names, sliders - instead of identical noise. Multiplicative walk with a
    // per-name drift and a per-name step size.
    const trend = round((rand() - 0.5) * 0.5, 4); // total drift over the trail: -25%..+25%
    const vol = 0.005 + rand() * 0.018; // per-step volatility 0.5%..2.3%
    const history: number[] = [];
    let h = basePrice;
    for (let k = 0; k < 30; k++) {
      h = Math.max(0.5, h * (1 + trend / 30 + (rand() - 0.5) * vol));
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
    const usedNames = new Set<string>();
    const usedTickers = new Set<string>();
    const out: Security[] = new Array(n);
    for (let i = 0; i < n; i++) out[i] = makeRow(i, usedNames, usedTickers);
    return out;
  }

  // ---- State

  const ROW_COUNT = 10_000;
  let rows = $state.raw<Security[]>(makeSeed(ROW_COUNT));
  let pulses = $state.raw<Record<string, "up" | "down">>({});
  let paused = $state(false);
  let ticks = $state(0);
  let sectorFilter = $state<Sector | "All">("All");

  // ---- Notifications: a lightweight desk feed. The tick loop surfaces the odd
  // notable move as a bell entry (throttled so it stays an occasional
  // heads-up, never a stream). Purely local demo state - no engine, no watching.
  type Notif = {
    id: number;
    symbol: string;
    tone: "up" | "down";
    title: string;
    detail: string;
  };
  let notifications = $state<Notif[]>([]);
  let unread = $state(0);
  let bellOpen = $state(false);
  let notifSeq = 0;
  let lastNotifTick = -100;
  const NOTIF_GAP = 6; // min ticks between notifications (~3 s at 500 ms)
  const NOTIF_PCT = 10; // only flag names at least this far from open

  function pushNotif(top: Security) {
    lastNotifTick = ticks;
    const up = top.pctChange >= 0;
    const n: Notif = {
      id: ++notifSeq,
      symbol: top.symbol,
      tone: up ? "up" : "down",
      title: `${top.symbol} ${up ? "+" : ""}${top.pctChange.toFixed(1)}% today`,
      detail: `${top.name} · ${fmtUsd(top.last)} · ${top.risk} risk`,
    };
    notifications = [n, ...notifications].slice(0, 24);
    unread += 1;
  }

  function toggleBell() {
    bellOpen = !bellOpen;
    if (bellOpen) unread = 0;
  }
  function clearNotifs() {
    notifications = [];
    unread = 0;
  }

  // Close the bell dropdown on an outside click.
  $effect(() => {
    if (!bellOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target;
      if (t instanceof Element && t.closest(".td-notif")) return;
      bellOpen = false;
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  });

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
    // Track the most extreme mover among the rows that ticked, for the desk feed.
    let topMover: Security | null = null;
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
      if (!topMover || Math.abs(next.pctChange) > Math.abs(topMover.pctChange)) {
        topMover = next;
      }
    }
    rows = nextRows;
    pulses = nextPulses;
    ticks += 1;
    // Occasionally surface the standout mover as a bell notification.
    if (
      topMover &&
      Math.abs(topMover.pctChange) >= NOTIF_PCT &&
      ticks - lastNotifTick >= NOTIF_GAP
    ) {
      pushNotif(topMover);
    }
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
    // Vertical padding so the line never sits flush against the top/bottom edge -
    // reads cleaner and lets a nearly-flat series actually look flat.
    const pad = h * 0.16;
    const inner = h - pad * 2;
    let d = "";
    for (let i = 0; i < history.length; i++) {
      const x = round(i * step, 2);
      const y = round(pad + (1 - (history[i]! - min) / range) * inner, 2);
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

{#snippet LogoMark(m: { sym: string; name: string })}
  {@const c = brandColor(m.sym)}
  {@const style = symbolHash(m.sym) % 6}
  {@const roundTile = symbolHash(m.sym) % 2 === 0}
  {@const initials = companyInitials(m.name, m.sym)}
  <svg class="td-logo" viewBox="0 0 28 28" width="27" height="27" aria-hidden="true">
    <!-- Brand tile: per-company colour, alternating rounded-square / disc, with a
         soft top sheen + darker foot so it reads like a moulded logo chip. -->
    {#if roundTile}
      <circle cx="14" cy="14" r="13" fill={c} />
      <path d="M2 12 A13 13 0 0 1 26 12 L26 3 L2 3 Z" fill="#fff" opacity="0.16" />
      <path d="M2 17 A13 13 0 0 0 26 17 L26 25 L2 25 Z" fill="#000" opacity="0.12" />
    {:else}
      <rect x="1" y="1" width="26" height="26" rx="7.5" fill={c} />
      <rect x="1" y="1" width="26" height="12" rx="7.5" fill="#fff" opacity="0.16" />
      <rect x="1" y="16" width="26" height="11" rx="7.5" fill="#000" opacity="0.1" />
    {/if}
    <!-- Mark: a distinct emblem per company (deterministic from the ticker). -->
    {#if style === 0}
      <circle cx="14" cy="14" r="6" fill="none" stroke="#fff" stroke-width="2.2" opacity="0.92" />
      <circle cx="14" cy="14" r="1.9" fill="#fff" />
    {:else if style === 1}
      <path d="M9 18.5 L13.5 9.5 M14.5 18.5 L19 9.5" stroke="#fff" stroke-width="2.3" stroke-linecap="round" opacity="0.92" />
    {:else if style === 2}
      <rect x="8" y="15" width="3.1" height="5" rx="1" fill="#fff" opacity="0.92" />
      <rect x="12.45" y="11.5" width="3.1" height="8.5" rx="1" fill="#fff" opacity="0.92" />
      <rect x="16.9" y="8" width="3.1" height="12" rx="1" fill="#fff" opacity="0.92" />
    {:else if style === 3}
      <path d="M14 8 L20 19 L8 19 Z" fill="#fff" opacity="0.92" />
    {:else if style === 4}
      <circle cx="11.6" cy="14" r="4.8" fill="#fff" opacity="0.5" />
      <circle cx="16.4" cy="14" r="4.8" fill="#fff" opacity="0.5" />
    {:else}
      <text
        x="14"
        y="18.4"
        text-anchor="middle"
        font-size="11"
        font-weight="800"
        fill="#fff"
        font-family="ui-monospace, SFMono-Regular, Menlo, monospace">{initials}</text>
    {/if}
  </svg>
{/snippet}

{#snippet SymbolCell(props: { row: Security })}
  {@const exchange = EXCHANGES[symbolHash(props.row.symbol) % EXCHANGES.length]}
  <span class="td-symbol">
    {@render LogoMark({ sym: props.row.symbol, name: props.row.name })}
    <span class="td-sym-meta">
      <span class="td-sym-ticker">{props.row.symbol}</span>
      <span class="td-sym-exch">{exchange}</span>
    </span>
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
  {@const pct = ((h[h.length - 1]! - h[0]!) / h[0]!) * 100}
  <span class="td-trend">
    <svg
      class={`td-spark ${positive ? "td-up" : "td-down"}`}
      style={`color: ${positive ? "var(--td-spark-up)" : "var(--td-spark-down)"}`}
      viewBox="0 0 120 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={`${sparkPath(h, 120, 32)} L 120 32 L 0 32 Z`}
        fill="currentColor"
        opacity="0.12"
      />
      <path
        d={sparkPath(h, 120, 32)}
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <span class={`td-spark-pct ${positive ? "td-up" : "td-down"}`}>
      {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
    </span>
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

    <!-- Notifications bell -->
    <div class="td-notif">
      <button
        type="button"
        class="td-bell"
        class:td-bell-on={unread > 0}
        onclick={toggleBell}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={bellOpen}
      >
        <svg
          viewBox="0 0 24 24"
          width="17"
          height="17"
          fill="none"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {#if unread > 0}
          <span class="td-bell-badge">{unread > 9 ? "9+" : unread}</span>
        {/if}
      </button>

      {#if bellOpen}
        <div class="td-notif-panel" role="dialog" aria-label="Notifications">
          <div class="td-notif-head">
            <span>Notifications</span>
            {#if notifications.length}
              <button type="button" class="td-notif-clear" onclick={clearNotifs}
                >Clear</button
              >
            {/if}
          </div>
          {#if notifications.length === 0}
            <div class="td-notif-empty">You're all caught up.</div>
          {:else}
            <ul class="td-notif-list">
              {#each notifications as n (n.id)}
                <li class={`td-notif-item td-${n.tone}`}>
                  <span class="td-notif-dot" aria-hidden="true"></span>
                  <div class="td-notif-text">
                    <span class="td-notif-title">{n.title}</span>
                    <span class="td-notif-detail">{n.detail}</span>
                  </div>
                </li>
              {/each}
            </ul>
          {/if}
        </div>
      {/if}
    </div>
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
          editorOptions: SECTOR_OPTIONS,
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
          editorOptions: RISK_OPTIONS,
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
      rowHeight={40}
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
  /* Keep every data cell at one size. Without this the grid cells inherit the
     page's 16px, which reads oddly next to the 11-13px chips/labels - the tags
     looked smaller than the numbers. 13px is the standard dense-grid size. */
  :global(.td-shell .sv-grid-cell) {
    font-size: 13px;
  }

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
    background: var(--sg-row-hover-bg, #f1f5f9);
  }

  /* ─── Notifications bell + panel ──────────────────────────────── */
  .td-notif {
    position: relative;
    display: inline-flex;
  }
  .td-bell {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 30px;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    cursor: pointer;
    transition:
      background 0.14s ease,
      border-color 0.14s ease;
  }
  .td-bell:hover {
    background: var(--sg-row-hover-bg, #f1f5f9);
  }
  .td-bell-on {
    color: var(--sg-accent, #2563eb);
    border-color: color-mix(in srgb, var(--sg-accent, #2563eb) 45%, var(--sg-border, #cbd5e1));
  }
  .td-bell-badge {
    position: absolute;
    top: -6px;
    right: -6px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
    color: #fff;
    background: #dc2626;
    border-radius: 999px;
    box-shadow: 0 0 0 2px var(--sg-bg, #fff);
  }
  .td-notif-panel {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    z-index: 40;
    width: 300px;
    max-height: 360px;
    overflow: auto;
    background: var(--sg-bg, #ffffff);
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 10px;
    box-shadow: 0 12px 32px -8px rgba(15, 23, 42, 0.35);
  }
  .td-notif-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 12px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sg-muted, #64748b);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    position: sticky;
    top: 0;
    background: var(--sg-bg, #ffffff);
  }
  .td-notif-clear {
    border: 0;
    background: transparent;
    color: var(--sg-accent, #2563eb);
    font-size: 11px;
    font-weight: 600;
    text-transform: none;
    letter-spacing: 0;
    cursor: pointer;
  }
  .td-notif-empty {
    padding: 28px 16px;
    text-align: center;
    font-size: 12.5px;
    color: var(--sg-muted, #64748b);
  }
  .td-notif-list {
    list-style: none;
    margin: 0;
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .td-notif-item {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 9px;
    align-items: start;
    padding: 9px 10px;
    border-radius: 8px;
  }
  .td-notif-item:hover {
    background: var(--sg-row-hover-bg, #f1f5f9);
  }
  .td-notif-dot {
    width: 8px;
    height: 8px;
    margin-top: 5px;
    border-radius: 50%;
    background: #16a34a;
  }
  .td-notif-item.td-down .td-notif-dot {
    background: #dc2626;
  }
  .td-notif-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .td-notif-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--sg-fg, #0f172a);
  }
  .td-notif-detail {
    font-size: 11.5px;
    color: var(--sg-muted, #64748b);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    box-shadow: 0 0 0 2px var(--sg-accent, #2563eb) inset;
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
    padding: 2px 10px;
    border-radius: 999px;
    font-size: 13px;
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
  :global(.td-logo) {
    flex-shrink: 0;
    /* A shape-following shadow so circular marks don't get a square halo. */
    filter: drop-shadow(0 1px 1.5px rgba(15, 23, 42, 0.3));
  }

  :global(.td-sym-meta) {
    display: inline-flex;
    flex-direction: column;
    min-width: 0;
    line-height: 1.15;
  }
  :global(.td-sym-ticker) {
    font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo,
      monospace;
    font-weight: 700;
    letter-spacing: 0.03em;
    color: var(--sg-fg, #0f172a);
    font-size: 13px;
  }
  :global(.td-sym-exch) {
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    text-transform: uppercase;
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
  /* Direction colours live as theme-aware CSS vars on the cell, and the SVG
     reads them inline (see TrendCell). Setting the colour inline makes the
     trail reliably green/red in every context - including the home-page
     preview - instead of falling back to a neutral slate that looks blue. */
  :global(.td-trend) {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 100%;
    --td-spark-up: #16a34a;
    --td-spark-down: #dc2626;
  }
  :global([data-theme="dark"] .td-trend) {
    --td-spark-up: #4ade80;
    --td-spark-down: #f87171;
  }
  :global(.td-spark) {
    flex: 1 1 auto;
    min-width: 0;
    height: 68%;
    max-height: 30px;
    color: var(--sg-muted, #64748b);
  }
  :global(.td-spark-pct) {
    flex: 0 0 auto;
    width: 48px;
    text-align: right;
    font-size: 11.5px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
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
    padding: 2px 10px;
    border-radius: 4px;
    font-size: 13px;
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
