#!/usr/bin/env node
// @svgrid/create - scaffold a Svelte app powered by SvGrid.
//
//   npm  create @svgrid@latest             # interactive
//   pnpm create @svgrid                     # interactive
//   npm  create @svgrid@latest my-app -- --template admin-dashboard
//   npm  create @svgrid@latest my-app -- -t minimal
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
  const args = { _: [], template: null, force: false, help: false, theme: null, mode: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--template' || a === '-t') args.template = argv[++i]
    else if (a.startsWith('--template=')) args.template = a.slice('--template='.length)
    else if (a === '--theme') args.theme = argv[++i]
    else if (a.startsWith('--theme=')) args.theme = a.slice('--theme='.length)
    else if (a === '--dark') args.mode = 'dark'
    else if (a === '--light') args.mode = 'light'
    else if (!a.startsWith('-')) args._.push(a)
  }
  return args
}

function printHelp() {
  stdout.write(`
${color('bold', '@svgrid/create')} - scaffold a Svelte app powered by SvGrid

${color('bold', 'Usage')}
  npm create @svgrid@latest [dir] -- [--template <name>] [--force]

${color('bold', 'Templates')}
${Object.entries(TEMPLATES)
  .map(([k, t]) => `  ${color('cyan', k.padEnd(16))} ${t.label.replace(/^\S+\s+-\s+/, '')}`)
  .join('\n')}

${color('bold', 'Options')}
  --theme <id>       admin-dashboard only. One of: ${THEME_IDS.join(', ')} (default: tailwind).
  --dark / --light   admin-dashboard only. Start in dark or light mode (default: dark).
  --force            Scaffold into a non-empty directory.

${color('bold', 'Examples')}
  npm  create @svgrid@latest
  npm  create @svgrid@latest my-app -- --template admin-dashboard
  npm  create @svgrid@latest my-app -- -t admin-dashboard --theme material --light
  pnpm create @svgrid my-app -t minimal
`)
}

const THEME_IDS = [
  'shadcn', 'tailwind', 'material', 'excel', 'fluent', 'carbon', 'sap',
  'salesforce', 'atlassian', 'github', 'antd', 'ag-alpine', 'bootstrap',
  'vercel', 'linear', 'notion', 'nord', 'dracula', 'catppuccin',
]

/**
 * Resolve the theme + mode to apply (admin-dashboard only): from `--theme` /
 * `--dark` / `--light` flags, or (in a TTY) an interactive prompt; otherwise
 * left untouched (the template's own dark-by-default look stands). Reuses
 * `@svgrid/grid/themes`'s own preset list, so the picker can never drift from
 * the canonical set.
 */
async function promptTheme(args, ask, interactive) {
  let themes
  try {
    themes = await import('@svgrid/grid/themes')
  } catch {
    return null // theming is best-effort; the template's own default stands in.
  }

  let themeId = args.theme ? args.theme.trim().toLowerCase() : null
  if (themeId && !themes.getThemePreset(themeId)) {
    stdout.write(`${color('yellow', '!')} Unknown theme "${themeId}" - using tailwind. (${THEME_IDS.join(', ')})\n`)
    themeId = null
  }
  if (!themeId && interactive) {
    const list = themes.themePresets.map((t, i) => `  ${i + 1}. ${t.name} ${color('dim', `(${t.id})`)}`).join('\n')
    stdout.write(`\n${color('bold', 'Theme')}\n${list}\n`)
    const choice = await ask('Pick a number or id:', 'tailwind')
    const byIndex = themes.themePresets[Number(choice) - 1]
    themeId = byIndex ? byIndex.id : (themes.getThemePreset(choice.trim().toLowerCase())?.id ?? 'tailwind')
  }
  themeId ??= 'tailwind'

  let mode = args.mode
  if (!mode && interactive) {
    const a = await ask('Light or dark mode? (light/dark)', 'dark')
    mode = /^l(ight)?$/i.test(a) ? 'light' : 'dark'
  }
  mode ??= 'dark' // matches the template's existing default - only patched when 'light' is chosen.

  return { themeId, mode, name: themes.getThemePreset(themeId)?.name ?? themeId, themes }
}

/** Rewrite `app.css` (between the `svgrid-theme` markers) with the resolved
 *  `--sg-*` tokens for the chosen theme. */
