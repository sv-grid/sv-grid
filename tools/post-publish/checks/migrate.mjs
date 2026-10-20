/**
 * @svgrid/migrate on the two table libraries it ports from, each in its own
 * fresh SvelteKit app with @svgrid/grid from npm, judged by svelte-check, a
 * build and a page load.
 *
 * The TanStack fixture is the v9 shape that shipped broken until 3.0.2:
 * `columnHelper.columns([...])`, `$state<SortingState>([])` and a
 * `RowSelectionState` import, with the import list formatted the way Prettier
 * writes it. It must come out with no type errors.
 *
 * The svelte-headless-table fixture keeps a pager outside the <table>, which
 * the codemod names rather than ports: its errors must be exactly the names
 * the warnings list, and removing that markup (what the warning says to do)
 * must leave none.
 */
import { cpSync } from 'node:fs'
import { REPO, freePort, join, loadPage, readFileSync, registryDoc, serve, tail, writeFileSync } from '../lib.mjs'

export const name = 'migrate'
export const description = 'npx @svgrid/migrate on TanStack v9 + svelte-headless-table fixtures, then svelte-check, build and load'

const FIXTURES = join(REPO, 'tools', 'post-publish', 'fixtures', 'migrate')

const SCENARIOS = [
  {
    id: 'tanstack',
    label: 'TanStack v9',
    file: 'src/lib/payments/payments-table.svelte',
    route: '/tanstack',
    rows: ['ken99@example.com', 'carmella@example.com'],
    // A component already on runes: it runs in sv's default forced-runes app.
    legacyMode: false,
  },
  {
    id: 'headless',
    label: 'svelte-headless-table',
    file: 'src/lib/orders/OrdersTable.svelte',
    route: '/headless',
    rows: ['Northwind', 'Litware'],
    // A store-era component compiles per-file (legacy mode), as it did before
    // the port. sv's template forces runes on every file, where the original
    // would not have compiled either; the README's upgrade path has no such line.
    legacyMode: true,
  },
]

/** svelte-check --output machine, parsed. Paths come back relative, with OS separators. */
function parseCheck(out) {
  const problems = []
  for (const line of out.split(/\r?\n/)) {
    const m = /^\d+ (ERROR|WARNING) "(.+?)" (\d+):(\d+) "(.*)"$/.exec(line)
    if (m) problems.push({ severity: m[1], file: m[2].replace(/\\+/g, '/'), line: +m[3], col: +m[4], message: m[5].replace(/\\n/g, ' ') })
  }
  const completed = /COMPLETED \d+ FILES \d+ ERRORS \d+ WARNINGS/.test(out)
  return { problems, completed, errors: problems.filter((p) => p.severity === 'ERROR') }
}

/** The preview's per-file sections: `--- path ---`, the new source, then warning lines. */
function parsePreview(out) {
  const files = {}
  let current
  for (const line of out.split(/\r?\n/)) {
    const head = /^--- (.+) ---$/.exec(line)
    if (head) {
      current = head[1].replace(/\\/g, '/')
      files[current] = { warnings: [], notes: [] }
      continue
    }
    const w = /^\s+(warning|note)\s+(.*)$/.exec(line)
    if (w && current) files[current][w[1] === 'warning' ? 'warnings' : 'notes'].push(w[2])
  }
  return files
}

const fmt = (ps) => ps.map((p) => `${p.file}:${p.line}:${p.col} ${p.message}`).join('\n')
const secs = (ms) => `${(ms / 1000).toFixed(1)} s`

export async function run(ctx) {
  const v = ctx.versions.migrate
  const vg = ctx.versions.grid
  const svVersion = (await registryDoc('sv'))?.['dist-tags']?.latest
  const root = ctx.dir('migrate')

  await ctx.step(`npx @svgrid/migrate@${v} --help names both sources and --write`, async () => {
    const r = await ctx.ok(`npx -y @svgrid/migrate@${v} --help`, { cwd: root })
    for (const want of ['svelte-headless-table', '@tanstack/svelte-table', '--write']) {
      if (!r.out.includes(want)) throw new Error(`--help does not mention ${want}:\n${tail(r.out)}`)
    }
  })

  for (const s of SCENARIOS) await scenario(ctx, s, { v, vg, svVersion, root })
}

