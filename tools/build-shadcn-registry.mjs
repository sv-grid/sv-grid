#!/usr/bin/env node
/**
 * Emit a shadcn-svelte registry so SvGrid installs with the CLI a shadcn app
 * already has:
 *
 *   npx shadcn-svelte@latest add https://svgrid.com/r/data-table.json
 *
 * Meeting people in their own tool matters more than owning the command. The
 * file content is read from the @svgrid/ui recipe rather than duplicated, so
 * `npx @svgrid/ui add data-table` and the shadcn route always ship the same
 * component.
 *
 *   docs:    https://shadcn-svelte.com/docs/registry/registry-item-json
 *   output:  website/public/r/*.json  (served from https://svgrid.com/r/)
 *
 * Run it from anywhere: `node tools/build-shadcn-registry.mjs`.
 * Dependency-free so it runs on a fresh clone without `pnpm install`.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const RECIPES = join(ROOT, 'packages', 'svgrid-ui', 'recipes')
const OUT_DIR = join(ROOT, 'website', 'public', 'r')
const SITE = process.env.SVGRID_SITE_ORIGIN ?? 'https://svgrid.com'

const ITEM_SCHEMA = 'https://shadcn-svelte.com/schema/registry-item.json'
const REGISTRY_SCHEMA = 'https://shadcn-svelte.com/schema/registry.json'

/**
 * Which recipes are published to the shadcn registry. Deliberately a short
 * list, not the whole 84-item UI kit: this route exists for people who already
 * have a shadcn app and want the grid, so the grid is what it carries.
 */
const ITEMS = [
  {
    name: 'data-table',
    title: 'SvGrid Data Table',
    description:
      'Sortable, filterable, paginated data table with row selection, built on SvGrid. ' +
      'The behaviour lives in @svgrid/grid, so it updates with a version bump instead of a re-paste.',
    recipe: 'data/data-table.svelte',
    // Relative to the project's `components` alias, NOT the project root: the
    // CLI joins the two, so a leading `src/lib/components/...` here installs to
    // `src/lib/components/src/lib/components/...`. This lands it beside the
    // shadcn UI components, where a shadcn app expects to find it.
    target: 'ui/data-table/data-table.svelte',
    dependencies: ['@svgrid/grid'],
    categories: ['data-table', 'grid', 'table'],
  },
]

async function buildItem(item) {
  const content = await readFile(join(RECIPES, item.recipe), 'utf8')
  return {
    $schema: ITEM_SCHEMA,
    name: item.name,
    title: item.title,
    type: 'registry:block',
    description: item.description,
    author: 'jQWidgets Ltd <https://svgrid.com>',
    dependencies: item.dependencies,
    categories: item.categories,
    docs: `Docs: ${SITE}/docs/getting-started/ - migrating from the shadcn-svelte data table: ${SITE}/docs/help/migrating-from-shadcn-data-table/`,
    files: [
      {
        // `content` (not `path`) is what a SERVED item carries - the CLI fetches
        // this JSON and writes the string, it never reaches into our repo.
        content,
        type: 'registry:component',
        target: item.target,
      },
    ],
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  const built = []
  for (const item of ITEMS) {
    const json = await buildItem(item)
    await writeFile(join(OUT_DIR, `${item.name}.json`), JSON.stringify(json, null, 2) + '\n')
    built.push({ name: item.name, type: json.type, title: item.title, description: item.description })
  }

  // The index a human (or another registry) browses.
  const index = {
    $schema: REGISTRY_SCHEMA,
    name: 'svgrid',
    homepage: SITE,
    items: built,
  }
  await writeFile(join(OUT_DIR, 'registry.json'), JSON.stringify(index, null, 2) + '\n')

  console.log(
    `build-shadcn-registry: ${built.length} item(s) -> website/public/r/ ` +
      `(${built.map((b) => b.name).join(', ')})`,
  )
}

await main()
