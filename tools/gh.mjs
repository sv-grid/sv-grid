// One-shot GitHub helper for keeping Issues + Discussions in sync with dev work
// (see the "GitHub sync workflow" the team follows: open issues for bugs, close
// them when fixed, post/comment Discussions for features + roadmap items).
//
// Needs a token (classic PAT `public_repo`, or fine-grained Issues/Discussions
// write) in GITHUB_TOKEN / GH_TOKEN. Add --dry to print the action without
// calling GitHub (no token needed) - use it to preview before posting.
//
//   node tools/gh.mjs issue create  --title "Bug: X" --body "..." --labels bug
//   node tools/gh.mjs issue comment --number 12 --body "Fixed in abc123."
//   node tools/gh.mjs issue close   --number 12 --comment "Fixed in abc123."
//   node tools/gh.mjs discussion create  --category Announcements --title "..." --body "..."
//   node tools/gh.mjs discussion comment --number 5 --body "Shipped in v1.4."
//   node tools/gh.mjs discussion close   --number 5 --comment "Shipped." [--reason RESOLVED]
const REPO = 'sv-grid/sv-grid'
const [OWNER, NAME] = REPO.split('/')
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN

import { readFileSync } from 'node:fs'

const argv = process.argv.slice(2)
const [resource, action] = argv
const DRY = argv.includes('--dry')
const flag = (k) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? argv[i + 1] : undefined
}
// Text from --<name>, or --<name>-file (a path) for robust multi-line markdown.
const text = (name) => {
  const inline = flag(name)
  if (inline !== undefined) return inline
  const file = flag(`${name}-file`)
  return file ? readFileSync(file, 'utf8') : undefined
}

function fail(msg) {
  console.error(msg)
  process.exit(1)
}

async function rest(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `bearer ${TOKEN}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'svgrid-gh-helper',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) fail(`GitHub REST ${method} ${path} -> ${res.status}: ${JSON.stringify(json)}`)
  return json
}

async function gql(query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'svgrid-gh-helper',
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok || json.errors) fail(`GitHub GraphQL ${res.status}: ${JSON.stringify(json.errors ?? json)}`)
  return json.data
}

function preview(label, obj) {
  console.log(`[dry] ${label}:`)
  console.log(JSON.stringify(obj, null, 2))
}

async function issueCreate() {
  const title = flag('title')
  const body = text('body') ?? ''
  const labels = (flag('labels') ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  if (!title) fail('issue create needs --title')
  if (DRY) return preview('POST /issues', { title, body, labels })
  const d = await rest('POST', `/repos/${OWNER}/${NAME}/issues`, { title, body, labels })
  console.log(`✓ issue #${d.number}: ${d.html_url}`)
}

async function issueComment() {
  const number = Number(flag('number'))
  const body = text('body')
  if (!number || !body) fail('issue comment needs --number and --body')
  if (DRY) return preview(`POST /issues/${number}/comments`, { body })
  const d = await rest('POST', `/repos/${OWNER}/${NAME}/issues/${number}/comments`, { body })
  console.log(`✓ commented on #${number}: ${d.html_url}`)
}

async function issueClose() {
  const number = Number(flag('number'))
  const comment = text('comment')
  if (!number) fail('issue close needs --number')
  if (DRY) return preview(`close #${number}`, { comment, state: 'closed' })
  if (comment) await rest('POST', `/repos/${OWNER}/${NAME}/issues/${number}/comments`, { body: comment })
  const d = await rest('PATCH', `/repos/${OWNER}/${NAME}/issues/${number}`, { state: 'closed' })
  console.log(`✓ closed #${number}: ${d.html_url}`)
}

async function discussionCreate() {
  const category = flag('category') ?? 'Ideas'
  const title = flag('title')
  const body = text('body') ?? ''
  if (!title) fail('discussion create needs --title')
  if (DRY) return preview('createDiscussion', { category, title, body })
  const data = await gql(
    `query($o:String!,$n:String!){repository(owner:$o,name:$n){id discussionCategories(first:25){nodes{id name}}}}`,
    { o: OWNER, n: NAME },
  )
  const repo = data.repository
  const cat = repo.discussionCategories.nodes.find((c) => c.name.toLowerCase() === category.toLowerCase())
  if (!cat) fail(`Category "${category}" not found. Have: ${repo.discussionCategories.nodes.map((c) => c.name).join(', ')}`)
  const r = await gql(
    `mutation($r:ID!,$c:ID!,$t:String!,$b:String!){createDiscussion(input:{repositoryId:$r,categoryId:$c,title:$t,body:$b}){discussion{number url}}}`,
    { r: repo.id, c: cat.id, t: title, b: body },
  )
  const d = r.createDiscussion.discussion
  console.log(`✓ discussion #${d.number}: ${d.url}`)
}

