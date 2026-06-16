<!-- Documented in: docs/help/recipes.md -->
<script lang="ts">
  /**
   * 37. Theming studio
   * ------------------
   * A live token playground. Move sliders / pick colors → the grid
   * restyles in real time. The "can I make it ours" answer for any
   * evaluator looking at this from a design-system perspective.
   *
   * What's adjustable, and what CSS variable each control writes:
   *
   *   - Brand accent  → --sg-accent       (header label, selection, focus)
   *   - Surface color → --sg-bg           (cell background)
   *   - Header bg     → --sg-header-bg
   *   - Border color  → --sg-border
   *   - Density       → row height (passed straight to the grid prop)
   *   - Radius        → --sg-radius       (cell rounding via override)
   *   - Font family   → wrapper `font-family`
   *   - Dark / light  → data-theme attribute on the wrapper
   *
   * A "Copy CSS" pane at the bottom emits the full `:root { ... }`
   * snippet so the buyer can paste it straight into their stylesheet.
   * Settings persist across page reloads via localStorage so the demo
   * remembers the configuration the user landed on.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    renderSnippet,
    type ColumnDef,
  } from '@svgrid/grid'

  // ---- Domain (small + visual so the theming is what's loud) ----------

  type Person = {
    id: string
    name: string
    role: string
    team: string
    location: string
    status: 'active' | 'pending' | 'inactive'
    salary: number
    joined: string
  }

  const ROLES = ['Engineer', 'Designer', 'Manager', 'Analyst', 'Director', 'PM']
  const TEAMS = ['Platform', 'Growth', 'Data', 'Mobile', 'DevX', 'Brand']
  const LOCATIONS = ['NYC', 'SF', 'London', 'Berlin', 'Tokyo', 'Sydney', 'Toronto', 'Amsterdam']

  let prng = 0x71EAD3
  function rnd(): number {
    prng = (prng * 1664525 + 1013904223) >>> 0
    return prng / 0xFFFFFFFF
  }
  function pick<T>(arr: readonly T[]): T { return arr[Math.floor(rnd() * arr.length)]! }

  const FIRST_NAMES = ['Alex', 'Jamie', 'Casey', 'Drew', 'Robin', 'Morgan', 'Riley', 'Quinn', 'Avery', 'Reese', 'Sasha', 'Jordan']
  const LAST_NAMES = ['Park', 'Singh', 'Khan', 'Cohen', 'Nakamura', 'Silva', 'Diaz', 'Mehta', 'Olsen', 'Tran', 'Wu', 'Nair']

  function seedPeople(n: number): Person[] {
    const out: Person[] = []
    for (let i = 0; i < n; i += 1) {
      const first = pick(FIRST_NAMES)
      const last = pick(LAST_NAMES)
      const statusRoll = rnd()
      const status: Person['status'] = statusRoll < 0.78 ? 'active' : statusRoll < 0.92 ? 'pending' : 'inactive'
      out.push({
        id: `EMP-${(1000 + i).toString(36).toUpperCase()}`,
        name: `${first} ${last}`,
        role: pick(ROLES),
        team: pick(TEAMS),
        location: pick(LOCATIONS),
        status,
        salary: Math.round((50_000 + rnd() * 200_000) / 1000) * 1000,
        joined: new Date(Date.now() - Math.floor(rnd() * 365 * 4) * 86_400_000).toISOString().slice(0, 10),
      })
    }
    return out
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const people = seedPeople(40)

  // ---- Theme tokens (state) -------------------------------------------

  type Density = 'compact' | 'normal' | 'comfortable'

  const ACCENT_PRESETS = [
    { name: 'Indigo',  hex: '#2563eb' },
    { name: 'Emerald', hex: '#059669' },
    { name: 'Rose',    hex: '#e11d48' },
    { name: 'Amber',   hex: '#d97706' },
    { name: 'Violet',  hex: '#7c3aed' },
    { name: 'Teal',    hex: '#0d9488' },
    { name: 'Slate',   hex: '#475569' },
  ]
  const FONT_OPTIONS = [
    { id: 'system',   label: 'System',   stack: '-apple-system, system-ui, Segoe UI, Roboto, Helvetica, Arial, sans-serif' },
    { id: 'inter',    label: 'Inter',    stack: 'Inter, system-ui, sans-serif' },
    { id: 'serif',    label: 'Serif',    stack: '"IBM Plex Serif", Georgia, serif' },
    { id: 'mono',     label: 'Mono',     stack: 'ui-monospace, "Cascadia Mono", Menlo, monospace' },
  ]
  // Bumped key (`:v2`) so saves from the earlier light-default build
  // are dropped - otherwise returning visitors would land in the old
  // light mode they happened to save before we flipped the default.
  const STORAGE_KEY = 'sv-grid:theming-studio:v2'

  type ThemeConfig = {
    accent: string
    density: Density
    radius: number
    fontId: string
    isDark: boolean
    zebra: boolean
  }
  function defaultConfig(): ThemeConfig {
    // Default to dark mode so the studio looks like a "design tool"
    // out of the box - most theming tools open dark and the buyer
    // immediately sees the contrast.
    return { accent: '#2563eb', density: 'normal', radius: 6, fontId: 'system', isDark: true, zebra: true }
  }
  function loadConfig(): ThemeConfig {
    if (typeof localStorage === 'undefined') return defaultConfig()
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return defaultConfig()
      const parsed = JSON.parse(raw) as Partial<ThemeConfig>
      return { ...defaultConfig(), ...parsed }
    } catch {
      return defaultConfig()
    }
  }

  const initial = loadConfig()
  let accent = $state(initial.accent)
  let density = $state<Density>(initial.density)
  let radius = $state(initial.radius)
  let fontId = $state(initial.fontId)
  let isDark = $state(initial.isDark)
  let zebra = $state(initial.zebra)

  $effect(() => {
    if (typeof localStorage === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accent, density, radius, fontId, isDark, zebra }))
    } catch {/* quota / private mode - fine */}
  })

  const rowHeight = $derived(density === 'compact' ? 28 : density === 'comfortable' ? 48 : 36)
  const fontStack = $derived(FONT_OPTIONS.find((f) => f.id === fontId)?.stack ?? FONT_OPTIONS[0]!.stack)

  /**
   * The grid's CSS variables (`--sg-bg`, `--sg-header-bg`, etc.) come
   * from the example app's global stylesheet, which scopes the dark
   * palette under `html[data-theme='dark']`. The Theming Studio's
   * `data-theme="dark"` attribute lives on the section wrapper, not
   * `html`, so the global rule never fires. To make the toggle
   * actually flip the grid's surface colors, we hand-write the full
   * dark-token set as inline CSS variables on the wrapper - that
   * forces the grid to read from the wrapper's scope, not the body.
   */
  const inlineStyle = $derived(
    `--sg-accent: ${accent};` +
    `--sg-radius: ${radius}px;` +
    `font-family: ${fontStack};` +
    (isDark
      ? // Mirror of html[data-theme='dark'] tokens from examples/src/index.css
        'color-scheme: dark;' +
        'background: #181d27;' +
        'color: #e2e8f0;' +
        '--sg-bg: #181d27;' +
        '--sg-fg: #e2e8f0;' +
        '--sg-muted: #94a3b8;' +
        '--sg-border: #374151;' +
        '--sg-header-bg: #1e2433;' +
        '--sg-header-fg: #e2e8f0;' +
        '--sg-row-alt-bg: #1b2230;' +
        '--sg-row-hover-bg: #232b3c;' +
        '--sg-selection-bg: #1d3a73;' +
        '--sg-input-bg: #1a2130;' +
        '--sg-input-border: #2c3548;' +
        '--sg-scrollbar-bg: #1a2130;' +
        '--sg-scrollbar-thumb: #475569;' +
        '--sg-scrollbar-thumb-hover: #64748b;' +
        '--sg-scrollbar-thumb-active: #94a3b8;' +
        '--sg-scrollbar-arrow: #64748b;' +
        '--sg-scrollbar-arrow-hover: #e2e8f0;' +
        '--sg-scrollbar-arrow-hover-bg: #2a3142;'
      : 'color-scheme: light;' +
        'background: #ffffff;' +
        'color: #0f172a;' +
        '--sg-bg: #ffffff;' +
        '--sg-fg: #0f172a;' +
        '--sg-muted: #64748b;' +
        '--sg-border: #e2e8f0;' +
        '--sg-header-bg: #f1f5f9;' +
        '--sg-header-fg: #0f172a;' +
        '--sg-row-alt-bg: #f8fafc;' +
        '--sg-row-hover-bg: #eef2ff;' +
        '--sg-selection-bg: #dbeafe;' +
        '--sg-input-bg: #ffffff;' +
        '--sg-input-border: #cbd5e1;'),
  )

  function resetTheme(): void {
    const d = defaultConfig()
    accent = d.accent
    density = d.density
    radius = d.radius
    fontId = d.fontId
    isDark = d.isDark
    zebra = d.zebra
  }

  // ---- Copyable CSS snippet --------------------------------------------

  const cssSnippet = $derived.by(() => {
    return [
      '/* Drop into your global stylesheet. */',
      ':root {',
      `  --sg-accent: ${accent};`,
      `  --sg-row-height: ${rowHeight}px;`,
      `  --sg-radius: ${radius}px;`,
      '}',
      'html, body {',
      `  font-family: ${fontStack};`,
      '}',
      isDark ? '/* Pair with html[data-theme=\'dark\'] for full dark-mode tokens. */' : '',
    ].filter(Boolean).join('\n')
  })

  let copiedFlash = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | null = null
  async function copySnippet(): Promise<void> {
    if (typeof navigator === 'undefined' || !navigator.clipboard) return
    try {
      await navigator.clipboard.writeText(cssSnippet)
      copiedFlash = true
      if (copyTimer) clearTimeout(copyTimer)
      copyTimer = setTimeout(() => (copiedFlash = false), 1600)
    } catch {/* user denied clipboard - fine */}
  }

  // ---- Formatters ------------------------------------------------------

  function fmtMoney(n: number): string {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
  }
