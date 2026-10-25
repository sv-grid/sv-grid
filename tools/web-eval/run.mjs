#!/usr/bin/env node
/**
 * Score svgrid.com for an agent that can only fetch it: no MCP server, no
 * repository, no search engine. The companion of tools/mcp-eval, for the
 * other way an assistant learns SvGrid.
 *
 * The agent is simulated, so the score is deterministic and costs nothing. It
 * starts at /llms.txt, as assistants that know the convention do, and reads
 * each response the way their fetch tools do: HTML turned into text, the text
 * cut at FETCH_LIMIT characters. On every page it follows the FOLLOW links
 * whose surrounding words best match the task, to MAX_DEPTH hops. A task passes
 * when the agent reaches one of its targets and the text it read there holds
 * every string the task needs (an API name, a line of a demo's source).
 *
 * What it can catch: a page past the cut of an oversized index, a demo whose
 * source an agent cannot read, an endpoint that is not linked from anywhere an
 * agent starts. What it cannot: whether a model would pick these links. A
 * model-in-the-loop run measures that and is a separate decision.
 *
 *   node tools/web-eval/run.mjs                      the live site
 *   node tools/web-eval/run.mjs --dist website/dist  a local build
 *   node tools/web-eval/run.mjs --check              fail if worse than the baseline
 *   node tools/web-eval/run.mjs --save               write the scores as the baseline
 *   node tools/web-eval/run.mjs --verbose            print each task's path
 */
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const BASELINE = join(HERE, 'baseline.json')
const SITE = 'https://svgrid.com'
const FETCH_LIMIT = 100_000
const FOLLOW = 3
const MAX_DEPTH = 3
const START = ['/llms.txt']

const args = process.argv.slice(2)
const flag = (name) => args.includes(name)
const distArg = args.includes('--dist') ? args[args.indexOf('--dist') + 1] : null
const DIST = distArg ? join(process.cwd(), distArg) : null
const PUBLIC = join(ROOT, 'website', 'public')

// ---- fetching ----------------------------------------------------------------

const cache = new Map()

/** The file a static host serves for a path: the path itself, or its index.html. */
function localFile(path) {
  for (const base of [DIST, PUBLIC]) {
    if (!base) continue
    const file = join(base, ...decodeURIComponent(path).split('/'))
    for (const candidate of [file, join(file, 'index.html')]) {
      if (existsSync(candidate) && statSync(candidate).isFile()) return candidate
    }
  }
  return null
}

/** What an agent's fetch tool hands back for a path: text, cut at FETCH_LIMIT; null on a 404. */
async function fetchPage(path) {
  if (cache.has(path)) return cache.get(path)
  let raw = null
  let type = ''
  if (DIST) {
    const file = localFile(path)
    if (file) {
      raw = readFileSync(file, 'utf8')
      type = file.endsWith('.html') ? 'text/html' : ''
    }
  } else {
    const res = await fetch(SITE + path, { redirect: 'follow' })
    if (res.ok) {
      raw = await res.text()
      type = res.headers.get('content-type') ?? ''
    }
  }
  const page = raw === null ? null : read(raw, type.includes('html') || /^\s*<!doctype html/i.test(raw))
  cache.set(path, page)
  return page
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

/** The text and links of a response, as a fetch tool that converts HTML would give them. */
function read(raw, html) {
  const links = []
  let text
  if (html) {
    const body = raw.replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    // Head links count: the markdown alternate is an <link rel=alternate> an agent can follow.
    for (const m of body.matchAll(/<link\b[^>]*rel="alternate"[^>]*>/gi)) {
      const href = /href="([^"]+)"/.exec(m[0])?.[1]
      const title = /title="([^"]*)"/.exec(m[0])?.[1] ?? ''
      if (href) links.push({ href, context: `alternate ${title}` })
    }
    for (const m of body.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = strip(m[2])
      links.push({ href: m[1], title, context: title })
    }
    text = strip(body)
  } else {
    text = raw
    for (const line of raw.split('\n')) {
      for (const m of line.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)|(https?:\/\/[^\s)<>"'`]+)/g)) links.push({ href: m[2] ?? m[3], title: m[1] ?? '', context: line })
    }
  }
  text = text.slice(0, FETCH_LIMIT)
  // Links past the cut were never seen.
  const seen = links.filter((l) => !html || text.includes(l.context.slice(0, 40)) || l.context.startsWith('alternate'))
  return { text, links: html ? seen : links.filter((l) => text.includes(l.href)) }
}

function strip(html) {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#?\w+);/g, (m, e) => ENTITIES[e] ?? (e.startsWith('#') ? String.fromCharCode(Number(e.slice(1))) : m))
    .replace(/\s+/g, ' ')
    .trim()
}

/** A site path for a link, or null when it leaves the site. */
function pathOf(href) {
  let url
  try {
    url = new URL(href, SITE + '/')
  } catch {
    return null
  }
  if (url.origin !== SITE) return null
  return url.pathname
}

