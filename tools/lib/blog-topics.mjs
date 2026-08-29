/**
 * The blog topic queue: tools/blog-topics.json, a prioritized list of search
 * queries the daily generator writes against instead of inventing a subject.
 *
 * A topic is consumed when website/src/content/blog/<slug>.md exists, so the
 * queue itself never changes when a post ships. That matters because the post
 * lands in the private website repo while the queue lives here; a "consumed"
 * flag would need a commit in both repos at once. Array order is priority.
 *
 * Shared by the generator and tools/seo-guardrails.test.ts so a queue entry
 * that points at a demo, doc or API name that does not exist fails CI instead
 * of failing the 05:23 UTC run.
 */
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { knownApiIdentifiers } from './grid-api-facts.mjs'

// Categories in use across the queue. The website groups them for display
// (CATEGORY_TO_GROUP in website/src/lib/blog.ts), so a new one needs a group.
export const BLOG_CATEGORIES = [
  'Engineering', 'Accessibility', 'Cells', 'Use cases', 'Comparisons',
  'Concepts', 'Editing', 'Selection', 'Columns', 'Rows', 'Filtering',
  'Data', 'Export', 'Grouping', 'Architecture', 'Formatting', 'Sorting',
  'Getting started', 'Integration', 'Theming', 'Performance', 'AI',
]

export const TOPIC_INTENTS = ['how-to', 'concept', 'comparison', 'integration', 'reference']

export const TOPICS_PATH = join('tools', 'blog-topics.json')

export function readTopics(root) {
  const raw = readFileSync(join(root, TOPICS_PATH), 'utf-8')
  const parsed = JSON.parse(raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw)
  return Array.isArray(parsed.topics) ? parsed.topics : []
}

/** Structural + referential checks. Returns human-readable problems, empty when clean. */
export function validateTopics(root, topics) {
  const problems = []
  const seen = new Set()
  const api = knownApiIdentifiers(root)
  const strings = (t) => [t.slug, t.query, t.workingTitle, t.brief, ...(t.secondary ?? []), ...(t.tags ?? [])]
  topics.forEach((t, i) => {
    const at = `topics[${i}] (${t.slug ?? '?'})`
    if (typeof t.slug !== 'string' || !/^[a-z0-9][a-z0-9-]{6,78}[a-z0-9]$/.test(t.slug)) problems.push(`${at}: slug must be 8-80 chars of [a-z0-9-]`)
    else if (seen.has(t.slug)) problems.push(`${at}: duplicate slug`)
    else seen.add(t.slug)
    if (!t.query || typeof t.query !== 'string') problems.push(`${at}: query is required`)
    if (!TOPIC_INTENTS.includes(t.intent)) problems.push(`${at}: intent must be one of ${TOPIC_INTENTS.join(', ')}`)
    if (!BLOG_CATEGORIES.includes(t.category)) problems.push(`${at}: category "${t.category}" is not in BLOG_CATEGORIES`)
    if (!t.workingTitle) problems.push(`${at}: workingTitle is required`)
    if (!t.brief) problems.push(`${at}: brief is required`)
    if (!Array.isArray(t.tags) || t.tags.length === 0) problems.push(`${at}: tags must be a non-empty array`)
    for (const key of ['secondary', 'demos', 'docs', 'api']) {
      if (t[key] !== undefined && !Array.isArray(t[key])) problems.push(`${at}: ${key} must be an array`)
    }
    const demos = t.demos ?? []
    const docs = t.docs ?? []
    if (demos.length === 0 && docs.length === 0) problems.push(`${at}: needs at least one demo or doc to link`)
    for (const id of demos) {
      if (!existsSync(join(root, 'examples', 'src', 'demos', `${id}.svelte`))) problems.push(`${at}: demo "${id}" does not exist`)
    }
    for (const slug of docs) {
      if (!existsSync(join(root, 'docs', `${slug}.md`))) problems.push(`${at}: doc "${slug}" does not exist`)
    }
    for (const name of t.api ?? []) {
      if (!api.has(name)) problems.push(`${at}: api "${name}" is not an export or SvGridApi method`)
    }
    for (const s of strings(t)) {
      if (typeof s === 'string' && /[—–]/.test(s)) problems.push(`${at}: contains an em/en dash; use a plain hyphen`)
    }
  })
  return problems
}

export function loadTopics(root) {
  const topics = readTopics(root)
  return { topics, problems: validateTopics(root, topics) }
}

export function isTopicConsumed(root, slug) {
  return existsSync(join(root, 'website', 'src', 'content', 'blog', `${slug}.md`))
}

/** First topic in priority order whose post has not been written yet. */
export function nextTopic(root, topics) {
  return topics.find((t) => !isTopicConsumed(root, t.slug)) ?? null
}

export function findTopic(topics, slug) {
  return topics.find((t) => t.slug === slug) ?? null
}
