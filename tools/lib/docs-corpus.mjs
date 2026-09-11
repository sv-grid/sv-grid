/**
 * Read the docs bodies back out of llms-full.txt.
 *
 * The site's docs search needs every page's text at once. Bundling the corpus
 * into the docs route chunk cost 3.4 MB on every docs page, and a second copy
 * built just for search would double the deploy. tools/build-docs-index.mjs
 * already writes every routed page's body into website/public/llms-full.txt
 * for models, under a fixed separator per page; the search fetches that file
 * the first time someone types and this splits it back into slug -> body.
 *
 * The separator is the contract:
 *
 *   <!-- =================================================================
 *        /docs/<slug>/  (<tier>)
 *        ================================================================== -->
 *
 * Blocks whose header is not a /docs/ URL (the unrouted API reference tail)
 * are ignored. tools/docs-corpus.test.ts checks the generated file against
 * docs-index.json so a change to the writer cannot silently empty the search.
 */

const SEPARATOR = /<!-- =+\r?\n\s*(\S+)\s+\([^)]*\)\r?\n\s*=+ -->\r?\n/g

/**
 * @param {string} text  The contents of llms-full.txt.
 * @returns {Map<string, string>}  slug -> markdown body (frontmatter already stripped by the writer).
 */
export function parseDocsCorpus(text) {
  /** @type {Map<string, string>} */
  const out = new Map()
  /** @type {Array<{ slug: string | null, start: number }>} */
  const marks = []
  for (const m of text.matchAll(SEPARATOR)) {
    const url = m[1]
    const slug = /^\/docs\/(.+)\/$/.exec(url)?.[1] ?? null
    marks.push({ slug, start: m.index + m[0].length })
  }
  // A body runs to the next separator of any shape: the next page's, or the
  // API reference tail's, whose header has no tier and so is not a mark.
  for (const { slug, start } of marks) {
    if (!slug) continue
    const end = text.indexOf('\n<!-- =', start)
    out.set(slug, text.slice(start, end === -1 ? text.length : end).trim())
  }
  return out
}
