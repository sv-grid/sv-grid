// Seed one GitHub Discussion per community demo, so each demo has a thread the
// community can 👍 (that reaction count is the demo's "star" on the site) and
// comment on. Mirrors tools/seed-discussions.mjs.
//
// SAFE BY DEFAULT:
//   - Dry-run unless you pass --create (prints exactly what it WOULD post).
//   - Idempotent: skips any demo that already has a discussion number in its
//     header, and any whose title already exists as a discussion.
//   - On --create, writes the new discussion number back into the demo file's
//     `discussion:` header so the site can link + read the upvote count.
//
// Token: same as seed-discussions.mjs - a PAT with `public_repo`/`repo`, or a
// fine-grained PAT with "Discussions: Read and write", or `gh auth token`.
//
//   node tools/seed-community-discussions.mjs                    # dry-run
//   GITHUB_TOKEN=ghp_xxx node tools/seed-community-discussions.mjs --create
//   node tools/seed-community-discussions.mjs --preview          # offline list
import { readFile, writeFile, readdir } from 'node:fs/promises'
import { dirname, resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'sv-grid/sv-grid'
const [OWNER, NAME] = REPO.split('/')
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const COMMUNITY_DIR = resolve(ROOT, 'examples/src/demos/community')
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

const args = process.argv.slice(2)
const flag = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}
const DO_CREATE = args.includes('--create')
const PREVIEW = args.includes('--preview')
const CATEGORY = flag('category', 'Show and tell')

/** Parse the leading `<!-- key: value -->` header from a community demo file. */
function parseHeader(src) {
  const meta = { tags: [], discussion: 0 }
  const block = src.match(/<!--([\s\S]*?)-->/)
  if (!block) return meta
  for (const line of block[1].split('\n')) {
    const kv = line.match(/^\s*([a-zA-Z]+)\s*:\s*(.+?)\s*$/)
    if (!kv) continue
    const key = kv[1].toLowerCase()
    const val = kv[2].trim()
    if (key === 'title') meta.title = val
    else if (key === 'author') meta.author = val
    else if (key === 'github') meta.github = val.replace(/^@/, '')
    else if (key === 'tags') meta.tags = val.split(',').map((t) => t.trim()).filter(Boolean)
    else if (key === 'discussion') meta.discussion = parseInt(val, 10) || 0
  }
  return meta
}

async function loadCommunityDemos() {
  let files = []
  try {
    files = (await readdir(COMMUNITY_DIR)).filter((f) => f.endsWith('.svelte'))
  } catch {
    return []
  }
  const out = []
  for (const file of files) {
    const path = join(COMMUNITY_DIR, file)
    const src = await readFile(path, 'utf-8')
    const slug = file.replace(/\.svelte$/, '')
    const meta = parseHeader(src)
    out.push({ path, src, slug, id: `community-${slug}`, ...meta, title: meta.title || slug })
  }
  return out
}

function bodyFor(it) {
  let b = `A community-contributed SvGrid demo`
  if (it.author) b += ` by **${it.author}**${it.github ? ` (@${it.github})` : ''}`
  b += '.\n'
  if (it.tags?.length) b += `\n**Tags:** ${it.tags.join(', ')}\n`
  b += `\n- Run it in the playground: https://svgrid.com/playground/${it.id}`
  b += `\n\n👍 this discussion to upvote the demo - the reaction count is shown as its star count in the playground.`
  return b
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'svgrid-seed-community-discussions',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors) {
    throw new Error(`GraphQL ${res.status}: ${JSON.stringify(json.errors ?? (await res.text()))}`)
  }
  return json.data
}

/** Patch the `discussion: N` line (or add one) in a community demo's header. */
async function writeBackDiscussion(it, number) {
  let src = it.src
  if (/discussion:\s*\d+/.test(src)) {
    src = src.replace(/(discussion:\s*)\d+/, `$1${number}`)
  } else {
    // Insert before the closing `-->` of the first comment.
    src = src.replace(/-->/, `  discussion: ${number}\n-->`)
  }
  await writeFile(it.path, src, 'utf-8')
}

async function main() {
  const demos = await loadCommunityDemos()
  const needing = demos.filter((d) => !d.discussion || d.discussion <= 0)

  if (PREVIEW) {
    console.log(`PREVIEW (offline) - ${demos.length} community demo(s), ${needing.length} need a discussion:\n`)
    for (const d of demos) {
      console.log(`  ${d.discussion ? `#${d.discussion}` : '   -  '}  ${d.title}  [${d.id}]`)
    }
    if (needing[0]) {
      console.log('\n--- example body ---\n')
      console.log(bodyFor(needing[0]))
    }
    console.log('\nTo post: re-run with --create and a GITHUB_TOKEN.')
    return
  }
  if (!demos.length) {
    console.log('No community demos found in examples/src/demos/community/.')
    return
  }
  if (!TOKEN) {
    console.error('Missing GITHUB_TOKEN (PAT with discussion write, or `gh auth token`).')
    process.exit(1)
  }

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
  const toCreate = needing.filter((d) => !existing.has(d.title.trim().toLowerCase()))

  console.log(
    `Repo ${REPO} | category "${cat.name}" | ${toCreate.length} to create | ` +
      `${DO_CREATE ? 'CREATING' : 'DRY-RUN (pass --create to post)'}`,
  )
  if (!toCreate.length) {
    console.log('Nothing to do - every community demo already has a discussion.')
    return
  }

  for (const [i, it] of toCreate.entries()) {
    if (!DO_CREATE) {
      console.log(`  [dry] ${i + 1}. ${it.title}  (${it.id})`)
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
      await writeBackDiscussion(it, d.number)
      console.log(`  ✓ #${d.number} ${it.title}  ->  ${d.url}  (wrote discussion:${d.number} to file)`)
    } catch (err) {
      console.error(`  ✗ failed: ${it.title}\n    ${err.message}`)
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  console.log('Done. Commit the updated demo files so the site can link + count upvotes.')
}

main()
