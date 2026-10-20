/**
 * What the registry itself serves, before anything runs: for every package at
 * `latest`, its dependency ranges resolve, no `workspace:` range leaked, every
 * exports/bin/main target is in the tarball, and every @svgrid range a
 * template or generator writes into a user's project resolves too.
 */
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { PACKAGES, existsSync, freshDir, readFileSync, readJson, registryDoc, semverFrom } from '../lib.mjs'

export const name = 'registry'
export const description = 'dependency ranges resolve, tarballs contain their entry points, template pins exist'

function targets(exp, out = []) {
  if (typeof exp === 'string') out.push(exp)
  else if (exp && typeof exp === 'object') for (const v of Object.values(exp)) targets(v, out)
  return out
}

function* walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    if (statSync(p).isDirectory()) {
      if (e !== 'node_modules') yield* walk(p)
    } else yield p
  }
}

export async function run(ctx) {
  const semver = semverFrom(ctx.work)
  const satisfiable = async (dep, range) => {
    if (/^(workspace|file|link):/.test(range)) return `${dep}@${range} is a workspace/file range`
    if (range === 'latest' || range === 'next') return null
    const doc = await registryDoc(dep)
    if (!doc) return `${dep} is not on npm`
    return semver.maxSatisfying(Object.keys(doc.versions), range) ? null : `${dep}@${range} matches no published version (latest ${doc['dist-tags'].latest})`
  }

  const unpacked = ctx.dir('registry')
  for (const short of PACKAGES) {
    const pkg = `@svgrid/${short}`
    const v = ctx.versions[short]
    await ctx.step(`${pkg}@${v}: dependency ranges resolve`, async () => {
      const m = (await registryDoc(pkg)).versions[v]
      const problems = []
      for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
        for (const [dep, range] of Object.entries(m[field] ?? {})) {
          const p = await satisfiable(dep, range)
          if (p) problems.push(`${field}: ${p}`)
        }
      }
      if (problems.length) throw new Error(problems.join('\n'))
    })

    await ctx.step(`${pkg}@${v}: tarball has every entry point`, async () => {
      const dir = freshDir(join(unpacked, short))
      // `npm pack` prints the tarball name; cmd.exe would not expand a *.tgz glob.
      const tgz = (await ctx.ok(`npm pack ${pkg}@${v} --silent`, { cwd: dir })).out.trim().split(/\r?\n/).pop()
      await ctx.ok(`tar xzf ${tgz}`, { cwd: dir })
      const m = readJson(join(dir, 'package', 'package.json'))
      const want = []
      for (const f of ['main', 'module', 'types', 'typings', 'svelte']) if (typeof m[f] === 'string') want.push([f, m[f]])
      if (typeof m.bin === 'string') want.push(['bin', m.bin])
      else for (const [k, f] of Object.entries(m.bin ?? {})) want.push([`bin.${k}`, f])
      for (const [k, e] of Object.entries(m.exports ?? {})) for (const t of targets(e)) want.push([`exports["${k}"]`, t])
      const missing = want.filter(([, f]) => !f.includes('*') && !existsSync(join(dir, 'package', f)))
      if (missing.length) throw new Error(missing.map(([k, f]) => `${k} -> ${f}`).join('\n'))
      return `${want.length} targets`
    })
  }

  // Ranges written into user projects: template package.json files, data-option
  // deps.json, and "@svgrid/x": "range" pairs in shipped generator code.
  await ctx.step('every range a template or generator writes resolves', async () => {
    const pair = /["'](@svgrid\/[a-z0-9-]+)["']\s*:\s*["']((?:\^|~|>=)?\d+\.\d+(?:\.\d+)?[^"'\s]*|latest|workspace:[^"']*)["']/g
    const found = new Map()
    for (const short of PACKAGES) {
      const base = join(unpacked, short, 'package')
      if (!existsSync(base)) continue
      for (const f of walk(base)) {
        const rel = `${short}/${relative(base, f).replace(/\\/g, '/')}`
        if (rel === `${short}/package.json` || /\/cdn\/|\.d\.ts$|\.map$/.test(rel)) continue
        if (!/(_?package\.json|deps\.json|\.m?js|\.cjs|\.ts|\.svelte)$/.test(rel)) continue
        const text = readFileSync(f, 'utf8')
        if (text.length > 3e6) continue
        for (const m of text.matchAll(pair)) {
          const k = `${m[1]}\t${m[2]}`
          if (!found.has(k)) found.set(k, rel)
        }
      }
    }
    const problems = []
    for (const [k, where] of found) {
      const [dep, range] = k.split('\t')
      const p = await satisfiable(dep, range)
      if (p) problems.push(`${p} (in ${where})`)
    }
    if (problems.length) throw new Error(problems.join('\n'))
    return `${found.size} distinct ranges`
  })
}
