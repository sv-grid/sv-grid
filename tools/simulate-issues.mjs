// Post a set of issue drafts to GitHub, each from a different account.
//
// GitHub stamps an issue with whoever owns the token, so "post as peter_stoev"
// means "hold a PAT for peter_stoev". This script routes one draft to one
// token, and refuses to post unless the token's real login matches the author
// the draft claims - otherwise a wrong env var quietly files everything from a
// single account and you only find out by reading the tracker.
//
// Drafts live in a directory as .md files with a leading header block:
//
//   <!--
//     author: peter_stoev
//     title: Row virtualization drops the last row at 200% zoom
//     labels: bug
//     version: @svgrid/grid 2.2.18
//     package: @svgrid/grid
//     environment: Svelte 5.55.9, Vite 8, Chrome 141, Windows 11
//   -->
//   ## What happened
//   ...
//   ## Reproduction
//   ...
//
// The `## ...` sections are rewritten into the `### <label>` shape GitHub
// itself produces from an issue form, and every field the form marks required
// must be present, so a posted draft matches what the form would have made.
//
// Tokens come from GH_TOKEN_<AUTHOR>, upper-snake: GH_TOKEN_PETER_STOEV,
// GH_TOKEN_JQWIDGETS, GH_TOKEN_BMARKOV. There is deliberately no fallback to
// GITHUB_TOKEN - a missing token is an error, never a silent reattribution.
//
//   node tools/simulate-issues.mjs --dir drafts/issues            # dry run
//   node tools/simulate-issues.mjs --dir drafts/issues --repo me/sandbox --create
import { readFile, readdir } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC_REPO = 'sv-grid/sv-grid'
const FORM = resolve(ROOT, '.github/ISSUE_TEMPLATE/bug_report.yml')

const args = process.argv.slice(2)
const flag = (k, d) => {
  const i = args.indexOf(`--${k}`)
  return i >= 0 ? args[i + 1] : d
}
const DIR = resolve(ROOT, flag('dir', 'drafts/issues'))
const REPO = flag('repo', process.env.GITHUB_REPO ?? PUBLIC_REPO)
const CREATE = args.includes('--create')
const YES_PUBLIC = args.includes('--yes-public')

function fail(msg) {
  console.error(`x ${msg}`)
  process.exit(1)
}

/** Header labels of every required field in the bug-report form, in order. */
async function requiredFields() {
  const src = await readFile(FORM, 'utf8')
  const out = []
  // Each field is a `- type:` block; keep the ones whose block sets
  // `required: true`, so this stays in step with the template as it changes.
  for (const block of src.split(/\n {2}- type:/).slice(1)) {
    if (!/required:\s*true/.test(block)) continue
    const label = block.match(/\n\s*label:\s*(.+)/)?.[1]?.trim()
    if (label) out.push(label)
  }
  if (!out.length) fail(`parsed no required fields out of ${FORM}`)
  return out
}