</script>

<!-- ───────────────────── CELL SNIPPETS ───────────────────── -->

{#snippet AvatarCell(props: { row: Person })}
  {@const initials = props.row.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
  <span class="ts-person">
    <span class="ts-avatar" style={`background: ${accent}`}>{initials}</span>
    <span>{props.row.name}</span>
  </span>
{/snippet}

{#snippet StatusCell(props: { row: Person })}
  <span class={`ts-status ts-status-${props.row.status}`}>
    <span class="ts-status-dot"></span>{props.row.status}
  </span>
{/snippet}

<!-- ───────────────────── LAYOUT ───────────────────── -->

<section
  class="ts-shell flex flex-1 min-h-0 gap-3"
  data-theme={isDark ? 'dark' : 'light'}
  class:ts-zebra-on={zebra}
  style={inlineStyle}
>
  <!-- LEFT: token controls -->
  <aside class="ts-sidebar">
    <header class="ts-side-head">Theme tokens</header>

    <section class="ts-side-block">
      <h3>Mode</h3>
      <div class="ts-segmented">
        <button
          type="button"
          class="ts-seg"
          class:ts-seg-active={!isDark}
          onclick={() => (isDark = false)}
        >☀ Light</button>
        <button
          type="button"
          class="ts-seg"
          class:ts-seg-active={isDark}
          onclick={() => (isDark = true)}
        >☾ Dark</button>
      </div>
    </section>

    <section class="ts-side-block">
      <h3>Brand accent</h3>
      <div class="ts-color-grid">
        {#each ACCENT_PRESETS as preset (preset.hex)}
          <button
            type="button"
            class="ts-color-dot"
            class:ts-color-active={preset.hex === accent}
            style={`background: ${preset.hex}`}
            onclick={() => (accent = preset.hex)}
            title={preset.name}
          ></button>
        {/each}
        <label class="ts-color-custom" title="Pick any color">
          <input type="color" bind:value={accent} />
          <span class="ts-color-custom-dot" style={`background: ${accent}`}></span>
        </label>
      </div>
      <code class="ts-token-readout">--sg-accent: {accent};</code>
    </section>

    <section class="ts-side-block">
      <h3>Density</h3>
      <div class="ts-segmented">
        {#each [{id: 'compact', label: 'Compact'}, {id: 'normal', label: 'Normal'}, {id: 'comfortable', label: 'Comfortable'}] as opt (opt.id)}
          <button
            type="button"
            class="ts-seg"
            class:ts-seg-active={density === opt.id}
            onclick={() => (density = opt.id as Density)}
          >{opt.label}</button>
        {/each}
      </div>
      <code class="ts-token-readout">row-height: {rowHeight}px;</code>
    </section>

    <section class="ts-side-block">
      <h3>Corner radius</h3>
      <input
        type="range"
        min="0"
        max="16"
        step="1"
        bind:value={radius}
        class="ts-slider"
      />
      <code class="ts-token-readout">--sg-radius: {radius}px;</code>
    </section>

    <section class="ts-side-block">
      <h3>Typography</h3>
      <select bind:value={fontId} class="ts-select">
        {#each FONT_OPTIONS as opt (opt.id)}<option value={opt.id}>{opt.label}</option>{/each}
      </select>
      <code class="ts-token-readout">font-family: {fontId};</code>
    </section>

    <section class="ts-side-block">
      <h3>Row striping</h3>
      <label class="ts-check">
        <input type="checkbox" bind:checked={zebra} />
        <span>Zebra rows</span>
      </label>
    </section>

    <div class="ts-side-foot">
      <button type="button" class="ts-reset-btn" onclick={resetTheme}>Reset</button>
    </div>
  </aside>

  <!-- RIGHT: live grid + CSS snippet -->
  <div class="ts-main flex flex-col flex-1 min-h-0 gap-3">
    <div class="flex-1 min-h-0 ts-grid-host">
      <SvGrid
        data={people}
        columns={[
          { field: 'id', header: 'ID', width: 110, editable: false },
          { field: 'name', header: 'Name', width: 200, editable: false,
            cell: (ctx) => renderSnippet(AvatarCell, { row: ctx.row.original }) },
          { field: 'role', header: 'Role', width: 130 },
          { field: 'team', header: 'Team', width: 130 },
          { field: 'location', header: 'Location', width: 130 },
          { field: 'status', header: 'Status', width: 120, editable: false,
            cell: (ctx) => renderSnippet(StatusCell, { row: ctx.row.original }) },
          { field: 'salary', header: 'Salary', editorType: 'number', width: 140,
            format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
            editable: false,
            cell: (ctx) => fmtMoney(ctx.row.original.salary) },
          { field: 'joined', header: 'Joined', editorType: 'date', width: 130, editable: false },
        ] satisfies ColumnDef<typeof features, Person>[]}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showPagination={false}
        enableInlineEditing={true}
        enableCellSelection={true}
        enableRowSummaries={false}
        rowHeight={rowHeight}
        containerHeight="100%"
        fitColumns={true}
      />
    </div>

    <div class="ts-snippet-card">
      <header class="ts-snippet-head">
        <span>CSS snippet</span>
        <button
          type="button"
          class="ts-copy-btn"
          onclick={copySnippet}
        >{copiedFlash ? '✓ Copied' : 'Copy'}</button>
      </header>
      <pre class="ts-snippet-pre"><code>{cssSnippet}</code></pre>
    </div>
  </div>
</section>

<style>
  .ts-shell {
    height: 100%;
  }

  /* Per-section dark overrides - the rest comes through the parent's
     [data-theme='dark'] selector defined in the example app's CSS. */
  .ts-shell[data-theme='dark'] {
    background: #111827;
    color: #e2e8f0;
  }

  /* Sidebar */
  .ts-sidebar {
    width: 260px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: auto;
    display: flex;
    flex-direction: column;
    flex-shrink: 0;
  }
  .ts-side-head {
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-header-bg, #f1f5f9);
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ts-side-block {
    padding: 12px 16px;
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .ts-side-block h3 {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--sg-muted, #64748b);
    margin: 0 0 8px 0;
  }
  .ts-token-readout {
    display: block;
    margin-top: 8px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 11px;
    color: var(--sg-muted, #64748b);
  }
  .ts-side-foot {
    padding: 12px 16px;
    margin-top: auto;
  }
  .ts-reset-btn {
    width: 100%;
    border: 1px solid var(--sg-border, #cbd5e1);
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 6px;
    padding: 6px;
    font-size: 12px;
    cursor: pointer;
  }
  .ts-reset-btn:hover { background: var(--sg-header-bg, #f1f5f9); }

  /* Mode toggle / density */
  .ts-segmented {
    display: inline-flex;
    width: 100%;
    background: var(--sg-header-bg, #f1f5f9);
    border-radius: 6px;
    padding: 2px;
    gap: 2px;
  }
  .ts-seg {
    flex: 1 1 0;
    border: 0;
    background: transparent;
    color: var(--sg-muted, #64748b);
    padding: 4px;
    font-size: 11.5px;
    border-radius: 4px;
    cursor: pointer;
  }
  .ts-seg-active {
    background: var(--sg-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    font-weight: 600;
  }

  /* Color picker grid */
  .ts-color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .ts-color-dot {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px solid transparent;
    cursor: pointer;
    padding: 0;
    transition: transform 80ms;
  }
  .ts-color-dot:hover { transform: scale(1.1); }
  .ts-color-active {
    border-color: var(--sg-fg, #1e293b);
    box-shadow: 0 0 0 1px var(--sg-bg, #ffffff);
  }
  .ts-color-custom {
    width: 26px;
    height: 26px;
    border-radius: 999px;
    border: 2px dashed var(--sg-border, #cbd5e1);
    position: relative;
    overflow: hidden;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  .ts-color-custom input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    cursor: pointer;
  }
  .ts-color-custom-dot {
    width: 16px;
    height: 16px;
    border-radius: 999px;
  }

  /* Slider */
  .ts-slider {
    width: 100%;
    accent-color: var(--sg-accent, #2563eb);
  }

  /* Select */
  .ts-select {
    width: 100%;
    border: 1px solid var(--sg-input-border, #cbd5e1);
    background: var(--sg-input-bg, #ffffff);
    color: var(--sg-fg, #1e293b);
    border-radius: 5px;
    padding: 4px 8px;
    font-size: 12px;
  }
  .ts-check {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--sg-fg, #1e293b);
  }

  /* Main column */
  .ts-main {
    min-width: 0;
  }
  .ts-grid-host {
    border-radius: var(--sg-radius, 6px);
    overflow: hidden;
  }
  /* Apply the wrapper's --sg-radius down to cells via global selectors. */
  :global(.ts-shell .sv-grid-shell) {
    border-radius: var(--sg-radius, 6px);
    overflow: hidden;
  }
  /* Suppress zebra striping when the user turns it off. */
  :global(.ts-shell:not(.ts-zebra-on) .sv-grid-table tbody tr:nth-child(even) .sv-grid-cell) {
    background: var(--sg-bg, #ffffff) !important;
  }

  /* Avatar pill */
  :global(.ts-person) {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  :global(.ts-avatar) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
  }

  :global(.ts-status) {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 600;
    text-transform: capitalize;
  }
  :global(.ts-status-dot) {
    width: 6px; height: 6px; border-radius: 50%;
    background: currentColor;
  }
  :global(.ts-status-active)   { background: #dcfce7; color: #166534; }
  :global(.ts-status-pending)  { background: #fef3c7; color: #92400e; }
  :global(.ts-status-inactive) { background: #fee2e2; color: #b91c1c; }
  :global([data-theme='dark'] .ts-status-active)   { background: rgba(34,197,94,.18); color: #4ade80; }
  :global([data-theme='dark'] .ts-status-pending)  { background: rgba(245,158,11,.18); color: #fbbf24; }
  :global([data-theme='dark'] .ts-status-inactive) { background: rgba(239,68,68,.18); color: #f87171; }

  /* CSS snippet card */
  .ts-snippet-card {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #ffffff);
    border-radius: 10px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .ts-snippet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--sg-header-bg, #f1f5f9);
    border-bottom: 1px solid var(--sg-border, #e2e8f0);
    font-size: 11.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .ts-copy-btn {
    border: 0;
    background: var(--sg-accent, #2563eb);
    color: #fff;
    border-radius: 5px;
    padding: 3px 12px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .ts-snippet-pre {
    margin: 0;
    padding: 12px 16px;
    font-family: ui-monospace, Menlo, monospace;
    font-size: 12px;
    color: var(--sg-fg, #1e293b);
    background: var(--sg-bg, #ffffff);
    overflow: auto;
    max-height: 180px;
  }
</style>
