#!/usr/bin/env node
/**
 * Weekly scorecard. GitHub stars are the north star for the popularity goal, and
 * nothing was recording them over time, so a flat week looked the same as a good
 * one.
 *
 * It also reports an honest adoption figure. Total npm downloads are NOT that
 * figure: on 2026-08-29 `@svgrid/grid` showed ~19,200/month while the
 * per-version breakdown was plainly mirrors and scanners refetching every
 * release - ancient 1.0.2 alone took 30.8% of the week, and 66 versions each
 * received a near-identical ~180. Real users concentrate on `latest`, so
 * `latestShare` (downloads of the current latest / total) is the number that
 * moves when adoption is real. Today it is around 4 percent.
 *
 * Usage:
 *   node tools/scorecard.mjs            # append a dated section to marketing/scorecard.md
 *   node tools/scorecard.mjs --print    # print only, write nothing
 */
import { appendFile, readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'marketing', 'scorecard.md')
const PRINT_ONLY = process.argv.includes('--print')

// The comparison set for "most-starred Svelte data grid". SVAR is deliberately
// absent: it ships one repo per widget (the largest, calendar, is ~54 stars), so
// there is no single grid repo to compare against.
const REPOS = [
  ['sv-grid/sv-grid', 'SvGrid (us)'],
  ['vincjo/datatables', 'vincjo/datatables'],
  ['bryanmylee/svelte-headless-table', 'svelte-headless-table'],
]

const PACKAGES = [
  '@svgrid/grid',
  '@svgrid/enterprise',
  '@svgrid/mcp',
  '@svgrid/create',
  '@svgrid/studio',
]

const UA = { 'User-Agent': 'svgrid-scorecard', Accept: 'application/vnd.github+json' }

