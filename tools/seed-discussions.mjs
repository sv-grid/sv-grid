// Seed GitHub Discussions from the SvGrid public roadmap (one discussion per
// planned item). Useful to bootstrap the Community page with real content the
// community can read, upvote, and comment on.
//
// SAFE BY DEFAULT:
//   - Dry-run unless you pass --create (prints exactly what it WOULD post).
//   - Idempotent: skips any item whose title already exists as a discussion.
//   - Capped with --limit (default 15) so you control how many get created.
//
// You run this with YOUR token (the discussions are authored by that account):
//   - A classic PAT with `repo` + `write:discussion`, or a fine-grained PAT
//     with Discussions: Read and write on sv-grid/sv-grid.
//   - Or `gh auth token` (if your gh login has discussion write scope).
//
//   GITHUB_TOKEN=ghp_xxx node tools/seed-discussions.mjs                 # dry-run
//   GITHUB_TOKEN=ghp_xxx node tools/seed-discussions.mjs --create        # post them
//   GITHUB_TOKEN=ghp_xxx node tools/seed-discussions.mjs --category=Ideas --limit=20 --create
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'sv-grid/sv-grid'
const [OWNER, NAME] = REPO.split('/')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

// --- args ---
const args = process.argv.slice(2)
const flag = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const DO_CREATE = args.includes('--create')
const CATEGORY = flag('category', 'Ideas')
const LIMIT = Number(flag('limit', '15'))
const SOURCE = flag('source', 'planned') // 'planned' | 'shipped'
const EFFORT_LABEL = { S: 'Small', M: 'Medium', L: 'Large' }

const unesc = (s) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\')

/** Parse the roadmap items straight from Roadmap.svelte (single source of truth). */
async function parseRoadmap(which) {
  const src = await readFile(resolve(ROOT, 'website/src/routes/Roadmap.svelte'), 'utf-8')
  if (which === 'shipped') {
    const start = src.indexOf('const shipped')
    const block = src.slice(start)
    const re = /\{\s*title:\s*'((?:\\.|[^'\\])*)'(?:\s*,\s*demo:\s*'((?:\\.|[^'\\])*)')?\s*\}/g
    const out = []
    let m
    while ((m = re.exec(block))) out.push({ area: 'Shipped', title: unesc(m[1]), demo: m[2] ? unesc(m[2]) : undefined })
    return out
  }
  // planned: assign each item to its nearest preceding `area:`.
  const start = src.indexOf('const planned')
  const end = src.indexOf('const shipped', start)
  const block = src.slice(start, end > -1 ? end : undefined)
  const areas = []
  let m
  const areaRe = /area:\s*'((?:\\.|[^'\\])*)'/g
  while ((m = areaRe.exec(block))) areas.push({ area: unesc(m[1]), at: m.index })
  const itemRe = /\{\s*title:\s*'((?:\\.|[^'\\])*)'\s*,\s*effort:\s*'([SML])'\s*(?:,\s*note:\s*'((?:\\.|[^'\\])*)')?\s*\}/g
  const out = []
  while ((m = itemRe.exec(block))) {
    let area = ''
    for (const a of areas) { if (a.at < m.index) area = a.area; else break }
    out.push({ area, title: unesc(m[1]), effort: m[2], note: m[3] ? unesc(m[3]) : undefined })
  }
  return out
}

function bodyFor(it) {
  let b = `**Area:** ${it.area}`
  if (it.effort) b += `  ·  **Effort:** ${EFFORT_LABEL[it.effort] ?? it.effort}`
  b += '\n'
  if (it.note) b += `\n${it.note}\n`
  if (it.demo) b += `\nShipped - see demo \`${it.demo}\`: https://svgrid.com/demos/${it.demo}\n`
  b += `\nImported from the [SvGrid public roadmap](https://svgrid.com/roadmap) so the community can discuss and track it. React with 👍 if you want this prioritised.`
  return b
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'svgrid-seed-discussions',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors) {
    throw new Error(`GraphQL ${res.status}: ${JSON.stringify(json.errors ?? (await res.text()))}`)
  }
  return json.data
}

async function main() {
  if (!TOKEN) {
    console.error('Missing GITHUB_TOKEN (PAT with discussion write, or `gh auth token`).')
    process.exit(1)
  }
  // Repo id + categories + existing titles (for idempotency).
  const setup = await gql(
    `query($owner:String!,$name:String!){repository(owner:$owner,name:$name){
        id
        discussionCategories(first:25){nodes{id name}}
        discussions(first:100){nodes{title}}
      }}`,
    { owner: OWNER, name: NAME },
  )
  const repo = setup.repository
  const cat = repo.discussionCategories.nodes.find(
    (c) => c.name.toLowerCase() === CATEGORY.toLowerCase(),
  )
  if (!cat) {
    console.error(
      `Category "${CATEGORY}" not found. Available: ${repo.discussionCategories.nodes.map((c) => c.name).join(', ')}`,
    )
    process.exit(1)
  }
  const existing = new Set(repo.discussions.nodes.map((d) => d.title.trim().toLowerCase()))

  const items = (await parseRoadmap(SOURCE)).filter(
    (it) => !existing.has(it.title.trim().toLowerCase()),
  )
  const toCreate = items.slice(0, Math.max(0, LIMIT))

  console.log(
    `Repo ${REPO} | category "${cat.name}" | source ${SOURCE} | ` +
      `${toCreate.length} to create (of ${items.length} new, limit ${LIMIT}) | ` +
      `${DO_CREATE ? 'CREATING' : 'DRY-RUN (pass --create to post)'}`,
  )
  if (!toCreate.length) {
    console.log('Nothing to do - everything already exists or limit is 0.')
    return
  }

  for (const [i, it] of toCreate.entries()) {
    if (!DO_CREATE) {
      console.log(`  [dry] ${i + 1}. ${it.title}  (${it.area}${it.effort ? '/' + it.effort : ''})`)
      continue
    }
    try {
      const data = await gql(
        `mutation($repoId:ID!,$catId:ID!,$title:String!,$body:String!){
            createDiscussion(input:{repositoryId:$repoId,categoryId:$catId,title:$title,body:$body}){
              discussion{ number url }
            }}`,
        { repoId: repo.id, catId: cat.id, title: it.title, body: bodyFor(it) },
      )
      const d = data.createDiscussion.discussion
      console.log(`  ✓ #${d.number} ${it.title}  ->  ${d.url}`)
    } catch (err) {
      console.error(`  ✗ failed: ${it.title}\n    ${err.message}`)
    }
    // Gentle pacing so a burst of mutations stays well under rate limits.
    await new Promise((r) => setTimeout(r, 700))
  }
  console.log('Done.')
}

main()