/** A docs page or demo counts once, as HTML or as its markdown twin. */
const sameTarget = (path, target) => {
  const norm = (p) => p.replace(/\.md$/, '/').replace(/\/index\.html$/, '/').replace(/\/?$/, '/')
  return norm(path) === norm(target)
}

// ---- the agent ---------------------------------------------------------------

const STOP = new Set('a an and are can do does for how i in is it of on or the to with my me add use using what show'.split(' '))
// Plural and singular match: an ask for "cells" finds the "cell" page.
const words = (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 1 && !STOP.has(w)).map((w) => (w.length > 3 ? w.replace(/s$/, '') : w))

function rank(links, query, visited) {
  const want = words(query)
  const scored = []
  const seen = new Set()
  links.forEach((l, i) => {
    const path = pathOf(l.href)
    if (!path || visited.has(path) || seen.has(path)) return
    seen.add(path)
    // A word in the link's own title counts twice: agents pick by the title,
    // and the description around it breaks ties.
    const inTitle = new Set(words(`${l.title ?? ''} ${path}`))
    const have = new Set(words(l.context))
    const score = want.reduce((n, w) => n + (inTitle.has(w) ? 2 : have.has(w) ? 1 : 0), 0)
    if (score > 0) scored.push({ path, score, i })
  })
  return scored.sort((a, b) => b.score - a.score || a.i - b.i).slice(0, FOLLOW)
}

async function runTask(task) {
  const visited = new Set()
  let frontier = START.map((path) => ({ path, via: [] }))
  let fetches = 0
  let bytes = 0
  let reached = null
  for (let depth = 0; depth <= MAX_DEPTH && frontier.length && !reached; depth++) {
    const next = []
    for (const { path, via } of frontier) {
      if (visited.has(path)) continue
      visited.add(path)
      const page = await fetchPage(path)
      fetches++
      if (!page) continue
      bytes += page.text.length
      const route = [...via, path]
      if (task.targets.some((t) => sameTarget(path, t))) {
        const missing = (task.mustContain ?? []).filter((s) => !page.text.includes(s))
        if (!missing.length) {
          reached = { path, route }
          break
        }
      }
      if (depth < MAX_DEPTH) for (const l of rank(page.links, task.query, visited)) next.push({ path: l.path, via: route })
    }
    frontier = next
  }
  return { id: task.id, band: task.band, pass: !!reached, route: reached?.route ?? null, fetches, bytes }
}

// ---- endpoint checks -------------------------------------------------------------

/** Machine endpoints an agent looks for by name, not by following links. */
async function runEndpoint(task) {
  const page = await fetchPage(task.path)
  const missing = page ? (task.mustContain ?? []).filter((s) => !page.text.includes(s)) : ['(404)']
  return { id: task.id, band: task.band, pass: missing.length === 0, route: [task.path], fetches: 1, bytes: page?.text.length ?? 0, missing }
}

// ---- report ------------------------------------------------------------------------

const { tasks } = JSON.parse(readFileSync(join(HERE, 'tasks.json'), 'utf8'))
const results = []
for (const task of tasks) results.push(task.band === 'endpoint' ? await runEndpoint(task) : await runTask(task))

const byBand = {}
for (const r of results) {
  byBand[r.band] ??= { pass: 0, total: 0 }
  byBand[r.band].total++
  if (r.pass) byBand[r.band].pass++
}
const summary = {
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  byBand,
  fetches: results.reduce((n, r) => n + r.fetches, 0),
  bytes: results.reduce((n, r) => n + r.bytes, 0),
}

console.log(`web-eval (${DIST ? distArg : SITE}): ${summary.passed}/${summary.total} passed, ${summary.fetches} fetches, ${Math.round(summary.bytes / 1024)} KB read`)
for (const [band, b] of Object.entries(byBand)) console.log(`  ${band.padEnd(10)} ${b.pass}/${b.total}`)
for (const r of results) {
  if (!r.pass) console.log(`  FAIL ${r.id}${r.missing ? ` - missing ${r.missing.join(', ')}` : ''}`)
  else if (flag('--verbose')) console.log(`  ok   ${r.id}: ${r.route.join(' -> ')}`)
}

if (flag('--save')) {
  writeFileSync(BASELINE, JSON.stringify({ ...summary, failing: results.filter((r) => !r.pass).map((r) => r.id) }, null, 2) + '\n')
  console.log(`saved ${BASELINE}`)
}
if (flag('--check')) {
  if (!existsSync(BASELINE)) {
    console.error('web-eval: no baseline yet; run with --save')
    process.exit(1)
  }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'))
  const regressed = results.filter((r) => !r.pass && !base.failing.includes(r.id)).map((r) => r.id)
  if (regressed.length) {
    console.error(`web-eval: newly failing: ${regressed.join(', ')}`)
    process.exit(1)
  }
}
