/**
 * `npx @svgrid/ui` in a fresh @svgrid/create SvelteKit app: add components and
 * page blocks across categories (picked from what `list` prints, so a renamed
 * recipe is caught here rather than in a hard-coded list), one block as its
 * headless core, then svelte-check, build, and load every preview route the
 * CLI wrote.
 */
import { existsSync, freePort, join, loadPage, readFileSync, readJson, serve, tail, writeFileSync } from '../lib.mjs'
import { mkdirSync } from 'node:fs'

export const name = 'ui'
export const description = 'npx @svgrid/ui list/add (components, blocks, --headless) in a fresh app: check, build, load'

const secs = (ms) => `${(ms / 1000).toFixed(1)} s`
// eslint-disable-next-line no-control-regex
const plain = (s) => String(s).replace(/\x1b\[[0-9;]*m/g, '')
const pascal = (id) => id.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())

/** `list` output: components, component groups and page-block groups. */
function parseList(out) {
  const components = []
  const groups = []
  const blocks = []
  let section = ''
  for (const raw of plain(out).split(/\r?\n/)) {
    if (/^Available components/.test(raw)) section = 'components'
    else if (/^Groups/.test(raw)) section = 'groups'
    else if (/^Page blocks/.test(raw)) section = 'blocks'
    else if (!raw.trim() || !/^\s{2}\S/.test(raw)) {
      if (!raw.trim()) continue
      section = ''
    } else {
      const m = /^\s{2}(\S+)\s{2,}(.*)$/.exec(raw)
      if (!m) continue
      if (section === 'components') components.push(m[1])
      else if (section === 'groups') groups.push({ id: m[1], members: m[2].split(/,\s*/) })
      else if (section === 'blocks') blocks.push({ id: m[1], members: m[2].split(/,\s*/) })
    }
  }
  return { components, groups, blocks }
}

/** The files an `add` run says it wrote (`+ path` lines). */
const written = (out) => [...plain(out).matchAll(/^\s+\+ (\S+)$/gm)].map((m) => m[1].replace(/\\/g, '/'))

