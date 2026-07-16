#!/usr/bin/env node
// @svgrid/create-studio - scaffold a runnable SvGrid Studio data app.
//
//   npm  create @svgrid/studio@latest            # interactive
//   pnpm create @svgrid/studio my-app            # into ./my-app
//   npm  create @svgrid/studio@latest my-app -- --force
//
// One command -> a full SvelteKit app: nav shell, two linked entities
// (Customers + Orders with a searchable lookup), grid + modal CRUD, and a
// modern theme, running on seeded in-memory data with no backend to set up.
//
// Zero runtime dependencies - Node built-ins only. Copies the bundled template,
// renames `_`-prefixed dotfiles, and rewrites the project name.

import { cp, mkdir, readdir, rename, rm, stat, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, basename, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = join(__dirname, 'templates', 'default')

const RENAME_BACK = new Map([
  ['_gitignore', '.gitignore'],
  ['_npmrc', '.npmrc'],
  ['_env.example', '.env.example'],
  ['_package.json', 'package.json'],
])

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
}
const color = stdout.isTTY ? (k, s) => `${c[k]}${s}${c.reset}` : (_k, s) => s

function parseArgs(argv) {
  const args = { _: [], force: false, help: false, from: null, project: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--from') args.from = argv[++i]
    else if (a.startsWith('--from=')) args.from = a.slice('--from='.length)
    else if (a === '--project') args.project = argv[++i]
    else if (a.startsWith('--project=')) args.project = a.slice('--project='.length)
    else if (!a.startsWith('-')) args._.push(a)
  }
  return args
}

function printHelp() {
  stdout.write(`
${color('bold', '@svgrid/create-studio')} - scaffold a SvGrid Studio data app

${color('bold', 'Usage')}
  npm create @svgrid/studio@latest [dir] -- [--from <schema>] [--force]

${color('bold', 'What you get')}
  A runnable SvelteKit app: nav shell, grid + modal CRUD per entity, and a
  modern theme. Without --from you get seeded Customers + Orders; with --from
  you get a screen for every table/model in your schema.

${color('bold', 'Options')}
  --from <path>      Generate the app from a Drizzle (.ts) or Prisma (.prisma)
                     schema instead of the seeded example (auto-detected).
  --project <path>   Generate the app from a studio.config.json exported by the
                     visual designer (screens + blocks, not just entities).
  --force            Scaffold into a non-empty directory.

${color('bold', 'Examples')}
  npm  create @svgrid/studio@latest
  pnpm create @svgrid/studio my-data-app
  npm  create @svgrid/studio@latest my-app -- --from ./prisma/schema.prisma
  npm  create @svgrid/studio@latest my-app -- --project ./studio.config.json
`)
}

/**
 * Generate the app from a studio.config.json (the visual designer's export):
 * parse it, emit each screen's composed blocks, and replace the seeded example.
 */
async function applyProject(destDir, projectPath) {
  const abs = resolve(process.cwd(), projectPath)
  const json = await readFile(abs, 'utf8').catch(() => null)
  if (json == null) throw new Error(`--project: config not found: ${projectPath}`)

  let studio
  try {
    studio = await import('@svgrid/enterprise/studio')
  } catch {
    throw new Error('--project needs @svgrid/enterprise; reinstall and try again.')
  }

  const project = studio.parseProject(json)
  const files = studio.emitStudioProject(project)

  for (const ex of ['customers', 'orders']) {
    await rm(join(destDir, 'src', 'routes', ex), { recursive: true, force: true })
  }
  for (const f of files) {
    const full = join(destDir, f.path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, f.contents)
  }
  // Add the runtime deps the generated code imports (Supabase client / SQL
  // drivers) so the app installs + runs turnkey.
  const allSource = files.map((f) => f.contents).join('\n')
  const DEPS = [
    ["from '@supabase/supabase-js'", '@supabase/supabase-js', '^2.45.0'],
    ["import pg from 'pg'", 'pg', '^8.11.0'],
    ["from 'mysql2/promise'", 'mysql2', '^3.9.0'],
    ["import mssql from 'mssql'", 'mssql', '^10.0.0'],
    ["import Database from 'better-sqlite3'", 'better-sqlite3', '^11.0.0'],
  ]
  for (const [needle, dep, version] of DEPS) {
    if (allSource.includes(needle)) await addDependency(destDir, dep, version)
  }
  return project.screens.map((s) => s.title)
}

/** Add a runtime dependency to the generated app's package.json (idempotent). */
async function addDependency(destDir, name, version) {
  const pkgPath = join(destDir, 'package.json')
  if (!existsSync(pkgPath)) return
  try {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
    pkg.dependencies = { ...pkg.dependencies, [name]: version }
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  } catch {
    // leave deps as-is if package.json isn't valid JSON
  }
}

/**
 * Generate the app's entities from a Drizzle/Prisma schema file: parse it with
 * the Studio core, emit EntityScreen-style files, and replace the seeded
 * Customers/Orders. Runs after the base template is copied.
 */
