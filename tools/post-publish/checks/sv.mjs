/**
 * `npx sv add @svgrid` (the @svgrid/sv add-on) in a fresh app from the
 * current Svelte CLI, then what a user does next: install, svelte-check,
 * build, open the demo route it wrote.
 *
 * Community add-ons are experimental upstream and the add-on API moves between
 * sv releases, so this runs the sv that `npx sv` resolves today, not the one
 * the add-on was written against.
 */
import { existsSync, freePort, join, loadPage, readFileSync, readJson, registryDoc, semverFrom, serve, tail } from '../lib.mjs'

export const name = 'sv'
export const description = 'npx sv create + npx sv add @svgrid: install, svelte-check, build, load /svgrid-demo'

const secs = (ms) => `${(ms / 1000).toFixed(1)} s`

export async function run(ctx) {
  const semver = semverFrom(ctx.work)
  const svVersion = (await registryDoc('sv'))?.['dist-tags']?.latest
  const addon = (await registryDoc('@svgrid/sv'))?.versions?.[ctx.versions.sv]
  const root = ctx.dir('sv')
  const app = join(root, 'app')
  const pkg = () => readJson(join(app, 'package.json'))

  if (!(await ctx.step(`sv@${svVersion} create (minimal, TypeScript)`, async () => {
    await ctx.ok(`npx -y sv@${svVersion} create app --template minimal --types ts --no-add-ons --no-install`, { cwd: root })
    return `@sveltejs/kit ${pkg().devDependencies?.['@sveltejs/kit']}, svelte ${pkg().devDependencies?.svelte}`
  }))) return

  let addOut = ''
  // Every option set, so sv does not prompt: the README's `npx sv add @svgrid`
  // with the defaults it documents (demo yes, AGENTS.md yes, enterprise no).
  if (!(await ctx.step(`npx sv add @svgrid (@svgrid/sv@${ctx.versions.sv}, defaults, npm install)`, async () => {
    const r = await ctx.ok(
      `npx -y sv@${svVersion} add @svgrid=demo:yes+agents:yes+enterprise:no --no-git-check --no-download-check --install npm`,
      { cwd: app },
    )
    addOut = r.out
    if (!/Successfully setup add-ons: svgrid/.test(r.out)) throw new Error(`sv did not report the add-on as set up:\n${tail(r.out)}`)
    return secs(r.ms)
  }))) return

  await ctx.step(`@svgrid/sv declares support for the sv that runs it (sv@${svVersion})`, async () => {
    const range = addon?.peerDependencies?.sv
    const warned = /was built for sv@[\d.]+ but you're running sv@[\d.]+/.exec(addOut)?.[0]
    if (range && !semver.satisfies(svVersion, range)) {
      throw new Error(`peerDependencies.sv is "${range}", which excludes sv@${svVersion}${warned ? `; every \`sv add @svgrid\` prints: "${warned}"` : ''}`)
    }
    if (warned) throw new Error(`sv prints: "${warned}"`)
    return `peer sv ${range}`
  })

  await ctx.step('writes the demo route, the AGENTS.md section and the dependency', async () => {
    const problems = []
    const demo = join(app, 'src', 'routes', 'svgrid-demo', '+page.svelte')
    if (!existsSync(demo)) problems.push('no src/routes/svgrid-demo/+page.svelte')
    else {
      const src = readFileSync(demo, 'utf8')
      if (!/lang="ts"/.test(src)) problems.push('demo is not TypeScript in a TypeScript project')
      if (!/from '@svgrid\/grid'/.test(src)) problems.push('demo does not import @svgrid/grid')
    }
    const agents = join(app, 'AGENTS.md')
    if (!existsSync(agents) || !readFileSync(agents, 'utf8').includes('## Tables and data grids')) problems.push('AGENTS.md has no "Tables and data grids" section')
    const deps = { ...pkg().dependencies, ...pkg().devDependencies }
    if (!deps['@svgrid/grid']) problems.push('package.json has no @svgrid/grid')
    if (deps['@svgrid/enterprise']) problems.push('enterprise was added with enterprise:no')
    if (problems.length) throw new Error(problems.join('\n'))
  })

  await ctx.step('the @svgrid/grid range it writes resolves to the latest grid', async () => {
    const deps = { ...pkg().dependencies, ...pkg().devDependencies }
    const range = deps['@svgrid/grid']
    const doc = await registryDoc('@svgrid/grid')
    const resolved = doc['dist-tags'][range] ?? semver.maxSatisfying(Object.keys(doc.versions), range)
    if (!resolved) throw new Error(`"@svgrid/grid": "${range}" matches no published version`)
    const installed = readJson(join(app, 'node_modules', '@svgrid', 'grid', 'package.json')).version
    if (installed !== ctx.versions.grid) throw new Error(`installed ${installed}, latest is ${ctx.versions.grid}`)
    const tag = range in doc['dist-tags'] ? ` (a dist-tag: a fresh install with no lockfile follows it across majors)` : ''
    return `writes "${range}"${tag}; installed ${installed}`
  })

  await ctx.step('svelte-check: 0 errors', async () => {
    const r = await ctx.sh('npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json --output machine', { cwd: app })
    const done = /COMPLETED (\d+) FILES (\d+) ERRORS (\d+) WARNINGS/.exec(r.out)
    if (!done) throw new Error(`svelte-check did not complete (exit ${r.code}):\n${tail(r.out)}`)
    if (+done[2]) throw new Error(r.out.split(/\r?\n/).filter((l) => / ERROR /.test(l)).join('\n'))
    return `${done[1]} files, ${done[3]} warnings`
  })

  if (!(await ctx.step('vite build', async () => secs((await ctx.ok('npx vite build', { cwd: app })).ms)))) return

  const port = await freePort()
  let server
  await ctx.step('/svgrid-demo renders the grid in Chromium', async () => {
    server = await serve(`npx vite preview --port ${port} --strictPort --host 127.0.0.1`, { cwd: app, url: `http://127.0.0.1:${port}/` })
    const shot = join(root, 'svgrid-demo.png')
    const { page, status, pageErrors, consoleErrors } = await loadPage(`http://127.0.0.1:${port}/svgrid-demo`, { screenshot: shot })
    const text = (await page.textContent('body')) ?? ''
    const headers = await page.locator('[role="columnheader"]').count()
    await page.close()
    const bad = []
    if (status !== 200) bad.push(`HTTP ${status}`)
    if (pageErrors.length) bad.push(`page errors: ${pageErrors.join(' | ')}`)
    if (consoleErrors.length) bad.push(`console errors: ${consoleErrors.join(' | ')}`)
    const missing = ['Ada Lovelace', 'Grace Hopper', 'Karen Sparck Jones', 'Mathematician'].filter((t) => !text.includes(t))
    if (missing.length) bad.push(`not rendered: ${missing.join(', ')}`)
    if (bad.length) throw new Error(`${bad.join('\n')}\nscreenshot: ${shot}`)
    return `${headers} column headers; ${shot}`
  }).finally(() => server?.stop())
}
