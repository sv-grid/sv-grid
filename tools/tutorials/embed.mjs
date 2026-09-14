/**
 * embed - put every recorded tutorial on its docs page.
 *
 * Reads tools/tutorials/manifest.json and writes one `<figure class="docs-
 * tutorial">` block per entry into the page named by its `docsPage`, fenced by
 * `<!-- tutorial:<id> -->` markers so a re-run replaces the block in place.
 * The block carries the muted MP4, the poster, the VTT captions and the
 * transcript as plain <p> lines, which is how the narration reaches
 * llms-full.txt, the site search and the VideoObject graph.
 *
 *   node tools/tutorials/embed.mjs           # write
 *   node tools/tutorials/embed.mjs --dry     # report only
 *   node tools/tutorials/embed.mjs --check   # exit 1 when a page is out of date
 *
 * Where a block lands is the tutorial script's call (`anchor` / `anchorAfter`
 * in scripts/<id>.mjs, stored on the manifest entry); the default is above
 * "## See also", which must stay the page's last section.
 *
 * After a write, run the two index builders so docs-index.json (VideoObject
 * data) and llms-full.txt (transcript) pick up the change; `--write` here
 * does that for you unless `--no-index` is passed.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { tutorialBlock, upsertBlock } from '../lib/tutorial-media.mjs'
import { readManifest, ROOT } from './lib/manifest.mjs'

/**
 * @param {{ dry?: boolean, check?: boolean, manifest?: ReturnType<typeof readManifest> }} opts
 * @returns {{ touched: Array<[string, string, 'inserted' | 'updated']>, stale: string[], missing: string[] }}
 */
export function apply({ dry = false, check = false, manifest = readManifest() } = {}) {
  const touched = []
  const stale = []
  const missing = []

  // Group by page so a page with two tutorials is read and written once.
  const byPage = new Map()
  for (const t of manifest.tutorials) {
    if (!byPage.has(t.docsPage)) byPage.set(t.docsPage, [])
    byPage.get(t.docsPage).push(t)
  }

  for (const [page, entries] of byPage) {
    const abs = join(ROOT, page)
    if (!existsSync(abs)) {
      missing.push(page)
      continue
    }
    // Docs are a mix of LF and CRLF; normalise for matching and restore the
    // page's own ending on write so the diff stays to the block.
    const raw = readFileSync(abs, 'utf-8')
    const crlf = raw.includes('\r\n')
    let text = raw.replace(/\r\n/g, '\n')
    let changed = false

    for (const t of entries) {
      const res = upsertBlock(text, t.id, tutorialBlock(t), { anchor: t.anchor, anchorAfter: t.anchorAfter })
      if (res.changed) {
        touched.push([page, t.id, res.inserted ? 'inserted' : 'updated'])
        changed = true
      }
      text = res.text
    }

    if (!changed) continue
    if (check) {
      stale.push(page)
      continue
    }
    if (!dry) writeFileSync(abs, crlf ? text.replace(/\n/g, '\r\n') : text, 'utf-8')
  }

  return { touched, stale, missing }
}

function rebuildIndexes() {
  for (const script of ['tools/build-docs-page-index.mjs', 'tools/build-docs-index.mjs']) {
    const r = spawnSync(process.execPath, [join(ROOT, script)], { cwd: ROOT, stdio: 'inherit' })
    if (r.status !== 0) throw new Error(`${script} exited ${r.status}`)
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('tools/tutorials/embed.mjs')) {
  const dry = process.argv.includes('--dry')
  const check = process.argv.includes('--check')
  const noIndex = process.argv.includes('--no-index')
  const { touched, stale, missing } = apply({ dry, check })

  for (const p of missing) console.error(`missing docs page: ${p}`)
  for (const [page, id, how] of touched) console.log(`  ${how.padEnd(8)} ${id.padEnd(28)} ${page}`)

  if (check) {
    if (stale.length || missing.length) {
      console.error(`\n${stale.length} page(s) out of date: run node tools/tutorials/embed.mjs`)
      process.exit(1)
    }
    console.log('tutorial embeds are up to date')
  } else {
    console.log(`\n${dry ? '[dry] would touch' : 'touched'} ${touched.length} block(s)`)
    if (!dry && touched.length && !noIndex) rebuildIndexes()
    if (missing.length) process.exit(1)
  }
}
