// Build-time fetch of the repo's GitHub Discussions into a static JSON the
// Community page renders as a native browse UI (category sidebar + list).
//
// GitHub Discussions are GraphQL-only and require a token even for public
// reads, and the site is static (GitHub Pages - no backend), so we bake the
// data at build time. In CI the workflow passes the automatic GITHUB_TOKEN
// (with `discussions: read`); the daily + on-push deploys keep it fresh.
//
// Safe by design: with NO token (local `vite build`, forks) it writes an empty
// dataset instead of failing, so the build + the Community page always work -
// they just show the "no discussions yet / browse on GitHub" state.
//
//   GITHUB_TOKEN=ghp_xxx node tools/fetch-discussions.mjs
import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'sv-grid/sv-grid' // keep in sync with website/src/lib/giscus.ts
const [OWNER, NAME] = REPO.split('/')
const OUT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../website/src/lib/discussions-data.json',
)
const TOKEN =
  process.env.GITHUB_TOKEN || process.env.GH_TOKEN || process.env.SVGRID_GH_TOKEN

const QUERY = `
query($owner:String!, $name:String!) {
  repository(owner:$owner, name:$name) {
    discussionCategories(first: 25) {
      nodes { name emoji description slug isAnswerable }
    }
    discussions(first: 50, orderBy: {field: UPDATED_AT, direction: DESC}) {
      totalCount
      nodes {
        number title url createdAt updatedAt answerChosenAt
        category { name emoji slug }
        author { login url avatarUrl }
        comments { totalCount }
        reactions { totalCount }
      }
    }
  }
}`

async function fetchDiscussions() {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'svgrid-site-build',
    },
    body: JSON.stringify({ query: QUERY, variables: { owner: OWNER, name: NAME } }),
  })
  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`)
  const json = await res.json()
  if (json.errors) throw new Error('GraphQL errors: ' + JSON.stringify(json.errors))
  const repo = json.data?.repository
  if (!repo) throw new Error('No repository in response')

  const categories = (repo.discussionCategories?.nodes ?? []).map((c) => ({
    name: c.name,
    emoji: c.emoji,
    slug: c.slug,
    description: c.description ?? '',
    isAnswerable: !!c.isAnswerable,
  }))
  const discussions = (repo.discussions?.nodes ?? []).map((d) => ({
    number: d.number,
    title: d.title,
    url: d.url,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    answered: !!d.answerChosenAt,
    category: d.category
      ? { name: d.category.name, emoji: d.category.emoji, slug: d.category.slug }
      : null,
    author: d.author
      ? { login: d.author.login, url: d.author.url, avatarUrl: d.author.avatarUrl }
      : null,
    comments: d.comments?.totalCount ?? 0,
    reactions: d.reactions?.totalCount ?? 0,
  }))
  return { totalCount: repo.discussions?.totalCount ?? discussions.length, categories, discussions }
}

async function main() {
  // `new Date()` is fine here (a plain build script, not a resumable workflow).
  const base = { repo: REPO, generatedAt: new Date().toISOString() }
  let data
  if (!TOKEN) {
    console.warn(
      '[fetch-discussions] No GITHUB_TOKEN - writing empty dataset. ' +
        'The Community page will link out to GitHub until a tokened build runs.',
    )
    data = { ...base, totalCount: 0, categories: [], discussions: [] }
  } else {
    try {
      data = { ...base, ...(await fetchDiscussions()) }
      console.log(
        `[fetch-discussions] ${data.discussions.length} discussions, ${data.categories.length} categories.`,
      )
    } catch (err) {
      // Never fail the build over discussions - fall back to empty + warn.
      console.warn('[fetch-discussions] fetch failed, writing empty dataset:', err.message)
      data = { ...base, totalCount: 0, categories: [], discussions: [] }
    }
  }
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(data, null, 2) + '\n', 'utf-8')
  console.log('[fetch-discussions] wrote', OUT)
}

main()