async function getJson(url, headers = {}) {
  try {
    const res = await fetch(url, { headers })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

async function repoStats() {
  const rows = []
  for (const [repo, label] of REPOS) {
    const j = await getJson(`https://api.github.com/repos/${repo}`, UA)
    rows.push(
      j
        ? {
            label,
            repo,
            stars: j.stargazers_count,
            forks: j.forks_count,
            watchers: j.subscribers_count,
            issues: j.open_issues_count,
          }
        : { label, repo, stars: null },
    )
  }
  return rows
}

/**
 * Downloads for a package, plus the share landing on the current `latest`.
 * A low share means the total is mirror traffic rather than adoption.
 */
async function npmStats(name) {
  const enc = name.replace('/', '%2F')
  const [month, perVersion, packument] = await Promise.all([
    getJson(`https://api.npmjs.org/downloads/point/last-month/${enc}`),
    getJson(`https://api.npmjs.org/versions/${enc}/last-week`),
    getJson(`https://registry.npmjs.org/${enc}`),
  ])
  const latest = packument?.['dist-tags']?.latest ?? null
  const versionCount = packument?.versions ? Object.keys(packument.versions).length : null

  let latestShare = null
  let recentShare = null
  let topVersion = null
  let weekTotal = null
  if (perVersion?.downloads) {
    const entries = Object.entries(perVersion.downloads)
    weekTotal = entries.reduce((sum, [, n]) => sum + n, 0)
    const sorted = [...entries].sort((a, b) => b[1] - a[1])
    topVersion = sorted[0] ? { version: sorted[0][0], downloads: sorted[0][1] } : null
    if (weekTotal > 0 && latest) {
      latestShare = (perVersion.downloads[latest] ?? 0) / weekTotal
      // `latest` alone is misleading while a package publishes often: a version
      // hours old has had no time to be installed, so its weekly share reads ~0
      // however healthy the package is. The newest handful of releases is the
      // stable version of the same signal.
      const newest = entries
        .map(([v]) => v)
        .sort(compareSemver)
        .slice(-5)
      recentShare = newest.reduce((sum, v) => sum + (perVersion.downloads[v] ?? 0), 0) / weekTotal
    }
  }
  return {
    name,
    latest,
    versionCount,
    month: month?.downloads ?? null,
    weekTotal,
    latestShare,
    recentShare,
    topVersion,
  }
}

/** Ascending semver-ish compare; prereleases and odd tags sort as lowest. */
function compareSemver(a, b) {
  const parse = (v) => (v.match(/^(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1, 4).map(Number)
  const [am, an, ap] = parse(a)
  const [bm, bn, bp] = parse(b)
  if (am == null) return bm == null ? a.localeCompare(b) : -1
  if (bm == null) return 1
  return am - bm || an - bn || ap - bp
}

const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`)
const num = (v) => (v == null ? 'n/a' : v.toLocaleString('en-US'))

async function main() {
  const [repos, packages] = await Promise.all([
    repoStats(),
    Promise.all(PACKAGES.map(npmStats)),
  ])

  const today = new Date().toISOString().slice(0, 10)
  const us = repos.find((r) => r.repo === 'sv-grid/sv-grid')
  const leader = repos
    .filter((r) => r.repo !== 'sv-grid/sv-grid' && r.stars != null)
    .sort((a, b) => b.stars - a.stars)[0]
  const gap = us?.stars != null && leader ? leader.stars - us.stars : null

  const lines = []
  lines.push(`## ${today}`)
  lines.push('')
  if (gap != null) {
    lines.push(
      gap > 0
        ? `**${gap} stars behind ${leader.label}** (${num(us.stars)} vs ${num(leader.stars)}).`
        : `**Most-starred of the tracked set** (${num(us.stars)}).`,
    )
    lines.push('')
  }

  lines.push('### Stars')
  lines.push('')
  lines.push('| Repo | Stars | Forks | Watchers | Open issues |')
  lines.push('| --- | ---: | ---: | ---: | ---: |')
  for (const r of repos) {
    lines.push(
      r.stars == null
        ? `| ${r.label} | n/a | n/a | n/a | n/a |`
        : `| ${r.label} | ${num(r.stars)} | ${num(r.forks)} | ${num(r.watchers)} | ${num(r.issues)} |`,
    )
  }
  lines.push('')

  lines.push('### npm')
  lines.push('')
  lines.push('`recentShare` is the adoption signal to watch: the share of last week\'s')
  lines.push('installs landing on the five newest releases. Monthly totals include mirror and')
  lines.push('scanner traffic that refetches every published version, so they overstate reach.')
  lines.push('`latestShare` reads near zero whenever the newest release is only hours old.')
  lines.push('')
  lines.push('| Package | latest | Versions | Month (inflated) | recentShare | latestShare |')
  lines.push('| --- | --- | ---: | ---: | ---: | ---: |')
  for (const p of packages) {
    lines.push(
      `| \`${p.name}\` | ${p.latest ?? 'n/a'} | ${num(p.versionCount)} | ${num(p.month)} | ${pct(p.recentShare)} | ${pct(p.latestShare)} |`,
    )
  }
  lines.push('')

  const grid = packages.find((p) => p.name === '@svgrid/grid')
  if (grid?.topVersion && grid.topVersion.version !== grid.latest) {
    lines.push(
      `> Most-downloaded version last week was \`${grid.topVersion.version}\` ` +
        `(${num(grid.topVersion.downloads)} of ${num(grid.weekTotal)}), not \`${grid.latest}\`. ` +
        'A version nobody would deliberately install topping the list means the total is bot traffic.',
    )
    lines.push('')
  }

  const body = lines.join('\n') + '\n'
  process.stdout.write(body)

  if (PRINT_ONLY) return
  await mkdir(dirname(OUT), { recursive: true })
  // Newest last, so the file reads as a running log.
  const header = existsSync(OUT)
    ? ''
    : '# SvGrid scorecard\n\nAppended by `node tools/scorecard.mjs`. Newest section last.\nDo not edit past numbers; add a new run instead.\n\n'
  await appendFile(OUT, header + body + '\n', 'utf8')
  process.stderr.write(`\nAppended to ${OUT}\n`)
}

await main()