async function applyTheme(destDir, choice) {
  if (!choice) return
  const { themeId, themes } = choice
  const preset = themes.getThemePreset(themeId) ?? themes.defaultThemePreset
  const light = themes.resolveThemeTokens(preset, 'light')
  const dark = themes.resolveThemeTokens(preset, 'dark')
  const block = (selector, tokens, scheme) => {
    const lines = Object.entries(tokens).map(([k, v]) => `  ${k}: ${v};`).join('\n')
    return `${selector} {\n${lines}\n  color-scheme: ${scheme};\n}`
  }
  const css = `${block(':root', light, 'light')}\n${block(":root[data-theme='dark']", dark, 'dark')}`

  const cssPath = join(destDir, 'src', 'app.css')
  const cssText = await readFile(cssPath, 'utf8').catch(() => null)
  if (cssText == null) return
  const marked = /\/\* svgrid-theme:start \*\/[\s\S]*?\/\* svgrid-theme:end \*\//
  if (marked.test(cssText)) {
    await writeFile(cssPath, cssText.replace(marked, `/* svgrid-theme:start */\n${css}\n/* svgrid-theme:end */`))
  }
}

/** admin-dashboard defaults to dark (see app.html / src/lib/theme.ts /
 *  +layout.svelte). Flip all three to light-by-default when 'light' is chosen
 *  - a no-op when 'dark' is chosen, since that already matches the template. */
async function applyMode(destDir, choice) {
  if (!choice || choice.mode !== 'light') return

  const htmlPath = join(destDir, 'src', 'app.html')
  const html = await readFile(htmlPath, 'utf8').catch(() => null)
  if (html != null) {
    await writeFile(
      htmlPath,
      html
        .replace(`data-theme="dark"`, `data-theme="light"`)
        .replace(`t === 'light' ? 'light' : 'dark'`, `t === 'dark' ? 'dark' : 'light'`),
    )
  }

  const themeTsPath = join(destDir, 'src', 'lib', 'theme.ts')
  const themeTs = await readFile(themeTsPath, 'utf8').catch(() => null)
  if (themeTs != null) {
    await writeFile(
      themeTsPath,
      themeTs
        .replace('Defaults to dark (matches app.html).', 'Defaults to light (matches app.html).')
        .replace(`if (!browser) return 'dark'`, `if (!browser) return 'light'`)
        .replace(
          `return localStorage.getItem('theme') === 'light' ? 'light' : 'dark'`,
          `return localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'`,
        ),
    )
  }

  const layoutPath = join(destDir, 'src', 'routes', '+layout.svelte')
  const layout = await readFile(layoutPath, 'utf8').catch(() => null)
  if (layout != null) {
    await writeFile(
      layoutPath,
      layout
        .replace('// Theme: dark by default (see app.html), toggleable + persisted.', '// Theme: light by default (see app.html), toggleable + persisted.')
        .replace(`let theme = $state<Theme>('dark')`, `let theme = $state<Theme>('light')`),
    )
  }
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
  // Match only on the path RELATIVE to the template root. The absolute `src`
  // includes the install location (e.g. `.../node_modules/@svgrid/create/...`),
  // so testing it directly would match `node_modules` and skip the whole copy.
  const skip = /(^|[\\/])(node_modules|\.svelte-kit|\.vercel|build|dist)([\\/]|$)/
  await cp(srcDir, destDir, {
    recursive: true,
    filter: (src) => !skip.test(src.slice(srcDir.length)),
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

  stdout.write(`\n${color('bold', '◆ @svgrid/create')}  ${color('dim', 'Svelte + SvGrid')}\n\n`)

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
      Object.entries(TEMPLATES).forEach(([, t], i) => {
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

  // 3b. Theme + light/dark mode - admin-dashboard only (minimal has no theme
  // system to pick from).
  const themeChoice = template === 'admin-dashboard' ? await promptTheme(args, ask, interactive) : null
  if (rl) rl.close()

  // 4. Scaffold.
  await mkdir(destDir, { recursive: true })
  await copyTemplate(srcDir, destDir)
  await setProjectName(destDir, projectName)
  await applyTheme(destDir, themeChoice)
  await applyMode(destDir, themeChoice)

  // 5. Next steps.
  const rel = isAbsolute(target) || target.startsWith('.') ? target : `./${target}`
  stdout.write(`\n${color('green', '✔')} Scaffolded ${color('bold', projectName)} (${template}) into ${rel}\n`)
  if (themeChoice) {
    stdout.write(`  ${color('dim', 'theme')} ${themeChoice.name} (${themeChoice.mode})\n`)
  }
  stdout.write(`\n`)
  stdout.write(`${color('bold', 'Next steps')}\n`)
  stdout.write(`  cd ${target}\n`)
  stdout.write(`  npm install\n`)
  stdout.write(`  npm run dev\n\n`)
  stdout.write(`${color('dim', 'Docs:')} https://svgrid.com/docs   ${color('dim', 'Pro:')} https://svgrid.com/pricing\n\n`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
