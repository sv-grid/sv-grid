#!/usr/bin/env node
/**
 * Builds svgrid-trial.zip, the download behind "Start a 30-day trial" on
 * svgrid.com:
 *
 *   packages/   @svgrid/grid and @svgrid/enterprise as npm tarballs
 *   demos/      the svgrid.com/demos page, built to run offline
 *   serve.mjs, start-demos.cmd, start-demos.sh   start the gallery offline
 *   README.md   install steps and the trial's terms
 *
 * The tarballs come from the npm registry by default (`npm pack`), so the zip
 * holds exactly what `npm install` would. `--packages workspace` packs the
 * local packages instead, for trying the bundle before a release (build the
 * grid and enterprise dist first).
 *
 * The gallery ships without a license key: its demos show the evaluation
 * watermark, as the customer's own app will until they buy. The Zazo voice
 * clips are left out (a quarter of the download); he stays silent.
 *
 *   node tools/build-trial-bundle.mjs [--out website/dist/downloads]
 *                                     [--packages npm|workspace] [--skip-demos]
 *
 * Writes <out>/svgrid-trial.zip and <out>/svgrid-trial.json (versions, size).
 */
import { spawnSync } from 'node:child_process'
import { mkdtemp, mkdir, readdir, readFile, writeFile, copyFile, cp, rename, rm } from 'node:fs/promises'
import { existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { createZip } from './lib/zip.mjs'
import { isReleased } from './lib/releases.mjs'

/** package.json from inside an npm tarball (gzip of a ustar archive). */
function packageJsonOf(tgz) {
  const tar = gunzipSync(readFileSync(tgz))
  for (let off = 0; off + 512 <= tar.length; ) {
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/s, '')
    if (!name) break
    const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/s, '').trim() || '0', 8)
    if (name === 'package/package.json') return JSON.parse(tar.toString('utf8', off + 512, off + 512 + size))
    off += 512 + Math.ceil(size / 512) * 512
  }
  throw new Error(`no package/package.json in ${tgz}`)
}

/** What the packed Enterprise tarball offers, read from its exports, so the
 *  README never names a module the customer cannot import. */
function enterpriseFeatures(exports) {
  const has = (sub) => Object.prototype.hasOwnProperty.call(exports ?? {}, `./${sub}`)
  // The Gantt view is not named before its public date (tools/lib/releases.mjs).
  const views = isReleased('gantt') ? 'the Kanban board, Scheduler and Gantt views' : 'the Kanban board and Scheduler views'
  const parts = ['export, import and print', 'pivot tables', views, 'the Server-Side Row Model']
  if (has('sheet')) parts.push('the Spreadsheet')
  if (has('base')) parts.push('SvGrid Base')
  if (has('studio')) parts.push('Studio')
  return { text: parts.slice(0, -1).join(', ') + ' and ' + parts.at(-1), hasBase: has('base') }
}

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const TEMPLATES = join(ROOT, 'tools', 'trial-bundle')
const ZIP_NAME = 'svgrid-trial.zip'

const args = process.argv.slice(2)
const opt = (name, fallback) => {
  const i = args.indexOf(name)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}
const OUT = resolve(ROOT, opt('--out', join('website', 'dist', 'downloads')))
const PACKAGES = opt('--packages', 'npm')
const SKIP_DEMOS = args.includes('--skip-demos')
if (!['npm', 'workspace'].includes(PACKAGES)) fail(`--packages must be npm or workspace, not "${PACKAGES}"`)

function fail(msg) {
  console.error(`build-trial-bundle: ${msg}`)
  process.exit(1)
}

/** Run a command, inherit nothing secret, fail loudly. */
function run(cmd, cmdArgs, { cwd = ROOT, env = {} } = {}) {
  const childEnv = { ...process.env, ...env }
  // The gallery must not pick up a real key from the build machine.
  delete childEnv.VITE_SVGRID_LICENSE_KEY
  delete childEnv.SVGRID_LICENSE_KEY
  // npm and pnpm are .cmd shims on Windows and need a shell there; a full
  // path (node itself) must not go through one, or "Program Files" splits.
  const shell = process.platform === 'win32' && (cmd === 'npm' || cmd === 'pnpm')
  const r = spawnSync(cmd, cmdArgs, { cwd, env: childEnv, encoding: 'utf8', shell, maxBuffer: 64 * 1024 * 1024 })
  if (r.status !== 0) fail(`${cmd} ${cmdArgs.join(' ')} failed:\n${r.stderr || r.stdout}`)
  return r.stdout
}

async function walk(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await walk(p)))
    else out.push(p)
  }
  return out
}

/** Pack the two packages into `dest`; returns [{ name, version, filename }]. */
function packPackages(dest) {
  if (PACKAGES === 'npm') {
    const json = run('npm', ['pack', '@svgrid/grid@latest', '@svgrid/enterprise@latest', '--json', '--pack-destination', dest])
    return JSON.parse(json).map((p) => ({ name: p.name, version: p.version, filename: p.filename }))
  }
  const out = []
  for (const [name, dir] of [['@svgrid/grid', 'packages/grid'], ['@svgrid/enterprise', 'packages/enterprise']]) {
    if (!existsSync(join(ROOT, dir, 'dist'))) fail(`${dir}/dist is missing; build it before --packages workspace`)
    // pnpm, not npm: pnpm rewrites workspace: ranges to real versions.
    run('pnpm', ['pack', '--pack-destination', dest], { cwd: join(ROOT, dir) })
    const pkg = JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8'))
    out.push({ name, version: pkg.version, filename: `${name.replace('@', '').replace('/', '-')}-${pkg.version}.tgz` })
  }
  return out
}

