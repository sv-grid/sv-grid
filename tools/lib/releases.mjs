/**
 * Features that ship on a date, not when their code lands.
 *
 * The Gantt view's renderer is in the enterprise package, its demos are in
 * examples/, its docs are under docs/help/gantt, and all of it is on main
 * weeks before the day it is announced. Until that day the site must not
 * list, route, index or advertise any of it, and on that day it must, with
 * nobody editing anything: the website rebuilds every morning (the deploy
 * cron that also lets future-dated blog posts go live), and every consumer
 * of this module reads the calendar.
 *
 * One record per release. `docs` are slug prefixes hidden until the date;
 * `stubs` are the placeholder pages shown INSTEAD until then (a live URL
 * that says "in progress" beats a 404) and hidden from the date on, when
 * the entry in docs/_data/doc-moves.json sends them to the real page;
 * `demos` are registry ids kept out of the gallery, the search index, the
 * prerender and the MCP manifests until the date. A solution page carries
 * `release` and a `prerelease` override in docs/_data/solutions.json; see
 * `resolveSolution`.
 *
 * Dependency free, so Vite bundles it into the website and Node runs it from
 * a fresh clone.
 */

export const RELEASES = {
  gantt: {
    date: '2026-11-01',
    title: 'Gantt view',
    docs: ['help/gantt'],
    stubs: ['help/rows/gantt'],
    demos: [
      '474-gantt-intro',
      '475-gantt-editing',
      '476-gantt-critical-path',
      '477-gantt-resources',
      '478-gantt-four-views',
      '479-gantt-roadmap',
      '480-gantt-program',
      '481-gantt-portfolio-console',
    ],
  },
}

/**
 * Today as an ISO date, UTC: the same clock the blog gate and the deploy cron
 * use. `SVGRID_TODAY=2026-11-01 pnpm build` (Node) or a
 * `globalThis.__SVGRID_TODAY__` set before the app's modules load (the e2e
 * suite's init script) previews the site as it will read on that day.
 */
export const TODAY =
  globalThis.__SVGRID_TODAY__ ??
  globalThis.process?.env?.SVGRID_TODAY ??
  new Date().toISOString().slice(0, 10)

export function isReleased(id, today = TODAY) {
  const r = RELEASES[id]
  return !r || r.date <= today
}

/** Releases whose date has not arrived. */
export function pendingReleases(today = TODAY) {
  return Object.entries(RELEASES)
    .filter(([, r]) => r.date > today)
    .map(([id, r]) => ({ id, ...r }))
}

/** Demo ids nothing may list yet. */
export function pendingDemoIds(today = TODAY) {
  return new Set(pendingReleases(today).flatMap((r) => r.demos))
}

const underPrefix = (slug, prefix) => slug === prefix || slug.startsWith(prefix + '/')

/**
 * A doc page that must not be routed or indexed today: one under a pending
 * release's `docs`, or a stub whose release has arrived.
 */
export function isPendingDoc(slug, today = TODAY) {
  for (const r of Object.values(RELEASES)) {
    const pending = r.date > today
    if (pending && r.docs.some((p) => underPrefix(slug, p))) return true
    if (!pending && (r.stubs ?? []).some((p) => underPrefix(slug, p))) return true
  }
  return false
}

/**
 * A solution page entry as it should read today. The entry itself is the
 * released copy; `prerelease` holds the fields that differ until then. Both
 * bookkeeping keys are stripped either way.
 */
export function resolveSolution(entry, today = TODAY) {
  if (!entry || typeof entry !== 'object') return entry
  const { release, prerelease, ...rest } = entry
  if (release && !isReleased(release, today) && prerelease && typeof prerelease === 'object') {
    return { ...rest, ...prerelease }
  }
  return rest
}
