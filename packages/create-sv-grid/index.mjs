#!/usr/bin/env node
// create-sv-grid - scaffold a Svelte app powered by SvGrid.
//
//   npm  create sv-grid@latest             # interactive
//   pnpm create sv-grid                     # interactive
//   npm  create sv-grid@latest my-app -- --template admin-dashboard
//   npm  create sv-grid@latest my-app -- -t minimal
//
// Zero runtime dependencies - Node built-ins only. Copies a bundled template,
// renames `_`-prefixed dotfiles, and rewrites the project name.

import { cp, mkdir, readdir, rename, stat, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, basename, resolve, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))

const TEMPLATES = {
  minimal: {
    label: 'Minimal      - Vite + Svelte 5 + SvGrid, one page',
    bundled: join(__dirname, 'templates', 'minimal'),
  },
  'admin-dashboard': {
    label: 'Admin dashboard - SvelteKit shell, multiple grids, deploy to Vercel',
    bundled: join(__dirname, 'templates', 'admin-dashboard'),
    // When running from the monorepo before `prepack` has synced the bundled
    // copy, fall back to the canonical source.
    fallback: join(__dirname, '..', '..', 'templates', 'sveltekit-admin-dashboard'),
  },
}

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
  const args = { _: [], template: null, force: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--template' || a === '-t') args.template = argv[++i]
    else if (a.startsWith('--template=')) args.template = a.slice('--template='.length)
    else if (!a.startsWith('-')) args._.push(a)
  }
  return args
}

function printHelp() {
  stdout.write(`
${color('bold', 'create-sv-grid')} - scaffold a Svelte app powered by SvGrid

${color('bold', 'Usage')}
  npm create sv-grid@latest [dir] -- [--template <name>] [--force]

${color('bold', 'Templates')}
${Object.entries(TEMPLATES)
  .map(([k, t]) => `  ${color('cyan', k.padEnd(16))} ${t.label.replace(/^\S+\s+-\s+/, '')}`)
  .join('\n')}

${color('bold', 'Examples')}
  npm  create sv-grid@latest
  npm  create sv-grid@latest my-app -- --template admin-dashboard
  pnpm create sv-grid my-app -t minimal
`)
}

function sanitizeName(name) {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-_.]+|[-_.]+$/g, '') || 'sv-grid-app'
  )
}

function resolveTemplateDir(key) {
  const t = TEMPLATES[key]
  if (existsSync(t.bundled)) return t.bundled
  if (t.fallback && existsSync(t.fallback)) return t.fallback
  return null
}

async function copyTemplate(srcDir, destDir) {
  await cp(srcDir, destDir, {
    recursive: true,
    filter: (src) =>
      !/[\\/](node_modules|\.svelte-kit|\.vercel|build|dist)([\\/]|$)/.test(src),
  })
  // Rename `_`-prefixed files back to their real dotfile names.
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

  stdout.write(`\n${color('bold', '◆ create-sv-grid')}  ${color('dim', 'Svelte + SvGrid')}\n\n`)

  // 1. Target directory.
  let target = args._[0]
  if (!target) target = await ask('Project directory:', 'my-sv-grid-app')
  const destDir = resolve(process.cwd(), target)
  const projectName = sanitizeName(basename(destDir))

  // 2. Template.
  let template = args.template
  if (!template) {
    if (interactive) {
      stdout.write(`\n  Templates:\n`)
      Object.entries(TEMPLATES).forEach(([k, t], i) => {
        stdout.write(`   ${color('cyan', String(i + 1))}. ${t.label}\n`)
      })
      const pick = await ask('\nChoose a template (1-2):', '1')
      template = Object.keys(TEMPLATES)[Number(pick) - 1] ?? 'minimal'
    } else {
      template = 'minimal'
    }
  }
  if (!TEMPLATES[template]) {
    if (rl) rl.close()
    stdout.write(
      `\n${color('red', '✖')} Unknown template "${template}". Choose: ${Object.keys(TEMPLATES).join(', ')}\n`,
    )
    process.exit(1)
  }

  // 3. Safety: don't clobber a non-empty directory.
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

  const srcDir = resolveTemplateDir(template)
  if (!srcDir) {
    if (rl) rl.close()
    stdout.write(
      `\n${color('red', '✖')} Template "${template}" is not available in this build.\n`,
    )
    process.exit(1)
  }

  // 4. Scaffold.
  await mkdir(destDir, { recursive: true })
  await copyTemplate(srcDir, destDir)
  await setProjectName(destDir, projectName)
  if (rl) rl.close()

  // 5. Next steps.
  const rel = isAbsolute(target) || target.startsWith('.') ? target : `./${target}`
  stdout.write(`\n${color('green', '✔')} Scaffolded ${color('bold', projectName)} (${template}) into ${rel}\n\n`)
  stdout.write(`${color('bold', 'Next steps')}\n`)
  stdout.write(`  cd ${target}\n`)
  stdout.write(`  npm install\n`)
  stdout.write(`  npm run dev\n\n`)
  stdout.write(`${color('dim', 'Docs:')} https://www.svgrid.com/docs   ${color('dim', 'Pro:')} https://www.svgrid.com/pricing\n\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
