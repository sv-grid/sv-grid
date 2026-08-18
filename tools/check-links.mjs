/**
 * Verify every svgrid.com URL and every relative markdown link in the repo's
 * docs, READMEs, and shipped source comments.
 *
 * Exists because the READMEs accumulated dead links (a legacy `#/` hash URL in
 * a package homepage, `/docs/studio` which never existed) and redirect hops
 * (`/docs` -> `/docs/`) that split ranking signal. Run it before a release.
 *
 *   node tools/check-links.mjs           # READMEs, docs, .github (the crawled surface)
 *   node tools/check-links.mjs --all     # every file, including source comments
 *   node tools/check-links.mjs --local   # relative links only, no network
 *
 * Default scope is deliberately narrow. Doc-URL comments inside
 * packages/svgrid-ui/recipes/*.svelte are not crawled by anything and carry a
 * long tail of trailing-slash redirects that would drown the real failures.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname, resolve, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCAL_ONLY = process.argv.includes('--local')
const ALL = process.argv.includes('--all')

const SKIP = /node_modules|[\\/]\.git[\\/]|website[\\/]dist|\.svelte-kit|packages[\\/]mcp[\\/]src[\\/]data\.ts|[\\/]dist[\\/]/
// The crawled surface: what GitHub, npm, and answer engines actually read.
const IN_SCOPE = /README\.md$|^AGENTS\.md$|^CONTRIBUTING\.md$|^SECURITY\.md$|(^|[\\/])docs[\\/]|(^|[\\/])\.github[\\/]|(^|[\\/])skills[\\/]/
const EXT = new Set(ALL ? ['.md', '.mjs', '.svelte', '.ts', '.yml'] : ['.md', '.yml'])

const files = []
;(function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (SKIP.test(p)) continue
    if (e.isDirectory()) { walk(p); continue }
    if (!EXT.has(extname(e.name))) continue
    const rel = p.slice(ROOT.length + 1)
    if (!ALL && !IN_SCOPE.test(rel)) continue
    files.push(p)
  }
})(ROOT)

// ---- absolute svgrid.com URLs ------------------------------------------
const absolute = new Map() // url -> Set(file)
// ---- relative markdown links -------------------------------------------
const relative = [] // { file, link }

for (const f of files) {
  const src = readFileSync(f, 'utf8')
  for (const m of src.matchAll(/https:\/\/svgrid\.com[^\s)"'<>\]`,;]*/g)) {
    const url = m[0].replace(/[.]$/, '')
    if (!absolute.has(url)) absolute.set(url, new Set())
    absolute.get(url).add(f)
  }
  if (extname(f) !== '.md') continue
  for (const m of src.matchAll(/\]\(([^)]+)\)/g)) {
    const link = m[1].trim()
    // Root-absolute paths (/docs-media/x.svg) are served by the site, not the repo.
    if (/^(https?:|mailto:|#|\/)/.test(link)) continue
    relative.push({ file: f, link: link.split('#')[0] })
  }
}

let failures = 0

for (const { file, link } of relative) {
  if (!link) continue
  const target = resolve(dirname(file), link)
  if (!existsSync(target)) {
    console.log(`BROKEN REL  ${file}  ->  ${link}`)
    failures++
  }
}

if (!LOCAL_ONLY) {
  const urls = [...absolute.keys()].sort()
  console.log(`\nchecking ${urls.length} svgrid.com URLs...\n`)
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD', redirect: 'manual' })
        return { url, status: res.status, location: res.headers.get('location') || '' }
      } catch (err) {
        return { url, status: 0, location: err.message }
      }
    }),
  )
  for (const r of results) {
    if (r.status === 200 && !r.location) continue
    const where = [...absolute.get(r.url)].slice(0, 2).join(', ')
    console.log(`${String(r.status).padEnd(4)} ${r.url}`)
    console.log(`     ${r.location ? '-> ' + r.location : ''}  [${where}]`)
    failures++
  }
}

console.log(`\n${failures} problem(s)`)
process.exit(failures ? 1 : 0)
