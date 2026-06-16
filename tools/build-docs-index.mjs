#!/usr/bin/env node
/**
 * Build the AI-era doc indexes:
 *
 *   docs/llms.txt        — topic map (one-line summaries, grouped by section)
 *   docs/llms-full.txt   — concatenated full text of every doc page
 *   docs/docs.json       — machine-readable route manifest with metadata
 *
 * Run from the repo root: `node tools/build-docs-index.mjs`.
 *
 * The generator is deliberately dependency-free so it runs on a fresh
 * clone without `pnpm install`.
 */
import { readdir, readFile, writeFile, stat, mkdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

const ROOT      = process.cwd()
const DOCS_DIR  = join(ROOT, 'docs')
const DEMOS_DIR = join(ROOT, 'examples', 'src', 'demos')
const PUBLIC_DIR = join(ROOT, 'website', 'public') // served copies for crawlers
const SITE      = process.env.SVGRID_SITE_ORIGIN ?? 'https://svgrid.com'   // canonical doc origin

const SECTION_TITLES = {
  '':                'Overview',
  'getting-started': 'Getting started',
  'help':            'Help / topic pages',
  'help/cells':      'Cells',
  'help/columns':    'Columns',
  'help/editing':    'Editing',
  'help/filtering':  'Filtering',
  'help/rows':       'Rows',
  'recipes':         'Recipes / cookbook',
  'reference':       'API reference',
  'pro':             'Pro tier',
  'compliance':      'Compliance',
}

/** Walk a directory recursively, yielding absolute file paths. */
async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

/** Pull the first H1 + the first non-empty paragraph as title / summary. */
function extract(md) {
  // Strip UTF-8 BOM if present - editors on Windows add it routinely.
  if (md.charCodeAt(0) === 0xFEFF) md = md.slice(1)
  const lines = md.split(/\r?\n/)
  let title = ''
  let summary = ''
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    if (!title && l.startsWith('# ')) { title = l.slice(2).trim(); continue }
    if (title && !summary && l.trim() && !l.startsWith('#') && !l.startsWith('<') && !l.startsWith('|') && !l.trim().startsWith('>')) {
      // collect the whole paragraph (until blank line)
      const para = []
      for (let j = i; j < lines.length; j += 1) {
        if (!lines[j].trim()) break
        para.push(lines[j].trim())
      }
      summary = para.join(' ')
        .replace(/`([^`]+)`/g, '$1')              // strip inline code marks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // strip md links
        .replace(/\s+/g, ' ')
        .trim()
      break
    }
  }
  return { title, summary }
}

/** Group docs by their parent folder. */
function sectionOf(relPath) {
  const parts = relPath.split(sep)
  if (parts.length === 1) return ''
  if (parts[0] === 'help' && parts.length > 2) return `help/${parts[1]}`
  return parts[0]
}

async function main() {
  const docs = []
  for await (const file of walk(DOCS_DIR)) {
    if (!file.endsWith('.md')) continue
    const rel = relative(DOCS_DIR, file).replaceAll('\\', '/')
    const src = await readFile(file, 'utf-8')
    const { title, summary } = extract(src)
    if (!title) continue
    const s = await stat(file)
    docs.push({
      path:        rel,
      url:         `/${rel.replace(/\.md$/, '')}`,
      title,
      summary,
      section:     sectionOf(rel.replaceAll('/', sep)),
      tier:        /\bPro\b/.test(title) ? 'pro' : 'community',
      words:       src.split(/\s+/).filter(Boolean).length,
      lastUpdated: s.mtime.toISOString().slice(0, 10),
      demoIds:     [...src.matchAll(/data-docs-demo="([^"]+)"/g)].map((m) => m[1]),
    })
  }
  docs.sort((a, b) => a.path.localeCompare(b.path))

  // ---- docs.json --------------------------------------------------------
  const manifest = {
    name:        'sv-grid documentation',
    site:        SITE,
    generatedAt: new Date().toISOString(),
    counts:      {
      pages: docs.length,
      pro:   docs.filter((d) => d.tier === 'pro').length,
      withDemo: docs.filter((d) => d.demoIds.length > 0).length,
    },
    sections: [...new Set(docs.map((d) => d.section))]
      .sort()
      .map((id) => ({
        id,
        title: SECTION_TITLES[id] ?? id,
        pages: docs.filter((d) => d.section === id).map((d) => d.path),
      })),
    pages: docs,
  }
  await writeFile(join(DOCS_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')

  // ---- llms.txt --------------------------------------------------------
  // Spec: https://llmstxt.org - a topic map with one-line summaries that
  // LLMs can fetch as a cheap first-pass context.
  const llmsLines = []
  llmsLines.push('# sv-grid')
  llmsLines.push('')
  llmsLines.push('> The Svelte 5-native data grid. Headless engine + render component, AI-native, WAI-ARIA, virtualized to 100k rows.')
  llmsLines.push('')
  llmsLines.push('Two npm packages: `sv-grid-core` (MIT, open source) and `sv-grid-pro` (commercial - export, import, pivot, AI helpers).')
  llmsLines.push('')
  llmsLines.push('For the full text of every doc page concatenated: see [llms-full.txt](/llms-full.txt).')
  llmsLines.push('For a machine-readable manifest: see [docs.json](/docs.json).')
  llmsLines.push('')
  for (const { id, title, pages } of manifest.sections) {
    if (pages.length === 0) continue
    llmsLines.push(`## ${title}`)
    llmsLines.push('')
    for (const p of pages) {
      const d = docs.find((x) => x.path === p)
      const trimmedSummary = d.summary.length > 200 ? d.summary.slice(0, 197) + '…' : d.summary
      llmsLines.push(`- [${d.title}](${SITE}${d.url}): ${trimmedSummary || '(no summary yet)'}`)
    }
    llmsLines.push('')
  }
  await writeFile(join(DOCS_DIR, 'llms.txt'), llmsLines.join('\n'), 'utf-8')

  // ---- llms-full.txt ---------------------------------------------------
  const llmsFullLines = []
  llmsFullLines.push('# sv-grid - full documentation')
  llmsFullLines.push('')
  llmsFullLines.push(`Generated ${new Date().toISOString().slice(0, 10)} from ${docs.length} pages.`)
  llmsFullLines.push('')
  for (const d of docs) {
    const src = await readFile(join(DOCS_DIR, d.path), 'utf-8')
    llmsFullLines.push(`<!-- =================================================================`)
    llmsFullLines.push(`     ${d.url}  (${d.tier})`)
    llmsFullLines.push(`     ================================================================== -->`)
    llmsFullLines.push('')
    llmsFullLines.push(src.trim())
    llmsFullLines.push('')
  }
  await writeFile(join(DOCS_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')

  // ---- Sync served copies ----------------------------------------------
  // The website fetches these at /llms.txt, /llms-full.txt, /docs.json, so the
  // crawler-facing copies must live under website/public.
  await mkdir(PUBLIC_DIR, { recursive: true })
  await writeFile(join(PUBLIC_DIR, 'docs.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms.txt'), llmsLines.join('\n'), 'utf-8')
  await writeFile(join(PUBLIC_DIR, 'llms-full.txt'), llmsFullLines.join('\n'), 'utf-8')

  // ---- Console summary --------------------------------------------------
  process.stdout.write(`build-docs-index: ${docs.length} pages → docs.json, llms.txt, llms-full.txt (docs/ + website/public/)\n`)
  process.stdout.write(`  pro: ${manifest.counts.pro} · with demo: ${manifest.counts.withDemo}\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
