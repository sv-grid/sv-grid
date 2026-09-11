/**
 * Build the demo search index: website/src/lib/demos-search.json.
 *
 * The demo registry (website/src/lib/demos.ts) carries a title, a blurb and a
 * category per demo, which is what the gallery search used to match on, one
 * substring per query word. The text people search with lives in the meta
 * files: examples/src/demos/meta/<id>.json holds a description, keywords and
 * FAQ pairs phrased the way a question is typed ("How do I pin a column on
 * mount?"). This gathers those into one file the site's search engine
 * (website/src/lib/search/) loads lazily on the first query; the registry
 * fields join at runtime.
 *
 * Runs from the website's `predev` and `prebuild` scripts; the output is
 * committed so a fresh clone builds without it having run.
 *
 * Usage: node tools/build-demo-search-index.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDemoSource } from './lib/demo-registry.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const META_DIR = join(ROOT, 'examples', 'src', 'demos', 'meta')
const OUT = join(ROOT, 'website', 'src', 'lib', 'demos-search.json')

const entries = []
for (const name of (await readdir(META_DIR)).filter((n) => n.endsWith('.json')).sort()) {
  const id = name.replace(/\.json$/, '')
  const meta = JSON.parse(await readFile(join(META_DIR, name), 'utf-8'))
  // The pitch is the demo's own explanation of what it shows, often naming
  // the props and API it uses; the source itself stays out (too big, and the
  // identifiers a developer searches by are already in the pitch and FAQ).
  const { pitch } = await readDemoSource(ROOT, id)
  entries.push({
    id,
    description: typeof meta.description === 'string' ? meta.description : '',
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
    faq: Array.isArray(meta.faq) ? meta.faq.map((f) => ({ q: f.question, a: f.answer })) : [],
    pitch: pitch.replace(/\s+/g, ' ').trim(),
  })
}

await writeFile(OUT, JSON.stringify(entries) + '\n', 'utf-8')
console.log(`build-demo-search-index: ${entries.length} demos -> ${OUT}`)
