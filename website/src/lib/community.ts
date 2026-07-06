// Community-demo helpers: the "Share as a community demo" PR flow and the
// GitHub-Discussion-backed upvote ("star") count.
//
// Stars are GitHub-native: each community demo is backed by a Discussion, and
// the "star" is that discussion's 👍 reaction. We read the count via the public
// GitHub API and cache it (like the repo-star nudge) so we stay under the
// unauthenticated 60/hr limit; any failure just hides the count and leaves the
// Upvote link working. There is no bespoke voting backend.

const REPO = 'sv-grid/sv-grid'
const BRANCH = 'main'
const COMMUNITY_DIR = 'examples/src/demos/community'

/** URL of the GitHub Discussion backing a community demo's upvotes. */
export function discussionUrl(n: number): string {
  return `https://github.com/${REPO}/discussions/${n}`
}

/** GitHub avatar URL for a handle (falls back handled by the caller's onerror). */
export function avatarUrl(handle: string | undefined, size = 48): string {
  return handle ? `https://github.com/${handle}.png?size=${size}` : ''
}

/** Slugify a title into a safe community file/demo slug. */
export function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'my-demo'
  )
}

export type ShareMeta = { title?: string; author?: string; github?: string; tags?: string }

/** The `<!-- ... -->` community header block built from explicit fields. */
export function communityHeader(meta: ShareMeta = {}): string {
  return (
    `<!--\n` +
    `  title: ${meta.title || 'Your demo title'}\n` +
    `  author: ${meta.author || 'Your Name'}\n` +
    `  github: ${meta.github || 'your-handle'}\n` +
    `  tags: ${meta.tags || 'editing, filtering'}\n` +
    `  discussion: 0\n` +
    `-->\n`
  )
}

/**
 * Return `source` with an authoritative community header. Any existing leading
 * community header (one that carries title/author/discussion) is replaced, so
 * the fields entered in the Share dialog always win; a plain code comment at the
 * top is left untouched.
 */
export function withCommunityHeader(source: string, meta: ShareMeta = {}): string {
  const stripped = source.replace(/^﻿?\s*<!--[\s\S]*?-->\s*/, (m) =>
    /\b(title|author|discussion)\s*:/i.test(m) ? '' : m,
  )
  return communityHeader(meta) + stripped
}

/**
 * Imports that would stop a demo running as a self-contained community demo -
 * anything that isn't `@svgrid/grid`, `@svgrid/enterprise`, or `svelte`. Relative
 * imports (e.g. `../shared/seed`) and extra npm packages are what break a bare
 * community demo, so we surface them before opening the PR.
 */
export function nonSelfContainedImports(source: string): string[] {
  const ok = (mod: string) =>
    mod === '@svgrid/grid' ||
    mod === '@svgrid/enterprise' ||
    mod === 'svelte' ||
    mod.startsWith('svelte/')
  const found = new Set<string>()
  // `import ... from 'x'` and side-effect `import 'x'`
  const re = /\bimport\b(?:[^'"]*?\bfrom\b)?\s*['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    if (!ok(m[1]!)) found.add(m[1]!)
  }
  return [...found]
}

/**
 * Build the GitHub "create a new file" URL that opens a pre-filled PR flow
 * (GitHub forks the repo for the user if needed, then offers "Propose changes").
 * The file content rides along in `?value=` when it's small enough; large demos
 * exceed URL limits, so callers copy the source to the clipboard as a fallback
 * and the user pastes. Returns whether the content was inlined.
 */
export function buildShareUrl(
  fileContent: string,
  slug: string,
): { url: string; inlined: boolean } {
  // The directory goes in the URL PATH with real slashes; only the basename
  // goes in `filename`. Putting the whole path (with `/` -> `%2F`) in the
  // `filename` param makes GitHub drop the prefill entirely (empty editor) - the
  // percent-encoded slashes confuse its parser. The `slug` is kebab-case ascii,
  // so the basename needs no encoding.
  const base = `https://github.com/${REPO}/new/${BRANCH}/${COMMUNITY_DIR}`
  const basename = `${slug}.svelte`
  const withValue = `${base}?filename=${basename}&value=${encodeURIComponent(fileContent)}`
  // GitHub rejects new-file URLs past ~8 KB (HTTP 414 - measured: 6 KB works,
  // 10 KB fails), so prefilling the editor via `?value=` only works for small
  // files. Keep a safe margin under the 8190-byte request-line limit.
  if (withValue.length <= 7800) return { url: withValue, inlined: true }
  // Too big to carry the code. Open an empty editor (GitHub shows its own "Enter
  // file contents here" placeholder) so the user can paste the clipboard code in
  // one step - Ctrl/Cmd+V into the empty field, no select-all needed.
  return { url: `${base}?filename=${basename}`, inlined: false }
}

/**
 * Fetch a discussion's 👍 ("+1") reaction count, cached in localStorage for 6h.
 * Best-effort: returns null on any failure (offline, rate-limited, endpoint
 * unavailable) so the UI can simply hide the count. `discussion: 0` means "no
 * thread yet" - we skip the call entirely.
 */
export async function fetchDiscussionUpvotes(n: number): Promise<number | null> {
  if (!n || n <= 0) return null
  const KEY = `sg-community-upvotes-${n}`
  const TTL = 6 * 60 * 60 * 1000
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const { v, t } = JSON.parse(raw)
      if (typeof v === 'number' && Date.now() - t < TTL) return v
    }
  } catch {
    /* ignore */
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/discussions/${n}`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) return null
    const data = await res.json()
    const count =
      typeof data?.reactions?.['+1'] === 'number' ? (data.reactions['+1'] as number) : null
    if (count !== null) {
      try {
        localStorage.setItem(KEY, JSON.stringify({ v: count, t: Date.now() }))
      } catch {
        /* ignore */
      }
    }
    return count
  } catch {
    return null
  }
}
