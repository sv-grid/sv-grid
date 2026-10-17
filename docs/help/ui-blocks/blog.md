# Blog blocks

The index pages of a blog: a filterable grid of post cards, and a lead article
next to the latest posts. Each block is one `.svelte` file built from `SvBadge`,
`SvAvatar`, `SvEmptyState` and `SvButton`, with cover art drawn as inline SVG
from the `--sg-*` tokens, so it follows the theme in light and dark.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/blog"></div>

See them first with `npx @svgrid/ui try blocks/blog`. No project needed.

## Post cards

Six cards, newest first. Each has a cover, a category badge, the reading time,
the title, an excerpt clamped to three lines, the author's avatar and the date.
The chips above the grid filter by category and show a count for each; pick
Customers, which has no posts in the sample, to see the empty state and its
Show all posts button. The whole card is one link to `/blog/<slug>`. Below
640 px the grid is a single column.

<div data-docs-demo="655-block-blog-cards" data-height="1560"></div>

`npx @svgrid/ui add blog-cards`

## Featured article

The newest post as a lead article with a large cover, badge, title, full
excerpt and an avatar byline with date and reading time. Beside it, the next
four posts list their title, date and reading time, with a View all posts link
under them. Below 760 px the list moves under the lead article.

<div data-docs-demo="656-block-blog-featured" data-height="720"></div>

`npx @svgrid/ui add blog-featured`

## Dates, reading time and links

Both cores take the same post shape:

```ts
type BlogPost = {
  slug: string; title: string; excerpt: string; category: string; author: string
  date: string   // ISO, YYYY-MM-DD
  body?: string  // the post text; reading time counts its words
  words?: number // or a word count, when the list page does not load bodies
}
```

Reading time is the word count of `body` (else `words`, else the excerpt)
divided by `wordsPerMinute`, 225 by default, rounded up, with a minimum of one
minute. Dates are formatted with `Intl.DateTimeFormat` in the `locale` option
(`en-US` by default) and the UTC time zone, so `2026-10-08` prints as
`Oct 8, 2026` on the server and in every browser.

Post links go to `/blog/<slug>`; pass `href: (post) => ...` to change that, and
`allHref` for the featured block's View all posts link (default `/blog`). The
demos pass `onOpen` (and `onViewAll`) only to show a toast instead of
navigating. Remove them in your copy and the links behave like any `<a>`, so
SvelteKit routes them on the client. With `onOpen` set, Ctrl, Cmd and
Shift-click still open a new tab or window.

The post cards block also takes `categories` (each `{ name, tone }`, where tone
is the badge variant: `neutral`, `info`, `success`, `warning` or `danger`),
the starting `category`, and `onFilter(category)`,
which you can use to keep a `?category=` query parameter in sync.

## Feeding it posts in SvelteKit

The cores read `posts` from their options and fall back to the sample posts when
you pass none. They derive everything from it, so passing a getter keeps the
block in step with the page's data. In your copy of the block, take the posts as
a prop:

```svelte
<!-- src/lib/components/ui/blog-cards.svelte, the instance script -->
let { posts }: { posts: BlogPost[] } = $props()

const blog = createBlogCards({ get posts() { return posts } })
```

and render it from the route:

```svelte
<!-- src/routes/blog/+page.svelte -->
<script lang="ts">
  import BlogCards from '$lib/components/ui/blog-cards.svelte'

  let { data } = $props()
</script>

<BlogCards posts={data.posts} />
```

The featured block works the same way with `createFeaturedPosts({ get posts() {
return posts } })`; add `featured: '<slug>'` to pin a lead article other than
the newest.

### From markdown files

Keep one `.md` file per post with a small front matter block, and read them all
at build time with `import.meta.glob`:

```md
---
title: Cutting our nightly ETL from 40 to 6 minutes
excerpt: The job spent 31 of its 40 minutes on one sequential scan.
category: Engineering
author: Priya Raman
date: 2026-10-08
---
The post text...
```

```ts
// src/routes/blog/+page.ts
import type { PageLoad } from './$types'
// The shape the blog cores take (exported as BlogPost from the block's module script).
type BlogPost = { slug: string; title: string; excerpt: string; category: string; author: string; date: string; body?: string; words?: number }

const files = import.meta.glob<string>('/src/posts/*.md', { query: '?raw', import: 'default', eager: true })

function toPost(path: string, raw: string): BlogPost {
  const [, front = '', body = ''] = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/) ?? []
  const meta: Record<string, string> = {}
  for (const line of front.split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  const slug = path.split('/').pop()!.replace(/\.md$/, '')
  return { slug, title: meta.title, excerpt: meta.excerpt, category: meta.category, author: meta.author, date: meta.date, body }
}

export const load: PageLoad = () => ({
  posts: Object.entries(files).map(([path, raw]) => toPost(path, raw)),
})
```

Passing `body` gives an exact reading time. The cores sort by `date`, so the
file order does not matter. If you already use a markdown preprocessor that
exposes front matter as `metadata`, glob the modules instead of `?raw` and map
`metadata` to the same fields.

### From a CMS

Fetch the list in the same `load`. List endpoints usually skip the body, so ask
for a word count and pass it as `words`:

```ts
// src/routes/blog/+page.ts
import type { PageLoad } from './$types'
// The shape the blog cores take (exported as BlogPost from the block's module script).
type BlogPost = { slug: string; title: string; excerpt: string; category: string; author: string; date: string; body?: string; words?: number }

type CmsPost = { slug: string; title: string; summary: string; tag: string; authorName: string; publishedAt: string; wordCount: number }

export const load: PageLoad = async ({ fetch }) => {
  const res = await fetch('https://cms.example.com/api/posts?status=published')
  if (!res.ok) throw new Error(`CMS returned ${res.status}`)
  const items: CmsPost[] = await res.json()
  const posts: BlogPost[] = items.map((p) => ({
    slug: p.slug, title: p.title, excerpt: p.summary, category: p.tag,
    author: p.authorName, date: p.publishedAt.slice(0, 10), words: p.wordCount,
  }))
  return { posts }
}
```

`date` must be `YYYY-MM-DD`, hence the `slice(0, 10)` on an ISO timestamp.

## Headless

Every block here is a styled render of the core in its `<script module>`. To
draw your own markup, take the core alone with `npx @svgrid/ui add blog-cards
--headless` (it writes `blog-cards.svelte.ts`) and spread its prop-getters on
plain elements:

```svelte
<script lang="ts">
  import { createBlogCards } from './blog-cards.svelte.js'

  let { data } = $props()
  const blog = createBlogCards({ get posts() { return data.posts } })
</script>

<div role="group" aria-label="Filter posts by category">
  {#each blog.filters as name}
    <button {...blog.chipProps(name)}>{name} ({blog.count(name)})</button>
  {/each}
</div>

{#each blog.posts as post (post.slug)}
  <article>
    <h3><a {...blog.linkProps(post)}>{post.title}</a></h3>
    <p>{post.excerpt}</p>
    <p>{post.author} · {blog.dateLabel(post)} · {blog.readLabel(post)}</p>
  </article>
{:else}
  <p>No posts in {blog.category} yet.</p>
{/each}
```

`chipProps()` sets `aria-pressed` on the active filter. The featured core,
`createFeaturedPosts()`, returns `lead`, `recent`, the same `dateLabel`,
`readLabel` and `linkProps`, and `viewAllProps()` for the View all posts link.

## See also

- [UI blocks overview](./index.md)
- [SvAvatar](../ui-components/sv-avatar.md)
- [SvEmptyState](../ui-components/sv-empty-state.md)
