/**
 * "Edit in StackBlitz" - turns any gallery demo into a live, editable Vite +
 * Svelte 5 project running in StackBlitz's WebContainer.
 *
 * We post to StackBlitz's public `/run` define-project endpoint with a normal
 * HTML form (no SDK dependency). Each demo is a single self-contained
 * `.svelte` file that imports only from published npm packages, so we wrap it
 * in the smallest Vite app that boots it and let StackBlitz `npm install` the
 * dependencies from the registry.
 *
 * See: https://developer.stackblitz.com/platform/api/post-api
 */
import type { Demo } from './demos'
// The gallery theme tokens (--sg-*) + the Tailwind entry, shared verbatim with
// the examples app. Bundled as text and written into each StackBlitz project.
import gridThemeCss from '../../../examples/src/index.css?raw'

// index.css pulls in the design-system PRESET themes via `@import './themes.css'`
// (which itself fans out to themes/*.css). A standalone StackBlitz demo only
// ships this one stylesheet and never sets `data-preset`, so those preset rules
// are unused - and the bare `@import` would fail to resolve in the WebContainer
// ("themes.css cannot be imported"). Strip it; the :root + dark base tokens that
// the demos actually use stay intact.
const gridBaseCss = gridThemeCss.replace(
  /^[ \t]*@import\s+['"]\.\/themes\.css['"];?[ \t]*\r?\n?/m,
  '',
)

// app.css = the gallery theme/Tailwind, plus a host that gives the WebContainer
// page a real height. Demos use `flex-1` / `containerHeight="100%"`, which
// collapse to 0px unless #app is a sized, flex-column container.
const APP_CSS = `${gridBaseCss}
/* --- StackBlitz host (not part of the gallery stylesheet) --- */
html, body { height: 100%; margin: 0; }
body { background: var(--sg-bg); color: var(--sg-fg); font-family: system-ui, -apple-system, sans-serif; }
#app { height: 100%; display: flex; flex-direction: column; padding: 1rem; box-sizing: border-box; }
`

// Published versions to pull from npm inside the WebContainer. Kept in step
// with packages/*/package.json and examples/package.json.
const SV_GRID_VERSION = '^1.0.0'

// Demos may reach for one of these in addition to @svgrid/grid. We only
// add a dependency when the demo source actually imports it, so a 10-line
// quick-start does not drag in pdfmake. Versions mirror examples/package.json.
const OPTIONAL_DEPS: Record<string, string> = {
  '@svgrid/enterprise': SV_GRID_VERSION,
  '@electric-sql/pglite': '^0.5.4',
  'ag-grid-community': '^35.3.1',
  'chart.js': '^4.5.1',
  hyperformula: '^3.3.0',
  jszip: '^3.10.1',
  pdfmake: '^0.2.10',
  'smart-webcomponents': '^26.0.0',
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Scan a demo's source for bare module imports we know how to resolve. */
function detectDependencies(source: string): Record<string, string> {
  const deps: Record<string, string> = { '@svgrid/grid': SV_GRID_VERSION }
  for (const [mod, version] of Object.entries(OPTIONAL_DEPS)) {
    // Match `from 'mod'`, `from "mod/sub"`, or a bare `import 'mod'`.
    const m = escapeForRegExp(mod)
    const re = new RegExp(`from\\s+['"]${m}(?:/[^'"]*)?['"]|import\\s+['"]${m}(?:/[^'"]*)?['"]`)
    if (re.test(source)) deps[mod] = version
  }
  return deps
}

// Raw sources of the shared helpers under examples/src/shared. Some demos
// import these via `../shared/<name>`; since StackBlitz only receives the demo
// file, we bundle the ones it actually references (transitively) alongside it.
const SHARED_SOURCES = import.meta.glob('../../../examples/src/shared/**/*.{ts,svelte}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

/** Resolve a bare shared name (e.g. 'seed', 'BadgeCell') to its glob key. */
function sharedKeyFor(name: string): string | null {
  for (const ext of ['.ts', '.svelte']) {
    const suffix = `/shared/${name}${ext}`
    const key = Object.keys(SHARED_SOURCES).find((k) => k.endsWith(suffix))
    if (key) return key
  }
  return null
}

/**
 * Walk a demo's `../shared/<name>` imports (and any same-dir `./` imports those
 * shared files make) and return them as project files placed under `shared/`,
 * so `../shared/<name>` resolves from `src/App.svelte`. `registry` is skipped -
 * it imports every demo and is only used by the standalone gallery shell.
 */
function collectSharedFiles(source: string): { files: Record<string, string>; sources: string[] } {
  const files: Record<string, string> = {}
  const sources: string[] = []
  const seen = new Set<string>()
  const visit = (src: string) => {
    const re = /from\s+['"](?:\.\.\/shared\/|\.\/)([A-Za-z0-9_.-]+)['"]/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      const name = m[1]!.replace(/\.(ts|svelte)$/, '')
      if (name === 'registry' || seen.has(name)) continue
      const key = sharedKeyFor(name)
      if (!key) continue
      seen.add(name)
      const content = SHARED_SOURCES[key]!
      const ext = key.endsWith('.svelte') ? '.svelte' : '.ts'
      files[`shared/${name}${ext}`] = content
      sources.push(content)
      visit(content)
    }
  }
  visit(source)
  return { files, sources }
}

function buildFiles(demo: Demo, source: string): Record<string, string> {
  const shared = collectSharedFiles(source)
  const pkg = {
    name: `svgrid-${demo.id}`,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { start: 'vite', dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: detectDependencies([source, ...shared.sources].join('\n')),
    devDependencies: {
      // Pinned to Rollup-based Vite 7, NOT the workspace's Vite 8. StackBlitz's
      // WebContainer cannot run Vite 8's native Rolldown bundler, so it falls
      // back to a wasm build that crashes ("Invalid atomic access index").
      // vite-plugin-svelte 6 supports Vite 7.
      '@sveltejs/vite-plugin-svelte': '^6.0.0',
      '@tailwindcss/vite': '^4.3.0',
      svelte: '^5.55.5',
      tailwindcss: '^4.3.0',
      typescript: '6.0.3',
      vite: '^7.0.0',
    },
  }

  const indexHtml = `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SvGrid - ${demo.title}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`

  const mainTs = `import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

export default mount(App, { target: document.getElementById('app')! })
`

  const viteConfig = `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({ plugins: [tailwindcss(), svelte()] })
`

  const svelteConfig = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

// vitePreprocess lets the demo's <script lang="ts"> compile out of the box.
export default { preprocess: vitePreprocess() }
`

  const tsconfig = JSON.stringify(
    {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
        resolveJsonModule: true,
        allowJs: true,
      },
      include: ['src'],
    },
    null,
    2,
  )

  return {
    ...shared.files,
    'package.json': JSON.stringify(pkg, null, 2),
    'index.html': indexHtml,
    'vite.config.js': viteConfig,
    'svelte.config.js': svelteConfig,
    'tsconfig.json': tsconfig,
    'src/app.css': APP_CSS,
    'src/main.ts': mainTs,
    'src/App.svelte': source,
  }
}

/**
 * Open the given demo as a new, editable StackBlitz project in a new tab.
 * Builds a hidden form and submits it - the only reliable cross-browser way to
 * POST a multi-file project to StackBlitz without their SDK.
 */
export async function openInStackBlitz(demo: Demo): Promise<void> {
  const source = await demo.loadSource()
  const files = buildFiles(demo, source)
  postToStackBlitz({
    title: `SvGrid - ${demo.title}`,
    description: demo.blurb,
    files,
  })
}

// ---------------------------------------------------------------------------
// "Open in StackBlitz" for an API-reference example (a prop / method / event
// snippet on the /api page). Each snippet is wrapped in a minimal but real
// Svelte 5 + @svgrid/grid app: working dataset, the imperative `api`
// object, and a "Run snippet" button that executes the example against the
// live grid when the snippet calls `api.*`. Pure-doc snippets (column defs,
// component prop usage) still land in a sandbox the user can edit live.
// ---------------------------------------------------------------------------

export type ApiSnippet = {
  /** Section title (e.g. "SvGridApi", "<SvGrid />", "ColumnDef"). */
  sectionTitle: string
  /** Section category (e.g. "Imperative API", "Events", "Components"). */
  sectionCategory: string
  /** The prop / method / event name. */
  propName: string
  /** Full TypeScript type signature for the prop. */
  propType?: string
  /** One-line human description from the docs. */
  description?: string
  /** The example snippet body shown in /api. */
  code: string
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function indent(code: string, spaces: number): string {
  const pad = ' '.repeat(spaces)
  return code
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n')
}

/**
 * A snippet is "runnable" when it actually calls a method on `api` (the
 * imperative SvGridApi object). Those embed straight into runSnippet().
 * Everything else (column defs, type shapes, prop attribute usage) lands as
 * inert documentation - the user still gets a working playground next to it.
 */
function snippetIsRunnable(code: string): boolean {
  return /\bapi\??\./.test(code)
}

function buildSnippetSource(snippet: ApiSnippet): string {
  const runnable = snippetIsRunnable(snippet.code)
  const runBody = runnable
    ? indent(snippet.code, 6)
    : "      // This snippet is documentation, not an api.* call.\n" +
      "      // Edit the grid setup above to incorporate it.\n" +
      "      output = 'Snippet is for reference - see code below the grid.'"

  const docsBlock = runnable
    ? "      output = 'Snippet ran. Open the browser console for any logs and watch the grid update.'"
    : ''

  const header = [
    snippet.sectionTitle,
    snippet.sectionCategory ? `(${snippet.sectionCategory})` : '',
    '·',
    snippet.propName,
  ]
    .filter(Boolean)
    .join(' ')

  return `<script lang="ts">
  /**
   * SvGrid docs · ${header}
   *
   * ${snippet.description ?? ''}
   *
   * The snippet from the docs is embedded inside runSnippet() below. Click
   * "Run snippet" to execute it against the live api, or edit it directly
   * - StackBlitz hot-reloads on save.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Order = {
    id: number
    customer: string
    status: 'paid' | 'pending' | 'shipped' | 'refunded'
    email: string
    total: number
    notes?: string
  }

  const features = tableFeatures({
    rowSortingFeature,
    columnFilteringFeature,
    rowSelectionFeature,
  })

  let data = $state<Order[]>([
    { id: 1, customer: 'Acme Corp',  status: 'paid',    email: 'ada@acme.com',     total: 1240 },
    { id: 2, customer: 'Globex Inc', status: 'pending', email: 'g@globex.io',      total: 850 },
    { id: 3, customer: 'Initech',    status: 'paid',    email: 'init@initech.io',  total: 3200 },
    { id: 4, customer: 'Soylent',    status: 'shipped', email: 'sales@soy.co',     total: 540 },
    { id: 5, customer: 'Umbrella',   status: 'pending', email: 'u@umbrella.co',    total: 980 },
    { id: 6, customer: 'Stark Ind',  status: 'paid',    email: 'pepper@stark.io',  total: 4750 },
  ])

  const columns: ColumnDef<typeof features, Order>[] = [
    { field: 'id',       header: 'ID',       width: 80,  editorType: 'number' },
    { field: 'customer', header: 'Customer', width: 170, editorType: 'text' },
    { field: 'status',   header: 'Status',   width: 110, editorType: 'text' },
    { field: 'email',    header: 'Email',    width: 200, editorType: 'text' },
    { field: 'total',    header: 'Total',    width: 130, editorType: 'number',
      format: { type: 'currency', currency: 'USD' } },
  ]

  let api = $state<SvGridApi<typeof features, Order> | null>(null)
  let output = $state('')

  function runSnippet() {
    if (!api) {
      output = 'Grid is still mounting - try again in a moment.'
      return
    }
    try {
${runBody}
${docsBlock}
    } catch (err) {
      output = 'Error: ' + ((err as Error).message ?? String(err))
    }
  }
</script>

<main style="padding: 1.25rem; font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; max-width: 1100px; margin: 0 auto;">
  <header style="margin-bottom: 1rem;">
    <p style="margin: 0; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #f97316;">
      ${escapeHtml(snippet.sectionCategory)} · ${escapeHtml(snippet.sectionTitle)}
    </p>
    <h1 style="margin: 0.25rem 0 0 0; font-size: 1.6rem; font-weight: 800;">
      ${escapeHtml(snippet.propName)}
    </h1>
    ${
      snippet.description
        ? `<p style="margin: 0.5rem 0 0 0; color: #475569; line-height: 1.5;">${escapeHtml(snippet.description)}</p>`
        : ''
    }
  </header>

  <section style="margin-bottom: 1.25rem; padding: 1rem; border-radius: 8px; background: #0f172a; color: #e2e8f0;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; margin-bottom: 0.5rem;">
      <p style="margin: 0; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #94a3b8;">
        Docs snippet
      </p>
      <button
        type="button"
        onclick={runSnippet}
        style="padding: 0.4rem 0.9rem; background: #f97316; color: white; border: 0; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 0.85rem;"
      >
        ${runnable ? 'Run snippet' : 'See docs note'}
      </button>
    </div>
    <pre style="margin: 0; font-size: 0.85rem; line-height: 1.5; overflow-x: auto;"><code>${escapeHtml(
      snippet.code,
    )}</code></pre>
    {#if output}
      <p style="margin: 0.6rem 0 0 0; font-size: 0.8rem; color: #facc15;">{output}</p>
    {/if}
  </section>

  <section>
    <p style="margin: 0 0 0.5rem 0; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #475569;">
      Live grid (the api the snippet runs against)
    </p>
    <SvGrid
      bind:data
      {columns}
      {features}
      rowHeight={36}
      containerHeight={420}
      showColumnFilters
      showRowSelection
      enableCellSelection
      enableInlineEditing
      onApiReady={(a) => (api = a)}
    />
  </section>
</main>
`
}

function buildSnippetFiles(snippet: ApiSnippet): Record<string, string> {
  const source = buildSnippetSource(snippet)
  const pkg = {
    name: 'svgrid-api-snippet',
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { start: 'vite', dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: detectDependencies(source),
    devDependencies: {
      // Pinned to Rollup-based Vite 7, NOT the workspace's Vite 8. StackBlitz's
      // WebContainer cannot run Vite 8's native Rolldown bundler, so it falls
      // back to a wasm build that crashes ("Invalid atomic access index").
      // vite-plugin-svelte 6 supports Vite 7.
      '@sveltejs/vite-plugin-svelte': '^6.0.0',
      '@tailwindcss/vite': '^4.3.0',
      svelte: '^5.55.5',
      tailwindcss: '^4.3.0',
      typescript: '6.0.3',
      vite: '^7.0.0',
    },
  }
  const indexHtml = `<!doctype html>
<html lang="en" data-theme="dark">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SvGrid - ${snippet.propName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
  const mainTs = `import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'

export default mount(App, { target: document.getElementById('app')! })
`
  const viteConfig = `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({ plugins: [tailwindcss(), svelte()] })
`
  const svelteConfig = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default { preprocess: vitePreprocess() }
`
  const tsconfig = JSON.stringify(
    {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        isolatedModules: true,
        resolveJsonModule: true,
        allowJs: true,
      },
      include: ['src'],
    },
    null,
    2,
  )
  return {
    'package.json': JSON.stringify(pkg, null, 2),
    'index.html': indexHtml,
    'vite.config.js': viteConfig,
    'svelte.config.js': svelteConfig,
    'tsconfig.json': tsconfig,
    'src/app.css': APP_CSS,
    'src/main.ts': mainTs,
    'src/App.svelte': source,
  }
}

function postToStackBlitz(args: {
  title: string
  description: string
  files: Record<string, string>
}): void {
  const form = document.createElement('form')
  form.method = 'POST'
  form.action = 'https://stackblitz.com/run?file=src%2FApp.svelte'
  form.target = '_blank'
  form.style.display = 'none'

  const addField = (name: string, value: string) => {
    const field = document.createElement('textarea')
    field.name = name
    field.value = value
    form.appendChild(field)
  }

  addField('project[title]', args.title)
  addField('project[description]', args.description)
  addField('project[template]', 'node')
  addField('project[tags][]', 'svelte')
  for (const [path, content] of Object.entries(args.files)) {
    addField(`project[files][${path}]`, content)
  }

  document.body.appendChild(form)
  form.submit()
  form.remove()
}

/**
 * Open an /api page snippet (prop / method / event example) as a new
 * editable StackBlitz project. The sandbox boots a real Svelte 5 + sv-grid-
 * community app with a working grid and the snippet wired into a "Run"
 * button when it touches the imperative api.
 */
export function openSnippetInStackBlitz(snippet: ApiSnippet): void {
  const files = buildSnippetFiles(snippet)
  postToStackBlitz({
    title: `SvGrid - ${snippet.sectionTitle} · ${snippet.propName}`,
    description: snippet.description ?? `SvGrid docs snippet for ${snippet.propName}`,
    files,
  })
}
