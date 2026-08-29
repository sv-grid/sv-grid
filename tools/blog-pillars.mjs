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

// The three hubs, so each can cross-link to the other two (hub-to-hub links
// concentrate authority and give crawlers a clear cluster map).
const PILLARS = [
  { slug: 'svelte-data-grid-comparisons', label: 'Comparisons and alternatives' },
  { slug: 'svelte-data-grid-integrations', label: 'Backend and framework integrations' },
  { slug: 'svelte-data-grid-guides', label: 'Guides and tutorials' },
]
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

function linkList(list) {
  return list
    .map((p) => `- [${p.title}](/blog/${p.slug})${p.description ? ` - ${p.description}` : ''}`)
    .join('\n')
}

function writePillar({ slug, title, description, tags, intro, sections }) {
  const path = join(BLOG_DIR, `${slug}.md`)
  const date = PUBLISH_DATE
  const frontmatter = [
    '---',
    `title: ${title}`,
    `description: ${description}`,
    `date: ${date}`,
    `updated: "${TODAY}"`,
    'category: Concepts',
    `tags: ${tags.join(', ')}`,
    `author: ${AUTHOR}`,
    'pinned: true',
    '---',
  ].join('\n')

  const otherHubs = PILLARS.filter((p) => p.slug !== slug)
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

console.log(DRY_RUN ? '\n(dry run - nothing written)' : 'done')
