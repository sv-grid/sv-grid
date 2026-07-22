#!/usr/bin/env node
/**
 * Scaffold the recipe pages that don't exist yet. Each new stub is a
 * compact 25-line page with a "what + when + how" outline + a link to
 * the matching live gallery demo, so the recipes index isn't lying
 * about coverage.
 *
 * Re-running is idempotent: pages that exist are left alone.
 */
import { readFile, writeFile, access } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join } from 'node:path'

const RECIPES = join(process.cwd(), 'docs', 'recipes')

const STUBS = [
  { id: 'bulk-edit-selected-rows',  title: 'Bulk-edit selected rows',  demo: '23-bulk-actions',
    when: 'A sticky action bar that operates on every row checked in a `selectionMode="row"` grid.',
    api: ["api.getDisplayedRows()", "api.setCellValue(rowIndex, field, value)"] },
  { id: 'two-grid-master-detail',   title: 'Two-grid master/detail',   demo: '40-forms-master-detail',
    when: 'Master grid on top, detail panel beneath that re-renders when the user picks a row.',
    api: ["api.getDisplayedRows()", "$state for active row id"] },
  { id: 'persist-column-layout-to-url', title: 'Persist column layout to URL', demo: '55-state-maintenance',
    when: 'Shareable links that restore the user\'s exact widths, pinning, sort, and filters.',
    api: ["api.getColumnWidths()", "api.getColumnPinning()", "api.getFilters()", "URLSearchParams"] },
  { id: 'kanban-from-grid-data',    title: 'Kanban board over the same `$state`', demo: '343-kanban-board',
    when: 'One <SvGrid> rendered as a board by setting the `board` prop - rows bucket into lanes by a field; built-in drag-and-drop + keyboard move cards.',
    api: ["board={{ groupBy, lanes }}", "onCardMove (optional notification)", "board.card snippet"] },
  { id: 'mobile-card-pivot',        title: 'Mobile card view with grid-on-desktop', demo: '81-mobile-card-view',
    when: 'Same data, two layouts. Auto-pivot below 720px or force one via a toolbar switch.',
    api: ["window.innerWidth listener", "shared $state array between the two views"] },
  { id: 'drag-drop-columns',        title: 'Drag-drop columns to reorder', demo: '54-columns-hierarchy',
    when: 'Re-order columns by dragging them in a side panel; live grid reflects the new order.',
    api: ["api.setColumnPinning({...})", "your reordering callback updates the columns prop"] },
  { id: 'pin-first-column',         title: 'Pin first column on horizontal scroll', demo: '25-column-pinning',
    when: 'Wide grids where the row-label column must stay visible while the data scrolls horizontally.',
    api: ["api.setColumnPinning({ left: ['id'] })"] },
  { id: 'external-search',          title: 'External search box with highlighted matches', demo: '69-highlighted-search',
    when: 'A search input outside the grid filters the visible rows AND highlights matched substrings inline.',
    api: ["derived visibleRows", "custom cell snippet wraps matches in <mark>"] },
  { id: 'saved-filter-sets',        title: 'Saved filter sets', demo: '64-filter-between-operator',
    when: 'Name and recall named filter combinations; round-trip via api.getFilters / setFilter.',
    api: ["api.getFilters()", "api.setFilter(id, filter)"] },
  { id: 'between-date-filter',      title: 'Between-operator filters for date ranges', demo: '64-filter-between-operator',
    when: '"From / to" date range as one filter, not two.',
    api: ["api.setFilter(id, { operator: 'between', value, valueTo })"] },
  { id: 'conditional-row-coloring', title: 'Conditional row coloring', demo: '62-conditional-styling',
    when: 'rowClass returns a class map per row; CSS does the rest.',
    api: ["<SvGrid rowClass={(ctx) => ({...})}>"] },
  { id: 'heatmap-cells',            title: 'Heatmap-tinted numeric cells', demo: '60-pivot-expandable',
    when: 'Bucket cell values into red/amber/neutral/green tints based on per-column min/max.',
    api: ["cellClass returns heat-1..heat-5 bucket classes"] },
  { id: 'sparkline-cells',          title: 'Sparkline cell renderer', demo: '11-stock-market',
    when: 'In-cell mini-charts of a value series, rendered via inline SVG.',
    api: ["renderSnippet(SparklineCell, { points: row.trend })"] },
  { id: 'theme-presets',            title: 'Theme tokens for Ant / MUI / Fluent / shadcn', demo: '74-theme-integrations',
    when: 'Map your design system\'s tokens to --sg-* and the grid re-skins.',
    api: ["CSS custom properties only - no JS API"] },
  { id: 'websocket-streaming',      title: 'WebSocket streaming with backpressure', demo: '34-realtime-orders',
    when: 'Live tick stream with pause / resume / disconnect-and-replay and per-tick delta merge.',
    api: ["onmessage merges into $state", "pause flag throttles applies"] },
  { id: 'chartjs-sync',             title: 'Chart.js sync from grid filter state', demo: '73-chartjs-sync',
    when: 'A chart that re-renders from api.getDisplayedRows() on every filter / sort change.',
    api: ["api.getDisplayedRows()", "onFiltersChange / onSortingChange"] },
  { id: 'smart-paste',              title: 'Smart paste: CSV / TSV / free-form → typed rows', demo: '75-ai-smart-paste',
    when: 'Paste anything; the assistant infers columns and previews typed rows for accept/update/skip.',
    api: ["setAIProvider(...) once at boot", "your own parse + map flow"] },
  { id: 'nl-filter',                title: 'NL filter wired to your LLM', demo: '51-ai-assistant',
    when: '"show last quarter > $10k sorted by date" - one natural-language input drives setFilter + setSort.',
    api: ["api.ai.filter(query)", "setAIProvider(adapter)"] },
  { id: 'theme-matched-export',     title: 'Theme-matched xlsx export', demo: '56-export-theme-matched',
    when: 'Excel file colours follow the same --sg-* tokens the grid renders with.',
    api: ["api.exportData({ format: 'xlsx', styles: { ... } })"] },
  { id: 'multi-sheet-export',       title: 'Multi-sheet xlsx export', demo: '59-export-multi-sheet',
    when: 'One workbook, multiple tabs - one per group / region / period.',
    api: ["api.exportData({ format: 'xlsx', sheets: [{ label, rows }, ...] })"] },
  { id: 'million-rows',             title: '1 million rows with virtualization', demo: '78-million-rows',
    when: 'Row + column virtualization configured for very wide / very tall data.',
    api: ["virtualization={true}", "columnVirtualization={true}", "overscan + columnOverscan"] },
  { id: 'lazy-load-expand',         title: 'Lazy-load expand on demand', demo: '31-lazy-tree-load',
    when: 'Tree rows where children are fetched only when the user expands their parent.',
    api: ["onExpand callback", "merge children into $state on resolve"] },
  { id: 'role-based-editing',       title: 'Role-based editable columns', demo: '41-healthcare-emr',
    when: 'Different user roles can edit different cells; the grid hides editors per-row via the editable callback.',
    api: ["editable: (ctx) => ctx.row.original.allowedBy.includes(role)"] },
  { id: 'undo-redo-edits',          title: 'Undo / redo for grid edits', demo: '55-state-maintenance',
    when: 'Maintain a history stack of cell edits; Ctrl+Z / Ctrl+Y replay backwards / forwards.',
    api: ["onCellValueChange records {rowId, field, before, after}", "Ctrl+Z replays inverse"] },
]

