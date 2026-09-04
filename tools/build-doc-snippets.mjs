/**
 * build-doc-snippets - turn `{runnable}` doc code blocks into real components.
 *
 * AG Grid ships ~1,023 runnable examples across its doc pages because each one
 * is a small page-scoped program living next to the page. We had the same
 * material - 2,117 fenced blocks in docs/, hundreds of them complete Svelte
 * components - sitting inert as highlighted text. This extracts them so Vite
 * compiles each into an ordinary lazy chunk and the docs can mount it.
 *
 * Output is GENERATED. `examples/src/doc-snippets/` is cleared on every run and
 * is gitignored; the markdown is the source of truth.
 *
 *   node tools/build-doc-snippets.mjs             # extract {runnable} blocks
 *   node tools/build-doc-snippets.mjs --candidates  # also extract un-flagged
 *                                                   # component-shaped blocks,
 *                                                   # for the promotion audit
 *   node tools/build-doc-snippets.mjs --promote     # add {runnable} to the
 *                                                   # candidates that passed
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error - plain .mjs helper with a sibling .d.mts
import { extractFences, isComponentShaped, splitComponent, mergePreamble, blockKey } from './lib/md-snippets.mjs'

// Anchored to this file, not to cwd: the website's `prebuild` runs this from
// `website/`, where a relative 'docs' resolves to website/docs and the whole
// deploy dies on ENOENT. Same approach as build-docs-index.mjs beside it.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const OUT = join(ROOT, 'examples/src/doc-snippets')
const MANIFEST = join(OUT, 'manifest.json')

/** Generated API reference is a declaration dump, never a runnable example. */
const SKIP = [/\/reference\/auto\//]

function docFiles(dir = DOCS, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name).replace(/\\/g, '/')
    if (e.isDirectory()) docFiles(p, out)
    else if (e.name.endsWith('.md') && !SKIP.some((re) => re.test(p))) out.push(p)
  }
  return out
}

/**
 * Stable id for a block: page slug plus its index in the file. Index rather than
 * a content hash so that editing a snippet keeps its URL and its chunk name;
 * moving one changes the id, which is the lesser evil.
 */
export function snippetId(file, index) {
  const slug = relative(DOCS, file).replace(/\\/g, '/').replace(/\.md$/, '')
  return `${slug.replace(/[^a-zA-Z0-9]+/g, '-')}--${index}`
}

/** Stable per-page key for a block, shared with the docs renderer. */
export const blockHash = blockKey

/** Every candidate block in the corpus, flagged or not. */
export function collect({ candidates = false } = {}) {
  const out = []
  for (const file of docFiles()) {
    const src = readFileSync(file, 'utf-8')
    const fences = extractFences(file, src)

    // A page may declare shared setup once. Doc blocks are excerpts - they say
    // `<SvGrid {data} {columns} />` and leave the import, the row type and the
    // data to the surrounding prose - so without this almost none of them stand
    // alone. Concatenated if a page declares more than one.
    const preamble = fences
      .filter((f) => f.lang === 'svelte' && f.flags.has('preamble'))
      .map((f) => splitComponent(f.code).script)
      .filter(Boolean)
      .join('\n\n')

    for (const fence of fences) {
      if (fence.lang !== 'svelte') continue
      if (fence.flags.has('preamble')) continue
      const flagged = fence.flags.has('runnable')
      // `nocheck` marks prose pseudocode - it does not type-check, so it will
      // not compile either.
      if (fence.flags.has('nocheck')) continue
      // `<svelte:options customElement>` only means anything when compiled as a
      // custom element, which the docs bundle is not - Vite warns and the
      // example would not behave as written.
      if (/<svelte:options[^>]*customElement/.test(fence.code)) continue
      // With a preamble in play a markup-only block can stand alone too, so the
      // candidate net widens to any block with markup.
      const shaped = preamble
        ? /<[A-Za-z][A-Za-z0-9]*[\s/>]/.test(fence.code.replace(/<script[\s\S]*?<\/script>/g, ''))
        : isComponentShaped(fence.code)
      if (!flagged && !(candidates && shaped)) continue
      out.push({
        id: snippetId(file, fence.index),
        file,
        index: fence.index,
        line: fence.line,
        flagged,
        // Hash the block as authored; compile the block as merged.
        hash: blockHash(fence.code),
        code: preamble ? mergePreamble(preamble, fence.code) : fence.code,
      })
    }
  }
  return out
}