async function discussionComment() {
  const number = Number(flag('number'))
  const body = text('body')
  if (!number || !body) fail('discussion comment needs --number and --body')
  if (DRY) return preview(`addDiscussionComment to #${number}`, { body })
  const data = await gql(
    `query($o:String!,$n:String!,$num:Int!){repository(owner:$o,name:$n){discussion(number:$num){id}}}`,
    { o: OWNER, n: NAME, num: number },
  )
  const id = data.repository.discussion?.id
  if (!id) fail(`Discussion #${number} not found`)
  const r = await gql(
    `mutation($d:ID!,$b:String!){addDiscussionComment(input:{discussionId:$d,body:$b}){comment{url}}}`,
    { d: id, b: body },
  )
  console.log(`✓ commented on discussion #${number}: ${r.addDiscussionComment.comment.url}`)
}

async function issueEdit() {
  const number = Number(flag('number'))
  const body = text('body')
  const title = flag('title')
  if (!number || (body === undefined && title === undefined)) fail('issue edit needs --number and --body and/or --title')
  const payload = {}
  if (body !== undefined) payload.body = body
  if (title !== undefined) payload.title = title
  if (DRY) return preview(`PATCH /issues/${number}`, payload)
  const d = await rest('PATCH', `/repos/${OWNER}/${NAME}/issues/${number}`, payload)
  console.log(`✓ edited issue #${number}: ${d.html_url}`)
}

async function discussionEdit() {
  const number = Number(flag('number'))
  const body = text('body')
  if (!number || body === undefined) fail('discussion edit needs --number and --body')
  if (DRY) return preview(`updateDiscussion #${number}`, { body })
  const data = await gql(
    `query($o:String!,$n:String!,$num:Int!){repository(owner:$o,name:$n){discussion(number:$num){id}}}`,
    { o: OWNER, n: NAME, num: number },
  )
  const id = data.repository.discussion?.id
  if (!id) fail(`Discussion #${number} not found`)
  const r = await gql(
    `mutation($d:ID!,$b:String!){updateDiscussion(input:{discussionId:$d,body:$b}){discussion{url}}}`,
    { d: id, b: body },
  )
  console.log(`✓ edited discussion #${number}: ${r.updateDiscussion.discussion.url}`)
}

async function discussionClose() {
  const number = Number(flag('number'))
  const comment = text('comment')
  // RESOLVED (default) for a shipped/answered idea, OUTDATED for one that no
  // longer applies, DUPLICATE when another discussion supersedes it.
  const reason = (flag('reason') ?? 'RESOLVED').toUpperCase()
  if (!number) fail('discussion close needs --number')
  if (!['RESOLVED', 'OUTDATED', 'DUPLICATE'].includes(reason))
    fail(`--reason must be RESOLVED, OUTDATED or DUPLICATE (got "${reason}")`)
  if (DRY) return preview(`closeDiscussion #${number}`, { comment, reason })
  const data = await gql(
    `query($o:String!,$n:String!,$num:Int!){repository(owner:$o,name:$n){discussion(number:$num){id}}}`,
    { o: OWNER, n: NAME, num: number },
  )
  const id = data.repository.discussion?.id
  if (!id) fail(`Discussion #${number} not found`)
  // Comment BEFORE closing so the reasoning is the last thing on the thread.
  if (comment) {
    await gql(
      `mutation($d:ID!,$b:String!){addDiscussionComment(input:{discussionId:$d,body:$b}){comment{url}}}`,
      { d: id, b: comment },
    )
  }
  const r = await gql(
    `mutation($d:ID!,$r:DiscussionCloseReason!){closeDiscussion(input:{discussionId:$d,reason:$r}){discussion{url}}}`,
    { d: id, r: reason },
  )
  console.log(`✓ closed discussion #${number} (${reason}): ${r.closeDiscussion.discussion.url}`)
}

async function discussionDelete() {
  const number = Number(flag('number'))
  if (!number) fail('discussion delete needs --number')
  if (DRY) return preview(`deleteDiscussion #${number}`, { number })
  const data = await gql(
    `query($o:String!,$n:String!,$num:Int!){repository(owner:$o,name:$n){discussion(number:$num){id}}}`,
    { o: OWNER, n: NAME, num: number },
  )
  const id = data.repository.discussion?.id
  if (!id) fail(`Discussion #${number} not found`)
  await gql(`mutation($id:ID!){deleteDiscussion(input:{id:$id}){discussion{number}}}`, { id })
  console.log(`✓ deleted discussion #${number}`)
}

const ROUTES = {
  'issue:create': issueCreate,
  'issue:comment': issueComment,
  'issue:close': issueClose,
  'issue:edit': issueEdit,
  'discussion:create': discussionCreate,
  'discussion:comment': discussionComment,
  'discussion:close': discussionClose,
  'discussion:edit': discussionEdit,
  'discussion:delete': discussionDelete,
}

async function main() {
  const fn = ROUTES[`${resource}:${action}`]
  if (!fn) {
    fail(
      'Usage:\n' +
        Object.keys(ROUTES).map((k) => '  node tools/gh.mjs ' + k.replace(':', ' ') + ' ...').join('\n'),
    )
  }
  if (!TOKEN && !DRY) fail('Missing GITHUB_TOKEN. Set it, or add --dry to preview without posting.')
  await fn()
}

main()
