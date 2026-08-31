#!/usr/bin/env node
// @svgrid/ui - add SvGrid UI components to your app, one command at a time.
//
//   npx @svgrid/ui add calendar               # add a component (installs the dep)
//   npx @svgrid/ui add button --preview        # + a /preview/button route to see it
//   npx @svgrid/ui try button                  # zero-setup: open it in a sandbox
//   npx @svgrid/ui add calendar time-picker --dir src/lib/ui
//   npx @svgrid/ui add date-time               # the whole date/time family
//   npx @svgrid/ui list
//
// Recipe-scaffolder model: `add` writes a minimal, ready-to-EDIT .svelte starter
// that imports from `@svgrid/grid` (which you own and can change). Each recipe is
// a self-contained demo, so `--preview` (in your app) and `try` (in a throwaway
// sandbox) can render it immediately - "one command and see it".
//
// Zero runtime dependencies - Node built-ins only.

import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { stdout } from 'node:process'
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
  // install defaults ON: an added component imports @svgrid/grid, so it should
  // work right away. `--no-install` opts out (just prints the command).
  const args = { _: [], dir: null, force: false, install: true, preview: false, help: false, js: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') args.help = true
    else if (a === '--force' || a === '-f') args.force = true
    else if (a === '--install') args.install = true
    else if (a === '--no-install') args.install = false
    else if (a === '--preview' || a === '-p') args.preview = true
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

/** Resolve tokens -> unique items in order; exits with a helpful error on unknowns. */
function collectItems(registry, tokens) {
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
  return [...items.values()]
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

/** A SvelteKit app has file-based routes, so we can drop in a /preview route. */
function isSvelteKit(root) {
  return !!root && (existsSync(join(root, 'svelte.config.js')) || existsSync(join(root, 'src', 'routes')))
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

/** A valid JS identifier for a component id (time-picker -> C_time_picker). */
function toIdent(id) {
  return 'C_' + id.replace(/[^a-zA-Z0-9]/g, '_')
}

function esc(s) {
  return String(s ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** A SvelteKit `/preview/<id>` page that renders the recipe you just added, so
 *  you can open it in your dev server. Import is relative to the recipe on disk,
 *  so it works whether or not the recipe lives under $lib. */
async function writePreviewRoutes(projectRoot, dest, items, force) {
  const routesRoot = join(projectRoot, 'src', 'routes', 'preview')
  const urls = []
  for (const it of items) {
    const file = it.files?.[0]
    if (!file) continue
    const routeDir = join(routesRoot, it.id)
    await mkdir(routeDir, { recursive: true })
    const routeFile = join(routeDir, '+page.svelte')
    urls.push('/preview/' + it.id)
    if (existsSync(routeFile) && !force) continue
    let rel = relative(routeDir, join(dest, file.write)).split('\\').join('/')
    if (!rel.startsWith('.')) rel = './' + rel
    await writeFile(
      routeFile,
      `<script lang="ts">
  // Auto-generated by @svgrid/ui to preview the ${it.id} recipe. Yours to edit.
  import Demo from '${rel}'
</script>

<div class="svui-preview">
  <a class="svui-preview__back" href="/preview">&larr; all components</a>
  <h1 class="svui-preview__title">${esc(it.title ?? it.id)}</h1>
  <p class="svui-preview__desc">${esc(it.description ?? '')}</p>
  <div class="svui-preview__stage">
    <Demo />
  </div>
</div>

<style>
  .svui-preview { max-width: 880px; margin: 0 auto; padding: 32px 24px; font-family: system-ui, sans-serif; }
  .svui-preview__back { font-size: 13px; color: #6366f1; text-decoration: none; }
  .svui-preview__title { margin: 12px 0 4px; font-size: 24px; }
  .svui-preview__desc { margin: 0 0 20px; color: #64748b; font-size: 14px; }
  .svui-preview__stage { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; padding: 28px; border: 1px solid #e2e8f0; border-radius: 12px; background: #fff; }
</style>
`,
    )
  }
  await writePreviewIndex(routesRoot)
  return urls
}

/** (Re)generate /preview - an index of every component preview present on disk. */
async function writePreviewIndex(routesRoot) {
  let entries = []
  try {
    entries = await readdir(routesRoot, { withFileTypes: true })
  } catch {
    return
  }
  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort()
  const links = ids.map((id) => `    <a class="svui-index__link" href="/preview/${id}">${esc(id)}</a>`).join('\n')
  await writeFile(
    join(routesRoot, '+page.svelte'),
    `<script lang="ts">
  // Auto-generated by @svgrid/ui. Lists the component previews you've added.
</script>

<div class="svui-index">
  <h1>Component previews</h1>
  <div class="svui-index__grid">
${links}
  </div>
</div>

<style>
  .svui-index { max-width: 880px; margin: 0 auto; padding: 32px 24px; font-family: system-ui, sans-serif; }
  .svui-index h1 { font-size: 22px; }
  .svui-index__grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin-top: 16px; }
  .svui-index__link { padding: 12px 14px; border: 1px solid #e2e8f0; border-radius: 10px; text-decoration: none; color: #0f172a; font-size: 14px; }
  .svui-index__link:hover { border-color: #6366f1; color: #6366f1; }
</style>
`,
  )
}

function printHelp() {
  stdout.write(`
${color('bold', '@svgrid/ui')} - add SvGrid UI components to your app

${color('bold', 'Usage')}
  npx @svgrid/ui add <component...> [--dir <path>] [--preview] [--force] [--no-install]
  npx @svgrid/ui try <component...>
  npx @svgrid/ui list

${color('bold', 'Commands')}
  ${color('cyan', 'add')}    Write a ready-to-edit recipe for each component into your project
         (and install @svgrid/grid). Add ${color('cyan', '--preview')} to also drop a /preview route.
  ${color('cyan', 'try')}    Open the component(s) in a throwaway sandbox - no project needed.
  ${color('cyan', 'list')}   Show the components you can add.

${color('bold', 'Options')}
  --preview, -p  (add) Also write a src/routes/preview/<id> route so you can see it
                 in your running dev server. SvelteKit apps only.
  --dir <path>   Where to write files (default: src/lib/components/ui, or the
                 "componentsDir" in a project svgrid.json).
  --force        Overwrite files that already exist.
  --no-install   Do not run the package manager; just print the install command.

${color('bold', 'Examples')}
  npx @svgrid/ui try button
  npx @svgrid/ui add button --preview
  npx @svgrid/ui add calendar time-picker --dir src/lib/ui
  npx @svgrid/ui add date-time
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
  stdout.write(`\n${color('dim', 'Add one with:')} npx @svgrid/ui add ${registry.items[0]?.id ?? 'calendar'}\n`)
  stdout.write(`${color('dim', 'Or just see it:')} npx @svgrid/ui try ${registry.items[0]?.id ?? 'calendar'}\n\n`)
}

async function cmdAdd(registry, tokens, args) {
  if (!tokens.length) {
    stdout.write(`${color('red', '✖')} Nothing to add. Try: ${color('cyan', 'npx @svgrid/ui list')}\n`)
    process.exit(1)
  }
  const items = collectItems(registry, tokens)

  const cwd = process.cwd()
  const projectRoot = findProjectRoot(cwd)
  const dest = await targetDir(args, projectRoot, cwd)
  await mkdir(dest, { recursive: true })

  const written = []
  const skipped = []
  const deps = new Set()
  for (const it of items) {
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
  if (!written.length && !args.preview) {
    stdout.write(`\n${color('yellow', '!')} No files written.\n\n`)
    return
  }

  // Install the dependency - only meaningful inside a project (on by default;
  // --no-install just prints the command). `add` writes into an EXISTING app;
  // a no-project run is handled in the next-steps block below.
  if (projectRoot) {
    const pm = detectPm(projectRoot)
    const added = await ensureDeps(projectRoot, [...deps])
    if (added.length) {
      if (args.install) {
        stdout.write(`\n${color('dim', `Installing with ${pm.id}...`)}\n`)
        // Single shell string (not bin + args[]) so Node doesn't warn DEP0190
        // under shell:true; the tokens here are fixed pm commands + npm package ids.
        const res = spawnSync(`${pm.add} ${added.join(' ')}`, { cwd: projectRoot, stdio: 'inherit', shell: true })
        if (res.status !== 0) {
          stdout.write(`${color('yellow', '!')} Install failed - run it yourself: ${color('cyan', `${pm.add} ${added.join(' ')}`)}\n`)
        }
      } else {
        stdout.write(`\n${color('bold', 'Install the dependency')}\n  ${color('cyan', `${pm.add} ${added.join(' ')}`)}\n`)
      }
    } else if ([...deps].length) {
      stdout.write(`\n${color('dim', `${[...deps].join(', ')} already in package.json.`)}\n`)
    }
  }

  // Optional preview route(s) - needs a SvelteKit project.
  if (args.preview) {
    if (isSvelteKit(projectRoot)) {
      const urls = await writePreviewRoutes(projectRoot, dest, items, args.force)
      stdout.write(`\n${color('green', '✔')} Preview route(s) written. Start your dev server and open:\n`)
      for (const u of urls) stdout.write(`  ${color('cyan', u)}\n`)
    } else {
      stdout.write(
        `\n${color('yellow', '!')} --preview needs a SvelteKit app (src/routes). ` +
          `To see it with zero setup: ${color('cyan', `npx @svgrid/ui try ${items[0].id}`)}\n`,
      )
    }
  }

  // Next steps.
  const first = items[0]
  const ids = items.map((it) => it.id).join(' ')
  stdout.write(`\n${color('green', '✔')} Added ${written.length} file(s). They're yours - edit away.\n`)
  if (!projectRoot) {
    // A lone component file with no app to run it - `add` targets an existing
    // project. Point at the two real paths instead of leaving a stranded file.
    stdout.write(
      `  ${color('yellow', 'Heads up:')} no package.json here, so there's nothing to run this in yet.\n` +
        `  ${color('dim', 'See it now:')}   ${color('cyan', `npx @svgrid/ui try ${ids}`)} ${color('dim', '(no project needed)')}\n` +
        `  ${color('dim', 'Start an app:')} ${color('cyan', 'npm create @svgrid@latest')} ${color('dim', '(then run add inside it)')}\n`,
    )
  } else {
    stdout.write(`  ${color('dim', 'Use it:')}  import { ${exportName(first)} } from '@svgrid/grid'\n`)
    // "See it" - skip when we already wrote preview routes just above.
    if (!(args.preview && isSvelteKit(projectRoot))) {
      stdout.write(`  ${color('dim', 'See it:')}  ${color('cyan', `npx @svgrid/ui try ${ids}`)} ${color('dim', '(opens in your browser)')}\n`)
      if (isSvelteKit(projectRoot)) {
        stdout.write(`  ${color('dim', 'In app:')}  re-run with ${color('cyan', '--preview')} to add a /preview/${first.id} route\n`)
      }
    }
  }
  stdout.write(`\n${color('dim', 'Docs:')} https://svgrid.com/docs/help/ui-components\n\n`)
}

/** `try` - render the component(s) in a throwaway Vite + Svelte sandbox and open
 *  the browser. No project needed. The sandbox is cached under the OS temp dir so
 *  repeat runs skip the install. */
async function cmdTry(registry, tokens) {
  if (!tokens.length) {
    stdout.write(`${color('red', '✖')} Nothing to try. Try: ${color('cyan', 'npx @svgrid/ui try button')}\n`)
    process.exit(1)
  }
  const items = collectItems(registry, tokens)
  const sandbox = join(tmpdir(), 'svgrid-ui-try')
  const src = join(sandbox, 'src')
  await mkdir(src, { recursive: true })

  // Base app (mirrors the known-good minimal Vite + Svelte 5 setup).
  await writeFile(
    join(sandbox, 'package.json'),
    JSON.stringify(
      {
        name: 'svgrid-ui-try',
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: { dev: 'vite' },
        dependencies: { '@svgrid/grid': 'latest' },
        devDependencies: { '@sveltejs/vite-plugin-svelte': '^7.0.0', svelte: '^5.55.5', vite: '^8.0.10' },
      },
      null,
      2,
    ) + '\n',
  )
  await writeFile(
    join(sandbox, 'vite.config.js'),
    `import { svelte } from '@sveltejs/vite-plugin-svelte'\nimport { defineConfig } from 'vite'\n\nexport default defineConfig({ plugins: [svelte()] })\n`,
  )
  await writeFile(
    join(sandbox, 'svelte.config.js'),
    `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'\n\nexport default { preprocess: vitePreprocess() }\n`,
  )
  await writeFile(
    join(sandbox, 'index.html'),
    `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>@svgrid/ui preview</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/src/main.js"></script>\n  </body>\n</html>\n`,
  )
  await writeFile(
    join(src, 'main.js'),
    `import { mount } from 'svelte'\nimport App from './App.svelte'\n\nexport default mount(App, { target: document.getElementById('app') })\n`,
  )

  // Copy each recipe (all its files) and render the primary one.
  const imports = []
  const sections = []
  for (const it of items) {
    let primary
    for (const file of it.files ?? []) {
      await cp(join(RECIPES_DIR, file.from), join(src, file.write))
      primary ??= file.write
    }
    if (!primary) continue
    const ident = toIdent(it.id)
    imports.push(`  import ${ident} from './${primary}'`)
    sections.push(`    <section class="svui-try__item">\n      <h2>${esc(it.title ?? it.id)}</h2>\n      <${ident} />\n    </section>`)
  }
  await writeFile(
    join(src, 'App.svelte'),
    `<script lang="ts">
  import { themePresets, resolveThemeTokens } from '@svgrid/grid/themes'
${imports.join('\n')}

  let themeId = $state(themePresets[0].id)
  let mode = $state<'light' | 'dark'>('light')
  const preset = $derived(themePresets.find((p) => p.id === themeId) ?? themePresets[0])

  // Apply the chosen preset + light/dark as --sg-* tokens on :root, the same way
  // the shipped themes/<id>.css files do (light in :root, dark under data-theme),
  // so both the components and this page follow the picker.
  $effect(() => {
    const tokens = resolveThemeTokens(preset, mode)
    const root = document.documentElement
    for (const [k, v] of Object.entries(tokens)) root.style.setProperty(k, v)
    root.setAttribute('data-theme', mode)
    root.style.colorScheme = mode
  })
</script>

<header class="svui-try__bar">
  <strong class="svui-try__brand">@svgrid/ui preview</strong>
  <div class="svui-try__controls">
    <label class="svui-try__field">
      Theme
      <select bind:value={themeId}>
        {#each themePresets as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
      </select>
    </label>
    <button type="button" class="svui-try__toggle" onclick={() => (mode = mode === 'light' ? 'dark' : 'light')}>
      {mode === 'light' ? 'Dark' : 'Light'} mode
    </button>
  </div>
</header>

<main class="svui-try">
  <p class="svui-try__sub">${esc(items.map((i) => i.id).join(', '))}</p>
${sections.join('\n')}
</main>

<style>
  :global(body) { margin: 0; background: var(--sg-bg, #f8fafc); color: var(--sg-fg, #0f172a); transition: background 0.15s, color 0.15s; }
  .svui-try__bar { position: sticky; top: 0; z-index: 10; display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 12px 24px; background: var(--sg-header-bg, #fff); border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .svui-try__brand { font-size: 13px; color: var(--sg-muted, #64748b); }
  .svui-try__controls { display: flex; align-items: center; gap: 12px; }
  .svui-try__field { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .svui-try__field select { font: inherit; padding: 5px 8px; border-radius: 8px; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); }
  .svui-try__toggle { font: inherit; font-size: 12px; padding: 6px 12px; border-radius: 8px; cursor: pointer; border: 1px solid var(--sg-border, #cbd5e1); background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); }
  .svui-try__toggle:hover { border-color: var(--sg-accent, #6366f1); }
  .svui-try { max-width: 960px; margin: 0 auto; padding: 24px; font-family: system-ui, sans-serif; }
  .svui-try__sub { margin: 0 0 20px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .svui-try__item { padding: 28px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; background: var(--sg-bg, #fff); margin-bottom: 16px; }
  .svui-try__item h2 { margin: 0 0 16px; font-size: 15px; color: var(--sg-muted, #334155); }
</style>
`,
  )

  // Install only when the sandbox isn't already provisioned.
  const provisioned =
    existsSync(join(sandbox, 'node_modules', '@svgrid', 'grid')) && existsSync(join(sandbox, 'node_modules', 'vite'))
  if (!provisioned) {
    stdout.write(`\n${color('dim', 'Setting up preview sandbox (first run installs deps)...')}\n`)
    const res = spawnSync('npm install', { cwd: sandbox, stdio: 'inherit', shell: true })
    if (res.status !== 0) {
      stdout.write(`${color('red', '✖')} Sandbox install failed.\n`)
      process.exit(1)
    }
  }

  stdout.write(
    `\n${color('green', '▶')} Opening ${color('cyan', items.map((i) => i.id).join(', '))} ${color('dim', '(Ctrl+C to stop)')}\n`,
  )
  spawnSync('npx vite --open', { cwd: sandbox, stdio: 'inherit', shell: true })
}

/** Component export name from its id (calendar -> SvCalendar, time-picker ->
 *  SvTimePicker). A registry item can override it with `export` when the id and
 *  the component name diverge (data-table -> SvGrid). */
function exportName(item) {
  if (item.export) return item.export
  return 'Sv' + item.id.split('-').map((s) => s[0].toUpperCase() + s.slice(1)).join('')
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
    case 'try':
    case 'preview':
      return cmdTry(registry, rest)
    default:
      // Treat a bare component id as `add <id>` for convenience.
      if (resolveItem(registry, command) || registry.groups?.[command]) {
        return cmdAdd(registry, [command, ...rest], args)
      }
      stdout.write(`${color('red', '✖')} Unknown command "${command}". Try ${color('cyan', 'add')}, ${color('cyan', 'try')} or ${color('cyan', 'list')}.\n`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