function write(snippets) {
  // The docs page looks a block up by (doc slug, key), so keys only have to be
  // unique within a page - but if two blocks on one page ARE identical, the
  // reader would get the same example twice and one chunk would be orphaned.
  // Fail loudly rather than emitting something that half works.
  const seen = new Map()
  for (const s of snippets) {
    const key = `${s.file}|${s.hash}`
    if (seen.has(key)) {
      throw new Error(
        `duplicate runnable block in ${s.file}: "${seen.get(key)}" and "${s.id}" are identical. ` +
          'Vary one of them, or drop the {runnable} flag from the repeat.',
      )
    }
    seen.set(key, s.id)
  }

  rmSync(OUT, { recursive: true, force: true })
  mkdirSync(OUT, { recursive: true })

  for (const s of snippets) {
    // A trailing newline keeps svelte-check's line numbers aligned with the
    // block as it appears in the markdown.
    writeFileSync(join(OUT, `${s.id}.svelte`), `${s.code.replace(/\s+$/, '')}\n`)
  }

  const manifest = {
    generatedBy: 'tools/build-doc-snippets.mjs',
    snippets: snippets.map((s) => ({
      id: s.id,
      doc: relative(DOCS, s.file).replace(/\\/g, '/').replace(/\.md$/, ''),
      index: s.index,
      line: s.line,
      hash: s.hash,
    })),
  }
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

/** Remove `{runnable}` from a block's opening fence, in place. */
export function demote(file, index) {
  const src = readFileSync(file, 'utf-8')
  const crlf = src.includes('\r\n')
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let seen = -1
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^```([a-zA-Z]+)(?:\s+\{([^}]*)\})?\s*$/.exec(lines[i])
    if (!m) continue
    seen += 1
    if (seen !== index) {
      let j = i + 1
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j += 1
      i = j
      continue
    }
    const flags = (m[2] ?? '').split(/[,\s]+/).filter(Boolean).filter((f) => f !== 'runnable')
    lines[i] = '```' + m[1] + (flags.length ? ' {' + flags.join(' ') + '}' : '')
    const next = lines.join('\n')
    writeFileSync(file, crlf ? next.replace(/\n/g, '\r\n') : next)
    return true
  }
  return false
}

/** Add `{runnable}` to a block's opening fence, in place. */
export function promote(file, index) {
  const src = readFileSync(file, 'utf-8')
  const crlf = src.includes('\r\n')
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  let seen = -1
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^```([a-zA-Z]+)(?:\s+\{([^}]*)\})?\s*$/.exec(lines[i])
    if (!m) continue
    seen += 1
    if (seen !== index) {
      // Skip to this block's closing fence so nested fences are not miscounted.
      let j = i + 1
      while (j < lines.length && !/^```\s*$/.test(lines[j])) j += 1
      i = j
      continue
    }
    const flags = (m[2] ?? '').split(/[,\s]+/).filter(Boolean)
    if (flags.includes('runnable')) return false
    flags.push('runnable')
    lines[i] = '```' + m[1] + ' {' + flags.join(' ') + '}'
    const next = lines.join('\n')
    writeFileSync(file, crlf ? next.replace(/\n/g, '\r\n') : next)
    return true
  }
  return false
}

if (process.argv[1]?.endsWith('build-doc-snippets.mjs')) {
  const candidates = process.argv.includes('--candidates')
  const doPromote = process.argv.includes('--promote')

  if (doPromote) {
    // Promote every candidate that svelte-check accepted. The pass list comes
    // from tools/check-doc-snippets.mjs, which owns running svelte-check.
    const passFile = join('node_modules', '.cache', 'doc-snippets', 'passing.json')
    if (!existsSync(passFile)) {
      console.error('--promote needs ' + passFile + '; run tools/check-doc-snippets.mjs first')
      process.exit(1)
    }
    const passing = new Set(JSON.parse(readFileSync(passFile, 'utf-8')))
    const all = collect({ candidates: true })
    // Descending index, so rewriting one fence cannot shift the next one's
    // position within the same file.
    const order = (a, b) => (a.file === b.file ? b.index - a.index : a.file < b.file ? -1 : 1)

    const toPromote = all.filter((s) => !s.flagged && passing.has(s.id)).sort(order)
    // A block can stop passing after an edit elsewhere on the page - a preamble
    // that shadows a name, a renamed prop. Leaving it flagged would render a
    // broken example, so promotion runs in both directions.
    const toDemote = all.filter((s) => s.flagged && !passing.has(s.id)).sort(order)

    let up = 0
    for (const s of toPromote) if (promote(s.file, s.index)) up += 1
    let down = 0
    for (const s of toDemote) if (demote(s.file, s.index)) down += 1
    console.log(`promoted ${up} blocks to {runnable}, demoted ${down} that no longer pass`)
    process.exit(0)
  }

  const snippets = collect({ candidates })
  const manifest = write(snippets)
  const flagged = snippets.filter((s) => s.flagged).length
  console.log(
    `build-doc-snippets: wrote ${manifest.snippets.length} snippets to ${OUT}/` +
      (candidates ? ` (${flagged} flagged, ${snippets.length - flagged} candidates)` : ''),
  )
}