export async function run(ctx) {
  const v = ctx.versions.ui
  const vc = ctx.versions.create
  const root = ctx.dir('ui')
  const app = join(root, 'app')
  const ui = `npx -y @svgrid/ui@${v}`

  await ctx.step(`${ui} --help documents add, list, try and --headless`, async () => {
    const r = await ctx.ok(`${ui} --help`, { cwd: root })
    const missing = ['add', 'list', 'try', '--headless', '--preview'].filter((w) => !plain(r.out).includes(w))
    if (missing.length) throw new Error(`--help does not mention ${missing.join(', ')}:\n${tail(r.out)}`)
  })

  let catalog
  if (!(await ctx.step(`${ui} list prints components, groups and page blocks`, async () => {
    const r = await ctx.ok(`${ui} list`, { cwd: root })
    catalog = parseList(r.out)
    const { components, groups, blocks } = catalog
    if (components.length < 20 || groups.length < 5 || blocks.length < 5) throw new Error(`parsed ${components.length} components, ${groups.length} groups, ${blocks.length} block groups:\n${tail(r.out, 40)}`)
    const orphans = groups.flatMap((g) => g.members).filter((m) => !components.includes(m))
    if (orphans.length) throw new Error(`groups name components the list does not have: ${orphans.join(', ')}`)
    return `${components.length} components in ${groups.length} groups, ${blocks.length} block groups (${blocks.reduce((n, b) => n + b.members.length, 0)} blocks)`
  }))) return

  // The first component of every group, and the first block of every sixth
  // block group: each category, without adding all ~250 files.
  const pickComponents = catalog.groups.map((g) => g.members[0])
  const pickBlocks = catalog.blocks.filter((_, i) => i % 6 === 0).map((b) => b.members[0])
  const headlessBlock = catalog.blocks.find((b) => b.members.length > 1)?.members[1]

  if (!(await ctx.step(`npm create @svgrid@${vc} app -- -t sveltekit, npm install`, async () => {
    await ctx.ok(`npm create @svgrid@${vc} app -- -t sveltekit`, { cwd: root })
    const r = await ctx.ok('npm install', { cwd: app })
    const grid = readJson(join(app, 'node_modules', '@svgrid', 'grid', 'package.json')).version
    return `${secs(r.ms)} install; @svgrid/grid ${grid}`
  }))) return

  const previews = []
  const addStep = (what, ids) =>
    ctx.step(`add ${what} --preview: ${ids.join(' ')}`, async () => {
      const r = await ctx.ok(`${ui} add ${ids.join(' ')} --preview`, { cwd: app })
      const files = written(r.out)
      const missing = ids.filter((id) => !files.some((f) => f.endsWith(`/${id}.svelte`)))
      if (missing.length) throw new Error(`no file reported for ${missing.join(', ')}:\n${tail(r.out)}`)
      const absent = files.filter((f) => !existsSync(join(app, f)))
      if (absent.length) throw new Error(`reported but not on disk: ${absent.join(', ')}`)
      for (const id of ids) {
        if (!existsSync(join(app, 'src', 'routes', 'preview', id, '+page.svelte'))) throw new Error(`no /preview/${id} route`)
        previews.push(id)
      }
      return `${files.length} files`
    })
  await addStep('one component per group', pickComponents)
  await addStep('page blocks from across the groups', pickBlocks)

  let headlessFile
  let headlessOut = ''
  if (headlessBlock) {
    await ctx.step(`add ${headlessBlock} --headless writes only its core`, async () => {
      const r = await ctx.ok(`${ui} add ${headlessBlock} --headless --dir src/lib/headless`, { cwd: app })
      headlessOut = plain(r.out)
      const files = written(r.out)
      if (files.length !== 1 || !files[0].endsWith(`/${headlessBlock}.svelte.ts`)) throw new Error(`expected one ${headlessBlock}.svelte.ts, got: ${files.join(', ') || 'none'}\n${tail(r.out)}`)
      headlessFile = files[0]
      const src = readFileSync(join(app, headlessFile), 'utf8')
      const fn = `create${pascal(headlessBlock)}`
      if (!new RegExp(`export function ${fn}\\b`).test(src)) throw new Error(`${headlessFile} does not export ${fn}()`)
      return headlessFile
    })

    await ctx.step(`add ${headlessBlock} --headless: the printed "Use it" line imports the file it wrote`, async () => {
      if (!headlessFile) throw new Error('nothing was written')
      const use = /Use it:\s*(.*)/.exec(headlessOut)?.[1]?.trim()
      if (!use) return 'no "Use it" line printed'
      // The core is a .svelte.ts module exporting create<Block>(); there is no
      // component to default-import or render as a tag.
      const fn = `create${pascal(headlessBlock)}`
      if (!use.includes(fn)) throw new Error(`wrote ${headlessFile} (exports ${fn}), but prints: "Use it: ${use}"`)
      return use
    })

    if (headlessFile) {
      const dir = join(app, 'src', 'routes', 'ui-headless')
      mkdirSync(dir, { recursive: true })
      const spec = '../../' + headlessFile.replace(/^src\//, '').replace(/\.ts$/, '.js')
      writeFileSync(
        join(dir, '+page.svelte'),
        `<script lang="ts">\n  import { create${pascal(headlessBlock)} } from '${spec}'\n\n  const core = create${pascal(headlessBlock)}()\n</script>\n\n<h1>Headless ${headlessBlock}</h1>\n<p data-core-keys>{Object.keys(core).join(', ')}</p>\n`,
      )
    }
  }

  await ctx.step('svelte-check: 0 errors', async () => {
    const r = await ctx.sh('npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json --output machine', { cwd: app })
    const done = /COMPLETED (\d+) FILES (\d+) ERRORS (\d+) WARNINGS/.exec(r.out)
    if (!done) throw new Error(`svelte-check did not complete (exit ${r.code}):\n${tail(r.out)}`)
    if (+done[2]) throw new Error(r.out.split(/\r?\n/).filter((l) => / ERROR /.test(l)).join('\n'))
    const warnings = r.out.split(/\r?\n/).filter((l) => / WARNING /.test(l))
    return `${done[1]} files, ${done[3]} warnings${warnings.length ? `: ${warnings.slice(0, 3).map((l) => l.replace(/^\d+ WARNING /, '')).join(' | ')}` : ''}`
  })

  if (!(await ctx.step('vite build', async () => secs((await ctx.ok('npx vite build', { cwd: app })).ms)))) return

  const port = await freePort()
  let server
  try {
    if (!(await ctx.step('vite preview answers', async () => {
      server = await serve(`npx vite preview --port ${port} --strictPort --host 127.0.0.1`, { cwd: app, url: `http://127.0.0.1:${port}/` })
    }))) return

    const shots = join(root, 'shots')
    mkdirSync(shots, { recursive: true })
    const load = async (route, check) => {
      const shot = join(shots, `${route.replace(/\W+/g, '_') || 'index'}.png`)
      const { page, status, pageErrors, consoleErrors } = await loadPage(`http://127.0.0.1:${port}${route}`, { screenshot: shot })
      try {
        const bad = []
        if (status !== 200) bad.push(`HTTP ${status}`)
        if (pageErrors.length) bad.push(`page errors: ${pageErrors.join(' | ')}`)
        if (consoleErrors.length) bad.push(`console errors: ${consoleErrors.join(' | ')}`)
        const extra = await check(page)
        if (extra) bad.push(extra)
        return bad.length ? `${route}: ${bad.join('; ')} (${shot})` : null
      } finally {
        await page.close()
      }
    }

    await ctx.step(`every /preview/<id> route renders its recipe (${previews.length})`, async () => {
      const failures = []
      const index = await load('/preview', async (page) => {
        const links = await page.locator('a[href^="/preview/"]').count()
        return links === previews.length ? null : `index links ${links} previews, expected ${previews.length}`
      })
      if (index) failures.push(index)
      for (const id of previews) {
        const f = await load(`/preview/${id}`, async (page) => {
          const stage = page.locator('.svui-preview__stage')
          if (!(await stage.count())) return 'no preview stage'
          const box = await stage.boundingBox()
          const kids = await stage.locator('*').count()
          return kids && box && box.height > 40 ? null : `stage is empty (${kids} elements, ${box?.height ?? 0}px tall)`
        })
        if (f) failures.push(f)
      }
      if (failures.length) throw new Error(failures.join('\n'))
      return `${previews.length} routes + index; screenshots in ${shots}`
    })

    if (headlessFile) {
      await ctx.step(`the ${headlessBlock} headless core runs in a route`, async () => {
        const f = await load('/ui-headless', async (page) => {
          const keys = ((await page.textContent('[data-core-keys]')) ?? '').trim()
          return keys ? null : 'the core returned no members'
        })
        if (f) throw new Error(f)
      })
    }
  } finally {
    server?.stop()
  }
}
