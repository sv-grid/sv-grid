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
 * @typedef {{ code: boolean, text: string }} PitchRun
 * @typedef {{ kind: 'p', runs: PitchRun[] } | { kind: 'list', items: PitchRun[][] } | { kind: 'pre', text: string }} PitchBlock
 * @typedef {{
 *   id: string,
 *   description: string,
 *   pitch: PitchBlock[],
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
/**
 * A line of the pitch split at its backticks, so `ChartSpec` reads as code on
 * the page rather than as a pair of backticks in the prose.
 * @param {string} text
 * @returns {PitchRun[]}
 */
export function pitchRuns(text) {
  const out = []
  const re = /`([^`\n]+)`/g
  let last = 0
  let m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ code: false, text: text.slice(last, m.index) })
    out.push({ code: true, text: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ code: false, text: text.slice(last) })
  return out
}

/**
 * The pitch as blocks: a paragraph, or a list where the banner wrote one
 * ("- `stacked` piles the channels", each item on its own line, wrapped
 * lines indented under it). The banners of the chart demos are mostly such
 * lists, and flattening them into one paragraph put "- `stacked` ... -
 * `stack` ..." on the page with the dashes and backticks in the text.
 * @param {string} pitch
 * @returns {PitchBlock[]}
 */
export function pitchBlocks(pitch) {
  /** @type {PitchBlock[]} */
  const out = []
  for (const para of String(pitch ?? '').split(/\n{2,}/)) {
    // A block indented under the prose (a column-aligned table in the demo's
    // comment) keeps its lines and spacing; joined into a paragraph it read as
    // one run-on sentence.
    const raw = para.split('\n').filter((l) => l.trim())
    // A list stays a list, however far it is indented.
    if (raw.length && raw.every((l) => /^ {2,}/.test(l)) && !raw.some((l) => /^\s*([-*]|\d+\.)\s/.test(l))) {
      const indent = Math.min(...raw.map((l) => l.match(/^ */)[0].length))
      out.push({ kind: 'pre', text: raw.map((l) => l.slice(indent).trimEnd()).join('\n') })
      continue
    }
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) continue
    if (!lines.some((l) => /^- /.test(l))) {
      out.push({ kind: 'p', runs: pitchRuns(lines.join(' ')) })
      continue
    }
    /** @type {string[]} */
    const items = []
    /** @type {string[]} */
    const lead = []
    for (const l of lines) {
      if (/^- /.test(l)) items.push(l.slice(2).trim())
      else if (items.length) items[items.length - 1] += ' ' + l
      else lead.push(l)
    }
    if (lead.length) out.push({ kind: 'p', runs: pitchRuns(lead.join(' ')) })
    out.push({ kind: 'list', items: items.map(pitchRuns) })
  }
  return out
}

export function demoAboutModel({ id, source = '', meta = null, related = null }) {
  const src = String(source ?? '')
  const pitch = src ? pitchFromSource(src) : ''
  const facts = src ? demoFacts(src) : null
  const hasFacts = !!facts && (facts.imports.length > 0 || facts.features.length > 0 || facts.columns.length > 0 || facts.api.length > 0)
  return {
    id,
    description: typeof meta?.description === 'string' ? meta.description.trim() : '',
    pitch: pitch ? pitchBlocks(pitch) : [],
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
      const runs = (/** @type {PitchRun[]} */ rs) => rs.map((r) => (r.code ? `<code>${escape(r.text)}</code>` : escape(r.text))).join('')
      for (const b of model.pitch) {
        html += b.kind === 'list' ? `<ul>${b.items.map((it) => `<li>${runs(it)}</li>`).join('')}</ul>` : b.kind === 'pre' ? `<pre>${escape(b.text)}</pre>` : `<p>${runs(b.runs)}</p>`
      }
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

/**
 * The same sections as markdown, for /demos/<id>.md: an assistant fetching a
 * demo gets its description and full source without the app shell. Links are
 * absolute, to the markdown copies where there are some.
 *
 * @param {DemoAboutModel} model
 * @param {{ href: (kind: 'docs' | 'blog', slug: string) => string, sourceLink?: string }} opts
 */
export function renderDemoAboutMarkdown(model, { href, sourceLink }) {
  if (typeof href !== 'function') throw new Error('renderDemoAboutMarkdown: href(kind, slug) is required')
  const h = DEMO_ABOUT_HEADINGS
  /** @param {string[]} list */
  const codes = (list) => list.map((x) => `\`${x}\``).join(', ')
  /** @param {PitchRun[]} rs */
  const runs = (rs) => rs.map((r) => (r.code ? `\`${r.text}\`` : r.text)).join('')
  // A fence longer than any backtick run in the source, so the block cannot end early.
  const fence = '`'.repeat(Math.max(3, ...[...model.source.matchAll(/`+/g)].map((m) => m[0].length + 1)))
  const out = []
  for (const key of demoAboutSections(model)) {
    if (key === 'about') {
      out.push(`## ${h.about}`, '')
      if (model.description) out.push(model.description, '')
      for (const b of model.pitch) {
        if (b.kind === 'list') out.push(...b.items.map((it) => `- ${runs(it)}`), '')
        else if (b.kind === 'pre') out.push('```text', b.text, '```', '')
        else out.push(runs(b.runs), '')
      }
    } else if (key === 'facts') {
      const f = model.facts
      if (!f) continue
      out.push(`## ${h.facts}`, '')
      if (f.imports.length) out.push(`- Imports: ${codes(f.imports)}`)
      if (f.features.length) out.push(`- Table features registered: ${codes(f.features)}`)
      if (f.columns.length) out.push(`- Columns: ${f.columns.map((c) => `\`${c.field}\`${c.header ? ` (${c.header})` : ''}`).join(', ')}`)
      if (f.api.length) out.push(`- SvGridApi methods called: ${f.api.map((a) => `\`api.${a}()\``).join(', ')}`)
      out.push('')
    } else if (key === 'faq') {
      out.push(`## ${h.faq}`, '')
      for (const q of model.faq) out.push(`### ${q.question}`, '', q.answer, '')
    } else if (key === 'docs') {
      out.push(`## ${h.docs}`, '', ...model.docs.map((d) => `- [${d.title}](${href('docs', d.slug)})`), '')
    } else if (key === 'posts') {
      out.push(`## ${h.posts}`, '', ...model.posts.map((p) => `- [${p.title}](${href('blog', p.slug)})${p.description ? ` - ${p.description}` : ''}`), '')
    } else if (key === 'source') {
      out.push(`## ${h.source(model.id)}`, '', `${fence}svelte`, model.source, fence, '')
      if (sourceLink) out.push(`[View this example on GitHub](${sourceLink})`, '')
    }
  }
  return out.join('\n')
}
