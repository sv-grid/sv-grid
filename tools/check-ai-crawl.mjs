#!/usr/bin/env node
/**
 * Does the LIVE robots.txt let the AI crawlers in?
 *
 * The repo's website/public/robots.txt welcomes every AI / LLM crawler, but the
 * file the internet sees is not that file: Cloudflare sits in front of GitHub
 * Pages and, with its "manage AI bots" / managed robots.txt setting on,
 * prepends a block that says `Disallow: /` for GPTBot, ClaudeBot, CCBot,
 * Google-Extended, Amazonbot, Applebot-Extended, Bytespider and
 * meta-externalagent, plus `Content-Signal: ai-train=no`. Found 2026-09-15;
 * nobody had turned it on knowingly. The setting lives in the Cloudflare
 * dashboard (Security > Bots, or AI Crawl Control), not in this repo, so this
 * script is how you check it after changing it, and what to run when the
 * AI-visibility numbers look wrong.
 *
 *   node tools/check-ai-crawl.mjs                 # https://svgrid.com
 *   node tools/check-ai-crawl.mjs https://host    # another origin
 *
 * Exit code 1 when any crawler on the list is disallowed, or gets both an
 * allow and a disallow for "/" (RFC 9309 says allow wins the tie, but not
 * every crawler's parser reads it that way, so a tie is not "fixed").
 */

const ORIGIN = (process.argv[2] ?? 'https://svgrid.com').replace(/\/$/, '')

// Training / index crawlers and the search-time agents, by the user-agent
// token each one honours in robots.txt.
const CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Googlebot', 'Bingbot',
  'CCBot', 'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'Bytespider',
]

/** Parse robots.txt into { agent (lower-case) -> rules[] }, merging groups for
 *  the same agent the way RFC 9309 section 2.2.1 says a crawler must. */
function parse(text) {
  const groups = new Map()
  let current = []
  let sawRule = false
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].toLowerCase()
    const value = m[2].trim()
    if (key === 'user-agent') {
      // A user-agent line after rules starts a new group; consecutive
      // user-agent lines share one.
      if (sawRule) { current = []; sawRule = false }
      const agent = value.toLowerCase()
      if (!groups.has(agent)) groups.set(agent, [])
      current.push(groups.get(agent))
    } else if (key === 'allow' || key === 'disallow') {
      sawRule = true
      for (const rules of current) rules.push({ type: key, path: value })
    } else if (key === 'content-signal') {
      sawRule = true
      for (const rules of current) rules.push({ type: 'content-signal', path: value })
    }
  }
  return groups
}

/** RFC 9309: the most specific (longest) matching rule wins; on a tie the
 *  least restrictive (allow) wins. Only "/" matters here. */
function verdict(rules) {
  const root = rules.filter((r) => (r.type === 'allow' || r.type === 'disallow') && r.path !== '')
  if (!root.length) return 'allowed (no rules)'
  const longest = Math.max(...root.map((r) => r.path.length))
  const top = root.filter((r) => r.path.length === longest)
  if (top.some((r) => r.type === 'allow')) {
    return top.some((r) => r.type === 'disallow') ? 'AMBIGUOUS (allow + disallow tie for "/")' : 'allowed'
  }
  return 'BLOCKED'
}

const url = `${ORIGIN}/robots.txt`
const res = await fetch(url, { headers: { 'user-agent': 'svgrid-check-ai-crawl/1.0' } })
if (!res.ok) {
  console.error(`${url} -> HTTP ${res.status}`)
  process.exit(1)
}
const text = await res.text()
const groups = parse(text)
const star = groups.get('*') ?? []

let blocked = 0
let ambiguous = 0
console.log(`${url}\n`)
for (const name of CRAWLERS) {
  const own = groups.get(name.toLowerCase())
  const rules = own ?? star
  const v = verdict(rules)
  if (v.startsWith('BLOCKED')) blocked += 1
  if (v.startsWith('AMBIGUOUS')) ambiguous += 1
  console.log(`  ${name.padEnd(20)} ${v}${own ? '' : '  (falls back to *)'}`)
}
const signals = [...groups.entries()].flatMap(([agent, rules]) => rules.filter((r) => r.type === 'content-signal').map((r) => `${agent}: ${r.path}`))
if (signals.length) console.log(`\n  Content-Signal: ${signals.join('; ')}`)
if (/BEGIN Cloudflare Managed/i.test(text)) {
  console.log('\n  A Cloudflare managed block is prepended to the file the repo ships.')
}
if (blocked || ambiguous) {
  console.log(`\n${blocked} crawler(s) blocked, ${ambiguous} ambiguous. Fix it in the Cloudflare dashboard, not here.`)
  // exitCode, not process.exit(): exiting straight after fetch trips a libuv
  // assertion on Windows.
  process.exitCode = 1
} else {
  console.log('\nEvery AI crawler is allowed.')
}