async function applyFromSchema(destDir, fromPath) {
  const abs = resolve(process.cwd(), fromPath)
  const src = await readFile(abs, 'utf8').catch(() => null)
  if (src == null) throw new Error(`--from: schema file not found: ${fromPath}`)

  let studio
  try {
    studio = await import('@svgrid/enterprise/studio')
  } catch {
    throw new Error('--from needs @svgrid/enterprise; reinstall, or scaffold without --from and run `npx @svgrid/studio add --all --from ...` in the app.')
  }

  const isPrisma = /\.prisma$/i.test(fromPath) || /\bmodel\s+\w+\s*\{/.test(src)
  const schemas = isPrisma ? studio.introspectPrismaAll(src) : studio.introspectDrizzleAll(src)
  if (!schemas.length) throw new Error(`--from: no ${isPrisma ? 'models' : 'tables'} found in ${fromPath}`)

  const files = studio.emitStudioApp(schemas)

  // Drop the seeded example screens (their schemas/data no longer exist).
  for (const ex of ['customers', 'orders']) {
    await rm(join(destDir, 'src', 'routes', ex), { recursive: true, force: true })
  }
  // Write generated files (overwrites schemas.ts / data.ts / +layout / +page).
  for (const f of files) {
    const full = join(destDir, f.path)
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, f.contents)
  }
  return schemas.map((s) => s.label ?? s.name)
}

function sanitizeName(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'my-studio-app'
  )
}

async function copyTemplate(srcDir, destDir) {
  // Match only on the path RELATIVE to the template root - the absolute `src`
  // includes the install location, which would match `node_modules` and skip
  // the whole copy.
  const skip = /(^|[\\/])(node_modules|\.svelte-kit|\.vercel|build|dist)([\\/]|$)/
  await cp(srcDir, destDir, {
    recursive: true,
    filter: (src) => !skip.test(src.slice(srcDir.length)),
  })
  await renameBack(destDir)
}

async function renameBack(dir) {
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry)
    if ((await stat(full)).isDirectory()) {
      await renameBack(full)
    } else if (RENAME_BACK.has(entry)) {
      await rename(full, join(dir, RENAME_BACK.get(entry)))
    }
  }
}

async function setProjectName(destDir, name) {
  const pkgPath = join(destDir, 'package.json')
  if (!existsSync(pkgPath)) return
  try {
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
    pkg.name = name
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  } catch {
    // leave the template's name if it isn't valid JSON for some reason
  }
}

async function isEmptyDir(dir) {
  if (!existsSync(dir)) return true
  const entries = await readdir(dir)
  return entries.filter((e) => e !== '.git').length === 0
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) return printHelp()

  const interactive = stdin.isTTY && stdout.isTTY
  let rl = null
  const ask = async (q, def) => {
    if (!interactive) return def
    rl ??= createInterface({ input: stdin, output: stdout })
    const a = (await rl.question(`${q} ${color('dim', `(${def})`)} `)).trim()
    return a || def
  }

  stdout.write(`\n${color('bold', '◆ @svgrid/create-studio')}  ${color('dim', 'a runnable data app')}\n\n`)

  // 1. Target directory.
  let target = args._[0]
  if (!target) target = await ask('Project directory:', 'my-studio-app')
  const destDir = resolve(process.cwd(), target)
  const projectName = sanitizeName(basename(destDir))

  // 2. Safety: don't clobber a non-empty directory.
  if (!(await isEmptyDir(destDir)) && !args.force) {
    const ok = await ask(
      `\n${color('yellow', '!')} ${target} is not empty. Continue and overwrite files? (y/N)`,
      'N',
    )
    if (!/^y(es)?$/i.test(ok)) {
      if (rl) rl.close()
      stdout.write(`${color('red', '✖')} Aborted.\n`)
      process.exit(1)
    }
  }

  if (!existsSync(TEMPLATE_DIR)) {
    if (rl) rl.close()
    stdout.write(`\n${color('red', '✖')} Template is missing from this build.\n`)
    process.exit(1)
  }

  // 3. Scaffold.
  await mkdir(destDir, { recursive: true })
  await copyTemplate(TEMPLATE_DIR, destDir)
  await setProjectName(destDir, projectName)
  if (rl) rl.close()

  // 3b. Generate from a designer project (--project) or a schema file (--from).
  let entities = null
  let source = null
  try {
    if (args.project) {
      entities = await applyProject(destDir, args.project)
      source = args.project
    } else if (args.from) {
      entities = await applyFromSchema(destDir, args.from)
      source = args.from
    }
  } catch (err) {
    stdout.write(`\n${color('red', '✖')} ${err instanceof Error ? err.message : String(err)}\n`)
    process.exit(1)
  }

  // 4. Next steps.
  const rel = isAbsolute(target) || target.startsWith('.') ? target : `./${target}`
  stdout.write(`\n${color('green', '✔')} Scaffolded ${color('bold', projectName)} into ${rel}\n`)
  if (entities) {
    stdout.write(`  ${color('dim', 'from')} ${source} ${color('dim', '->')} ${entities.join(', ')}\n`)
  }
  stdout.write(`\n`)
  stdout.write(`${color('bold', 'Next steps')}\n`)
  stdout.write(`  cd ${target}\n`)
  stdout.write(`  npm install\n`)
  stdout.write(`  npm run dev\n\n`)
  stdout.write(`${color('dim', 'Docs:')} https://www.svgrid.com/docs/studio\n\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
