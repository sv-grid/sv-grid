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
  const args = { _: [], force: false, help: false, from: null, project: null, theme: null, dark: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--from') args.from = argv[++i]
    else if (a.startsWith('--from=')) args.from = a.slice('--from='.length)
    else if (a === '--project') args.project = argv[++i]
    else if (a.startsWith('--project=')) args.project = a.slice('--project='.length)
    else if (a === '--theme') args.theme = argv[++i]
    else if (a.startsWith('--theme=')) args.theme = a.slice('--theme='.length)
    else if (a === '--dark') args.dark = true
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
  --theme <id>       One of: ${THEME_IDS.join(', ')} (default: tailwind).
  --dark             Start the app in dark mode.
  --force            Scaffold into a non-empty directory.

${color('bold', 'Examples')}
  npm  create @svgrid/studio@latest
  pnpm create @svgrid/studio my-data-app
  npm  create @svgrid/studio@latest my-app -- --from ./prisma/schema.prisma
  npm  create @svgrid/studio@latest my-app -- --project ./studio.config.json
  npm  create @svgrid/studio@latest my-app -- --theme material --dark
`)
}

const THEME_IDS = [
  'shadcn', 'tailwind', 'material', 'excel', 'fluent', 'carbon', 'sap',
  'salesforce', 'atlassian', 'github', 'antd', 'ag-alpine', 'bootstrap',
  'vercel', 'linear', 'notion', 'nord', 'dracula', 'catppuccin',
]

/**
 * Resolve the theme + mode to apply: from `--theme`/`--dark` flags, or (in a
 * TTY) an interactive prompt; otherwise the default (tailwind, light). Reuses
 * `@svgrid/enterprise/studio`'s own preset list, so the picker can never drift
 * from the canonical set in `@svgrid/grid/themes`.
 */
async function promptTheme(args, ask, interactive) {
  let studio
  try {
    studio = await import('@svgrid/enterprise/studio')
  } catch {
    return null // theming is best-effort; the template's own default stands in.
  }

  let themeId = args.theme ? args.theme.trim().toLowerCase() : null
  if (themeId && !studio.getStudioTheme(themeId)) {
    stdout.write(`${color('yellow', '!')} Unknown theme "${themeId}" - using tailwind. (${THEME_IDS.join(', ')})\n`)
    themeId = null
  }
  if (!themeId && interactive) {
    const list = studio.studioThemes.map((t, i) => `  ${i + 1}. ${t.name} ${color('dim', `(${t.id})`)}`).join('\n')
    stdout.write(`\n${color('bold', 'Theme')}\n${list}\n`)
    const choice = await ask('Pick a number or id:', 'tailwind')
    const byIndex = studio.studioThemes[Number(choice) - 1]
    themeId = byIndex ? byIndex.id : (studio.getStudioTheme(choice.trim().toLowerCase())?.id ?? 'tailwind')
  }
  themeId ??= 'tailwind'

  let dark = args.dark
  if (!dark && interactive) {
    const a = await ask('Start in dark mode? (y/N)', 'N')
    dark = /^y(es)?$/i.test(a)
  }

  return { themeId, dark, name: studio.getStudioTheme(themeId)?.name ?? themeId, studio }
}

/** Rewrite the template's `app.css` (between the `svgrid-theme` markers) with
 *  the resolved `--sg-*` tokens for the chosen theme + mode, and set
 *  `data-theme="dark"` on `<html>` when dark mode was picked. */
async function applyTheme(destDir, choice) {
  if (!choice) return
  const { themeId, dark, studio } = choice
  const light = studio.resolveThemeTokens({ preset: themeId, mode: 'light' })
  const darkTokens = studio.resolveThemeTokens({ preset: themeId, mode: 'dark' })
  const block = (selector, tokens, scheme) => {
    const lines = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    return `${selector} {\n${lines}\n  color-scheme: ${scheme};\n}`
  }
  const css = `${block(':root', light, 'light')}\n${block(":root[data-theme='dark']", darkTokens, 'dark')}`

  const cssPath = join(destDir, 'src', 'app.css')
  const cssText = await readFile(cssPath, 'utf8')
  const marked = /\/\* svgrid-theme:start \*\/[\s\S]*?\/\* svgrid-theme:end \*\//
  if (marked.test(cssText)) {
    await writeFile(cssPath, cssText.replace(marked, `/* svgrid-theme:start */\n${css}\n/* svgrid-theme:end */`))
  }

  if (dark) {
    const htmlPath = join(destDir, 'src', 'app.html')
    const htmlText = await readFile(htmlPath, 'utf8').catch(() => null)
    if (htmlText && !/data-theme=/.test(htmlText)) {
      await writeFile(htmlPath, htmlText.replace('<html lang="en">', '<html lang="en" data-theme="dark">'))
    }
  }
}

/**
 * Generate the app from a studio.config.json (the visual designer's export):
 * the COMPLETE runnable bundle - same code path as the designer's own "Download
 * .zip" - so the deploy target picked in the designer (Vercel / Netlify /
 * Cloudflare / Node) gets its real adapter + config, and every driver dependency
 * the generated code needs (pg / mysql2 / mssql / better-sqlite3 / libsql /
 * pglite / supabase-js) is detected and added, instead of layering a partial
 * set of routes on top of the static template's fixed adapter-auto/package.json.
 * No static template involved for this path - the bundle is self-sufficient.
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
  const files = studio.emitStudioAppBundle(project)
  for (const f of files) {
    const full = join(destDir, f.path)
    // User-owned companions (handlers.ts) are write-once: never overwrite an
    // existing one on regeneration - same contract as the designer server.
    if (typeof studio.skipUserOwned === 'function' && studio.skipUserOwned(f, existsSync(full))) continue
    await mkdir(dirname(full), { recursive: true })
    await writeFile(full, f.contents)
  }
  return { titles: project.screens.map((s) => s.title), deployLabel: studio.studioDeployInfo(project).label }
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

  // 2b. Theme + light/dark mode. Skipped for --project - a designer export
  // already carries its own theme, applied straight into +layout.svelte.
  const themeChoice = args.project ? null : await promptTheme(args, ask, interactive)
  if (rl) rl.close()

  // 3. Scaffold. --project ships a complete, self-sufficient bundle (its own
  // package.json/adapter config/theme) - skip the static template for that path
  // so its deploy-target choice isn't immediately overwritten by the template's
  // fixed adapter-auto. --from and the default (seeded example) path still
  // build on the template.
  await mkdir(destDir, { recursive: true })
  if (!args.project) {
    await copyTemplate(TEMPLATE_DIR, destDir)
    await setProjectName(destDir, projectName)
    await applyTheme(destDir, themeChoice)
  }

  // 3b. Generate from a designer project (--project) or a schema file (--from).
  let entities = null
  let source = null
  let deployLabel = null
  try {
    if (args.project) {
      const result = await applyProject(destDir, args.project)
      entities = result.titles
      deployLabel = result.deployLabel
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
  if (deployLabel) {
    stdout.write(`  ${color('dim', 'deploy')} ${deployLabel}\n`)
  }
  if (themeChoice) {
    stdout.write(`  ${color('dim', 'theme')} ${themeChoice.name}${themeChoice.dark ? ' (dark)' : ''}\n`)
  }
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
