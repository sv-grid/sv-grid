/**
 * The crawlable half of a demo page, as one model with two renderers.
 *
 * A demo page carries the same facts twice: tools/prerender-site.mjs writes
 * them into the static HTML that crawlers which do not run JavaScript read
 * (GPTBot, ClaudeBot, PerplexityBot, Bing's raw pass), and
 * website/src/components/DemoAboutBody.svelte draws them again once the SPA
 * has cleared #root, which is the version Google's renderer indexes. Before
 * this module each side built its own sections by hand and nothing checked
 * that they agreed, so a section added to one silently never reached the
 * other half of the crawlers.
 *
 * `demoAboutModel` turns a demo's source, meta json and related links into an
 * ordered list of sections; `renderDemoAboutHtml` is the static renderer and
 * DemoAboutBody.svelte is the hydrated one. website/src/demo-page-parity.dom.test.ts
 * renders both from the same model and diffs the text.
 */
import { pitchFromSource, demoFacts } from './demo-facts.mjs'

/** Section headings, shared by both renderers so the text is identical. */
export const DEMO_ABOUT_HEADINGS = Object.freeze({
  about: 'About this example',
  facts: 'Imports, features and API used',
  faq: 'Frequently asked questions',
  docs: 'Related documentation',
  posts: 'Related articles',
  /** @param {string} id */
  source: (id) => `Source code (${id}.svelte)`,
})

/** Section order. Both renderers iterate this list, never their own. */
export const DEMO_ABOUT_ORDER = Object.freeze(['about', 'facts', 'faq', 'docs', 'posts', 'source'])

/**
 * @typedef {{ description: string, faq: Array<{ question: string, answer: string }> }} DemoMetaLike
 * @typedef {{ docs: Array<{ slug: string, title: string }>, posts: Array<{ slug: string, title: string, description?: string }> }} DemoRelated
 * @typedef {{
 *   id: string,
 *   description: string,
 *   pitch: string[],
 *   facts: { imports: string[], features: string[], columns: Array<{ field: string, header?: string }>, api: string[] } | null,
 *   faq: Array<{ question: string, answer: string }>,
 *   docs: DemoRelated['docs'],
 *   posts: DemoRelated['posts'],
 *   source: string,
 * }} DemoAboutModel
 */

/**
 * Build the page model. Every field is a plain value so the model can cross
 * the node / browser boundary and be compared in a test.
 *
 * @param {{ id: string, source?: string, meta?: Partial<DemoMetaLike> | null, related?: Partial<DemoRelated> | null }} input
 * @returns {DemoAboutModel}
 */
export function demoAboutModel({ id, source = '', meta = null, related = null }) {
  const src = String(source ?? '')
  const pitch = src ? pitchFromSource(src) : ''
  const facts = src ? demoFacts(src) : null
  const hasFacts = !!facts && (facts.imports.length > 0 || facts.features.length > 0 || facts.columns.length > 0 || facts.api.length > 0)
  return {
    id,
    description: typeof meta?.description === 'string' ? meta.description.trim() : '',
    pitch: pitch ? pitch.split(/\n{2,}/).map((p) => p.replace(/\n/g, ' ').trim()).filter(Boolean) : [],
    facts: hasFacts ? facts : null,
    faq: Array.isArray(meta?.faq) ? meta.faq.filter((f) => f && typeof f.question === 'string' && typeof f.answer === 'string') : [],
    docs: Array.isArray(related?.docs) ? related.docs : [],
    posts: Array.isArray(related?.posts) ? related.posts : [],
    source: src,
  }
}

/**
 * Which sections of a model have content, in render order.
 * @param {DemoAboutModel} model
 * @returns {string[]}
 */
export function demoAboutSections(model) {
  /** @type {Record<string, boolean>} */
  const present = {
    about: model.description !== '' || model.pitch.length > 0,
    facts: !!model.facts,
    faq: model.faq.length > 0,
    docs: model.docs.length > 0,
    posts: model.posts.length > 0,
    source: model.source !== '',
  }
  return DEMO_ABOUT_ORDER.filter((k) => present[k])
}

/** @param {string} s */
function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Static HTML for the sections, for the prerendered page.
 *
 * @param {DemoAboutModel} model
 * @param {{ href: (kind: 'docs' | 'blog', slug: string) => string, escape?: (s: string) => string, sourceLink?: string }} opts
 *   `href` builds a link for a doc or post slug; `sourceLink` is an optional
 *   "view on GitHub" URL appended under the source.
 */
export function renderDemoAboutHtml(model, { href, escape = escapeHtml, sourceLink }) {
  if (typeof href !== 'function') throw new Error('renderDemoAboutHtml: href(kind, slug) is required')
  const h = DEMO_ABOUT_HEADINGS
  /** @param {string[]} list */
  const codes = (list) => list.map((x) => `<code>${escape(x)}</code>`).join(', ')
  let html = ''
  for (const key of demoAboutSections(model)) {
    if (key === 'about') {
      html += `<section><h2>${escape(h.about)}</h2>`
      if (model.description) html += `<p>${escape(model.description)}</p>`
      for (const p of model.pitch) html += `<p>${escape(p)}</p>`
      html += `</section>`
    } else if (key === 'facts') {
      const f = model.facts
      if (!f) continue
      html += `<section><h2>${escape(h.facts)}</h2>`
      if (f.imports.length) html += `<p>Imports: ${codes(f.imports)}</p>`
      if (f.features.length) html += `<p>Table features registered: ${codes(f.features)}</p>`
      if (f.columns.length) {
        html += `<p>Columns: ${f.columns.map((c) => `<code>${escape(c.field)}</code>${c.header ? ` (${escape(c.header)})` : ''}`).join(', ')}</p>`
      }
      if (f.api.length) html += `<p>SvGridApi methods called: ${f.api.map((a) => `<code>api.${escape(a)}()</code>`).join(', ')}</p>`
      html += `</section>`
    } else if (key === 'faq') {
      html += `<section><h2>${escape(h.faq)}</h2>`
      for (const q of model.faq) html += `<h3>${escape(q.question)}</h3><p>${escape(q.answer)}</p>`
      html += `</section>`
    } else if (key === 'docs') {
      html += `<section><h2>${escape(h.docs)}</h2><ul>`
      for (const d of model.docs) html += `<li><a href="${escape(href('docs', d.slug))}">${escape(d.title)}</a></li>`
      html += `</ul></section>`
    } else if (key === 'posts') {
      html += `<section><h2>${escape(h.posts)}</h2><ul>`
      for (const p of model.posts) html += `<li><a href="${escape(href('blog', p.slug))}">${escape(p.title)}</a>${p.description ? ` - ${escape(p.description)}` : ''}</li>`
      html += `</ul></section>`
    } else if (key === 'source') {
      html += `<section><h2>${escape(h.source(model.id))}</h2>`
      html += `<pre><code class="language-svelte">${escape(model.source)}</code></pre>`
      if (sourceLink) html += `<p><a href="${escape(sourceLink)}">View this example on GitHub</a></p>`
      html += `</section>`
    }
  }
  return html
}
