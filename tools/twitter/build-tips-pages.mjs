#!/usr/bin/env node
/**
 * Generate the two SEO tips pages from the shared tips data, so the on-site
 * content and the tweet rotation never drift apart. Run this whenever you edit
 * tools/twitter/tips-data.mjs.
 *
 *   node tools/twitter/build-tips-pages.mjs           # write the pages
 *   node tools/twitter/build-tips-pages.mjs --dry-run # print, write nothing
 *
 * Output (into the private website submodule, alongside the blog):
 *   website/src/content/blog/svelte-5-tips-and-tricks.md
 *   website/src/content/blog/svgrid-tips-and-tricks.md
 *   website/src/content/blog/svgrid-ui-components-tips-and-tricks.md
 *   website/src/content/blog/svgrid-studio-tips-and-tricks.md
 *
 * These are comprehensive, anchor-linked posts (one <h2> per tip, each with an
 * <a id> the tweets deep-link to). Comprehensive pages rank better than many
 * thin ones, and the anchors let every tweet point at its exact tip.
 *
 * Idempotent: an existing file's publish `date` is preserved and only `updated`
 * is refreshed, so regenerating never resets a page's age (which SEO cares about).
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SVELTE_TIPS, SVGRID_TIPS, SVGRID_UI_TIPS, SVGRID_STUDIO_TIPS,
  SVELTE_TIPS_SLUG, SVGRID_TIPS_SLUG, SVGRID_UI_TIPS_SLUG, SVGRID_STUDIO_TIPS_SLUG,
} from './tips-data.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = join(HERE, '..', '..')
const BLOG_DIR = join(ROOT, 'website', 'src', 'content', 'blog')
const DRY_RUN = process.argv.includes('--dry-run')
const TODAY = new Date().toISOString().slice(0, 10)
const AUTHOR = 'Boyko Markov'

// Fixed publish date, NOT "today". These pages are regenerated on every deploy
// (from a fresh website clone that has no prior file), so a "today" date would
// reset their SEO age on every build. Pin it; only `updated` moves.
const PUBLISH_DATE = '2026-07-25'

// Turn a `code` snippet into a fenced block; guess the language for highlighting.
function fence(code) {
  const lang = /<[A-Za-z]|{@render|{#snippet|=>/.test(code) ? 'svelte' : 'ts'
  return '```' + lang + '\n' + code + '\n```'
}

function renderTip(tip) {
  const parts = [
    `<a id="${tip.anchor}"></a>`,
    ``,
    `## ${tip.title}`,
    ``,
    tip.body,
    ``,
    fence(tip.code),
  ]
  if (tip.link) {
    parts.push(``, `[Read the docs](${tip.link})`)
  }
  return parts.join('\n')
}

function buildPage({ slug, title, description, tags, intro, tips, outro }) {
  const path = join(BLOG_DIR, `${slug}.md`)
  const date = PUBLISH_DATE
  const frontmatter = [
    '---',
    `title: ${title}`,
    `description: ${description}`,
    `date: ${date}`,
    `updated: "${TODAY}"`,
    'category: Tips',
    `tags: ${tags.join(', ')}`,
    `author: ${AUTHOR}`,
    'pinned: true',
    '---',
  ].join('\n')

  const body = [
    intro,
    '',
    tips.map(renderTip).join('\n\n'),
    '',
    outro,
    '',
  ].join('\n')

  const content = `${frontmatter}\n\n${body}`
  if (DRY_RUN) {
    console.log(`\n===== ${slug}.md (date ${date}) =====\n`)
    console.log(content.slice(0, 600) + '\n...[truncated]...')
  } else {
    mkdirSync(BLOG_DIR, { recursive: true })
    writeFileSync(path, content)
    console.log(`wrote ${path} (${tips.length} tips, date ${date})`)
  }
}

buildPage({
  slug: SVELTE_TIPS_SLUG,
  title: 'Svelte 5 Tips and Tricks: Runes, Snippets, and More',
  description:
    'A practical, growing list of Svelte 5 tips - $state, $derived, snippets, $bindable and the runes patterns that replace stores and slots, each with a code snippet.',
  tags: ['svelte', 'svelte 5', 'runes', 'snippets', 'tips', 'tutorial'],
  intro:
    'Svelte 5 rethinks reactivity around **runes**. If you are coming from Svelte 4, ' +
    'a handful of new patterns replace stores, slots, and the `$:` label. Here are the ' +
    'ones that come up every day, each with a short, copy-ready example. This page grows ' +
    'over time, so bookmark it.',
  tips: SVELTE_TIPS,
  outro:
    '### Built something with these?\n\n' +
    'These patterns power [SvGrid](https://svgrid.com), the Svelte 5-native data grid. ' +
    'If you work with tables, it is worth a look - the same runes you use above drive it under the hood.',
})

buildPage({
  slug: SVGRID_TIPS_SLUG,
  title: 'SvGrid Tips and Tricks: Get More from Your Svelte Data Grid',
  description:
    'Practical SvGrid tips - fitColumns, cellFlash, Kanban board mode, server-side data, theming tokens and headless rendering - each with a code snippet and docs link.',
  tags: ['svgrid', 'svelte data grid', 'data grid', 'tips', 'tutorial'],
  intro:
    '[SvGrid](https://svgrid.com) does a lot with very few props. These are the tips that ' +
    'most often make people say "it can do that?" - from filling the viewport to live cell ' +
    'flashes, Kanban board mode, and dropping to the headless core. Each one is a one-liner ' +
    'you can paste in today.',
  tips: SVGRID_TIPS,
  outro:
    '### Go deeper\n\n' +
    'Every tip above links to its full documentation. Start with the ' +
    '[getting-started guide](https://svgrid.com/docs/getting-started) or browse the ' +
    '[150+ live examples](https://svgrid.com/demos/).',
})

buildPage({
  slug: SVGRID_UI_TIPS_SLUG,
  title: 'SvGrid UI Components Tips and Tricks: Svelte 5 Buttons, Inputs, Tree, Forms',
  description:
    'Practical tips for the SvGrid UI component kit - SvButton states, a Cmd+K command palette, a virtualized searchable tree, schema-driven forms, a parsing date/time field, and the shared field contract - each with a code snippet.',
  tags: ['svgrid', 'svelte ui components', 'svelte 5', 'ui kit', 'tips', 'tutorial'],
  intro:
    'SvGrid ships more than a grid: a Svelte 5-native UI component kit - buttons, ' +
    'inputs, overlays, a tree, forms, a command palette and date/time pickers - that ' +
    'you can use standalone or as grid cell editors. These tips show the parts people ' +
    'most often miss, each a copy-ready one-liner. This page grows over time, so bookmark it.',
  tips: SVGRID_UI_TIPS,
  outro:
    '### Explore the kit\n\n' +
    'Every tip links to its component docs. Browse the full ' +
    '[UI components reference](https://svgrid.com/docs/help/ui-components) or see them ' +
    'live in the [examples gallery](https://svgrid.com/demos/). The same components double ' +
    'as in-cell editors inside [SvGrid](https://svgrid.com), the Svelte 5 data grid.',
})

buildPage({
  slug: SVGRID_STUDIO_TIPS_SLUG,
  title: 'SvGrid Studio Tips and Tricks: Build Svelte Data Apps, Fast',
  description:
    'Practical SvGrid Studio tips - AI app generation, a designer that emits real SvelteKit, schema-driven edit forms, code-behind with ctx.grid, production auth/data/deploy toggles, and real data-source binding - each with a snippet.',
  tags: ['svgrid studio', 'svelte data app', 'low code svelte', 'sveltekit', 'tips', 'tutorial'],
  intro:
    '[SvGrid Studio](https://svgrid.com/docs/enterprise/studio) turns entities and ' +
    'screens into a real, ejectable SvelteKit app - no runtime lock-in. These tips cover ' +
    'the moves that make it feel like a team-scale tool: generate from a prompt, drop into ' +
    'code-behind, and ship to production. Each is a short, concrete example. This page grows ' +
    'over time, so bookmark it.',
  tips: SVGRID_STUDIO_TIPS,
  outro:
    '### Start building\n\n' +
    'Every tip links to its Studio docs. Begin with the ' +
    '[Studio getting-started guide](https://svgrid.com/docs/enterprise/studio/getting-started) ' +
    'or read how the [app designer](https://svgrid.com/docs/enterprise/studio/app-designer/) ' +
    'generates code you own.',
})

console.log(DRY_RUN ? '\n(dry run - nothing written)' : 'done')
