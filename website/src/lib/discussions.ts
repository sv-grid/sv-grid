// Typed access to the discussions dataset baked at build time by
// tools/fetch-discussions.mjs (see that file for the why). The Community page
// renders this as a native GitHub-Discussions-style browse UI. When the dataset
// is empty (no-token build / no discussions yet) the page falls back to a
// "browse on GitHub" empty state.
import raw from './discussions-data.json'
import { DISCUSSIONS_URL } from './giscus'

export type DiscussionCategory = {
  name: string
  emoji: string
  slug: string
  description: string
  isAnswerable: boolean
}

export type DiscussionAuthor = { login: string; url: string; avatarUrl: string }

export type Discussion = {
  number: number
  title: string
  url: string
  createdAt: string
  updatedAt: string
  answered: boolean
  category: { name: string; emoji: string; slug: string } | null
  author: DiscussionAuthor | null
  comments: number
  reactions: number
}

export type DiscussionsData = {
  repo: string
  generatedAt: string
  totalCount: number
  categories: DiscussionCategory[]
  discussions: Discussion[]
}

export const discussionsData = raw as DiscussionsData

// GitHub's GraphQL returns a category's emoji as a shortcode (":bulb:"), not a
// glyph. Map the common ones (GitHub's default discussion categories + popular
// custom picks) to Unicode; unknown shortcodes fall back to a speech balloon.
const SHORTCODE_EMOJI: Record<string, string> = {
  mega: '📣', loudspeaker: '📢', speech_balloon: '💬', bulb: '💡', ballot_box: '🗳️',
  pray: '🙏', raised_hands: '🙌', wave: '👋', rocket: '🚀', question: '❓', grey_question: '❓',
  bell: '🔔', hammer_and_wrench: '🛠️', sparkles: '✨', tada: '🎉', heart: '❤️', books: '📚',
  white_check_mark: '✅', computer: '💻', bug: '🐛', art: '🎨', memo: '📝', star: '⭐',
  handshake: '🤝', busts_in_silhouette: '👥', open_book: '📖', gear: '⚙️', warning: '⚠️',
}

/** Resolve a GitHub emoji shortcode (or pass through an existing glyph). */
export function toEmoji(raw: string | undefined | null): string {
  if (!raw) return '💬'
  const m = /^:([a-z0-9_+-]+):$/i.exec(raw.trim())
  if (!m) return raw // already a glyph (e.g. our DEFAULT_CATEGORIES)
  return SHORTCODE_EMOJI[m[1].toLowerCase()] ?? '💬'
}

export const discussions: Discussion[] = discussionsData.discussions.map((d) => ({
  ...d,
  category: d.category ? { ...d.category, emoji: toEmoji(d.category.emoji) } : null,
}))
export const discussionsTotal = discussionsData.totalCount

/**
 * The standard GitHub Discussions categories, used as a fallback so the
 * sidebar still shows the full category list (like GitHub does) when the baked
 * dataset is empty - i.e. a no-token build, or before the first tokened deploy
 * has run. Once real categories are baked in they take over (with their real
 * slugs/emoji). Slugs match GitHub's defaults so the deep-links resolve.
 */
export const DEFAULT_CATEGORIES: DiscussionCategory[] = [
  { name: 'Announcements', emoji: '📣', slug: 'announcements', description: 'Updates from the maintainers', isAnswerable: false },
  { name: 'General', emoji: '💬', slug: 'general', description: 'Chat about anything and everything', isAnswerable: false },
  { name: 'Ideas', emoji: '💡', slug: 'ideas', description: 'Share ideas for new features', isAnswerable: false },
  { name: 'Polls', emoji: '🗳️', slug: 'polls', description: 'Take a vote from the community', isAnswerable: false },
  { name: 'Q&A', emoji: '🙏', slug: 'q-a', description: 'Ask the community for help', isAnswerable: true },
  { name: 'Show and tell', emoji: '🙌', slug: 'show-and-tell', description: 'Show off something you have made', isAnswerable: false },
]

/** Categories to render: the baked set (with emoji shortcodes resolved to
 *  glyphs), or the GitHub defaults when empty. */
export const discussionCategories: DiscussionCategory[] =
  discussionsData.categories.length
    ? discussionsData.categories.map((c) => ({ ...c, emoji: toEmoji(c.emoji) }))
    : DEFAULT_CATEGORIES

/** Link to open a new discussion (optionally pre-filtered to a category slug). */
export function newDiscussionUrl(categorySlug?: string): string {
  const base = `${DISCUSSIONS_URL}/new`
  return categorySlug ? `${base}?category=${encodeURIComponent(categorySlug)}` : base
}

/** Count of loaded discussions per category slug (among the baked set). */
export function countsByCategory(): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const d of discussions) {
    const slug = d.category?.slug
    if (slug) counts[slug] = (counts[slug] ?? 0) + 1
  }
  return counts
}

/** Compact "x ago" / "in x" relative time from an ISO string. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const sec = Math.round((now - then) / 1000)
  const abs = Math.abs(sec)
  const units: [number, string][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [7, 'day'],
    [4.345, 'week'],
    [12, 'month'],
    [Number.POSITIVE_INFINITY, 'year'],
  ]
  let value = abs
  let unit = 'second'
  let divisor = 1
  for (const [step, name] of units) {
    if (value < step) {
      unit = name
      break
    }
    divisor *= step
    value = abs / divisor
    unit = name
  }
  const rounded = Math.max(1, Math.floor(value))
  const label = `${rounded} ${unit}${rounded === 1 ? '' : 's'}`
  return sec >= 0 ? `${label} ago` : `in ${label}`
}

export type SortKey = 'updated' | 'created' | 'comments'
export type AnsweredFilter = 'all' | 'answered' | 'open'

/** Filter by category slug ('' = all) + free-text query + answered status, then sort. */
export function selectDiscussions(
  categorySlug: string,
  query: string,
  sort: SortKey,
  answered: AnsweredFilter = 'all',
): Discussion[] {
  const q = query.trim().toLowerCase()
  let list = discussions.filter((d) => {
    if (categorySlug && d.category?.slug !== categorySlug) return false
    if (answered === 'answered' && !d.answered) return false
    if (answered === 'open' && d.answered) return false
    if (q) {
      const hay = `${d.title} ${d.author?.login ?? ''} ${d.category?.name ?? ''}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })
  list = [...list].sort((a, b) => {
    if (sort === 'comments') return b.comments - a.comments
    const key = sort === 'created' ? 'createdAt' : 'updatedAt'
    return new Date(b[key]).getTime() - new Date(a[key]).getTime()
  })
  return list
}