function body(s) {
  return [
    `# ${s.title}`,
    '',
    `> Live in [demo ${s.demo}](https://svgrid.dev/#/demos/${s.demo}).`,
    '',
    '## When',
    '',
    s.when,
    '',
    '## How',
    '',
    'Key API surface:',
    '',
    s.api.map((a) => `- \`${a}\``).join('\n'),
    '',
    'See the demo source for the full implementation; this recipe pins the',
    'pattern + the surface so you can copy-paste it confidently. The doc',
    'page that explains the underlying feature in depth is linked from the',
    '[recipes index](./index.md).',
    '',
    '## See also',
    '',
    `- [Demo ${s.demo} source](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/${s.demo}.svelte)`,
    `- [Demo ${s.demo} prompt sidecar](https://github.com/sv-grid/sv-grid/blob/main/examples/src/demos/prompts/${s.demo}.md) - drop into an LLM context window`,
    '- [Recipes index](./index.md)',
    '',
  ].join('\n')
}

async function exists(p) {
  try { await access(p, constants.F_OK); return true } catch { return false }
}

async function main() {
  let wrote = 0, skipped = 0
  for (const s of STUBS) {
    const p = join(RECIPES, `${s.id}.md`)
    if (await exists(p)) { skipped += 1; continue }
    await writeFile(p, body(s), 'utf-8')
    wrote += 1
  }
  process.stdout.write(`build-recipe-stubs: wrote ${wrote} new recipes, skipped ${skipped} existing\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
