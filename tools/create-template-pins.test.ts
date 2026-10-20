/**
 * Guards what `@svgrid/create` 3.0.5 shipped broken: a template pinned
 * `@svgrid/*` to a version npm did not have yet (`^3.2.0` while the workspace
 * was on 3.1.x, so `npm install` failed with ETARGET), and a template
 * vite.config.ts whose regex had lost a backslash (`split(/[/\]/)`), so the
 * project did not even load its config.
 *
 * Reads the templates as published (packages/create-sv-grid/templates) plus
 * the admin-dashboard source at templates/sveltekit-admin-dashboard, which the
 * package only copies in on prepack.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { afterAll, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

// `latest` follows whatever npm has, so it cannot run ahead of the registry,
// but it also floats past breaking majors. Only these keep it.
const LATEST_ALLOWED = new Set([
  'admin-dashboard @svgrid/grid',
  'headless @svgrid/grid',
  'minimal @svgrid/grid',
  'sveltekit-admin-dashboard @svgrid/grid',
])

/** Name -> version of every workspace package under packages/. */
function workspaceVersions(root: string): Map<string, string> {
  const out = new Map<string, string>()
  const dir = join(root, 'packages')
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, 'package.json')
    if (!existsSync(file)) continue
    const pkg = JSON.parse(readFileSync(file, 'utf8'))
    if (pkg.name && pkg.version) out.set(pkg.name, pkg.version)
  }
  return out
}

/** The template manifests: [label, path] for each that exists. */
function manifests(root: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const templates = join(root, 'packages', 'create-sv-grid', 'templates')
  for (const t of readdirSync(templates)) {
    const pkg = join(templates, t, '_package.json')
    if (existsSync(pkg)) out.push([t, pkg])
    const variants = join(templates, t, 'variants')
    if (!existsSync(variants)) continue
    for (const v of readdirSync(variants)) {
      const deps = join(variants, v, 'deps.json')
      if (existsSync(deps)) out.push([`${t}/${v}`, deps])
    }
  }
  const source = join(root, 'templates', 'sveltekit-admin-dashboard', 'package.json')
  if (existsSync(source)) out.push(['sveltekit-admin-dashboard', source])
  return out
}

type Version = [number, number, number]
const parse = (v: string): Version | null => {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(v)
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
const compare = (a: Version, b: Version) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]

/**
 * The lowest version a range admits, for the forms the templates use:
 * `^x.y.z`, `~x.y.z`, `>=x.y.z` and an exact `x.y.z`. semver is not a root
 * dependency; anything else returns null and fails the test, so a new range
 * form gets looked at instead of waved through.
 */
function minVersion(range: string): Version | null {
  const m = /^(?:\^|~|>=)?\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(range.trim())
  return m ? parse(m[1]!) : null
}

/** Every reason the templates under `root` would not install or load. */
function pinProblems(root: string): string[] {
  const problems: string[] = []
  const versions = workspaceVersions(root)
  for (const [label, file] of manifests(root)) {
    const json = JSON.parse(readFileSync(file, 'utf8'))
    for (const key of ['dependencies', 'devDependencies', 'peerDependencies']) {
      for (const [name, range] of Object.entries<string>(json[key] ?? {})) {
        if (!name.startsWith('@svgrid/')) continue
        if (range === 'latest') {
          if (!LATEST_ALLOWED.has(`${label} ${name}`)) problems.push(`${label}: ${name} is "latest"; pin a range the registry has`)
          continue
        }
        const have = versions.get(name)
        if (!have) {
          problems.push(`${label}: ${name} is not a workspace package`)
          continue
        }
        const min = minVersion(range)
        if (!min) {
          problems.push(`${label}: ${name} "${range}" is not a range this test reads (^, ~, >= or exact)`)
          continue
        }
        if (compare(min, parse(have)!) > 0) {
          problems.push(`${label}: ${name} "${range}" needs ${min.join('.')}, the workspace is on ${have}`)
        }
      }
    }
  }
  return problems
}

/** Every template vite.config.* (not in node_modules or build output). */
function viteConfigs(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (/^(node_modules|\.svelte-kit|build|dist)$/.test(name)) continue
      const full = join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else if (/^vite\.config\.(ts|js|mjs)$/.test(name)) out.push(full)
    }
  }
  walk(join(root, 'packages', 'create-sv-grid', 'templates'))
  const source = join(root, 'templates', 'sveltekit-admin-dashboard')
  if (existsSync(source)) walk(source)
  return out
}

/** Syntax errors in a config, as TypeScript's parser reports them. */
function syntaxProblems(root: string): string[] {
  const problems: string[] = []
  for (const file of viteConfigs(root)) {
    const text = readFileSync(file, 'utf8')
    const rel = relative(root, file)
    if (text.includes('split(/[/\\]/)')) problems.push(`${rel}: the path regex lost its backslash: split(/[/\\]/)`)
    const { diagnostics = [] } = ts.transpileModule(text, {
      fileName: file,
      reportDiagnostics: true,
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    })
    for (const d of diagnostics) problems.push(`${rel}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`)
  }
  return problems
}

const scratch: string[] = []
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true })
})