async function scenario(ctx, s, { v, vg, svVersion, root }) {
  const app = join(root, s.id)
  const label = (text) => `${s.label}: ${text}`

  if (!(await ctx.step(label(`fresh SvelteKit app (sv@${svVersion} create, minimal, TypeScript) + fixture`), async () => {
    await ctx.ok(`npx -y sv@${svVersion} create ${s.id} --template minimal --types ts --no-add-ons --no-install`, { cwd: root })
    cpSync(join(FIXTURES, s.id, 'src'), join(app, 'src'), { recursive: true })
    if (s.legacyMode) {
      const cfg = join(app, 'vite.config.ts')
      const text = readFileSync(cfg, 'utf8')
      const stripped = text.replace(/compilerOptions:\s*\{[\s\S]*?runes:[\s\S]*?\n\t*\s*\},?\n/, '')
      if (stripped === text) throw new Error(`could not find the forced-runes option in vite.config.ts:\n${text}`)
      writeFileSync(cfg, stripped)
    }
    const kit = JSON.parse(readFileSync(join(app, 'package.json'), 'utf8')).devDependencies?.['@sveltejs/kit']
    return `@sveltejs/kit ${kit}${s.legacyMode ? ', per-file runes mode' : ', forced runes mode'}`
  }))) return

  let preview = {}
  await ctx.step(label('preview (no --write) lists the file and leaves it untouched'), async () => {
    const before = readFileSync(join(app, s.file), 'utf8')
    const r = await ctx.ok(`npx -y @svgrid/migrate@${v} src`, { cwd: app })
    preview = parsePreview(r.out)
    if (!preview[s.file]) throw new Error(`preview does not list ${s.file}; lists ${Object.keys(preview).join(', ') || 'nothing'}\n${tail(r.out)}`)
    if (readFileSync(join(app, s.file), 'utf8') !== before) throw new Error('preview changed the file on disk')
    const w = preview[s.file].warnings
    return `${w.length} warning(s)${w.length ? `: ${w.map((x) => x.slice(0, 70)).join(' | ')}` : ''}`
  })

  await ctx.step(label('--write rewrites it onto @svgrid/grid'), async () => {
    const r = await ctx.ok(`npx -y @svgrid/migrate@${v} src --write`, { cwd: app })
    if (!/Rewrote 1 file\(s\)/.test(r.out)) throw new Error(tail(r.out))
    const src = readFileSync(join(app, s.file), 'utf8')
    if (/@tanstack\/|svelte-headless-table/.test(src)) throw new Error(`still imports the old library:\n${src.slice(0, 800)}`)
    if (!/<SvGrid\b/.test(src)) throw new Error(`no <SvGrid> in the output:\n${src}`)
  })

  if (!(await ctx.step(label(`npm install with @svgrid/grid@${vg}`), async () => {
    const r = await ctx.ok(`npm i @svgrid/grid@${vg}`, { cwd: app })
    return secs(r.ms)
  }))) return

  const svelteCheck = async () => {
    const r = await ctx.sh('npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json --output machine', { cwd: app })
    const parsed = parseCheck(r.out)
    if (!parsed.completed) throw new Error(`svelte-check did not complete (exit ${r.code}):\n${tail(r.out)}`)
    return parsed
  }

  let clean = false
  if (s.id === 'tanstack') {
    clean = await ctx.step(label('svelte-check reports 0 errors'), async () => {
      const check = await svelteCheck()
      if (check.errors.length) {
        const out = readFileSync(join(app, s.file), 'utf8').split('\n').slice(0, 20).join('\n')
        throw new Error(`${check.errors.length} error(s):\n${fmt(check.errors)}\n--- head of the migrated file ---\n${out}`)
      }
      return `${check.problems.length} warning(s)`
    })
  } else {
    // The names the "still reads ... from the view model" warning lists.
    const leftovers = new Set()
    for (const w of preview[s.file]?.warnings ?? []) {
      if (/still reads/.test(w)) for (const m of w.split(/from the view model/)[0].matchAll(/`([A-Za-z_$][\w$]*)`/g)) leftovers.add(m[1])
    }

    await ctx.step(label('svelte-check errors are only the leftovers the codemod named'), async () => {
      const check = await svelteCheck()
      const src = readFileSync(join(app, s.file), 'utf8')
      const problems = []
      if (!leftovers.size) problems.push('the codemod named no view-model leftovers, but the fixture reads four')
      if (!/\/\/ TODO port: cell:/.test(src)) problems.push('the custom cell renderer was not kept as a `// TODO port:` comment')
      const named = (e) => [...leftovers].some((n) => e.message.includes(`$${n}`) || e.message.includes(`'${n}'`))
      const unnamed = check.errors.filter((e) => !named(e))
      if (unnamed.length) problems.push(`errors the warnings did not name:\n${fmt(unnamed)}`)
      if (problems.length) throw new Error(problems.join('\n'))
      return `${check.errors.length} error(s), all on named leftovers: ${[...leftovers].join(', ')}`
    })

    clean = await ctx.step(label('removing the named leftover markup leaves 0 errors'), async () => {
      if (!leftovers.size) throw new Error('nothing was named to remove')
      const file = join(app, s.file)
      const lines = readFileSync(file, 'utf8').split('\n')
      const reads = (l) => [...leftovers].some((n) => l.includes(`$${n}`))
      const kept = lines.filter((l) => !reads(l))
      writeFileSync(file, kept.join('\n'))
      const after = await svelteCheck()
      if (after.errors.length) throw new Error(`${after.errors.length} error(s):\n${fmt(after.errors)}`)
      return `removed ${lines.length - kept.length} line(s); ${after.problems.length} warning(s)`
    })
  }
  if (!clean) return

  if (!(await ctx.step(label('vite build'), async () => secs((await ctx.ok('npx vite build', { cwd: app })).ms)))) return

  const port = await freePort()
  let server
  await ctx.step(label(`${s.route} renders the rows in Chromium`), async () => {
    server = await serve(`npx vite preview --port ${port} --strictPort --host 127.0.0.1`, { cwd: app, url: `http://127.0.0.1:${port}/` })
    const shot = join(root, `${s.id}.png`)
    const { page, status, pageErrors, consoleErrors } = await loadPage(`http://127.0.0.1:${port}${s.route}`, { screenshot: shot })
    const text = (await page.textContent('body')) ?? ''
    await page.close()
    const bad = []
    if (status !== 200) bad.push(`HTTP ${status}`)
    if (pageErrors.length) bad.push(`page errors: ${pageErrors.join(' | ')}`)
    if (consoleErrors.length) bad.push(`console errors: ${consoleErrors.join(' | ')}`)
    const missing = s.rows.filter((r) => !text.includes(r))
    if (missing.length) bad.push(`rows not rendered: ${missing.join(', ')}`)
    if (bad.length) throw new Error(`${bad.join('\n')}\nscreenshot: ${shot}`)
    return shot
  }).finally(() => server?.stop())
}
