<script lang="ts">
  /**
   * 10. Custom cells + themes
   * -------------------------
   * Demonstrates `renderSnippet` for custom cell content, a density toggle
   * driven entirely by CSS custom properties, and a forced light/dark/
   * high-contrast theme switch. ARIA roles & focus styles come from the
   * grid's built-in a11y helpers - they do not need to be re-declared here.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    renderSnippet,
    type ColumnDef,
  } from 'sv-grid-core'
  import { makePeople, type Person } from '../shared/seed'

  const features = tableFeatures({ rowSortingFeature })

  const rows = makePeople(50)

  let density = $state<'compact' | 'normal' | 'comfortable'>('normal')
  let theme = $state<'auto' | 'light' | 'dark' | 'high-contrast'>('auto')

  // Complete palettes per theme. The previous version only overrode --sg-bg
  // and --sg-fg, so the zebra rows / headers / borders kept the surrounding
  // page's dark values and the grid ended up as light-and-dark stripes.
  // A theme is either *every* relevant token or none (auto = inherit page).
  type Palette = Record<string, string>
  const THEME_PALETTES: Record<'light' | 'dark' | 'high-contrast', Palette> = {
    light: {
      '--sg-bg': '#ffffff',
      '--sg-fg': '#0f172a',
      '--sg-muted': '#64748b',
      '--sg-border': '#e2e8f0',
      '--sg-header-bg': '#f1f5f9',
      '--sg-header-fg': '#0f172a',
      '--sg-row-alt-bg': '#f8fafc',
      '--sg-row-hover-bg': '#eef2ff',
      '--sg-selection-bg': '#dbeafe',
      '--sg-input-bg': '#ffffff',
      '--sg-input-border': '#cbd5e1',
    },
    dark: {
      '--sg-bg': '#0f172a',
      '--sg-fg': '#f1f5f9',
      '--sg-muted': '#94a3b8',
      '--sg-border': '#334155',
      '--sg-header-bg': '#1e2433',
      '--sg-header-fg': '#f1f5f9',
      '--sg-row-alt-bg': '#1b2230',
      '--sg-row-hover-bg': '#232b3c',
      '--sg-selection-bg': '#1d3a73',
      '--sg-input-bg': '#1a2130',
      '--sg-input-border': '#2c3548',
    },
    'high-contrast': {
      '--sg-bg': '#000000',
      '--sg-fg': '#ffffff',
      '--sg-muted': '#d1d5db',
      '--sg-border': '#ffffff',
      '--sg-header-bg': '#000000',
      '--sg-header-fg': '#ffffff',
      '--sg-row-alt-bg': '#111111',
      '--sg-row-hover-bg': '#1f2937',
      '--sg-selection-bg': '#1e40af',
      '--sg-input-bg': '#000000',
      '--sg-input-border': '#ffffff',
    },
  }
  const themeStyle = $derived(
    theme === 'auto'
      ? ''
      : Object.entries(THEME_PALETTES[theme])
          .map(([k, v]) => `${k}:${v}`)
          .join(';'),
  )

  // Snippets defined below are hoisted, so they are usable here.
  function buildColumns(): ColumnDef<typeof features, Person>[] {
    return [
      {
        id: 'person',
        header: 'Person',
        accessorFn: (row) => `${row.firstName} ${row.lastName}`,
        cell: (ctx) => renderSnippet(PersonCell, { row: ctx.row.original }),
      },
      { field: 'department', header: 'Department' },
      { field: 'country', header: 'Country', width: 80 },
      {
        field: 'status',
        header: 'Status',
        cell: (ctx) => renderSnippet(StatusPill, { value: String(ctx.getValue()) }),
      },
      {
        field: 'performance',
        header: 'Performance',
        editorType: 'number',
        cell: (ctx) => renderSnippet(PerformanceBar, { value: Number(ctx.getValue()) }),
      },
      {
        id: 'trend',
        header: 'Trend (12mo)',
        cell: (ctx) => renderSnippet(Sparkline, { row: ctx.row.original }),
      },
      {
        field: 'salary',
        header: 'Salary',
        editorType: 'number',
        format: { type: 'currency', currency: 'USD', options: { maximumFractionDigits: 0 } },
      },
    ]
  }
  const columns = buildColumns()
</script>

{#snippet PersonCell(props: { row: Person })}
  {@const initials = props.row.firstName.charAt(0) + props.row.lastName.charAt(0)}
  <span class="inline-flex items-center gap-2">
    <span class="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-xs font-semibold dark:bg-blue-900 dark:text-blue-200">
      {initials}
    </span>
    <span>{props.row.firstName} {props.row.lastName}</span>
  </span>
{/snippet}

{#snippet StatusPill(props: { value: string })}
  <span class="pill pill-{props.value}">{props.value}</span>
{/snippet}

{#snippet PerformanceBar(props: { value: number })}
  <div
    role="progressbar"
    aria-label="performance"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-valuenow={props.value}
    class="inline-flex items-center gap-2"
  >
    <div class="relative h-1.5 w-24 rounded bg-slate-200 dark:bg-slate-700">
      <div class="absolute inset-y-0 left-0 rounded bg-blue-600" style="width: {props.value}%"></div>
    </div>
    <span class="text-xs tabular-nums w-7 text-right">{props.value}</span>
  </div>
{/snippet}

{#snippet Sparkline(props: { row: Person })}
  {@const seed = props.row.id.length + props.row.age}
  {@const bars = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => 4 + ((seed * (i + 3)) % 14))}
  <span class="sparkbar" aria-label="trend">
    {#each bars as h, i (i)}<span style="height: {h}px"></span>{/each}
  </span>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="flex flex-wrap items-center gap-3 text-sm shrink-0">
    <label class="flex items-center gap-2">
      Density:
      <select bind:value={density} class="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1">
        <option value="compact">Compact</option>
        <option value="normal">Normal</option>
        <option value="comfortable">Comfortable</option>
      </select>
    </label>
    <label class="flex items-center gap-2">
      Theme:
      <select bind:value={theme} class="rounded border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1">
        <option value="auto">Auto (system)</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
        <option value="high-contrast">High contrast</option>
      </select>
    </label>
    <span class="text-slate-500 dark:text-slate-400">All controls are driven by CSS custom properties.</span>
  </div>

  <div
    class="density-{density} flex flex-col flex-1 min-h-0"
    data-theme={theme}
    style={`--sg-row-height: ${density === 'compact' ? '28px' : density === 'comfortable' ? '48px' : '36px'}; ${themeStyle}`}
  >
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="none"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={false}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={density === 'compact' ? 28 : density === 'comfortable' ? 48 : 36}
      containerHeight="100%"
    />
  </div>
</section>
