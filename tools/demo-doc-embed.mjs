/**
 * demo-doc-embed - apply tools/demo-doc-placements.json to the docs.
 *
 * Each placement becomes a live `data-docs-demo` host appended to the page
 * under a "More examples" heading, with the demo's registry title and
 * description as the caption. Idempotent: a demo already present on the page
 * (in any form - embed, link, or bare id) is skipped, so re-running after
 * hand-editing a page does not duplicate anything.
 *
 *   node tools/demo-doc-embed.mjs --dry     # report only
 *   node tools/demo-doc-embed.mjs           # write
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { loadRegistry } from './demo-doc-coverage.mjs'

const PLACEMENTS = process.env.PLACEMENTS ?? 'tools/demo-doc-placements.json'
const HEADING = '## More examples'

/** The block appended for one demo. */
function block(demo, height) {
  return [
    `### ${demo.title}`,
    '',
    demo.description,
    '',
    `<div data-docs-demo="${demo.id}" data-height="${height}"></div>`,
    '',
  ].join('\n')
}

/**
 * Charts, boards and dashboards need vertical room; a plain input does not.
 * Guessing from the category beats one global height, which either crops the
 * big ones or leaves a field floating in 460px of nothing.
 */
function heightFor(category) {
  if (/Chart|Kanban|Scheduler|Pivot|Spreadsheet|Industry|Server|Recipes/i.test(category)) return 560
  if (/Layout|Blocks|Alerts/i.test(category)) return 520
  if (/Headless Editors|Inputs|Buttons|Range/i.test(category)) return 420
  return 460
}

export function apply({ dry = false } = {}) {
  const placements = JSON.parse(readFileSync(PLACEMENTS, 'utf-8'))
  const registry = new Map(loadRegistry().map((d) => [d.id, d]))

  let added = 0
  let skipped = 0
  const touched = []

  for (const [page, ids] of Object.entries(placements)) {
    if (page.startsWith('$')) continue
    if (!existsSync(page)) {
      console.error(`missing page: ${page}`)
      continue
    }
    // Docs are a mix of LF and CRLF; normalise for matching and restore the
    // page's own ending on write so the diff stays to the lines we added.
    const raw = readFileSync(page, 'utf-8')
    const crlf = raw.includes('\r\n')
    let text = raw.replace(/\r\n/g, '\n')

    const fresh = ids.filter((id) => registry.has(id) && !text.includes(id))
    skipped += ids.length - fresh.length
    if (!fresh.length) continue

    const blocks = fresh
      .map((id) => block(registry.get(id), heightFor(registry.get(id).category)))
      .join('\n')

    if (text.includes(HEADING)) {
      // Extend the existing section rather than opening a second one.
      text = text.replace(HEADING, `${HEADING}\n\n${blocks.trimEnd()}\n`)
    } else {
      text = `${text.trimEnd()}\n\n${HEADING}\n\n${blocks.trimEnd()}\n`
    }

    if (!dry) writeFileSync(page, crlf ? text.replace(/\n/g, '\r\n') : text)
    added += fresh.length
    touched.push([page, fresh.length])
  }

  return { added, skipped, touched }
}

if (process.argv[1]?.endsWith('demo-doc-embed.mjs')) {
  const dry = process.argv.includes('--dry')
  const { added, skipped, touched } = apply({ dry })
  for (const [page, n] of touched) console.log(`  +${String(n).padStart(2)}  ${page}`)
  console.log(`\n${dry ? '[dry] would add' : 'added'} ${added} embeds across ${touched.length} pages (${skipped} already present)`)
}
