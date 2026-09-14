/**
 * Rewrite the generated facts blocks in the comparison guides from docs/_data.
 *
 *   node tools/sync-guide-facts.mjs           rewrite docs/help/comparison.md and every
 *                                             docs/help/migrating-from-*.md that has a comparison
 *   node tools/sync-guide-facts.mjs --check   exit 1 when any block is stale (CI)
 *
 * A guide without a block gets one inserted after its intro. The block text
 * is tools/lib/guide-facts.mjs; the numbers are the registry ledger
 * (tools/verify-competitors.mjs), the bundle ledger
 * (packages/grid/scripts/measure-competitor-bundles.mjs), SvGrid's own size
 * (measure-size.mjs --json) and each comparison's dated pricing statement.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadComparisons, loadLedger, loadSvgridSize } from './lib/compare-data.mjs'
import { guideFactsBlock, syncGuideFacts, guideFactsSlugs, guideFactsPackages, comparisonForGuide, benchmarkBlock, syncBenchmarkBlock } from './lib/guide-facts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const HELP = join(ROOT, 'docs', 'help')
const CHECK = process.argv.includes('--check')

/** comparison.md names its own slugs in the marker; a missing marker gets the two grids it compares. */
const COMPARISON_MD_DEFAULT = ['ag-grid', 'tanstack-table']

export async function syncGuides({ write }) {
  const comparisons = await loadComparisons()
  const ledger = await loadLedger()
  const size = await loadSvgridSize()
  const ctx = { comparisons, ledger, size }
  const stale = []
  const files = (await readdir(HELP)).filter((f) => f === 'comparison.md' || /^migrating-from-.*\.md$/.test(f))
  for (const f of files) {
    const path = join(HELP, f)
    const fileSlug = f.replace(/\.md$/, '')
    const raw = await readFile(path, 'utf-8')
    const crlf = raw.includes('\r\n')
    const md = raw.replace(/\r\n/g, '\n')
    let slugs = guideFactsSlugs(md)
    if (!slugs || !slugs.length) {
      if (fileSlug === 'comparison') slugs = COMPARISON_MD_DEFAULT
      else {
        const c = comparisonForGuide(fileSlug, comparisons)
        if (!c) continue // a guide with no comparison page (none today; kept as a rule)
        slugs = [c.slug]
      }
    }
    let next = syncGuideFacts(md, guideFactsBlock(slugs, ctx, guideFactsPackages(md)))
    if (fileSlug === 'comparison') next = syncBenchmarkBlock(next, benchmarkBlock(ledger))
    if (next !== md) {
      stale.push(f)
      if (write) await writeFile(path, crlf ? next.replace(/\n/g, '\r\n') : next, 'utf-8')
    }
  }
  return { files, stale }
}

const { files, stale } = await syncGuides({ write: !CHECK })
if (CHECK) {
  if (stale.length) {
    console.error(`sync-guide-facts: ${stale.length} stale block(s): ${stale.join(', ')}\n  run: node tools/sync-guide-facts.mjs`)
    process.exit(1)
  }
  console.log(`sync-guide-facts: ${files.length} guides up to date`)
} else {
  console.log(`sync-guide-facts: ${files.length} guides, ${stale.length} rewritten${stale.length ? ` (${stale.join(', ')})` : ''}`)
}
