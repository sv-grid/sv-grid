/**
 * demo-doc-embed - apply tools/demo-doc-placements.json to the docs.
 *
 * Each placement becomes a live `data-docs-demo` host appended to the page
 * under a "More examples" heading, with the demo's registry title and
 * description as the caption. Idempotent: a demo already embedded on the page
 * is skipped, so re-running after hand-editing a page does not duplicate
 * anything. A link to the demo's gallery page is not an embed and does not
 * count; the section opens above "See also", which stays last.
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

/** Whether the page already carries a live host for this demo. A link or a bare mention is not one. */
export function isEmbedded(text, id) {
  return text.includes(`data-docs-demo="${id}"`)
}

/**
 * The page with the blocks added under "More examples": an existing section
 * grows, otherwise one opens above "See also" (the coverage test keeps that
 * section last on every page) or at the end when there is none.
 */
export function embedInto(text, blocks) {
  if (text.includes(HEADING)) return text.replace(HEADING, `${HEADING}\n\n${blocks.trimEnd()}\n`)
  const seeAlso = /\n## See also\b/.exec(text)
  if (seeAlso) return `${text.slice(0, seeAlso.index).trimEnd()}\n\n${HEADING}\n\n${blocks.trimEnd()}\n${text.slice(seeAlso.index)}`
  return `${text.trimEnd()}\n\n${HEADING}\n\n${blocks.trimEnd()}\n`
}

export function apply({ dry = false } = {}) {
  const placements = JSON.parse(readFileSync(PLACEMENTS, 'utf-8'))
  const registry = new Map(loadRegistry().map((d) => [d.id, d]))

  let added = 0
  let skipped = 0
  const touched = []
  // An id the registry does not know is a typo in the placements, or a
  // registry entry the parser cannot read (a double-quoted demo() call). It
  // used to be counted as "already present", which hid exactly that.
  const unknown = []

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

    for (const id of ids) if (!registry.has(id)) unknown.push(`${id} (in ${page})`)
    const known = ids.filter((id) => registry.has(id))
    // Present means embedded. A page that only linked to a demo's gallery URL
    // used to count, so a placement for it was skipped and the page stayed
    // without the live example the placement asked for.
    const fresh = known.filter((id) => !isEmbedded(text, id))
    skipped += known.length - fresh.length
    if (!fresh.length) continue

    const blocks = fresh
      .map((id) => block(registry.get(id), heightFor(registry.get(id).category)))
      .join('\n')

    text = embedInto(text, blocks)

    if (!dry) writeFileSync(page, crlf ? text.replace(/\n/g, '\r\n') : text)
    added += fresh.length
    touched.push([page, fresh.length])
  }

  return { added, skipped, touched, unknown }
}

if (process.argv[1]?.endsWith('demo-doc-embed.mjs')) {
  const dry = process.argv.includes('--dry')
  const { added, skipped, touched, unknown } = apply({ dry })
  for (const [page, n] of touched) console.log(`  +${String(n).padStart(2)}  ${page}`)
  console.log(`\n${dry ? '[dry] would add' : 'added'} ${added} embeds across ${touched.length} pages (${skipped} already present)`)
  if (unknown.length) {
    console.error(`\n${unknown.length} placement id(s) not in the registry (website/src/lib/demos.ts, single-quoted demo() calls):\n  ${unknown.join('\n  ')}`)
    process.exitCode = 1
  }
}
