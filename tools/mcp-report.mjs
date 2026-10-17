#!/usr/bin/env node
// Usage report for the hosted MCP server (mcp.svgrid.com).
//
// Reads the `svgrid_mcp` Analytics Engine dataset that workers/svgrid-mcp
// writes one data point to per tool call (columns documented above `record`
// in workers/svgrid-mcp/src/index.ts), and prints a Markdown report:
//
//   - calls and errors per tool
//   - the most common searches
//   - searches no page matched in full: a feature we lack, or name differently
//   - paid features asked about (answers that carried the trial note)
//   - the most-read docs and demos
//   - the check_svgrid_code rules that fire most: the mistakes models make
//
// Only the hosted server reports anything; `npx @svgrid/mcp` sends nothing.
//
// Usage:
//   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... node tools/mcp-report.mjs [--days 7]
//   node tools/mcp-report.mjs --sql     # print the queries and exit
//
// The token needs "Account Analytics: Read". Counts are sums of
// _sample_interval, so they stay right if Analytics Engine starts sampling.

const DATASET = 'svgrid_mcp'

function parseArgs(argv) {
  const args = { days: 7, sql: false }
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--sql') args.sql = true
    else if (argv[i] === '--days') args.days = Number(argv[++i])
  }
  if (!Number.isInteger(args.days) || args.days < 1 || args.days > 90) {
    throw new Error('--days must be a whole number from 1 to 90 (the dataset keeps three months)')
  }
  return args
}

/** The report's queries, by section. */
export function queries(days) {
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`
  const n = 'SUM(_sample_interval)'
  return {
    tools: `SELECT blob1 AS tool, ${n} AS calls, SUM(_sample_interval * (1 - double2)) AS errors
      FROM ${DATASET} WHERE ${since} GROUP BY tool ORDER BY calls DESC`,
    searches: `SELECT blob2 AS query, ${n} AS calls
      FROM ${DATASET} WHERE ${since} AND blob1 = 'search' AND blob2 != ''
      GROUP BY query ORDER BY calls DESC LIMIT 25`,
    unanswered: `SELECT blob2 AS query, ${n} AS calls
      FROM ${DATASET} WHERE ${since} AND blob1 = 'search' AND double3 = 0 AND blob2 != ''
      GROUP BY query ORDER BY calls DESC LIMIT 25`,
    paid: `SELECT blob1 AS tool, blob2 AS query, blob3 AS id, ${n} AS calls
      FROM ${DATASET} WHERE ${since} AND blob5 = '1'
      GROUP BY tool, query, id ORDER BY calls DESC LIMIT 25`,
    reads: `SELECT blob3 AS id, ${n} AS calls
      FROM ${DATASET} WHERE ${since} AND blob3 != ''
      GROUP BY id ORDER BY calls DESC LIMIT 25`,
    rules: `SELECT blob4 AS rules, ${n} AS calls
      FROM ${DATASET} WHERE ${since} AND blob1 = 'check_svgrid_code' AND blob4 != ''
      GROUP BY rules ORDER BY calls DESC LIMIT 500`,
  }
}

async function runSql(sql) {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  const token = process.env.CLOUDFLARE_API_TOKEN
  if (!account || !token) {
    throw new Error('set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Account Analytics: Read)')
  }
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/analytics_engine/sql`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: `${sql} FORMAT JSON`,
  })
  const body = await res.text()
  if (!res.ok) throw new Error(`Analytics Engine SQL ${res.status}: ${body.slice(0, 500)}`)
  return JSON.parse(body).data ?? []
}

const num = (v) => Math.round(Number(v) || 0)

function table(headers, rows) {
  if (!rows.length) return '_None._\n'
  const esc = (v) => String(v).replace(/\|/g, '\\|').replace(/\s+/g, ' ')
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.map(esc).join(' | ')} |`),
    '',
  ].join('\n')
}

/** A check_svgrid_code row lists every rule that fired on one call; count each rule. */
export function countRules(rows) {
  const counts = new Map()
  for (const row of rows) {
    for (const rule of String(row.rules).split(',').filter(Boolean)) {
      counts.set(rule, (counts.get(rule) ?? 0) + num(row.calls))
    }
  }
  return [...counts].sort((a, b) => b[1] - a[1])
}

export function render(days, data) {
  const out = [`# Hosted MCP usage, last ${days} days`, '']
  out.push('## Calls per tool', '', table(['Tool', 'Calls', 'Errors'], data.tools.map((r) => [r.tool, num(r.calls), num(r.errors)])))
  out.push('## Top searches', '', table(['Query', 'Calls'], data.searches.map((r) => [r.query, num(r.calls)])))
  out.push(
    '## Searches nothing answered',
    '',
    'No page matched the whole query: a feature we lack, or one we name differently.',
    '',
    table(['Query', 'Calls'], data.unanswered.map((r) => [r.query, num(r.calls)])),
  )
  out.push(
    '## Paid features asked about',
    '',
    'Answers that carried the Enterprise trial note.',
    '',
    table(['Tool', 'Query or id', 'Calls'], data.paid.map((r) => [r.tool, r.query || r.id, num(r.calls)])),
  )
  out.push('## Most-read docs and demos', '', table(['Id', 'Calls'], data.reads.map((r) => [r.id, num(r.calls)])))
  out.push('## Check rules that fired', '', table(['Rule', 'Calls'], countRules(data.rules).slice(0, 25)))
  return out.join('\n')
}

async function main() {
  const args = parseArgs(process.argv)
  const sql = queries(args.days)
  if (args.sql) {
    for (const [name, q] of Object.entries(sql)) console.log(`-- ${name}\n${q};\n`)
    return
  }
  const data = {}
  for (const [name, q] of Object.entries(sql)) data[name] = await runSql(q)
  console.log(render(args.days, data))
}

// Run as a script, not when a test imports the helpers.
if (process.argv[1]?.endsWith('mcp-report.mjs')) {
  main().catch((err) => {
    console.error(`mcp-report: ${err.message}`)
    process.exit(1)
  })
}