/** Parse the leading `<!-- key: value -->` header, mirroring the demo files. */
function parseDraft(src, file) {
  const block = src.match(/^\s*<!--([\s\S]*?)-->/)
  if (!block) fail(`${file}: missing the leading <!-- ... --> header`)
  const meta = {}
  for (const line of block[1].split('\n')) {
    const m = line.match(/^\s*([a-z]+):\s*(.*)$/)
    if (m) meta[m[1]] = m[2].trim()
  }
  const sections = {}
  for (const part of src.slice(block[0].length).split(/^##\s+/m).slice(1)) {
    const nl = part.indexOf('\n')
    const heading = (nl === -1 ? part : part.slice(0, nl)).trim()
    sections[heading.toLowerCase()] = (nl === -1 ? '' : part.slice(nl + 1)).trim()
  }
  return { meta, sections }
}

/** Render a draft into the markdown GitHub emits for an issue-form submission. */
function renderBody({ meta, sections }, fields) {
  const value = (label) => {
    const key = label.toLowerCase()
    // Short single-line answers live in the header; prose lives in sections.
    if (key === 'package version') return meta.version
    if (key === 'which package') return meta.package
    if (key === 'environment') return meta.environment ?? sections[key]
    return sections[key]
  }
  const parts = []
  const missing = []
  for (const label of fields) {
    const v = value(label)
    if (v) parts.push(`### ${label}\n\n${v}`)
    else missing.push(label)
  }
  return { body: parts.join('\n\n'), missing }
}

const tokenVar = (author) => `GH_TOKEN_${author.toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`

const headers = (token, extra) => ({
  Authorization: `bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'svgrid-issue-sim',
  ...extra,
})

async function whoami(token) {
  const res = await fetch('https://api.github.com/user', { headers: headers(token) })
  if (!res.ok) return { error: `GET /user -> ${res.status}` }
  const json = await res.json()
  return { login: json.login }
}

async function post(token, title, body, labels) {
  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: headers(token, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ title, body, labels }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) fail(`POST issue as this account -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function main() {
  if (CREATE && REPO === PUBLIC_REPO && !YES_PUBLIC)
    fail(
      `refusing to post to the public ${PUBLIC_REPO} tracker without --yes-public.\n` +
        `  Pass --repo owner/sandbox to rehearse somewhere private instead.`,
    )

  const fields = await requiredFields()
  const files = (await readdir(DIR).catch(() => fail(`no draft directory at ${DIR}`)))
    .filter((f) => f.endsWith('.md'))
    .sort()
  if (!files.length) fail(`no .md drafts in ${DIR}`)

  const drafts = []
  for (const file of files) {
    const draft = parseDraft(await readFile(join(DIR, file), 'utf8'), file)
    if (!draft.meta.author) fail(`${file}: header needs an author`)
    if (!draft.meta.title) fail(`${file}: header needs a title`)
    const { body, missing } = renderBody(draft, fields)
    if (missing.length) fail(`${file}: missing required field(s): ${missing.join(', ')}`)
    drafts.push({
      file,
      author: draft.meta.author,
      title: draft.meta.title,
      labels: (draft.meta.labels ?? 'bug').split(',').map((s) => s.trim()).filter(Boolean),
      body,
    })
  }

  console.log(`${drafts.length} draft(s) -> ${REPO}${CREATE ? '' : '  (dry run)'}\n`)

  // Resolve and verify every token BEFORE posting anything, so a bad env var
  // fails the run clean rather than half way through.
  const tokens = new Map()
  if (CREATE) {
    for (const d of drafts) {
      if (tokens.has(d.author)) continue
      const v = tokenVar(d.author)
      const token = process.env[v]
      if (!token) fail(`no token for "${d.author}" - set ${v}`)
      const { login, error } = await whoami(token)
      if (error) fail(`${v} rejected by GitHub: ${error}`)
      if (login.toLowerCase() !== d.author.toLowerCase())
        fail(`${v} belongs to "${login}", not "${d.author}" - refusing to post under the wrong name`)
      console.log(`ok ${v} verified as ${login}`)
      tokens.set(d.author, token)
    }
    console.log('')
  }

  for (const d of drafts) {
    if (!CREATE) {
      const have = process.env[tokenVar(d.author)] ? 'token set' : `NO ${tokenVar(d.author)}`
      console.log(`-- ${d.file}  [@${d.author}, ${have}]`)
      console.log(`   ${d.title}   ${d.labels.map((l) => `#${l}`).join(' ')}`)
      console.log(d.body.split('\n').map((l) => `   | ${l}`).join('\n'))
      console.log('')
      continue
    }
    const issue = await post(tokens.get(d.author), d.title, d.body, d.labels)
    console.log(`ok @${d.author} filed #${issue.number}: ${issue.html_url}`)
  }

  if (!CREATE) console.log('Nothing posted. Re-run with --create (and --repo) to file these.')
}

main()
