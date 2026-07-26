// Turn a topic (from select-content.mjs) into a ready-to-post tweet:
//   { text, replyText, link, card?, image? }
//
// - release / highlight: deterministic, brand-safe templates (no model call).
// - blog / ai: an AI-written hook via the Anthropic API (bare fetch, like
//   tools/generate-blog-post.mjs), grounded so the copy stays truthful. Falls
//   back to a template if the API key is missing or the call fails.
//
// The main tweet carries NO link; the link goes in a first reply (buildReply),
// which avoids X's per-link API charge and its link-in-body reach penalty.
//
// Blog tweets return `image` (the post's own hero image) so the orchestrator
// uploads the real post image instead of a rendered card. Every type also
// returns a `card` spec as a fallback.
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { HIGHLIGHTS } from './highlights.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const GRID_INDEX = join(ROOT, 'packages', 'grid', 'src', 'index.ts')

const SITE = 'https://svgrid.com'
const MODEL = process.env.TWEET_MODEL || 'claude-sonnet-4-6'
const API_KEY = process.env.ANTHROPIC_API_KEY
const TWEET_MAX = 280
const URL_WEIGHT = 23

export function tweetLength(text) {
  const withoutUrls = text.replace(/https?:\/\/\S+/g, '')
  const urlCount = (text.match(/https?:\/\/\S+/g) || []).length
  return withoutUrls.length + urlCount * URL_WEIGHT
}

const hashtags = (tags = []) => tags.map((t) => `#${t}`).join(' ')
const stripEmDash = (s) => s.replace(/—/g, '-').replace(/\s-\s/g, ' - ')

// Main tweet: "<hook> <hashtags>", no link, trimmed to 280.
function assemble(hook, tags) {
  const tail = hashtags(tags)
  let text = stripEmDash(`${hook} ${tail}`.trim())
  if (tweetLength(text) <= TWEET_MAX) return text
  let h = hook
  while (h.length > 8 && tweetLength(`${h} ${tail}`) > TWEET_MAX) {
    h = h.slice(0, Math.max(8, h.length - 8)).replace(/\s+\S*$/, '') + '...'
  }
  return stripEmDash(`${h} ${tail}`.trim())
}

const buildReply = (prefix, link) => stripEmDash(`${prefix} ${link}`.trim())

async function callModel(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`)
  const data = await res.json()
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim()
}

function readExports() {
  if (!existsSync(GRID_INDEX)) return ''
  const raw = readFileSync(GRID_INDEX, 'utf-8')
  const names = new Set()
  for (const m of raw.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim()
      if (name) names.add(name)
    }
  }
  return [...names].slice(0, 60).join(', ')
}

const VOICE = [
  'You write short, punchy tweets for SvGrid, a Svelte 5 data grid.',
  'Rules: at most 180 characters. No hashtags (added separately). No URLs.',
  'No emoji. No em-dashes (use a plain hyphen). Never name rival grid libraries.',
  'Be concrete and developer-focused. Return ONLY the tweet text.',
].join(' ')

async function aiHook(promptBody, fallback) {
  if (!API_KEY) return fallback
  try {
    const hook = (await callModel(`${VOICE}\n\n${promptBody}`)).replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0]
    return hook || fallback
  } catch (err) {
    console.warn('AI hook failed, using fallback:', err.message)
    return fallback
  }
}

// -------- Per-type composition -------------------------------------------
async function composeRelease(topic) {
  const short = topic.pkg.replace('@svgrid/', '')
  const link = `${SITE}/docs/changelog`
  const hook = short === 'grid'
    ? `SvGrid ${topic.version} is out. Fresh release of the Svelte 5 data grid - grab it from npm.`
    : `@svgrid/${short} ${topic.version} just shipped. Update from npm to get the latest.`
  return {
    text: assemble(hook, ['Svelte', 'SvelteKit']),
    replyText: buildReply('Changelog:', link),
    link,
    card: { eyebrow: 'New release', headline: `${topic.pkg} ${topic.version}`, subline: 'Now on npm. The Svelte 5 data grid keeps shipping.', footerRight: `v${topic.version}` },
  }
}

async function composeHighlight(topic) {
  return {
    text: assemble(`${topic.headline} ${topic.body}`, topic.hashtags),
    replyText: buildReply('Docs:', topic.link),
    link: topic.link,
    card: { eyebrow: topic.eyebrow, headline: topic.headline, subline: topic.body, footerRight: topic.footerRight },
  }
}

async function composeBlog(topic) {
  const link = `${SITE}/blog/${topic.slug}`
  const fallback = topic.description || topic.title
  const hook = await aiHook(
    `Write a tweet hook that makes a developer want to read this new SvGrid blog post.\n` +
      `Title: ${topic.title}\nSummary: ${topic.description}\nCategory: ${topic.category}`,
    fallback,
  )
  return {
    text: assemble(hook, ['Svelte', 'SvelteKit']),
    replyText: buildReply('Read it here:', link),
    link,
    // The post's own hero image (preferred); orchestrator falls back to `card`.
    image: topic.image || null,
    card: { eyebrow: topic.category || 'From the blog', headline: topic.title, subline: topic.description, footerRight: 'New on the blog' },
  }
}

async function composeAi() {
  const link = `${SITE}`
  const hook = await aiHook(
    `Write one original tweet promoting SvGrid, the Svelte 5 data grid.\n` +
      `Pick ONE concrete capability and make it compelling.\n` +
      `Real public API names you may reference: ${readExports()}\n` +
      `Feature themes: ${HIGHLIGHTS.map((h) => h.headline).join(' | ')}`,
    'The Svelte 5 data grid: virtualization, filters, editing, and 20+ themes - one prop pass.',
  )
  return {
    text: assemble(hook, ['Svelte', 'SvelteKit']),
    replyText: buildReply('Try it:', link),
    link,
    card: { eyebrow: 'SvGrid', headline: 'The Svelte 5 data grid.', subline: 'Headless-first. Render-ready.', footerRight: 'Built for Svelte 5 runes' },
  }
}

export async function compose(topic) {
  switch (topic.type) {
    case 'release': return composeRelease(topic)
    case 'blog': return composeBlog(topic)
    case 'highlight': return composeHighlight(topic)
    case 'ai': return composeAi()
    default: throw new Error(`Unknown topic type: ${topic.type}`)
  }
}
