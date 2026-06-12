#!/usr/bin/env node
/**
 * Walk every help page that doesn't already embed a demo and try to
 * find a matching gallery demo by filename / keyword. Inject a
 * `<div data-docs-demo="...">` block after the page's first H1 +
 * intro paragraph. Skip pages whose topic doesn't map to a demo.
 *
 * Run: `node tools/backfill-demo-embeds.mjs`.
 * The script is idempotent - pages that already embed a demo are left
 * alone.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const DOCS_DIR  = join(process.cwd(), 'docs', 'help')
const DEMOS_DIR = join(process.cwd(), 'examples', 'src', 'demos')

/** Manual mapping for pages whose name doesn't match a demo id.
 *  Each value is the demo id (without `.svelte`) OR null to skip. */
const MAP = {
  // ─── help/* ──────────────────────────────────────────────
  'accessibility':           '17-accessibility',
  'ai':                      '51-ai-assistant',
  'ai-smart-paste':          '75-ai-smart-paste',
  'api-reference':           null,
  'api-stability':           null,
  'architecture':            null,
  'benchmarks':              '06-large-dataset',
  'browser-support':         null,
  'columns-hierarchy':       '54-columns-hierarchy',
  'comparison':              null,
  'conditional-form-schema': '82-conditional-form-schema',
  'errors':                  null,
  'export':                  '21-export-and-print',
  'glossary':                null,
  'grouping-aggregation':    '07-grouping-aggregation',
  'i18n-rtl':                '38-rtl-i18n',
  'import':                  '53-excel-import',
  'index':                   null,
  'mcp-server':              null,
  'agents':                  null,
  'llm-grounding':           null,
  'tokens':                  '74-theme-integrations',
  'observability':           null,
  'versioning':              null,
  'migrating-from-ag-grid':       null,
  'migrating-from-tanstack-table': null,
  'migrating-from-mui-x':         null,
  'migrating-from-handsontable':  null,
  'migrating-from-glide':         null,
  'missing-features':        null,
  'mobile-card-view':        '81-mobile-card-view',
  'pivot':                   '60-pivot-expandable',
  'production':              '22-admin-template',
  'real-time':               '34-realtime-orders',
  'recipes':                 null,
  'saved-views':             '63-column-layout-api',
  'security':                '16-csp-compliant',
  'server-side-data':        '09-server-side',
  'spreadsheet-formulas':    '83-spreadsheet-formulas',
  'state-maintenance':       '55-state-maintenance',
  'tailwind':                '10-custom-cells-and-themes',
  'testing':                 null,
  'testing-and-quality':     null,
  // ─── help/cells/* ───────────────────────────────────────
  'cells/cell-components':       '10-custom-cells-and-themes',
  'cells/cell-data-types':       '01-quick-start',
  'cells/cell-text-selection':   '04-selection-copy-paste',
  'cells/expressions':           '83-spreadsheet-formulas',
  'cells/getting-values':        '04-selection-copy-paste',
  'cells/highlighting-changes':  '11-stock-market',
  'cells/styling-cells':         '62-conditional-styling',
  'cells/text-formatting':       '13-finances',
  'cells/tooltips':              null,
  'cells/view-refresh':          null,
  // ─── help/columns/* ─────────────────────────────────────
  'columns/column-definitions':       '01-quick-start',
  'columns/column-groups':            '54-columns-hierarchy',
  'columns/column-headers':           '01-quick-start',
  'columns/column-moving':            '54-columns-hierarchy',
  'columns/column-pinning':           '25-column-pinning',
  'columns/column-sizing':            '63-column-layout-api',
  'columns/column-spanning':          null,
  'columns/column-state':             '55-state-maintenance',
  'columns/custom-header-components': '10-custom-cells-and-themes',
  'columns/updating-definitions':     null,
  // ─── help/editing/* ─────────────────────────────────────
  'editing/edit-components':    '66-custom-cell-editors',
  'editing/full-row':           '40-forms-master-detail',
  'editing/overview':           '05-inline-editing',
  'editing/parsing-values':     '24-validation',
  'editing/provided-editors':   '26-list-chips-editors',
  'editing/saving-values':      '18-cascade-editing',
  'editing/start-stop-editing': '05-inline-editing',
  'editing/undo-redo':          '55-state-maintenance',
  'editing/validation':         '24-validation',
  // ─── help/filtering/* ───────────────────────────────────
  'filtering/applying-filters':       '02-sort-filter-paginate',
  'filtering/custom-column-filters':  '03-excel-filters',
  'filtering/date-filter':            '64-filter-between-operator',
  'filtering/filter-api':             '64-filter-between-operator',
  'filtering/filter-conditions':      '03-excel-filters',
  'filtering/floating-filters':       '03-excel-filters',
  'filtering/number-filter':          '64-filter-between-operator',
  'filtering/overview':               '02-sort-filter-paginate',
  'filtering/set-filter':             '03-excel-filters',
  'filtering/text-filter':            '69-highlighted-search',
  // ─── help/rows/* ────────────────────────────────────────
  'rows/accessing-rows':       '04-selection-copy-paste',
  'rows/full-width-rows':      '08-tree-and-master-detail',
  'rows/row-data':             '01-quick-start',
  'rows/row-dragging':         '23-bulk-actions',
  'rows/row-height':           '10-custom-cells-and-themes',
  'rows/row-pagination':       '02-sort-filter-paginate',
  'rows/row-pinning':          '25-column-pinning',
  'rows/row-sorting':          '02-sort-filter-paginate',
  'rows/row-spanning':         null,
  'rows/styling-rows':         '62-conditional-styling',
  'rows/tree-rows':            '28-org-chart-tree',
}

function makeEmbed(id) {
  return `\n<div data-docs-demo="${id}" data-height="540"></div>\n`
}

async function* walk(dir, prefix = '') {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const sub = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) yield* walk(join(dir, entry.name), sub)
    else yield { full: join(dir, entry.name), key: sub.replace(/\.md$/, '') }
  }
}

async function main() {
  let backfilled = 0
  let skipped    = 0
  let alreadyHad = 0

  for await (const { full, key } of walk(DOCS_DIR)) {
    if (!full.endsWith('.md')) continue
    let src = await readFile(full, 'utf-8')
    if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1)

    if (src.includes('data-docs-demo=')) { alreadyHad += 1; continue }

    const demoId = MAP[key]
    if (demoId === undefined) {
      // Not in the map at all - leave alone, log so we can review.
      process.stdout.write(`  (no mapping)  ${key}\n`)
      skipped += 1
      continue
    }
    if (demoId === null) { skipped += 1; continue }

    // Inject after the first paragraph that follows the H1.
    const lines = src.split(/\r?\n/)
    let i = 0
    while (i < lines.length && !lines[i].startsWith('# ')) i += 1   // find H1
    i += 1
    while (i < lines.length && lines[i].trim() === '') i += 1       // skip blanks
    while (i < lines.length && lines[i].trim() !== '') i += 1       // skip first paragraph
    const before = lines.slice(0, i).join('\n')
    const after  = lines.slice(i).join('\n')
    const out    = before + makeEmbed(demoId) + after
    await writeFile(full, out, 'utf-8')
    backfilled += 1
  }
  process.stdout.write(
    `\nbackfill-demo-embeds: ${backfilled} backfilled, ${alreadyHad} already had a demo, ${skipped} skipped\n`,
  )
}

main().catch((err) => { console.error(err); process.exit(1) })
