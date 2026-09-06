/**
 * Write the framework example sections of the docs from the example files.
 *
 * The three framework pages show each recipe's source. Pasting it once means
 * the page is a snapshot: change `examples/react/editing/App.tsx` and the docs
 * quietly describe the old one. Everything else in this corner of the repo is
 * generated for that reason - the element surface, the wrappers, the reference
 * tables - so the example listings are too.
 *
 * The fences are marked `{nocheck}` on purpose. `tools/docs-snippets.test.ts`
 * compiles doc fences standalone, and these import `../data`, a sibling module
 * that only exists in the example's own directory. They are not unchecked: they
 * are compiled from their real location by `pnpm --filter @svgrid/grid-wc
 * check:examples`, with each framework's own compiler, which is a stronger
 * check than a standalone paste could be.
 *
 * Usage:
 *   node scripts/sync-example-docs.mjs           write the sections
 *   node scripts/sync-example-docs.mjs --check   fail if stale (CI)
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const pkgRoot = join(here, '..')
const examples = join(pkgRoot, 'examples')
const docs = join(pkgRoot, '..', '..', 'docs', 'help', 'web-components')

const BEGIN = '<!-- BEGIN generated examples - packages/grid-wc/scripts/sync-example-docs.mjs -->'
const END = '<!-- END generated examples -->'

/** Recipe order and prose. The order is the reading order on the page. */
const RECIPES = [
  ['basic', 'A first grid', 'Rows, columns, and the two features almost every table wants.'],
  [
    'sorting-filtering',
    'Sorting and filtering',
    'A filter row under the headers, multi-column sort, and the current sort read back into your own state.',
  ],
  [
    'editing',
    'Editing and saving',
    'Inline editing, with each committed edit arriving through `cellvaluechange`. Swap the local update for your save call.',
  ],
  [
    'selection',
    'Row selection',
    'Checkboxes, with the selected rows handed straight to you - both the selection map and the rows themselves.',
  ],
  [
    'grouping',
    'Grouping and totals',
    'Group by one or two columns with an aggregate in the group row. `groupBy` is an array, so it is one of the props that can only be a property.',
  ],
  [
    'pagination',
    'Pagination',
    'Client-side paging. `pageSize` is the INITIAL page size, read once at mount.',
  ],
  [
    'server-data',
    'Server-side data',
    'The grid renders the page you hand it and tells you when the user wants another. `externalSort` and `externalPagination` stop it doing the work locally; `rowCount` is how it knows how many pages exist.',
  ],
  [
    'theming',
    'Theming',
    'The `--sg-*` custom properties. Ordinary CSS custom properties, so they cascade from any ancestor - which is why they also reach inside `<sv-grid-shadow>`.',
  ],
  [
    'enterprise',
    'Excel export (Enterprise)',
    'The paid pack from a non-Svelte host. `@svgrid/enterprise/export` is plain JavaScript, so it needs no Svelte in your build - the same goes for `/import`, `/print`, `/pivot` and `/license`. See [Enterprise features](./enterprise.md) for what those subpaths cover and what needs a Svelte-aware bundler.',
  ],
]

const ENTRY = { react: 'App.tsx', vue: 'App.vue', angular: 'app.component.ts' }
const LANG = { react: 'tsx', vue: 'vue', angular: 'ts' }
const FRAMEWORK_LABEL = { react: 'React', vue: 'Vue', angular: 'Angular' }

/** Small numbers read better as words in prose; past that a numeral is fine. */
const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const countWord = (n) => {
  const w = WORDS[n] ?? String(n)
  return w[0].toUpperCase() + w.slice(1)
}

/**
 * The example's source with its leading explanatory comment removed - the page
 * prose above each listing already says the same thing, and repeating it makes
 * the listing look padded.
 */
function listing(framework, recipe) {
  const src = readFileSync(join(examples, framework, recipe, ENTRY[framework]), 'utf8')
  const stripped =
    framework === 'vue'
      ? src.replace(/(<script setup lang="ts">\r?\n)(\/\/[^\n]*\r?\n)+/, '$1')
      : src.replace(/^(\/\*\*[\s\S]*?\*\/|(\/\/[^\n]*\r?\n)+)\r?\n?/, '')
  return stripped.trimEnd()
}

