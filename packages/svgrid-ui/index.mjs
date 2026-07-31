#!/usr/bin/env node
// @svgrid/ui - add SvGrid UI components to your app, one command at a time.
//
//   npx @svgrid/ui add calendar
//   npx @svgrid/ui add calendar time-picker --dir src/lib/ui
//   npx @svgrid/ui add date-time            # the whole date/time family
//   npx @svgrid/ui list
//
// Recipe-scaffolder model: `add` writes a minimal, ready-to-EDIT .svelte starter
// that imports from `@svgrid/grid` (which you own and can change), then makes
// sure the package is a dependency and prints the install command. It does NOT
// vendor library source - the components live in `@svgrid/grid`.
//
// Zero runtime dependencies - Node built-ins only.

import { cp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { stdin, stdout } from 'node:process'
import { spawnSync } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RECIPES_DIR = join(__dirname, 'recipes')

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

// Package managers: lockfile -> add command. Order matters (first match wins).
const PMS = [
  { id: 'pnpm', lock: 'pnpm-lock.yaml', add: 'pnpm add' },
  { id: 'bun', lock: 'bun.lockb', add: 'bun add' },
  { id: 'yarn', lock: 'yarn.lock', add: 'yarn add' },
  { id: 'npm', lock: 'package-lock.json', add: 'npm install' },
]

function parseArgs(argv) {
  const args = { _: [], dir: null, force: false, install: false, help: false, js: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--install') args.install = true
    else if (a === '--js') args.js = true
    else if (a === '--ts') args.js = false
    else if (a === '--dir' || a === '-d') args.dir = argv[++i]
    else if (a.startsWith('--dir=')) args.dir = a.slice('--dir='.length)
    else if (!a.startsWith('-')) args._.push(a)
  }
  return args
}

async function loadRegistry() {
  const raw = await readFile(join(RECIPES_DIR, 'registry.json'), 'utf8')
  return JSON.parse(raw)
}

/** Match a user-typed id against the registry: exact id, alias, or lowercase. */
function resolveItem(registry, token) {
  const key = token.trim().toLowerCase()
  return (
    registry.items.find((it) => it.id === key) ??
    registry.items.find((it) => (it.aliases ?? []).includes(key)) ??
    null
  )
}

/** Expand a token into one or more recipe items (a group alias -> its members). */
function expand(registry, token) {
  const key = token.trim().toLowerCase()
  const group = registry.groups?.[key]
  if (group) return group.items.map((id) => resolveItem(registry, id)).filter(Boolean)
  const item = resolveItem(registry, key)
  return item ? [item] : []
}

/** Walk up from `start` to the nearest directory containing a package.json. */
function findProjectRoot(start) {
  let dir = start
  while (true) {
    if (existsSync(join(dir, 'package.json'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

function detectPm(root) {
  if (!root) return PMS.find((p) => p.id === 'npm')
  return PMS.find((p) => existsSync(join(root, p.lock))) ?? PMS.find((p) => p.id === 'npm')
}

async function targetDir(args, projectRoot, cwd) {
  if (args.dir) return resolve(cwd, args.dir)
  // Optional project config: svgrid.json { componentsDir }
  if (projectRoot) {
    const cfgPath = join(projectRoot, 'svgrid.json')
    if (existsSync(cfgPath)) {
      try {
        const cfg = JSON.parse(await readFile(cfgPath, 'utf8'))
        if (cfg.componentsDir) return resolve(projectRoot, cfg.componentsDir)
      } catch {
        /* fall through to the default */
      }
    }
    return join(projectRoot, 'src', 'lib', 'components', 'ui')
  }
  return join(cwd, 'src', 'lib', 'components', 'ui')
}

/** Add any missing deps to the nearest package.json (dependencies). Returns the
 *  list actually added so the caller can report / install them. */
async function ensureDeps(projectRoot, deps) {
  if (!projectRoot) return deps
  const pkgPath = join(projectRoot, 'package.json')
  let pkg
  try {
    pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
  } catch {
    return deps
  }
  pkg.dependencies ??= {}
  const added = []
  for (const dep of deps) {
    const known = pkg.dependencies[dep] || pkg.devDependencies?.[dep]
    if (!known) {
      pkg.dependencies[dep] = 'latest'
      added.push(dep)
    }
  }
  if (added.length) await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  return added
}

function printHelp() {
  stdout.write(`
${color('bold', '@svgrid/ui')} - add SvGrid UI components to your app

${color('bold', 'Usage')}
  npx @svgrid/ui add <component...> [--dir <path>] [--force] [--install]
  npx @svgrid/ui list

${color('bold', 'Commands')}
  ${color('cyan', 'add')}   Write a ready-to-edit recipe for each component into your project.
  ${color('cyan', 'list')}  Show the components you can add.

${color('bold', 'Options')}
  --dir <path>   Where to write files (default: src/lib/components/ui, or the
                 "componentsDir" in a project svgrid.json).
  --force        Overwrite files that already exist.
  --install      Run the package manager to install deps (default: just print it).

${color('bold', 'Examples')}
  npx @svgrid/ui add calendar
  npx @svgrid/ui add calendar time-picker --dir src/lib/ui
  npx @svgrid/ui add date-time --install
`)
}

async function cmdList(registry) {
  stdout.write(`\n${color('bold', 'Available components')}\n`)
  for (const it of registry.items) {
    stdout.write(`  ${color('cyan', it.id.padEnd(18))} ${color('dim', it.description)}\n`)
  }
  const groups = Object.entries(registry.groups ?? {})
  if (groups.length) {
    stdout.write(`\n${color('bold', 'Groups')}\n`)
    for (const [id, g] of groups) {
      stdout.write(`  ${color('cyan', id.padEnd(18))} ${color('dim', g.items.join(', '))}\n`)
    }
  }
  stdout.write(`\n${color('dim', 'Add one with:')} npx @svgrid/ui add ${registry.items[0]?.id ?? 'calendar'}\n\n`)
}

async function cmdAdd(registry, tokens, args) {
  if (!tokens.length) {
    stdout.write(`${color('red', '✖')} Nothing to add. Try: ${color('cyan', 'npx @svgrid/ui list')}\n`)
    process.exit(1)
  }

  // Resolve tokens -> unique items.
  const items = new Map()
  const unknown = []
  for (const tok of tokens) {
    const matched = expand(registry, tok)
    if (!matched.length) unknown.push(tok)
    for (const it of matched) items.set(it.id, it)
  }
  if (unknown.length) {
    stdout.write(
      `${color('red', '✖')} Unknown component(s): ${unknown.join(', ')}\n` +
        `  See ${color('cyan', 'npx @svgrid/ui list')} for the available set.\n`,
    )
    process.exit(1)
  }

  const cwd = process.cwd()
  const projectRoot = findProjectRoot(cwd)
  const dest = await targetDir(args, projectRoot, cwd)
  await mkdir(dest, { recursive: true })

  const written = []
  const skipped = []
  const deps = new Set()
  for (const it of items.values()) {
    for (const d of it.deps ?? []) deps.add(d)
    for (const file of it.files ?? []) {
      const outPath = join(dest, file.write)
      if (existsSync(outPath) && !args.force) {
        skipped.push(file.write)
        continue
      }
      await cp(join(RECIPES_DIR, file.from), outPath)
      written.push(file.write)
    }
  }

  // Report writes.
  stdout.write(`\n`)
  for (const f of written) stdout.write(`  ${color('green', '+')} ${relFromCwd(cwd, join(dest, f))}\n`)
  for (const f of skipped)
    stdout.write(`  ${color('yellow', '•')} ${f} ${color('dim', 'already exists (use --force to overwrite)')}\n`)
  if (!written.length) {
    stdout.write(`\n${color('yellow', '!')} No files written.\n\n`)
    return
  }

  // Ensure deps + install.
  const added = await ensureDeps(projectRoot, [...deps])
  const pm = detectPm(projectRoot)
  if (added.length) {
    if (args.install && projectRoot) {
      stdout.write(`\n${color('dim', `Installing with ${pm.id}...`)}\n`)
      const [bin, ...rest] = pm.add.split(' ')
      const res = spawnSync(bin, [...rest, ...added], { cwd: projectRoot, stdio: 'inherit', shell: true })
      if (res.status !== 0) {
        stdout.write(`${color('yellow', '!')} Install failed - run it yourself: ${color('cyan', `${pm.add} ${added.join(' ')}`)}\n`)
      }
    } else {
      stdout.write(`\n${color('bold', 'Install the dependency')}\n  ${color('cyan', `${pm.add} ${added.join(' ')}`)}\n`)
    }
  } else if ([...deps].length) {
    stdout.write(`\n${color('dim', `${[...deps].join(', ')} already in package.json.`)}\n`)
  }

  // Usage hint.
  const first = [...items.values()][0]
  stdout.write(`\n${color('green', '✔')} Added ${written.length} file(s). They're yours - edit away.\n`)
  if (first) {
    stdout.write(`  ${color('dim', 'Use it:')} import { ${exportName(first.id)} } from '@svgrid/grid'\n`)
  }
  stdout.write(`\n${color('dim', 'Docs:')} https://www.svgrid.com/docs/help/ui-components\n\n`)
}

/** Component export name from its id (calendar -> SvCalendar, time-picker ->
 *  SvTimePicker). */
function exportName(id) {
  return 'Sv' + id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')
}

function relFromCwd(cwd, p) {
  const r = p.startsWith(cwd) ? p.slice(cwd.length).replace(/^[\\/]/, '') : p
  return r.split('\\').join('/')
}

async function main() {
  const argv = process.argv.slice(2)
  const args = parseArgs(argv)
  const [command, ...rest] = args._

  if (args.help || !command) return printHelp()

  const registry = await loadRegistry()
  stdout.write(`${color('bold', '◆ @svgrid/ui')}\n`)

  switch (command) {
    case 'list':
    case 'ls':
      return cmdList(registry)
    case 'add':
      return cmdAdd(registry, rest, args)
    default:
      // Treat a bare component id as `add <id>` for convenience.
      if (resolveItem(registry, command) || registry.groups?.[command]) {
        return cmdAdd(registry, [command, ...rest], args)
      }
      stdout.write(`${color('red', '✖')} Unknown command "${command}". Try ${color('cyan', 'add')} or ${color('cyan', 'list')}.\n`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
