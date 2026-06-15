#!/usr/bin/env node
/**
 * Insert real demo screenshots into the matching blog posts, right after the
 * intro paragraph. Images live in website/public/blog-media/ (captured by
 * tools/blog-screenshots.mjs) and are served at /blog-media/<name>.png.
 * Idempotent: a post that already references its image is skipped.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')

// slug -> { name (file in /blog-media), alt, caption }
const MAP = {
  'multi-level-column-headers': { name: 'columns-hierarchy', alt: 'Multi-level grouped column headers in SvGrid', caption: 'Grouped, multi-level column headers in SvGrid.' },
  'column-visibility-toggle': { name: 'column-layout', alt: 'Column show/hide and layout controls in SvGrid', caption: 'Column layout and visibility controls in SvGrid.' },
  'saved-views-persist-layout': { name: 'column-layout', alt: 'Saving a grid layout in SvGrid', caption: 'Saving and restoring grid layouts in SvGrid.' },
  'custom-set-filters': { name: 'set-filter', alt: 'An Excel-style set filter in SvGrid', caption: 'An advanced set filter in SvGrid.' },
  'pagination-patterns': { name: 'server-row-model', alt: 'Server-driven pagination in SvGrid', caption: 'A server row model paging data in SvGrid.' },
  'inventory-management-grid': { name: 'anomaly', alt: 'Anomaly highlighting in a SvGrid grid', caption: 'Threshold and anomaly highlighting, ideal for stock levels.' },
  'ecommerce-product-catalog': { name: 'barcode', alt: 'Barcode and rich cells in a SvGrid product grid', caption: 'Barcode and rich cells in a SvGrid catalog.' },
  'what-is-a-pivot-table': { name: 'pivot', alt: 'A pivot table in SvGrid', caption: 'A pivot table: rows, columns, and aggregated values.' },
  'headless-vs-render-component': { name: 'quick-start', alt: 'The SvGrid render component', caption: 'The <SvGrid> render component - the batteries-included layer over the headless core.' },
  'admin-user-management-screen': { name: 'admin-dashboard', alt: 'An admin screen built with SvGrid', caption: 'An admin screen built around SvGrid.' },
  'log-viewer-large-logs': { name: 'large-dataset', alt: 'A large dataset in SvGrid', caption: 'Virtualization keeps huge row counts smooth - ideal for logs.' },
  'editable-select-dropdown-cell': { name: 'custom-cell-editors', alt: 'Editable dropdown cells in SvGrid', caption: 'Custom cell editors, including dropdowns, in SvGrid.' },
  'date-picker-cell-editor': { name: 'custom-cell-editors', alt: 'Editable cells in SvGrid', caption: 'Typed cell editors in SvGrid.' },
  'sticky-summary-footer-row': { name: 'grouping', alt: 'Group footers and totals in SvGrid', caption: 'Aggregated footers and totals in SvGrid.' },
  'status-badge-cells': { name: 'custom-cells-themes', alt: 'Custom badge cells in SvGrid', caption: 'Custom badge and status cells in SvGrid.' },
}

async function main() {
  const files = new Set(await readdir(BLOG_DIR))
  let inserted = 0
  for (const [slug, { name, alt, caption }] of Object.entries(MAP)) {
    const file = `${slug}.md`
    if (!files.has(file)) { process.stdout.write(`miss ${slug} (no file)\n`); continue }
    const path = join(BLOG_DIR, file)
    let text = await readFile(path, 'utf-8')
    if (text.includes(`/blog-media/${name}.png`)) { process.stdout.write(`skip ${slug} (already has image)\n`); continue }

    // Find the end of frontmatter, then the end of the first body paragraph.
    const fmEnd = text.indexOf('\n---', 4)
    const bodyStart = text.indexOf('\n', fmEnd + 1) + 1
    const afterIntro = text.indexOf('\n\n', bodyStart)
    if (fmEnd === -1 || afterIntro === -1) { process.stdout.write(`miss ${slug} (parse)\n`); continue }

    const img = `\n\n![${alt}](/blog-media/${name}.png)\n*${caption}*`
    text = text.slice(0, afterIntro) + img + text.slice(afterIntro)
    await writeFile(path, text)
    inserted += 1
    process.stdout.write(`image -> ${slug}\n`)
  }
  process.stdout.write(`\ninserted ${inserted} images\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
