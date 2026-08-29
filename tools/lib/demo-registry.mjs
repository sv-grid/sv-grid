/**
 * The demo gallery registry, read from website/src/lib/demos.ts as text.
 *
 * The registry is a TypeScript module with lazy `import.meta.glob` loaders, so
 * a node script cannot import it; both the prerenderer and the SEO audit scrape
 * it instead. Scraping it in one place keeps their view of a demo identical.
 */
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pitchFromSource } from './demo-facts.mjs'

// SvGrid UI (component) demo categories - mirrors EDITOR_CATEGORIES in
// website/src/lib/demos.ts. Flips the demo <title> suffix to "Component
// Example" so a UI page (accordion, button, ...) stops mislabeling itself as a
// data grid for component-name searches.
export const EDITOR_CATEGORIES = new Set([
  'Recipes', 'Date & Time', 'Buttons & Toggles', 'Inputs', 'Selection',
  'Range & Feedback', 'Layout', 'Blocks', 'Headless Editors',
])

/** Unescape a single-quoted JS string literal's body. */
function unesc(s) {
  return s.replace(/\\(['"\\])/g, '$1')
}

/**
 * Parse the gallery registry (one demo(...) call per entry). Each call may
 * carry a multi-line opts object with pro / seoTitle / seoDescription, so the
 * source is sliced between calls and the overrides read per chunk.
 */
export async function parseDemoRegistry(root) {
  const src = await readFile(join(root, 'website', 'src', 'lib', 'demos.ts'), 'utf-8')
  const re = /demo\(\s*'([^']+)'\s*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'((?:\\.|[^'\\])*)'\s*,\s*'([^']+)'/g
  const marks = []
  let m
  while ((m = re.exec(src))) {
    marks.push({ id: m[1], title: unesc(m[2]), blurb: unesc(m[3]), category: m[4], at: m.index })
  }
  const out = []
  for (let i = 0; i < marks.length; i += 1) {
    const chunk = src.slice(marks[i].at, i + 1 < marks.length ? marks[i + 1].at : marks[i].at + 1000)
    const st = chunk.match(/seoTitle:\s*'((?:\\.|[^'\\])*)'/)
    const sd = chunk.match(/seoDescription:\s*'((?:\\.|[^'\\])*)'/)
    out.push({
      id: marks[i].id, title: marks[i].title, blurb: marks[i].blurb, category: marks[i].category,
      pro: /pro:\s*true/.test(chunk),
      seoTitle: st ? unesc(st[1]) : undefined,
      seoDescription: sd ? unesc(sd[1]) : undefined,
    })
  }
  return out
}

/** A demo's Svelte source plus the pitch from its leading comment block.
 *  Returns empty strings when the file is missing. */
export async function readDemoSource(root, id) {
  try {
    const raw = await readFile(join(root, 'examples', 'src', 'demos', `${id}.svelte`), 'utf-8')
    const source = raw.replace(/^\ufeff/, '').replace(/\r\n/g, '\n').trimEnd()
    return { source, pitch: pitchFromSource(source) }
  } catch {
    return { source: '', pitch: '' }
  }
}

/** Optional search copy for a demo: examples/src/demos/meta/<id>.json with a
 *  2-4 sentence `description`, `faq` pairs and extra `keywords`. It lives next
 *  to the demo rather than in website/src/lib/demos.ts because that registry is
 *  in the entry chunk of every page. A missing file means no extra facts. */
export async function readDemoMeta(root, id) {
  try {
    const raw = await readFile(join(root, 'examples', 'src', 'demos', 'meta', `${id}.json`), 'utf-8')
    const meta = JSON.parse(raw.replace(/^\ufeff/, ''))
    return {
      description: typeof meta.description === 'string' ? meta.description.trim() : '',
      faq: Array.isArray(meta.faq) ? meta.faq.filter((f) => f && f.question && f.answer) : [],
      keywords: Array.isArray(meta.keywords) ? meta.keywords.filter((k) => typeof k === 'string') : [],
      exists: true,
    }
  } catch {
    return { description: '', faq: [], keywords: [], exists: false }
  }
}
