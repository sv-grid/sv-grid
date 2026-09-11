/**
 * What a docs page says about itself, derived from its markdown: the title,
 * the meta description, the FAQ pairs and the per-page keywords.
 *
 * These lived in website/src/lib/docs.ts, which ran them in the browser over
 * every page because it inlined the whole corpus with an eager `?raw` glob.
 * They now run once at build time in tools/build-docs-page-index.mjs, which
 * writes website/src/lib/docs-index.json; docs.ts reads that and loads a
 * page's body only when it is opened.
 */
import { clampDescription } from './seo-text.mjs'

/**
 * Display title: the first `# ...` line, else the fallback.
 * @param {string} md
 * @param {string} fallback
 */
export function titleFromMarkdown(md, fallback) {
  const cleaned = md.replace(/^﻿/, '')
  const m = cleaned.match(/^#\s+(.+?)\s*$/m)
  if (!m) return fallback
  return m[1].trim()
}

/**
 * First real paragraph after the H1 - the meta description for the page.
 * Mirrors tools/build-docs-index.mjs so the on-page meta and the generated
 * docs.json/llms.txt stay in lockstep. Skips headings, HTML (demo embeds),
 * tables, and blockquotes; strips inline code marks and link syntax.
 * @param {string} md
 */
export function descriptionFromMarkdown(md) {
  const lines = md.replace(/^﻿/, '').split(/\r?\n/)
  let seenTitle = false
  for (let i = 0; i < lines.length; i += 1) {
    const l = (lines[i] ?? '').trim()
    if (!seenTitle) {
      if (l.startsWith('# ')) seenTitle = true
      continue
    }
    if (!l || l.startsWith('#') || l.startsWith('<') || l.startsWith('|') || l.startsWith('>')) continue
    /** @type {string[]} */
    const para = []
    for (let j = i; j < lines.length; j += 1) {
      const t = (lines[j] ?? '').trim()
      if (!t || t.startsWith('<')) break
      para.push(t)
    }
    const text = para
      .join(' ')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim()
    // Meta descriptions sweet-spot ~155-160 chars.
    return clampDescription(text)
  }
  return ''
}

/**
 * Parse a "## Frequently asked questions" section into Q&A pairs. Each `###`
 * heading is a question; the text until the next heading is the answer. Feeds
 * FAQPage JSON-LD so the Q&A can surface as a rich result and AI answer.
 * @param {string} md
 * @returns {Array<{ question: string, answer: string }>}
 */
export function faqFromMarkdown(md) {
  const lines = md.replace(/^﻿/, '').split(/\r?\n/)
  /** @type {Array<{ question: string, answer: string }>} */
  const out = []
  let inFaq = false
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i] ?? ''
    if (/^##\s+Frequently asked questions/i.test(l)) { inFaq = true; continue }
    if (!inFaq) continue
    if (/^##\s+/.test(l)) break // next H2 ends the FAQ block
    if (/^###\s+/.test(l)) {
      const question = l.replace(/^###\s+/, '').trim()
      /** @type {string[]} */
      const ans = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (/^#{2,3}\s+/.test(lines[j] ?? '')) break
        const t = (lines[j] ?? '').trim()
        if (t) ans.push(t)
      }
      const answer = ans
        .join(' ')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\s+/g, ' ')
        .trim()
      if (question && answer) out.push({ question, answer })
    }
  }
  return out
}

const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'into', 'your', 'a', 'an', 'of', 'to', 'in', 'on', 'or'])

/**
 * Per-page SEO keywords: title words + category + the SvGrid baseline.
 * @param {string} title
 * @param {string} category
 * @returns {string[]}
 */
export function keywordsFor(title, category) {
  const fromTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
  const base = ['svelte data grid', 'svelte 5', 'sv-grid']
  const cat = category.trim().toLowerCase()
  return [...new Set([...fromTitle, cat, ...base].filter(Boolean))]
}
