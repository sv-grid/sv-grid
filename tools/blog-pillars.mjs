#!/usr/bin/env node
/**
 * Generate cluster pillar pages for the blog. A pillar is a hub: a substantial,
 * keyword-targeted page that links down to every post in a cluster (and each of
 * those posts links back via its "Related reading" block). This is what turns a
 * pile of posts into a topic cluster search + AI engines recognize.
 *
 *   node tools/blog-pillars.mjs            # write the pillar pages
 *   node tools/blog-pillars.mjs --dry-run  # print, write nothing
 *
 * Pillars are built from LIVE cluster membership (published posts only), so
 * re-running keeps them current as the drip publishes more posts. Idempotent:
 * publish date is preserved across runs; only `updated` refreshes.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BLOG_DIR = join(HERE, '..', 'website', 'src', 'content', 'blog')
const DRY_RUN = process.argv.includes('--dry-run')
const TODAY = new Date().toISOString().slice(0, 10)
const AUTHOR = 'Boyko Markov'

// Fixed publish date, NOT "today" - pillars are regenerated on every deploy from
// a fresh website clone, so "today" would reset their SEO age each build.
const PUBLISH_DATE = '2026-07-25'

function parseFrontmatter(raw) {
  // Tolerate a leading UTF-8 BOM and CRLF line endings (Windows checkouts add
  // both; without this the ^--- anchor fails and every field parses as empty).
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  const meta = {}
  if (m) {
    for (const line of m[1].split(/\r?\n/)) {
      const i = line.indexOf(':')
      if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    }
  }
  return meta
}

if (!existsSync(BLOG_DIR)) {
  console.error(`Blog dir not found: ${BLOG_DIR}\nCheck out the private website submodule first.`)
  process.exit(1)
}

// The learn cluster is an experiment (category `Svelte` in tools/blog-topics.json),
// so it is gated: below this many published posts the hub is neither written nor
// linked from the other three. An empty hub is a thin page, and a cross-link to a
// page that was never written is a 404 in every other hub.
const LEARN_SLUG = 'learn-svelte-5'
const LEARN_MIN_POSTS = 3

// The hubs, so each can cross-link to the others (hub-to-hub links concentrate
// authority and give crawlers a clear cluster map).
const PILLARS = [
  { slug: 'svelte-data-grid-comparisons', label: 'Comparisons and alternatives' },
  { slug: 'svelte-data-grid-integrations', label: 'Backend and framework integrations' },
  { slug: 'svelte-data-grid-guides', label: 'Guides and tutorials' },
  { slug: LEARN_SLUG, label: 'Learn Svelte 5' },
]
// Every pillar slug, gated or not, so a hub is never listed inside another hub.
const PILLAR_SLUGS = new Set(PILLARS.map((p) => p.slug))

const posts = readdirSync(BLOG_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ slug: f.replace(/\.md$/, ''), meta: parseFrontmatter(readFileSync(join(BLOG_DIR, f), 'utf-8')) }))
  .filter((p) => !PILLAR_SLUGS.has(p.slug)) // never list a pillar inside a pillar
  .map((p) => ({
    slug: p.slug,
    title: p.meta.title || p.slug,
    description: p.meta.description || '',
    category: p.meta.category || 'General',
    date: p.meta.date || '1970-01-01',
    published: (p.meta.date || '9999-12-31') <= TODAY,
  }))
  .filter((p) => p.published)

const byCategory = (cat) =>
  posts.filter((p) => p.category === cat).sort((a, b) => a.title.localeCompare(b.title))
const byCategories = (cats) =>
  posts.filter((p) => cats.includes(p.category)).sort((a, b) => a.title.localeCompare(b.title))

// Hubs that exist on disk after this run, so cross-links only point at real pages.
const LIVE_HUBS = new Set(
  PILLARS.filter((p) => p.slug !== LEARN_SLUG || byCategory('Svelte').length >= LEARN_MIN_POSTS).map((p) => p.slug),
)

function linkList(list) {
  return list
    .map((p) => `- [${p.title}](/blog/${p.slug})${p.description ? ` - ${p.description}` : ''}`)
    .join('\n')
}

// `category` decides which blog group the hub itself lands in (CATEGORY_TO_GROUP
// on the site). The three grid hubs are Concepts, which groups them under Guides.
function writePillar({ slug, title, description, tags, intro, sections, category = 'Concepts' }) {
  const path = join(BLOG_DIR, `${slug}.md`)
  const date = PUBLISH_DATE
  const frontmatter = [
    '---',
    `title: ${title}`,
    `description: ${description}`,
    `date: ${date}`,
    `updated: "${TODAY}"`,
    `category: ${category}`,
    `tags: ${tags.join(', ')}`,
    `author: ${AUTHOR}`,
    'pinned: true',
    '---',
  ].join('\n')

  const otherHubs = PILLARS.filter((p) => p.slug !== slug && LIVE_HUBS.has(p.slug))
    .map((p) => `- [${p.label}](/blog/${p.slug})`)
    .join('\n')
  const hubsSection = `## More Svelte data grid hubs\n\n${otherHubs}`

  const body = [intro, '', ...sections.map((s) => `## ${s.heading}\n\n${s.blurb}\n\n${linkList(s.list)}`), '', hubsSection].join('\n\n')
  const content = `${frontmatter}\n\n${body}\n`

  if (DRY_RUN) {
    const total = sections.reduce((n, s) => n + s.list.length, 0)
    console.log(`\n===== ${slug}.md (date ${date}) - ${total} links across ${sections.length} sections =====`)
    console.log(content.slice(0, 480) + '\n...[truncated]...')
  } else {
    mkdirSync(BLOG_DIR, { recursive: true })
    writeFileSync(path, content)
    const total = sections.reduce((n, s) => n + s.list.length, 0)
    console.log(`wrote ${slug}.md (${total} links, date ${date})`)
  }
}

// ---- Comparisons pillar -------------------------------------------------
writePillar({
  slug: 'svelte-data-grid-comparisons',
  title: 'Svelte Data Grid Comparisons and Alternatives (2026)',
  description:
    'The complete hub for choosing a Svelte data grid: honest comparisons, alternatives to popular grids, build-vs-buy, and migration guides from every major library.',
  tags: ['svelte data grid', 'comparison', 'alternatives', 'migration'],
  intro:
    'Picking a data grid for a Svelte or SvelteKit app is a long-lived decision, so it is worth doing once and doing well. ' +
    'This hub pulls together every comparison, alternative, and migration guide in one place: how the options stack up, when to ' +
    'build your own, and exactly how to move an existing grid to a Svelte 5-native stack. Start with the honest overview, then ' +
    'drill into the specific comparison or migration path that matches your current setup.',
  sections: [
    { heading: 'Compare the options', blurb: 'Side-by-side looks at the Svelte data grid landscape and how to judge it.', list: byCategory('Comparisons').filter((p) => !/^migrating/i.test(p.title) && !/^porting/i.test(p.title)) },
    { heading: 'Migrating from another grid', blurb: 'Step-by-step guides for moving an existing grid to a Svelte 5-native stack.', list: byCategory('Comparisons').filter((p) => /^migrating/i.test(p.title) || /^porting/i.test(p.title)) },
  ],
})

// ---- Integrations pillar ------------------------------------------------
writePillar({
  slug: 'svelte-data-grid-integrations',
  title: 'Connecting a Svelte Data Grid to Any Backend or Framework',
  description:
    'Every integration guide for a Svelte data grid in one place: Supabase, Prisma, Drizzle, GraphQL, tRPC, Firebase, REST, SvelteKit SSR, Astro, Tauri, and more.',
  tags: ['svelte data grid', 'sveltekit', 'integration', 'backend'],
  intro:
    'A data grid is only as useful as the data behind it. This hub collects every guide for wiring SvGrid to a real backend or ' +
    'framework - databases and ORMs, API layers, auth-backed stacks, and the surrounding tooling for testing and docs. Whatever ' +
    'your stack, there is a starting point here that uses the same grid API.',
  sections: [
    { heading: 'Databases, ORMs, and APIs', blurb: 'Back the grid with a real data source.', list: byCategory('Integration').filter((p) => !/(storybook|playwright|vitest|testing|astro|tauri|flowbite|shadcn|skeleton)/i.test(p.slug)) },
    { heading: 'Frameworks, UI kits, and tooling', blurb: 'Drop the grid into the rest of your ecosystem.', list: byCategory('Integration').filter((p) => /(storybook|playwright|vitest|testing|astro|tauri|flowbite|shadcn|skeleton)/i.test(p.slug)) },
  ],
})

// ---- Guides pillar ------------------------------------------------------
writePillar({
  slug: 'svelte-data-grid-guides',
  title: 'Svelte Data Grid Guides and Tutorials',
  description:
    'Learn to build with a Svelte data grid: editing, filtering, sorting, grouping, selection, columns, cells, performance, theming, and real-world use cases.',
  tags: ['svelte data grid', 'tutorial', 'guide', 'how to'],
  intro:
    'Everything you need to go from a first render to a production grid. These guides cover the core features - editing, ' +
    'filtering, sorting, grouping, selection, columns, and cells - plus performance, theming, and complete real-world screens. ' +
    'Work through them in order or jump to the feature you need.',
  sections: [
    { heading: 'Core features', blurb: 'The building blocks of a working grid.', list: byCategories(['Editing', 'Filtering', 'Sorting', 'Grouping', 'Selection', 'Columns', 'Cells', 'Rows', 'Formatting', 'Data']) },
    { heading: 'Concepts and performance', blurb: 'The ideas behind fast, correct grids.', list: byCategories(['Concepts', 'Performance', 'Architecture', 'Accessibility', 'Theming']) },
    { heading: 'Real-world use cases', blurb: 'Complete screens built end to end.', list: byCategory('Use cases') },
  ],
})

// ---- Learn Svelte 5 pillar ----------------------------------------------
// Deliberately not about SvGrid features. This cluster targets the Svelte 5 and
// SvelteKit questions a developer hits while building a data-heavy screen, where
// svelte.dev's tutorial stops and no canonical answer exists. Syntax basics stay
// out: svelte.dev owns those queries and that reader does not evaluate a grid.
if (LIVE_HUBS.has(LEARN_SLUG)) {
  writePillar({
    slug: LEARN_SLUG,
    // Sits in the Learn group with the posts it lists, not in Guides with the
    // three grid hubs, so the group reads as one self-contained track.
    category: 'Svelte',
    title: 'Learn Svelte 5: State, Runes, and Data in Real Apps',
    description:
      'Working guides to Svelte 5 and SvelteKit for data-heavy apps: $state vs stores, $derived vs $effect, snippets, load functions, form actions, and rendering large lists.',
    tags: ['svelte 5', 'sveltekit', 'runes', 'learn svelte'],
    intro:
      'The official Svelte tutorial teaches the syntax. These guides pick up where it stops: what to reach for once a ' +
      'real app has a few thousand rows, a server to load them from, and state that more than one component needs. Each ' +
      'one answers a question with runnable Svelte 5 code, explains the tradeoff behind the answer, and says when the ' +
      'simpler option is still the right one.',
    sections: [
      { heading: 'State and reactivity', blurb: 'Runes in an app that outgrew a single component.', list: byCategory('Svelte').filter((p) => /(state|store|derived|effect|context|bindable|reactiv)/i.test(p.slug)) },
      { heading: 'SvelteKit and data loading', blurb: 'Getting rows from a server into a page.', list: byCategory('Svelte').filter((p) => /(sveltekit|load|action|fetch|pagination|server)/i.test(p.slug)) },
      { heading: 'Rendering and components', blurb: 'Snippets, lists, and what gets slow.', list: byCategory('Svelte').filter((p) => !/(state|store|derived|effect|context|bindable|reactiv|sveltekit|load|action|fetch|pagination|server)/i.test(p.slug)) },
    ].filter((sec) => sec.list.length > 0),
  })
} else {
  const have = byCategory('Svelte').length
  console.log(`skipped ${LEARN_SLUG}.md (${have}/${LEARN_MIN_POSTS} published posts in category Svelte)`)
}

console.log(DRY_RUN ? '\n(dry run - nothing written)' : 'done')