describe('create template pins', () => {
  it('finds the templates it is meant to check', () => {
    const labels = manifests(repoRoot).map(([l]) => l)
    expect(labels).toEqual(expect.arrayContaining(['base', 'base/browser', 'minimal', 'sveltekit', 'pivot-dashboard', 'headless']))
    expect(viteConfigs(repoRoot).length).toBeGreaterThanOrEqual(5)
  })

  it('every @svgrid/* range is one the workspace (and so npm) can satisfy', () => {
    expect(pinProblems(repoRoot)).toEqual([])
  })

  it('every template vite.config parses', () => {
    expect(syntaxProblems(repoRoot)).toEqual([])
  })

  it('catches the 3.0.5 breakage: a pin ahead of the workspace and the corrupted regex', () => {
    // A copy of what the checks read, with both 3.0.5 faults put back.
    const root = mkdtempSync(join(tmpdir(), 'svgrid-pins-'))
    scratch.push(root)
    for (const dir of readdirSync(join(repoRoot, 'packages'))) {
      const pkg = join(repoRoot, 'packages', dir, 'package.json')
      if (existsSync(pkg)) cpSync(pkg, join(root, 'packages', dir, 'package.json'))
    }
    const base = join(root, 'packages', 'create-sv-grid', 'templates', 'base')
    cpSync(join(repoRoot, 'packages', 'create-sv-grid', 'templates', 'base'), base, {
      recursive: true,
      filter: (src) => !/node_modules/.test(src),
    })
    expect(pinProblems(root)).toEqual([])
    expect(syntaxProblems(root)).toEqual([])

    const pkgFile = join(base, '_package.json')
    const pkg = JSON.parse(readFileSync(pkgFile, 'utf8'))
    pkg.dependencies['@svgrid/enterprise'] = '^3.2.0'
    pkg.dependencies['@svgrid/grid'] = 'latest'
    writeFileSync(pkgFile, JSON.stringify(pkg, null, 2))
    const vite = join(base, 'vite.config.ts')
    writeFileSync(vite, readFileSync(vite, 'utf8').replace('split(/[/\\\\]/)', 'split(/[/\\]/)'))

    const pins = pinProblems(root)
    expect(pins).toContainEqual(expect.stringMatching(/^base: @svgrid\/enterprise "\^3\.2\.0" needs 3\.2\.0, the workspace is on /))
    expect(pins).toContain('base: @svgrid/grid is "latest"; pin a range the registry has')
    const syntax = syntaxProblems(root)
    expect(syntax).toContainEqual(expect.stringContaining('the path regex lost its backslash'))
    // And the parser on its own, without the substring check.
    expect(syntax.filter((p) => !p.includes('lost its backslash')).length).toBeGreaterThan(0)
  })
})

/** Scaffold base with the local CLI into a fresh directory named `dir`. */
function scaffoldBase(dir: string, args: string[]) {
  const cwd = mkdtempSync(join(tmpdir(), 'svgrid-base-'))
  scratch.push(cwd)
  execFileSync(process.execPath, [join(repoRoot, 'packages', 'create-sv-grid', 'index.mjs'), dir, '--template', 'base', ...args], { cwd, stdio: 'pipe' })
  const app = join(cwd, dir)
  return { app, read: (f: string) => readFileSync(join(app, f), 'utf8') }
}

// What installing @svgrid/create@3.0.6 and running the Base template turned up.
// Each test spawns the CLI (the browser one twice), slower than vitest's 5 s
// default on Windows when other test files run alongside.
describe('base scaffold', { timeout: 30_000 }, () => {
  it('browser: each project gets its own IndexedDB database', () => {
    const one = scaffoldBase('My_Base.2', ['--data', 'browser'])
    expect(one.read('src/lib/db.ts')).toContain(`'idb://svgrid-base-my-base-2'`)
    expect(one.read('src/lib/db.ts')).not.toContain('__project__')
    expect(scaffoldBase('crm', ['--data', 'browser']).read('src/lib/db.ts')).toContain(`'idb://svgrid-base-crm'`)
  })

  it('supabase: builds without .env, reading the keys at runtime', () => {
    const { read } = scaffoldBase('app', ['--data', 'supabase'])
    for (const f of ['src/lib/supabase.ts', 'src/routes/+page.svelte']) expect(read(f)).not.toContain('$env/static')
    expect(read('src/lib/supabase.ts')).toContain(`from '$env/dynamic/public'`)
    expect(read('src/routes/+page.svelte')).toContain('Copy <code>.env.example</code> to <code>.env</code> and fill in your project URL and anon key')
  })

  it.each(['browser', 'postgres', 'supabase'])('%s: the README sets up before it runs, and the page says when there are no tables', (data) => {
    const { read } = scaffoldBase('app', ['--data', data, '--sample', 'none'])
    const readme = read('README.md')
    const dev = readme.indexOf('npm run dev')
    expect(dev).toBeGreaterThan(readme.indexOf('## Your data'))
    expect(readme.indexOf('npm run dev', dev + 1)).toBe(-1)
    if (data !== 'browser') expect(readme.indexOf('cp .env.example .env')).toBeLessThan(dev)
    if (data === 'postgres') expect(readme.indexOf('npm run db:setup')).toBeLessThan(dev)
    expect(readme).toContain('"Add table" in the app is not saved to the database')
    expect(read('src/routes/+page.svelte')).toContain('No tables yet.')
  })

  it('postgres: db:setup runs without --env-file, and says when it cannot connect', () => {
    const { read } = scaffoldBase('app', ['--data', 'postgres'])
    expect(JSON.parse(read('package.json')).scripts['db:setup']).toBe('node scripts/db-setup.mjs')
    const script = read('scripts/db-setup.mjs')
    expect(script).toContain('process.loadEnvFile()')
    expect(script).toContain('Could not reach DATABASE_URL')
  })
})
