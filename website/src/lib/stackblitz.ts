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

// Published versions to pull from npm inside the WebContainer. Kept in step
// with packages/*/package.json and examples/package.json.
const SV_GRID_VERSION = '^1.0.0'

// Demos may reach for one of these in addition to sv-grid-community. We only
// add a dependency when the demo source actually imports it, so a 10-line
// quick-start does not drag in pdfmake. Versions mirror examples/package.json.
const OPTIONAL_DEPS: Record<string, string> = {
  'sv-grid-pro': SV_GRID_VERSION,
  'chart.js': '^4.5.1',
  jszip: '^3.10.1',
  pdfmake: '^0.2.10',
  'smart-webcomponents': '^26.0.0',
}

function escapeForRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Scan a demo's source for bare module imports we know how to resolve. */
function detectDependencies(source: string): Record<string, string> {
  const deps: Record<string, string> = { 'sv-grid-community': SV_GRID_VERSION }
  for (const [mod, version] of Object.entries(OPTIONAL_DEPS)) {
    // Match `from 'mod'`, `from "mod/sub"`, or a bare `import 'mod'`.
    const m = escapeForRegExp(mod)
    const re = new RegExp(`from\\s+['"]${m}(?:/[^'"]*)?['"]|import\\s+['"]${m}(?:/[^'"]*)?['"]`)
    if (re.test(source)) deps[mod] = version
  }
  return deps
}

function buildFiles(demo: Demo): Record<string, string> {
  const pkg = {
    name: `svgrid-${demo.id}`,
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: detectDependencies(demo.source),
    devDependencies: {
      '@sveltejs/vite-plugin-svelte': '^7.0.0',
      svelte: '^5.55.5',
      typescript: '6.0.3',
      vite: '^8.0.10',
    },
  }

  const indexHtml = `<!doctype html>
<html lang="en">
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
import App from './App.svelte'

export default mount(App, { target: document.getElementById('app')! })
`

  const viteConfig = `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({ plugins: [svelte()] })
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
    'package.json': JSON.stringify(pkg, null, 2),
    'index.html': indexHtml,
    'vite.config.js': viteConfig,
    'svelte.config.js': svelteConfig,
    'tsconfig.json': tsconfig,
    'src/main.ts': mainTs,
    'src/App.svelte': demo.source,
  }
}

/**
 * Open the given demo as a new, editable StackBlitz project in a new tab.
 * Builds a hidden form and submits it - the only reliable cross-browser way to
 * POST a multi-file project to StackBlitz without their SDK.
 */
export function openInStackBlitz(demo: Demo): void {
  const files = buildFiles(demo)

  const form = document.createElement('form')
  form.method = 'POST'
  // Open App.svelte with the preview pane visible on load.
  form.action = 'https://stackblitz.com/run?file=src%2FApp.svelte'
  form.target = '_blank'
  form.style.display = 'none'

  const addField = (name: string, value: string) => {
    // <textarea> preserves newlines in file contents that a bare <input> would
    // collapse on some browsers.
    const field = document.createElement('textarea')
    field.name = name
    field.value = value
    form.appendChild(field)
  }

  addField('project[title]', `SvGrid - ${demo.title}`)
  addField('project[description]', demo.blurb)
  addField('project[template]', 'node')
  addField('project[tags][]', 'svelte')
  for (const [path, content] of Object.entries(files)) {
    addField(`project[files][${path}]`, content)
  }

  document.body.appendChild(form)
  form.submit()
  form.remove()
}
