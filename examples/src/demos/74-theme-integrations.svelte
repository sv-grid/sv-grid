<script lang="ts">
  /**
   * 74. Theme integrations - Ant Design / MUI / Fluent UI / Base Web / shadcn
   * ------------------------------------------------------------------------
   * The grid renders entirely through CSS custom properties (`--sg-*`).
   * Drop a token preset onto any wrapper and every grid below picks it up.
   *
   * Each preset here ships BOTH a light and a dark token set. The active
   * mode is read from the gallery's `[data-theme="dark"]` attribute on
   * `<html>`, so flipping the gallery's sun/moon swaps every preset's
   * tokens in lockstep.
   *
   * Real-world integration: map your design system's tokens to `--sg-*`,
   * optionally inject `font-family` + accent overrides, and ship.
   */
  import { onMount, onDestroy } from 'svelte'
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
  } from 'sv-grid-core'
  import { makeOrders, type Order } from '../shared/seed'

  type ThemeId = 'ant' | 'mui' | 'fluent' | 'base' | 'shadcn'
  type TokenSet = Record<string, string>
  type Theme = {
    id: ThemeId
    label: string
    blurb: string
    light: TokenSet
    dark:  TokenSet
  }

  const THEMES: Theme[] = [
    {
      id: 'ant', label: 'Ant Design', blurb: 'Compact, neutral surfaces, accent #1677ff.',
      light: {
        '--sg-bg':'#ffffff','--sg-fg':'rgba(0,0,0,0.85)','--sg-muted':'rgba(0,0,0,0.45)',
        '--sg-border':'#f0f0f0','--sg-header-bg':'#fafafa','--sg-header-fg':'rgba(0,0,0,0.85)',
        '--sg-row-alt-bg':'#ffffff','--sg-row-hover-bg':'#fafafa','--sg-selection-bg':'#e6f4ff',
        '--sg-accent':'#1677ff','--sg-focus-ring':'0 0 0 2px rgba(22,119,255,0.25)',
        '--sg-row-height':'36px','--sg-font':'"Segoe UI", Roboto, sans-serif',
        '--sg-scrollbar-bg':'#fafafa','--sg-scrollbar-border':'rgba(0,0,0,0.06)',
        '--sg-scrollbar-thumb':'rgba(0,0,0,0.20)','--sg-scrollbar-thumb-hover':'rgba(0,0,0,0.30)','--sg-scrollbar-thumb-active':'rgba(0,0,0,0.40)',
        '--sg-scrollbar-arrow':'rgba(0,0,0,0.45)','--sg-scrollbar-arrow-hover':'rgba(0,0,0,0.85)','--sg-scrollbar-arrow-hover-bg':'#f0f0f0',
        '--sg-scrollbar-arrow-active':'rgba(0,0,0,0.85)','--sg-scrollbar-arrow-active-bg':'#e6e6e6','--sg-scrollbar-arrow-disabled':'rgba(0,0,0,0.25)',
      },
      dark: {
        '--sg-bg':'#141414','--sg-fg':'rgba(255,255,255,0.85)','--sg-muted':'rgba(255,255,255,0.45)',
        '--sg-border':'#303030','--sg-header-bg':'#1d1d1d','--sg-header-fg':'rgba(255,255,255,0.85)',
        '--sg-row-alt-bg':'#141414','--sg-row-hover-bg':'#1f1f1f','--sg-selection-bg':'rgba(22,119,255,0.18)',
        '--sg-accent':'#3c89e8','--sg-focus-ring':'0 0 0 2px rgba(60,137,232,0.30)',
        '--sg-row-height':'36px','--sg-font':'"Segoe UI", Roboto, sans-serif',
        '--sg-scrollbar-bg':'#1d1d1d','--sg-scrollbar-border':'rgba(255,255,255,0.06)',
        '--sg-scrollbar-thumb':'#3f3f3f','--sg-scrollbar-thumb-hover':'#555555','--sg-scrollbar-thumb-active':'#6e6e6e',
        '--sg-scrollbar-arrow':'#7a7a7a','--sg-scrollbar-arrow-hover':'#e6e6e6','--sg-scrollbar-arrow-hover-bg':'#2a2a2a',
        '--sg-scrollbar-arrow-active':'#ffffff','--sg-scrollbar-arrow-active-bg':'#3a3a3a','--sg-scrollbar-arrow-disabled':'#4a4a4a',
      },
    },
    {
      id: 'mui', label: 'Material UI', blurb: 'Roboto, taller rows, indigo accent.',
      light: {
        '--sg-bg':'#ffffff','--sg-fg':'rgba(0,0,0,0.87)','--sg-muted':'rgba(0,0,0,0.60)',
        '--sg-border':'rgba(0,0,0,0.12)','--sg-header-bg':'#ffffff','--sg-header-fg':'rgba(0,0,0,0.87)',
        '--sg-row-alt-bg':'#ffffff','--sg-row-hover-bg':'rgba(0,0,0,0.04)','--sg-selection-bg':'rgba(25,118,210,0.08)',
        '--sg-accent':'#1976d2','--sg-focus-ring':'0 0 0 2px rgba(25,118,210,0.4)',
        '--sg-row-height':'52px','--sg-font':'"Roboto","Helvetica","Arial",sans-serif',
        '--sg-scrollbar-bg':'#ffffff','--sg-scrollbar-border':'rgba(0,0,0,0.08)',
        '--sg-scrollbar-thumb':'rgba(0,0,0,0.22)','--sg-scrollbar-thumb-hover':'rgba(0,0,0,0.34)','--sg-scrollbar-thumb-active':'#1976d2',
        '--sg-scrollbar-arrow':'rgba(0,0,0,0.54)','--sg-scrollbar-arrow-hover':'#1976d2','--sg-scrollbar-arrow-hover-bg':'rgba(25,118,210,0.06)',
        '--sg-scrollbar-arrow-active':'#1976d2','--sg-scrollbar-arrow-active-bg':'rgba(25,118,210,0.10)','--sg-scrollbar-arrow-disabled':'rgba(0,0,0,0.26)',
      },
      dark: {
        '--sg-bg':'#121212','--sg-fg':'rgba(255,255,255,0.87)','--sg-muted':'rgba(255,255,255,0.60)',
        '--sg-border':'rgba(255,255,255,0.12)','--sg-header-bg':'#1e1e1e','--sg-header-fg':'rgba(255,255,255,0.87)',
        '--sg-row-alt-bg':'#121212','--sg-row-hover-bg':'rgba(255,255,255,0.05)','--sg-selection-bg':'rgba(144,202,249,0.16)',
        '--sg-accent':'#90caf9','--sg-focus-ring':'0 0 0 2px rgba(144,202,249,0.35)',
        '--sg-row-height':'52px','--sg-font':'"Roboto","Helvetica","Arial",sans-serif',
        '--sg-scrollbar-bg':'#1e1e1e','--sg-scrollbar-border':'rgba(255,255,255,0.08)',
        '--sg-scrollbar-thumb':'rgba(255,255,255,0.22)','--sg-scrollbar-thumb-hover':'rgba(255,255,255,0.34)','--sg-scrollbar-thumb-active':'#90caf9',
        '--sg-scrollbar-arrow':'rgba(255,255,255,0.60)','--sg-scrollbar-arrow-hover':'#90caf9','--sg-scrollbar-arrow-hover-bg':'rgba(144,202,249,0.10)',
        '--sg-scrollbar-arrow-active':'#90caf9','--sg-scrollbar-arrow-active-bg':'rgba(144,202,249,0.18)','--sg-scrollbar-arrow-disabled':'rgba(255,255,255,0.28)',
      },
    },
    {
      id: 'fluent', label: 'Fluent UI', blurb: 'Segoe UI, subtle borders, communication blue.',
      light: {
        '--sg-bg':'#ffffff','--sg-fg':'#242424','--sg-muted':'#616161',
        '--sg-border':'#e1dfdd','--sg-header-bg':'#f5f5f5','--sg-header-fg':'#242424',
        '--sg-row-alt-bg':'#fafafa','--sg-row-hover-bg':'#f3f2f1','--sg-selection-bg':'#deecf9',
        '--sg-accent':'#0078d4','--sg-focus-ring':'0 0 0 2px rgba(0,120,212,0.25)',
        '--sg-row-height':'42px','--sg-font':'"Segoe UI","Segoe UI Web",Arial,sans-serif',
        '--sg-scrollbar-bg':'#f5f5f5','--sg-scrollbar-border':'#e1dfdd',
        '--sg-scrollbar-thumb':'#c8c6c4','--sg-scrollbar-thumb-hover':'#a19f9d','--sg-scrollbar-thumb-active':'#0078d4',
        '--sg-scrollbar-arrow':'#616161','--sg-scrollbar-arrow-hover':'#0078d4','--sg-scrollbar-arrow-hover-bg':'#edebe9',
        '--sg-scrollbar-arrow-active':'#0078d4','--sg-scrollbar-arrow-active-bg':'#deecf9','--sg-scrollbar-arrow-disabled':'#c8c6c4',
      },
      dark: {
        '--sg-bg':'#1b1a19','--sg-fg':'#f3f2f1','--sg-muted':'#a19f9d',
        '--sg-border':'#3b3a39','--sg-header-bg':'#252423','--sg-header-fg':'#f3f2f1',
        '--sg-row-alt-bg':'#1b1a19','--sg-row-hover-bg':'#252423','--sg-selection-bg':'rgba(0,120,212,0.20)',
        '--sg-accent':'#2899f5','--sg-focus-ring':'0 0 0 2px rgba(40,153,245,0.30)',
        '--sg-row-height':'42px','--sg-font':'"Segoe UI","Segoe UI Web",Arial,sans-serif',
        '--sg-scrollbar-bg':'#252423','--sg-scrollbar-border':'#3b3a39',
        '--sg-scrollbar-thumb':'#484644','--sg-scrollbar-thumb-hover':'#605e5c','--sg-scrollbar-thumb-active':'#2899f5',
        '--sg-scrollbar-arrow':'#a19f9d','--sg-scrollbar-arrow-hover':'#2899f5','--sg-scrollbar-arrow-hover-bg':'#323130',
        '--sg-scrollbar-arrow-active':'#2899f5','--sg-scrollbar-arrow-active-bg':'#3b3a39','--sg-scrollbar-arrow-disabled':'#484644',
      },
    },
    {
      id: 'base', label: 'Base Web (Uber)', blurb: 'Uber Move, high-contrast borders.',
      light: {
        '--sg-bg':'#ffffff','--sg-fg':'#000000','--sg-muted':'#545454',
        '--sg-border':'#e2e2e2','--sg-header-bg':'#ffffff','--sg-header-fg':'#000000',
        '--sg-row-alt-bg':'#f6f6f6','--sg-row-hover-bg':'#f0f0f0','--sg-selection-bg':'#dcefe9',
        '--sg-accent':'#000000','--sg-focus-ring':'0 0 0 3px rgba(0,0,0,0.18)',
        '--sg-row-height':'48px','--sg-font':'"UberMoveText","Helvetica Neue",Arial,sans-serif',
        '--sg-scrollbar-bg':'#ffffff','--sg-scrollbar-border':'#e2e2e2',
        '--sg-scrollbar-thumb':'#545454','--sg-scrollbar-thumb-hover':'#2a2a2a','--sg-scrollbar-thumb-active':'#000000',
        '--sg-scrollbar-arrow':'#000000','--sg-scrollbar-arrow-hover':'#000000','--sg-scrollbar-arrow-hover-bg':'#f0f0f0',
        '--sg-scrollbar-arrow-active':'#000000','--sg-scrollbar-arrow-active-bg':'#e2e2e2','--sg-scrollbar-arrow-disabled':'#bcbcbc',
      },
      dark: {
        '--sg-bg':'#0d0d0d','--sg-fg':'#ffffff','--sg-muted':'#aaaaaa',
        '--sg-border':'#272727','--sg-header-bg':'#0d0d0d','--sg-header-fg':'#ffffff',
        '--sg-row-alt-bg':'#171717','--sg-row-hover-bg':'#1e1e1e','--sg-selection-bg':'#143427',
        '--sg-accent':'#ffffff','--sg-focus-ring':'0 0 0 3px rgba(255,255,255,0.20)',
        '--sg-row-height':'48px','--sg-font':'"UberMoveText","Helvetica Neue",Arial,sans-serif',
        '--sg-scrollbar-bg':'#0d0d0d','--sg-scrollbar-border':'#272727',
        '--sg-scrollbar-thumb':'#3a3a3a','--sg-scrollbar-thumb-hover':'#666666','--sg-scrollbar-thumb-active':'#ffffff',
        '--sg-scrollbar-arrow':'#ffffff','--sg-scrollbar-arrow-hover':'#ffffff','--sg-scrollbar-arrow-hover-bg':'#1e1e1e',
        '--sg-scrollbar-arrow-active':'#ffffff','--sg-scrollbar-arrow-active-bg':'#272727','--sg-scrollbar-arrow-disabled':'#4a4a4a',
      },
    },
    {
      id: 'shadcn', label: 'shadcn/ui', blurb: 'Tailwind tokens, slate primary, modern density.',
      light: {
        '--sg-bg':'hsl(0 0% 100%)','--sg-fg':'hsl(222 47% 11%)','--sg-muted':'hsl(215 16% 47%)',
        '--sg-border':'hsl(214 32% 91%)','--sg-header-bg':'hsl(210 40% 98%)','--sg-header-fg':'hsl(222 47% 11%)',
        '--sg-row-alt-bg':'hsl(210 40% 99%)','--sg-row-hover-bg':'hsl(210 40% 96%)','--sg-selection-bg':'hsl(214 32% 91%)',
        '--sg-accent':'hsl(222 47% 11%)','--sg-focus-ring':'0 0 0 2px hsl(222 47% 11% / 0.5)',
        '--sg-row-height':'40px','--sg-font':'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
        '--sg-scrollbar-bg':'hsl(210 40% 98%)','--sg-scrollbar-border':'hsl(214 32% 91%)',
        '--sg-scrollbar-thumb':'hsl(215 16% 78%)','--sg-scrollbar-thumb-hover':'hsl(215 16% 60%)','--sg-scrollbar-thumb-active':'hsl(222 47% 11%)',
        '--sg-scrollbar-arrow':'hsl(215 16% 47%)','--sg-scrollbar-arrow-hover':'hsl(222 47% 11%)','--sg-scrollbar-arrow-hover-bg':'hsl(210 40% 96%)',
        '--sg-scrollbar-arrow-active':'hsl(222 47% 11%)','--sg-scrollbar-arrow-active-bg':'hsl(214 32% 91%)','--sg-scrollbar-arrow-disabled':'hsl(215 16% 80%)',
      },
      dark: {
        '--sg-bg':'hsl(222 47% 11%)','--sg-fg':'hsl(210 40% 98%)','--sg-muted':'hsl(215 20% 65%)',
        '--sg-border':'hsl(217 33% 17%)','--sg-header-bg':'hsl(217 33% 14%)','--sg-header-fg':'hsl(210 40% 98%)',
        '--sg-row-alt-bg':'hsl(222 47% 11%)','--sg-row-hover-bg':'hsl(217 33% 17%)','--sg-selection-bg':'hsl(217 33% 25%)',
        '--sg-accent':'hsl(210 40% 98%)','--sg-focus-ring':'0 0 0 2px hsl(210 40% 98% / 0.40)',
        '--sg-row-height':'40px','--sg-font':'ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif',
        '--sg-scrollbar-bg':'hsl(217 33% 14%)','--sg-scrollbar-border':'hsl(217 33% 20%)',
        '--sg-scrollbar-thumb':'hsl(217 33% 28%)','--sg-scrollbar-thumb-hover':'hsl(217 33% 42%)','--sg-scrollbar-thumb-active':'hsl(210 40% 98%)',
        '--sg-scrollbar-arrow':'hsl(215 20% 65%)','--sg-scrollbar-arrow-hover':'hsl(210 40% 98%)','--sg-scrollbar-arrow-hover-bg':'hsl(217 33% 20%)',
        '--sg-scrollbar-arrow-active':'hsl(210 40% 98%)','--sg-scrollbar-arrow-active-bg':'hsl(217 33% 25%)','--sg-scrollbar-arrow-disabled':'hsl(217 33% 30%)',
      },
    },
  ]

  let theme = $state<Theme>(THEMES[0]!)

  /** Read the gallery's current theme (`[data-theme="dark"]` on <html>). */
  function readMode(): 'light' | 'dark' {
    if (typeof document === 'undefined') return 'light'
    return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
  }
  let mode = $state<'light' | 'dark'>(readMode())

  // Watch the <html> data-theme attribute so our preview tracks the
  // gallery's light/dark switcher live.
  let observer: MutationObserver | null = null
  onMount(() => {
    mode = readMode()
    observer = new MutationObserver(() => { mode = readMode() })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] })
  })
  onDestroy(() => observer?.disconnect())

  const activeTokens = $derived(mode === 'dark' ? theme.dark : theme.light)
  const inlineStyle  = $derived(
    Object.entries(activeTokens).map(([k, v]) => `${k}: ${v}`).join('; '),
  )

  function cssForPreset(t: Theme): string {
    const light = Object.entries(t.light).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    const dark  = Object.entries(t.dark ).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    return `/* ${t.label} - light */
[data-theme-preset="${t.id}"] {
${light}
}
/* ${t.label} - dark */
[data-theme="dark"][data-theme-preset="${t.id}"],
[data-theme-preset="${t.id}"][data-theme="dark"] {
${dark}
}`
  }

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })
  const rows = makeOrders(100)
  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'orderId',  header: 'Order ID', editorType: 'text',   width: 140 },
    { field: 'company',  header: 'Company',  editorType: 'text',   width: 180 },
    { field: 'product',  header: 'Product',  editorType: 'text',   width: 180 },
    { field: 'sellDate', header: 'Sell date',editorType: 'date',   width: 130,
      format: { type: 'date', pattern: 'y-m-d' } },
    { field: 'quantity', header: 'Qty',      editorType: 'number', width: 90 },
    { field: 'price',    header: 'Price',    editorType: 'number', width: 130,
      format: { type: 'currency', currency: 'USD' } },
  ]