function section(framework, eol) {
  const recipes = readdirSync(join(examples, framework)).filter((f) =>
    statSync(join(examples, framework, f)).isDirectory(),
  )
  const missing = recipes.filter((r) => !RECIPES.some(([id]) => id === r))
  if (missing.length)
    throw new Error(
      `sync-example-docs: ${framework} has recipes with no prose: ${missing.join(', ')}. ` +
        `Add them to RECIPES in this script.`,
    )

  const blocks = RECIPES.map(([recipe, title, blurb]) =>
    [
      `### ${title}`,
      '',
      blurb,
      '',
      `<div data-docs-sandbox="${framework}:${recipe}" data-title="${title}"></div>`,
      '',
      '```' + LANG[framework] + ' {nocheck}',
      listing(framework, recipe),
      '```',
    ].join(eol),
  ).join(eol + eol)

  return [
    BEGIN,
    '',
    '## Examples',
    '',
    // Counted, not written out. "Eight complete apps" went stale the moment a
    // ninth recipe landed, which is the whole reason these sections are
    // generated rather than pasted.
    `${countWord(RECIPES.length)} complete apps, each one click from running. **Open in StackBlitz**`,
    'boots a full editable project - no local install, nothing to configure - and',
    "every one is compiled in this repository's CI, so what you open is what works.",
    '',
    'They all share the same typed `data.ts`, so the only thing that changes',
    'between recipes is the grid.',
    '',
    blocks,
    '',
    END,
  ].join(eol)
}

/**
 * The landing page's comparison table, generated from the same RECIPES list.
 *
 * It was hand-written, and a ninth recipe made it wrong twice over in one
 * afternoon: a missing row, and a "the same eight apps" sentence. A table whose
 * whole job is to enumerate the recipes should be generated from the recipes.
 */
const LANDING_BEGIN = '<!-- BEGIN generated recipe table - packages/grid-wc/scripts/sync-example-docs.mjs -->'
const LANDING_END = '<!-- END generated recipe table -->'

/** `A first grid` -> `a-first-grid`, matching how markdown builds heading ids. */
const anchor = (title) =>
  title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

function landingTable(eol) {
  const frameworks = Object.keys(ENTRY)
  return [
    LANDING_BEGIN,
    '',
    `The same ${WORDS[RECIPES.length] ?? RECIPES.length} apps in each framework, so you can compare them`,
    'directly - only the framework differs, never the data or the grid',
    'configuration. Every one is compiled in CI, so what you open is what works.',
    '',
    `| Recipe | What it shows | ${frameworks.map((f) => FRAMEWORK_LABEL[f]).join(' | ')} |`,
    `| --- | --- | ${frameworks.map(() => '---').join(' | ')} |`,
    ...RECIPES.map(([, title, blurb]) => {
      // The blurb trimmed to its first sentence - the table is a signpost, and
      // the page it links to carries the full text.
      const short = blurb.split('. ')[0].replace(/\.$/, '')
      const links = frameworks.map((f) => `[→](./${f}.md#${anchor(title)})`).join(' | ')
      return `| ${title} | ${short} | ${links} |`
    }),
    '',
    LANDING_END,
  ].join(eol)
}

const check = process.argv.includes('--check')
const stale = []

for (const framework of Object.keys(ENTRY)) {
  const path = join(docs, `${framework}.md`)
  const text = readFileSync(path, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const start = text.indexOf(BEGIN)
  const stop = text.indexOf(END)
  if (start < 0 || stop < 0)
    throw new Error(`sync-example-docs: markers missing in docs/help/web-components/${framework}.md`)

  const next = text.slice(0, start) + section(framework, eol) + text.slice(stop + END.length)
  if (check) {
    if (text.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) stale.push(`${framework}.md`)
    continue
  }
  writeFileSync(path, next)
}

// The landing page's comparison table, from the same list.
{
  const path = join(docs, 'frameworks.md')
  const text = readFileSync(path, 'utf8')
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const start = text.indexOf(LANDING_BEGIN)
  const stop = text.indexOf(LANDING_END)
  if (start < 0 || stop < 0)
    throw new Error('sync-example-docs: recipe-table markers missing in frameworks.md')
  const next = text.slice(0, start) + landingTable(eol) + text.slice(stop + LANDING_END.length)
  if (check) {
    if (text.replace(/\r\n/g, '\n') !== next.replace(/\r\n/g, '\n')) stale.push('frameworks.md')
  } else {
    writeFileSync(path, next)
  }
}

if (check) {
  if (stale.length) {
    console.error(
      `sync-example-docs: STALE: ${stale.join(', ')}. ` +
        `Run: pnpm --filter @svgrid/grid-wc sync:example-docs`,
    )
    process.exit(1)
  }
  console.log('sync-example-docs: the example sections are current')
} else {
  console.log(`sync-example-docs: ${RECIPES.length} recipes x ${Object.keys(ENTRY).length} frameworks`)
}