/** What the website's demos page reads from public/ besides the bundle. */
const SITE_FILES = ['thumbs', 'demo-related.json', 'llms-full.txt', 'docs-media/studio-hero.png', 'favicon-16.png', 'favicon-32.png', 'favicon.ico']

/**
 * The website's own /demos page and header (`vite build --mode trial`, entry
 * website/trial.html), so the zip's gallery is the one on svgrid.com/demos.
 * Absolute base: serve.mjs serves it at the root and answers every route
 * with index.html, as the site does.
 */
async function buildDemos(dest) {
  const site = join(ROOT, 'website')
  const vite = join(site, 'node_modules', 'vite', 'bin', 'vite.js')
  if (!existsSync(join(site, 'trial.html'))) fail('website/ is missing; check out the submodule (git submodule update --init website)')
  if (!existsSync(vite)) fail('website/node_modules is missing; run pnpm install')
  run(process.execPath, [vite, 'build', '--mode', 'trial', '--base', '/', '--outDir', dest, '--emptyOutDir', '--logLevel', 'warn'], { cwd: site })
  await rename(join(dest, 'trial.html'), join(dest, 'index.html'))
  for (const f of SITE_FILES) await cp(join(site, 'public', f), join(dest, f), { recursive: true })
  let dropped = 0
  for (const f of await walk(join(dest, 'assets'))) {
    if (f.endsWith('.mp3')) {
      await rm(f)
      dropped += 1
    }
  }
  return dropped
}

/** The key that silences the watermark, when this machine has it, so the bundle can be checked for it. */
async function knownLicenseKeys() {
  const keys = [process.env.SVGRID_LICENSE_KEY, process.env.VITE_SVGRID_LICENSE_KEY]
  const file = join(ROOT, 'tools', 'licenses', 'master-key.txt')
  if (existsSync(file)) keys.push((await readFile(file, 'utf8')).trim())
  return keys.filter((k) => typeof k === 'string' && k.length >= 16)
}

const stage = await mkdtemp(join(tmpdir(), 'svgrid-trial-'))
try {
  const packagesDir = join(stage, 'packages')
  await mkdir(packagesDir, { recursive: true })
  const packs = packPackages(packagesDir)
  const grid = packs.find((p) => p.name === '@svgrid/grid')
  const enterprise = packs.find((p) => p.name === '@svgrid/enterprise')
  if (!grid || !enterprise) fail(`npm pack returned ${packs.map((p) => p.name).join(', ')}`)
  console.log(`build-trial-bundle: ${grid.filename}, ${enterprise.filename}`)
  const features = enterpriseFeatures(packageJsonOf(join(packagesDir, enterprise.filename)).exports)

  if (!SKIP_DEMOS) {
    const dropped = await buildDemos(join(stage, 'demos'))
    console.log(`build-trial-bundle: demo gallery built (${dropped} voice clips left out)`)
  }

  for (const f of ['serve.mjs', 'start-demos.cmd', 'start-demos.sh']) await copyFile(join(TEMPLATES, f), join(stage, f))
  const built = new Date().toISOString().slice(0, 10)
  const readme = (await readFile(join(TEMPLATES, 'README.md'), 'utf8'))
    .replaceAll('{{GRID_TGZ}}', grid.filename)
    .replaceAll('{{GRID_VERSION}}', grid.version)
    .replaceAll('{{ENTERPRISE_TGZ}}', enterprise.filename)
    .replaceAll('{{ENTERPRISE_VERSION}}', enterprise.version)
    .replaceAll('{{BUILT}}', built)
    .replaceAll('{{ENTERPRISE_FEATURES}}', features.text)
    .replaceAll('{{GALLERY_NOTE}}', features.hasBase || SKIP_DEMOS
      ? ''
      : ' The demo gallery is newer than the packages: its SvGrid Base demos show a module that ships in a later @svgrid/enterprise release.')
  await writeFile(join(stage, 'README.md'), readme)

  const files = await walk(stage)
  const keys = await knownLicenseKeys()
  const entries = []
  for (const file of files) {
    const data = await readFile(file)
    if (keys.length && !file.endsWith('.tgz') && !file.endsWith('.wasm')) {
      const text = data.toString('latin1')
      for (const k of keys) if (text.includes(k) || text.toLowerCase().includes(k.toLowerCase())) fail(`${relative(stage, file)} contains the license key`)
    }
    const path = ['svgrid-trial', ...relative(stage, file).split(sep)].join('/')
    entries.push({ path, data, executable: file.endsWith('.sh') || file.endsWith('serve.mjs') })
  }
  const zip = createZip(entries)
  await mkdir(OUT, { recursive: true })
  await writeFile(join(OUT, ZIP_NAME), zip)
  const manifest = { file: ZIP_NAME, bytes: zip.length, built, grid: grid.version, enterprise: enterprise.version }
  await writeFile(join(OUT, 'svgrid-trial.json'), JSON.stringify(manifest, null, 2) + '\n')
  console.log(`build-trial-bundle: ${relative(ROOT, join(OUT, ZIP_NAME))} ${(zip.length / 1024 / 1024).toFixed(1)} MB, ${entries.length} files`)
} finally {
  await rm(stage, { recursive: true, force: true })
}
