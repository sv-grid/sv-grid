#!/usr/bin/env node
/**
 * Copy every Blocks demo into the @svgrid/ui recipe set, so
 * `npx @svgrid/ui add <block>` and `add blocks/<group>` hand out the exact
 * file the gallery shows.
 *
 * Source of truth: examples/src/demos/<n>-block-*.svelte, registered in
 * website/src/lib/demos.ts with category 'Blocks' and a `group` from
 * examples/src/shared/block-groups.json. For each one this writes
 *
 *   packages/svgrid-ui/recipes/blocks/<group>/<id>.svelte   (byte copy)
 *
 * where <id> is the demo id minus its "<n>-block-" prefix, and upserts the
 * item plus one `blocks/<group>` group in recipes/registry.json. Recipe files
 * under recipes/blocks/ that no demo produces are deleted: the folder is
 * generated.
 *
 *   node tools/sync-block-recipes.mjs           write
 *   node tools/sync-block-recipes.mjs --check   exit 1 if anything is stale
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseDemoRegistry } from './lib/demo-registry.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DEMOS = join(ROOT, 'examples', 'src', 'demos')
const RECIPES = join(ROOT, 'packages', 'svgrid-ui', 'recipes')
const BLOCKS_DIR = join(RECIPES, 'blocks')
const REGISTRY = join(RECIPES, 'registry.json')
const GROUPS = JSON.parse(readFileSync(join(ROOT, 'examples', 'src', 'shared', 'block-groups.json'), 'utf8'))

/** `<n>-block-auth-centered-sign-in` -> `auth-centered-sign-in`. */
export function blockRecipeId(demoId) {
  return demoId.replace(/^\d+-block-/, '')
}

/** The recipe set the Blocks demos imply: files to write and registry entries. */
export async function planBlockRecipes(root = ROOT) {
  const groupIds = new Set(GROUPS.map((g) => g.id))
  const blocks = (await parseDemoRegistry(root)).filter((d) => d.category === 'Blocks')
  const problems = []
  const files = new Map() // abs path -> source abs path
  const items = []
  for (const g of GROUPS) {
    for (const d of blocks.filter((b) => b.group === g.id)) {
      const id = blockRecipeId(d.id)
      const from = `blocks/${g.id}/${id}.svelte`
      files.set(join(RECIPES, from), join(DEMOS, `${d.id}.svelte`))
      items.push({
        id,
        title: d.title.replace(/ block$/i, ''),
        description: d.blurb,
        aliases: [d.id],
        deps: ['@svgrid/grid'],
        files: [{ write: `${id}.svelte`, from }],
        group: `blocks/${g.id}`,
      })
    }
  }
  for (const d of blocks) {
    if (!d.group) problems.push(`${d.id}: Blocks demo has no group`)
    else if (!groupIds.has(d.group)) problems.push(`${d.id}: unknown group '${d.group}'`)
  }
  const groups = {}
  for (const g of GROUPS) {
    const ids = items.filter((it) => it.group === `blocks/${g.id}`).map((it) => it.id)
    if (ids.length) groups[`blocks/${g.id}`] = { title: `${g.label} blocks`, items: ids }
  }
  return { files, items, groups, problems }
}

function listFiles(dir) {
  if (!existsSync(dir)) return []
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out.push(...listFiles(p))
    else out.push(p)
  }
  return out
}

/** The registry with its block items and groups replaced by `plan`'s. */
export function mergeRegistry(registry, plan) {
  const groups = {}
  for (const [k, v] of Object.entries(registry.groups ?? {})) if (!k.startsWith('blocks/')) groups[k] = v
  Object.assign(groups, plan.groups)
  const items = (registry.items ?? []).filter((it) => !String(it.group ?? '').startsWith('blocks/'))
  items.push(...plan.items)
  return { ...registry, groups, items }
}

async function main() {
  const check = process.argv.includes('--check')
  const plan = await planBlockRecipes()
  if (plan.problems.length) {
    for (const p of plan.problems) console.error(`  x ${p}`)
    process.exit(1)
  }
  const stale = []

  for (const [dest, src] of plan.files) {
    const bytes = readFileSync(src)
    if (existsSync(dest) && readFileSync(dest).equals(bytes)) continue
    stale.push(`write ${relative(ROOT, dest)}`)
    if (!check) {
      mkdirSync(dirname(dest), { recursive: true })
      writeFileSync(dest, bytes)
    }
  }
  for (const f of listFiles(BLOCKS_DIR)) {
    if (plan.files.has(f)) continue
    stale.push(`delete ${relative(ROOT, f)}`)
    if (!check) rmSync(f)
  }

  const raw = readFileSync(REGISTRY, 'utf8')
  const eol = raw.includes('\r\n') ? '\r\n' : '\n'
  const next = JSON.stringify(mergeRegistry(JSON.parse(raw), plan), null, 2).replace(/\n/g, eol) + eol
  if (next !== raw) {
    stale.push(`update ${relative(ROOT, REGISTRY)}`)
    if (!check) writeFileSync(REGISTRY, next)
  }

  const n = plan.items.length
  if (check) {
    if (stale.length) {
      for (const s of stale) console.error(`  stale: ${s}`)
      console.error('Block recipes are out of date - run node tools/sync-block-recipes.mjs')
      process.exit(1)
    }
    console.log(`block recipes up to date (${n} blocks)`)
  } else {
    for (const s of stale) console.log(`  ${s}`)
    console.log(`${n} blocks in ${Object.keys(plan.groups).length} groups`)
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main()