</script>

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-2 text-sm shrink-0">
    <span class="font-medium">Theme preset:</span>
    <div class="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
      {#each THEMES as t (t.id)}
        {@const previewTokens = mode === 'dark' ? t.dark : t.light}
        <button type="button" onclick={() => (theme = t)}
          class="theme-chip px-3 py-1.5 text-sm border-r border-slate-200 dark:border-slate-700 last:border-r-0 inline-flex items-center gap-2
                 {t.id === theme.id ? 'theme-chip-active' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'}"
          title={t.blurb}
        >
          <span class="theme-swatch" aria-hidden="true">
            <span class="theme-swatch-bg"    style={`background: ${previewTokens['--sg-bg']}`}></span>
            <span class="theme-swatch-accent" style={`background: ${previewTokens['--sg-accent']}`}></span>
          </span>
          <span>{t.label}</span>
        </button>
      {/each}
    </div>
    <span class="text-slate-500 dark:text-slate-400 text-xs">{theme.blurb}</span>
    <span class="ml-auto text-xs text-slate-500 dark:text-slate-400">
      Active mode: <strong class="text-slate-700 dark:text-slate-200">{mode}</strong> (toggle via the gallery's theme switch)
    </span>
  </div>

  <div class="theme-layout">
    <!-- The theme tokens live on this wrapper. -->
    <div data-theme-preset={theme.id} style={inlineStyle} class="themed-host theme-grid-wrap">
      <SvGrid
        data={rows}
        columns={columns}
        features={features}
        filterMode="menu"
        selectionMode="cell"
        showRowNumbers={true}
        showPagination={false}
        enableInlineEditing={false}
        enableCellSelection={true}
        enableRowSummaries={false}
        virtualization={true}
        rowHeight={36}
        containerHeight="100%"
        fitColumns={true}
      />
    </div>

    <aside class="theme-aside">
      <header class="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">
        Copy this into your app's CSS
      </header>
      <pre class="source-snippet flex-1 min-h-0 overflow-auto leading-snug rounded p-3">{cssForPreset(theme)}</pre>
    </aside>
  </div>
</section>

<style>
  .themed-host { font-family: var(--sg-font, inherit); }

  /* Layout: CSS Grid (not flex-wrap) so each pane gets a single,
     bounded height equal to the section's remaining vertical space.
     With flex-wrap the wrap container had no row height, so the grid's
     containerHeight: 100% resolved to "natural height" - the grid grew
     past the viewport and stacked a second scrollbar on top of its
     own internal one. */
  .theme-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 340px;
    gap: 16px;
    min-height: 0;
    /* Belt-and-braces: stop our own content from pushing the page. */
    overflow: hidden;
  }
  @media (max-width: 900px) {
    .theme-layout {
      grid-template-columns: 1fr;
      grid-template-rows: minmax(0, 1fr) auto;
    }
    .theme-aside { max-height: 220px; }
  }
  .theme-grid-wrap {
    min-width: 0; min-height: 0;
    display: flex; flex-direction: column;
  }
  .theme-aside {
    min-width: 0; min-height: 0;
    display: flex; flex-direction: column;
    gap: 8px;
  }

  /* Theme preset swatches: tiny BG+accent half-pill so users see the
     palette at a glance before clicking. */
  .theme-chip { transition: background 120ms ease; }
  .theme-chip-active {
    background: var(--sg-accent, #2563eb);
    color: #fff;
    font-weight: 600;
  }
  .theme-swatch {
    display: inline-block;
    width: 18px; height: 12px;
    border-radius: 3px;
    border: 1px solid rgba(0,0,0,0.18);
    overflow: hidden;
    position: relative;
    flex-shrink: 0;
  }
  :global([data-theme="dark"]) .theme-swatch { border-color: rgba(255,255,255,0.22); }
  .theme-swatch-bg, .theme-swatch-accent {
    position: absolute; top: 0; bottom: 0;
  }
  .theme-swatch-bg     { left: 0;   width: 60%; }
  .theme-swatch-accent { right: 0;  width: 40%; }

  /* Code panel: solid contrast in both modes, real monospace stack. */
  .source-snippet {
    background: #f1f5f9;
    color: #0f172a;
    border: 1px solid #e2e8f0;
    font-family: ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace;
    font-size: 11.5px;
    tab-size: 2;
  }
  :global([data-theme="dark"]) .source-snippet {
    background: #0b1220;
    color: #e2e8f0;
    border-color: #1e293b;
  }
</style>
