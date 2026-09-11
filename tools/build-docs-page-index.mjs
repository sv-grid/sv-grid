/**
 * Build the docs pages' metadata index: website/src/lib/docs-index.json.
 *
 * website/src/lib/docs.ts used to inline every docs/**\/*.md with an eager
 * `?raw` glob and derive the title, description, FAQ and keywords in the
 * browser, which put the whole 3.4 MB corpus into the docs route chunk on
 * every docs page. The index carries what the sidebar, the search results and
 * route SEO need for all pages; a page's body loads on demand when opened.
 *
 * Only what depends on the markdown is derived here (title, description, FAQ,
 * frontmatter overrides). The sidebar category and order come from the
 * routing tables in docs.ts and are computed there from the slug.
 *
 * Hidden docs follow tools/lib/doc-meta.mjs, the same filter docs.ts applied.
 * Runs from the website's `predev` and `prebuild` scripts; the output is
 * committed so a fresh clone builds without it having run.
 *
 * Usage: node tools/build-docs-page-index.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isHiddenDoc, parseDocFrontmatter } from './lib/doc-meta.mjs'
import { titleFromMarkdown, descriptionFromMarkdown, faqFromMarkdown } from './lib/docs-page.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS_DIR = join(ROOT, 'docs')
const OUT = join(ROOT, 'website', 'src', 'lib', 'docs-index.json')

/** @param {string} dir @returns {Promise<string[]>} */
async function walk(dir) {
  /** @type {string[]} */
  const out = []
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) out.push(...(await walk(p)))
    else if (e.name.endsWith('.md')) out.push(p)
  }
  return out
}

const pages = []
for (const file of (await walk(DOCS_DIR)).sort()) {
  const slug = relative(DOCS_DIR, file).replace(/\\/g, '/').replace(/\.md$/, '')
  if (isHiddenDoc(slug)) continue
  const { meta, body } = parseDocFrontmatter(await readFile(file, 'utf-8'))
  const baseName = slug.slice(slug.lastIndexOf('/') + 1)
  const entry = {
    slug,
    title: titleFromMarkdown(body, baseName),
    description: meta.seoDescription || descriptionFromMarkdown(body),
    faq: faqFromMarkdown(body),
  }
  // Optional keys only when set, so the index stays small and the diff quiet.
  if (meta.keywords?.length) entry.keywords = meta.keywords
  if (meta.seoTitle) entry.seoTitle = meta.seoTitle
  if (meta.noindex) entry.noindex = true
  pages.push(entry)
}

await writeFile(OUT, JSON.stringify(pages, null, 2) + '\n', 'utf-8')
console.log(`build-docs-page-index: ${pages.length} pages -> ${OUT}`)
