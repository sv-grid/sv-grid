// Rewrite intra-docs links so clicking "Getting Started" or "../foo.md" from
// inside the rendered markdown jumps to the website's hash route instead of
// 404'ing on a non-existent .md URL.
//
// Examples:
//   currentSlug = "help/columns/column-definitions"
//   href = "../../getting-started.md"       -> "#/docs/getting-started"
//   href = "../columns/column-pinning.md"   -> "#/docs/help/columns/column-pinning"
//   href = "./other.md"                     -> "#/docs/help/columns/other"
//   href = "../LICENSE"                     -> GitHub URL
//   href = "#some-anchor"                   -> "#some-anchor"          (left alone)
//   href = "https://github.com/..."         -> "https://github.com/..."(left alone)

import { docs } from './docs'

const KNOWN_SLUGS = new Set(docs.map((d) => d.slug))
const GITHUB_BASE = 'https://github.com/sv-grid/sv-grid/blob/main'

// Map dangling / never-written .md targets that appear in the source docs
// to the right website page so we never render a broken link.
const REDIRECTS: Record<string, string> = {
  // Hidden / non-existent .md files that some docs link to.
  'examples-plan': '#/demos',
  'help/index': '#/docs',
  // Legacy / planned files referenced from getting-started.md
  'column-definitions': '#/docs/help/columns/column-definitions',
  'row-models': '#/docs/help/rows/row-data',
  'server-side': '#/docs/help/filtering/filter-api',
  'theming': '#/docs/help/tailwind',
  'migration': '#/compare',
}

// Non-.md repo files we want to route to GitHub (LICENSE, NOTICE, CHANGELOG).
const REPO_FILES = new Set(['LICENSE', 'NOTICE', 'CHANGELOG', 'README'])

export function resolveDocsLink(href: string, currentSlug: string): string {
  if (!href) return href

  // Absolute URLs, mailto / tel: leave alone.
  if (/^(https?:|mailto:|tel:|javascript:)/i.test(href)) return href

  // Pure in-page anchor (e.g. "#some-section" from a Table of Contents):
  // route it through the hash router so we stay on the current doc instead
  // of resetting the route to root.
  if (href.startsWith('#') && !href.startsWith('#/')) {
    return `#/docs/${currentSlug}${href}`
  }

  // Already a hash-route ("#/docs/..."): leave alone.
  if (href.startsWith('#/')) return href

  // Split off a trailing #fragment or ?query.
  const fragMatch = href.match(/^([^#?]*)([#?].*)?$/)
  let pathPart = fragMatch ? fragMatch[1] : href
  const tail = fragMatch && fragMatch[2] ? fragMatch[2] : ''

  // Three kinds of intra-repo references we know how to rewrite:
  //  1. Markdown docs (.md) -> resolve relative path -> website hash route
  //  2. Repo-root files (LICENSE / NOTICE etc.) -> GitHub URL
  //  3. Anything else with no extension and a single segment relative to repo
  //     root that matches a REPO_FILES entry -> GitHub URL
  const isMd = pathPart.endsWith('.md')
  if (!isMd) {
    const tailSeg = pathPart.split('/').filter(Boolean).pop() ?? ''
    if (REPO_FILES.has(tailSeg)) {
      return `${GITHUB_BASE}/${tailSeg}${tail}`
    }
    return href
  }

  pathPart = pathPart.replace(/\.md$/, '')

  // If the path starts with "/", treat as repo-absolute (e.g. /docs/foo).
  let segments: string[]
  if (pathPart.startsWith('/')) {
    // Strip leading "/" and any leading "docs/" prefix.
    const stripped = pathPart.replace(/^\/+/, '').replace(/^docs\/+/, '')
    segments = stripped.split('/').filter(Boolean)
  } else {
    // Relative path - resolve against the current doc's directory.
    const currentDir = currentSlug.includes('/')
      ? currentSlug.slice(0, currentSlug.lastIndexOf('/'))
      : ''
    const baseSegs = currentDir ? currentDir.split('/') : []
    const hrefSegs = pathPart.split('/')
    for (const seg of hrefSegs) {
      if (seg === '..') baseSegs.pop()
      else if (seg && seg !== '.') baseSegs.push(seg)
    }
    segments = baseSegs
  }

  const slug = segments.join('/')

  // Explicit redirect table covers hidden / never-written / renamed files.
  if (slug in REDIRECTS) {
    const target = REDIRECTS[slug]!
    return target.startsWith('http') || target.startsWith('#')
      ? `${target}${tail}`
      : `#/docs/${target}${tail}`
  }

  // Resolved to a real doc -> hash route.
  if (KNOWN_SLUGS.has(slug)) {
    return `#/docs/${slug}${tail}`
  }

  // Unknown .md target: instead of leaving a broken URL, link to the GitHub
  // source location. Worst case the user lands on a 404 on GitHub - at least
  // it is not an internal SPA crash.
  return `${GITHUB_BASE}/docs/${slug}.md${tail}`
}
