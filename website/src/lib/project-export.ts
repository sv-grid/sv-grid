/**
 * "Download runnable project" - turns a demo (or the playground's edited
 * source) into a minimal, self-contained Vite + Svelte 5 project that runs the
 * real component with `npm install && npm run dev`. Uses the `@svgrid/grid`
 * package straight from npm (no CDN, no build tricks), so what you download is
 * exactly what you edited.
 */
import JSZip from 'jszip'

// Raw source of the shared helpers some demos import via `../shared/...`.
const RAW_SHARED = import.meta.glob('../../../examples/src/shared/**/*.{ts,js,svelte}', {
  query: '?raw',
  import: 'default',
}) as Record<string, () => Promise<string>>

// Pinned versions for the deps we know; anything else falls back to "latest".
const DEP_VERSIONS: Record<string, string> = {
  '@svgrid/grid': '^1.1.2',
  '@svgrid/enterprise': '^1.1.0',
  jszip: '^3.10.1',
  'chart.js': '^4.4.7',
  hyperformula: '^2.7.1',
  'ag-grid-community': '^33.0.0',
}

/** Base package name for an import specifier (handles scoped + subpaths). */
function pkgOf(spec: string): string {
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]!
}

/** Collect the npm runtime deps a component source needs. */
function detectDeps(source: string): Record<string, string> {
  const deps: Record<string, string> = { '@svgrid/grid': DEP_VERSIONS['@svgrid/grid']! }
  const re = /(?:from|import)\s*(['"])([^'"]+)\1/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const spec = m[2]!
    if (spec.startsWith('.') || spec.startsWith('svelte')) continue
    const pkg = pkgOf(spec)
    if (pkg === '@svgrid/grid') continue
    deps[pkg] = DEP_VERSIONS[pkg] ?? 'latest'
  }
  return deps
}

const VITE_CONFIG = `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [svelte(), tailwindcss()],
})
`

const SVELTE_CONFIG = `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  // Lets the component use <script lang="ts">.
  preprocess: vitePreprocess(),
}
`

const REPO_URL = 'https://github.com/sv-grid/sv-grid'

const MAIN_TS = `import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

// Enjoying SvGrid? A GitHub star genuinely helps the project: ${REPO_URL}
console.log(
  '%c★ SvGrid%c  Star us on GitHub → ${REPO_URL}',
  'color:#ff5a1f;font-weight:700',
  'color:inherit',
)

mount(App, { target: document.getElementById('app')! })
`

// Compact light + dark themes for the grid (--sg-* tokens the grid reads) plus
// the few structural overrides the examples ship. The generated index.html sets
// <html data-theme="..."> to whichever theme you were viewing, and toggling that
// attribute flips the whole grid.
const APP_CSS = `@import 'tailwindcss';

:root {
  --sg-bg: #ffffff;
  --sg-fg: #0f172a;
  --sg-muted: #64748b;
  --sg-border: #e2e8f0;
  --sg-header-bg: #f1f5f9;
  --sg-header-fg: #0f172a;
  --sg-row-alt-bg: #f8fafc;
  --sg-row-hover-bg: #eef2ff;
  --sg-selection-bg: #dbeafe;
  --sg-accent: #2563eb;
  --sg-input-bg: #ffffff;
  --sg-input-border: #cbd5e1;
  --sg-scrollbar-bg: #eef2f8;
  --sg-scrollbar-border: rgba(15, 23, 42, 0.04);
  --sg-scrollbar-arrow: #64748b;
  --sg-scrollbar-arrow-hover: #1f2937;
  --sg-scrollbar-arrow-hover-bg: #dde4ee;
  --sg-scrollbar-arrow-active: #0f172a;
  --sg-scrollbar-arrow-active-bg: #c7d1df;
  --sg-scrollbar-arrow-disabled: #cbd5e1;
  --sg-scrollbar-thumb: #b1bccd;
  --sg-scrollbar-thumb-hover: #8693a7;
  --sg-scrollbar-thumb-active: #64748b;
  color-scheme: light;
}

html[data-theme='dark'] {
  --sg-bg: #181d27;
  --sg-fg: #e2e8f0;
  --sg-muted: #94a3b8;
  --sg-border: #374151;
  --sg-header-bg: #1e2433;
  --sg-header-fg: #e2e8f0;
  --sg-row-alt-bg: #1b2230;
  --sg-row-hover-bg: #232b3c;
  --sg-selection-bg: #1d3a73;
  --sg-accent: #3b82f6;
  --sg-input-bg: #1a2130;
  --sg-input-border: #2c3548;
  --sg-scrollbar-bg: #1a2130;
  --sg-scrollbar-border: rgba(148, 163, 184, 0.08);
  --sg-scrollbar-arrow: #64748b;
  --sg-scrollbar-arrow-hover: #e2e8f0;
  --sg-scrollbar-arrow-hover-bg: #2a3142;
  --sg-scrollbar-arrow-active: #f1f5f9;
  --sg-scrollbar-arrow-active-bg: #374151;
  --sg-scrollbar-arrow-disabled: #475569;
  --sg-scrollbar-thumb: #475569;
  --sg-scrollbar-thumb-hover: #64748b;
  --sg-scrollbar-thumb-active: #94a3b8;
  color-scheme: dark;
}

html, body { height: 100%; margin: 0; }
body {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  background: var(--sg-bg);
  color: var(--sg-fg);
}
#app { height: 100vh; display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; }
#app > * { flex: 1; min-height: 0; }

.sv-grid-column, .sv-grid-cell {
  background: var(--sg-bg);
  color: var(--sg-fg);
  border-right: 1px solid var(--sg-border);
  border-bottom: 1px solid var(--sg-border);
}
.sv-grid-head, .sv-grid-head .sv-grid-column, .sv-grid-foot {
  background: var(--sg-header-bg);
  color: var(--sg-header-fg);
}
.sv-grid-table tbody tr:hover .sv-grid-cell { background: var(--sg-row-hover-bg); }
.sv-grid-row-number-column, .sv-grid-row-number-cell {
  color: var(--sg-muted);
  background: var(--sg-header-bg);
}
`

function indexHtml(title: string, theme: string): string {
  const safe = title.replace(/[<>&]/g, '')
  return `<!doctype html>
<html lang="en" data-theme="${theme === 'dark' ? 'dark' : 'light'}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safe} - SvGrid</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}

function packageJson(id: string, deps: Record<string, string>): string {
  const pkg = {
    name: `svgrid-${id}`.replace(/[^a-z0-9-]/gi, '-').toLowerCase(),
    private: true,
    version: '0.0.0',
    type: 'module',
    scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
    dependencies: Object.fromEntries(Object.entries(deps).sort()),
    devDependencies: {
      '@sveltejs/vite-plugin-svelte': '^7.0.0',
      '@tailwindcss/vite': '^4.2.4',
      svelte: '^5.55.5',
      tailwindcss: '^4.2.4',
      vite: '^8.0.10',
    },
  }
  return JSON.stringify(pkg, null, 2) + '\n'
}

function readme(title: string, hasEnterprise: boolean): string {
  return `# ${title} - SvGrid

[![Star on GitHub](https://img.shields.io/github/stars/sv-grid/sv-grid?style=social)](${REPO_URL})

A minimal, runnable Svelte 5 + Vite project generated from the SvGrid
playground. It renders the exact component you saw, powered by the
\`@svgrid/grid\` npm package.

## Run

\`\`\`bash
npm install
npm run dev
\`\`\`

Then open the printed \`http://localhost:5173\` URL.
${hasEnterprise ? '\n> This demo uses `@svgrid/enterprise`. Some enterprise features may require a license key in production.\n' : ''}
## Like it? Star it ⭐

If SvGrid saved you time, a [star on GitHub](${REPO_URL}) really helps others
find it - thank you!

- Package: https://www.npmjs.com/package/@svgrid/grid
- GitHub: ${REPO_URL}
- Docs: https://www.svgrid.com
`
}

// `../shared/...` -> `./shared/...` because App.svelte and the shared files
// both live under `src/`.
function rewriteSharedImports(source: string): string {
  return source.replace(/(['"])\.\.\/shared\//g, '$1./shared/')
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

// ---------------------------------------------------------------------------
// Single-file "copy, paste into notepad, open" runnable Svelte page.
//
// The copied .html contains the REAL .svelte source (plus any ../shared files
// it needs) and compiles it in the browser - Svelte compiler + TypeScript from
// a CDN, the grid from its CDN bundle - then mounts it. It is 100% Svelte: a
// dev opens the file and sees/edits Svelte, not a web component. The grid bundle
// keeps `svelte` external so the page's compiled component and the grid share
// one Svelte runtime (via the import map).
// ---------------------------------------------------------------------------

const SVELTE_VER = '5.55.9'
const TS_VER = '5.6.3'
// Unversioned = latest published; unpkg serves the file directly by path.
const DEFAULT_GRID_CDN = 'https://unpkg.com/@svgrid/grid/dist/cdn/svgrid.svelte-external.js'
// Enterprise pack: a svelte-external CDN bundle (keeps svelte + @svgrid/grid
// external so it shares the page's runtime + the same grid instance). Used only
// by demos that import @svgrid/enterprise; unlicensed use shows the pack's
// built-in watermark + console nudge.
const DEFAULT_ENTERPRISE_CDN =
  'https://unpkg.com/@svgrid/enterprise/dist/cdn/svgrid-enterprise.svelte-external.js'

const THEME_VARS = `      :root {
        --sg-bg:#fff; --sg-fg:#0f172a; --sg-muted:#64748b; --sg-border:#e2e8f0;
        --sg-header-bg:#f1f5f9; --sg-header-fg:#0f172a; --sg-row-alt-bg:#f8fafc;
        --sg-row-hover-bg:#eef2ff; --sg-selection-bg:#dbeafe; --sg-accent:#2563eb;
        --sg-input-bg:#ffffff; --sg-input-border:#cbd5e1;
        --sg-scrollbar-bg:#eef2f8; --sg-scrollbar-thumb:#b1bccd; --sg-scrollbar-thumb-hover:#8693a7;
        --sg-scrollbar-thumb-active:#64748b; --sg-scrollbar-arrow:#64748b;
        color-scheme:light;
      }
      :root {
        --sg-pill-active:#dcfce7; --sg-pill-active-fg:#166534;
        --sg-pill-pending:#fef9c3; --sg-pill-pending-fg:#854d0e;
        --sg-pill-inactive:#fee2e2; --sg-pill-inactive-fg:#991b1b;
      }
      html[data-theme='dark'] {
        --sg-bg:#181d27; --sg-fg:#e2e8f0; --sg-muted:#94a3b8; --sg-border:#374151;
        --sg-header-bg:#1e2433; --sg-header-fg:#e2e8f0; --sg-row-alt-bg:#1b2230;
        --sg-row-hover-bg:#232b3c; --sg-selection-bg:#1d3a73; --sg-accent:#3b82f6;
        --sg-scrollbar-bg:#1a2130; --sg-scrollbar-thumb:#475569; --sg-scrollbar-thumb-hover:#64748b;
        --sg-scrollbar-thumb-active:#94a3b8; --sg-scrollbar-arrow:#64748b;
        --sg-input-bg:#1a2130; --sg-input-border:#2c3548;
        --sg-pill-active:#064e3b; --sg-pill-active-fg:#6ee7b7;
        --sg-pill-pending:#713f12; --sg-pill-pending-fg:#fde68a;
        --sg-pill-inactive:#7f1d1d; --sg-pill-inactive-fg:#fecaca;
        color-scheme:dark;
      }`

// Global demo helpers the examples are authored against (normally supplied by
// the host app's stylesheet). The global @keyframes also back demos whose own
// keyframes get scoped away by the Svelte compiler (the animation is applied via
// a :global(...) rule, so its name stays unscoped and needs a global keyframe).
const HOST_HELPERS = `      @keyframes sv-pulse-up { 0% { background: rgba(34,197,94,0.55); } 100% { background: transparent; } }
      @keyframes sv-pulse-down { 0% { background: rgba(239,68,68,0.55); } 100% { background: transparent; } }
      .pill { display:inline-flex; align-items:center; padding:.125rem .5rem; border-radius:9999px; font-size:.75rem; font-weight:600; }
      .pill-active { background: var(--sg-pill-active); color: var(--sg-pill-active-fg); }
      .pill-pending { background: var(--sg-pill-pending); color: var(--sg-pill-pending-fg); }
      .pill-inactive { background: var(--sg-pill-inactive); color: var(--sg-pill-inactive-fg); }
      .sparkbar { display:inline-flex; align-items:flex-end; gap:1px; height:18px; }
      .sparkbar span { width:3px; background: var(--sg-accent); border-radius:1px; opacity:.85; }
      .density-compact { --sg-row-height:28px; }
      .density-comfortable { --sg-row-height:48px; }`

// Raw source of the shared helpers, reused from RAW_SHARED (declared above).
function sharedByName(): Record<string, () => Promise<string>> {
  const out: Record<string, () => Promise<string>> = {}
  for (const k in RAW_SHARED) out[k.slice(k.indexOf('/shared/') + '/shared/'.length)] = RAW_SHARED[k]!
  return out
}

// Gather the shared modules reachable from a component source (transitively),
// keyed as `shared/<name>` for the in-page module map.
async function gatherShared(appSource: string): Promise<Record<string, string>> {
  const byName = sharedByName()
  const modules: Record<string, string> = {}
  const resolveName = (spec: string): string | null => {
    const base = spec.split('/').pop()!
    for (const cand of [base, base + '.ts', base + '.js', base + '.svelte']) {
      if (byName[cand]) return cand
    }
    return null
  }
  const seen = new Set<string>()
  async function visit(src: string) {
    for (const m of src.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
      const spec = m[1]!
      // Only follow relative specs that resolve to a known shared module.
      if (!spec.startsWith('.')) continue
      const name = resolveName(spec)
      if (!name || seen.has(name)) continue
      seen.add(name)
      const code = (await byName[name]!()).replace(/^﻿/, '')
      modules['shared/' + name] = code
      await visit(code)
    }
  }
  await visit(appSource)
  return modules
}

// The in-browser loader that compiles the embedded sources and mounts App.
// Kept free of backticks / ${} so it embeds cleanly in the HTML template.
const LOADER = [
  "const SV = 'https://esm.sh/svelte@" + SVELTE_VER + "';",
  "const status = (m) => { const el = document.getElementById('status'); if (el) el.textContent = m; };",
  "try {",
  "  const compiler = await import(SV + '/compiler');",
  "  const ts = (await import('https://esm.sh/typescript@" + TS_VER + "')).default;",
  "  const svelte = await import('svelte');",
  "  const tsOpts = { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true, verbatimModuleSyntax: true } };",
  "  async function toJs(name, src) {",
  "    if (name.endsWith('.svelte')) {",
  "      const pp = await compiler.preprocess(src, { script: (o) => ({ code: ts.transpileModule(o.content, tsOpts).outputText }) }, { filename: name });",
  "      return compiler.compile(pp.code, { generate: 'client', dev: false, css: 'injected', filename: name }).js.code;",
  "    }",
  "    return ts.transpileModule(src, tsOpts).outputText;",
  "  }",
  "  function resolveKey(fromKey, spec) {",
  "    const dir = fromKey.includes('/') ? fromKey.slice(0, fromKey.lastIndexOf('/')) : '';",
  "    const parts = (dir + '/' + spec).split('/'); const out = [];",
  "    for (const p of parts) { if (!p || p === '.') continue; if (p === '..') out.pop(); else out.push(p); }",
  "    const base = out.join('/');",
  "    for (const c of [base, base + '.ts', base + '.js', base + '.svelte']) if (SOURCES[c] !== undefined) return c;",
  "    return null;",
  "  }",
  "  const compiled = {}; for (const k in SOURCES) compiled[k] = await toJs(k, SOURCES[k]);",
  "  const blobs = {}; const inflight = {};",
  "  async function blobFor(key) {",
  "    if (blobs[key]) return blobs[key];",
  "    let code = compiled[key];",
  "    const specs = [...code.matchAll(/from\\s*['\\\"](\\.[^'\\\"]+)['\\\"]/g)].map((m) => m[1]);",
  "    for (const spec of specs) {",
  "      const dep = resolveKey(key, spec); if (!dep) continue;",
  "      const url = inflight[dep] || (blobs[dep]) || (await blobFor(dep));",
  "      code = code.split(\"'\" + spec + \"'\").join(\"'\" + url + \"'\").split('\\\"' + spec + '\\\"').join('\\\"' + url + '\\\"');",
  "    }",
  "    const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));",
  "    blobs[key] = url; return url;",
  "  }",
  "  const appUrl = await blobFor('App.svelte');",
  "  const mod = await import(appUrl);",
  "  document.getElementById('status').remove();",
  "  svelte.mount(mod.default, { target: document.getElementById('app') });",
  "} catch (e) {",
  "  status('Error: ' + (e && e.message ? e.message : e));",
  "  console.error(e);",
  "}",
].join('\n')

/**
 * Strip a demo's built-in DEV/EVAL license key so an EXPORTED copy runs
 * UNLICENSED. svgrid.com's own demos call `setLicenseKey('SVENTERPRISE-DEV-...')`
 * to suppress the trial watermark on the vendor's site - but a user who copies
 * the demo out should see the real trial UX: the corner "www.svgrid.com"
 * watermark + the one-time console license nudge. Removing the key restores it.
 */
export function stripDevLicenseKey(source: string): string {
  return source.replace(
    /setLicenseKey\(\s*['"]SVENTERPRISE-(?:DEV|EVAL)[^'"]*['"]\s*\)\s*;?/g,
    '/* dev license removed for export - runs in unlicensed trial mode (watermark) */',
  )
}

/**
 * Build a self-contained, runnable Svelte HTML page (in-browser compile).
 * Async because it gathers any `../shared` modules the component imports.
 * `gridCdnUrl` is overridable for testing (defaults to the published bundle).
 */
export async function buildStandaloneHtml(source: string, title: string, theme?: string): Promise<string> {
  const t =
    (theme ||
      (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) ||
      'light') === 'dark'
      ? 'dark'
      : 'light'
  const safe = title.replace(/[<>&]/g, '')
  const app = stripDevLicenseKey(source.replace(/^﻿/, '')).replace(/(['"])\.\.\/shared\//g, '$1./shared/')
  const shared = await gatherShared(app)
  const sources: Record<string, string> = { 'App.svelte': app, ...shared }

  // Grid CDN URL is overridable via window.__SVGRID_CDN__ (used by tests before
  // the real 1.2.0 is published).
  const gridCdn =
    (typeof window !== 'undefined' && (window as unknown as { __SVGRID_CDN__?: string }).__SVGRID_CDN__) ||
    DEFAULT_GRID_CDN
  const enterpriseCdn =
    (typeof window !== 'undefined' &&
      (window as unknown as { __SVGRID_ENTERPRISE_CDN__?: string }).__SVGRID_ENTERPRISE_CDN__) ||
    DEFAULT_ENTERPRISE_CDN

  const importMap = {
    imports: {
      svelte: `https://esm.sh/svelte@${SVELTE_VER}`,
      'svelte/internal/client': `https://esm.sh/svelte@${SVELTE_VER}/internal/client`,
      'svelte/internal/disclose-version': `https://esm.sh/svelte@${SVELTE_VER}/internal/disclose-version`,
      'svelte/transition': `https://esm.sh/svelte@${SVELTE_VER}/transition`,
      'svelte/animate': `https://esm.sh/svelte@${SVELTE_VER}/animate`,
      'svelte/easing': `https://esm.sh/svelte@${SVELTE_VER}/easing`,
      'svelte/store': `https://esm.sh/svelte@${SVELTE_VER}/store`,
      'svelte/motion': `https://esm.sh/svelte@${SVELTE_VER}/motion`,
      '@svgrid/grid': gridCdn,
      // Enterprise demos import this; unlicensed = watermark + console nudge.
      '@svgrid/enterprise': enterpriseCdn,
      jszip: 'https://esm.sh/jszip@3.10.1',
      // Optional peer of the enterprise pack (PDF export).
      pdfmake: 'https://esm.sh/pdfmake@0.2.10',
    },
  }

  return `<!doctype html>
<html lang="en" data-theme="${t}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SvGrid - ${safe}</title>
    <!-- Many demos lay out with Tailwind utility classes (flex-1, min-h-0, gaps,
         colors). The Play CDN generates them at runtime so the demo looks right. -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script type="importmap">
${JSON.stringify(importMap, null, 2)}
    </script>
    <style>
${THEME_VARS}
${HOST_HELPERS}
      html, body, #app { height: 100%; }
      body { margin: 0; background: var(--sg-bg); color: var(--sg-fg);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
      /* Give the mounted demo a real height so containerHeight:100% / flex-1
         resolve (otherwise the grid computes a 0-height viewport = no rows). */
      #app { display: flex; flex-direction: column; padding: 16px; box-sizing: border-box; }
      #app > * { flex: 1; min-height: 0; }
      #status { padding: 24px; font-size: 14px; color: var(--sg-muted); }
    </style>
  </head>
  <body>
    <!-- This file IS the demo's real Svelte source (below), compiled in your
         browser and mounted. Edit the component and refresh to see changes. -->
    <div id="status">Compiling the Svelte component…</div>
    <div id="app"></div>

    <script type="module">
const SOURCES = ${JSON.stringify(sources).replace(/<\//g, '<\\/')};
${LOADER}
    </script>
  </body>
</html>
`
}

/**
 * Build and download a runnable project zip for a component source.
 * Returns the zip filename (for a toast / confirmation).
 */
export async function downloadProject(source: string, id: string, title: string): Promise<string> {
  // Strip the demo's dev license key so the downloaded project runs unlicensed
  // (trial watermark) until the user adds their own key - see stripDevLicenseKey.
  const clean = stripDevLicenseKey(source.replace(/^﻿/, ''))
  const deps = detectDeps(clean)
  const hasEnterprise = '@svgrid/enterprise' in deps
  const needsShared = /['"]\.\.\/shared\//.test(clean)
  // Match whatever theme the user is viewing on the site.
  const theme =
    (typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme')) || 'light'

  const zip = new JSZip()
  zip.file('package.json', packageJson(id, deps))
  zip.file('vite.config.js', VITE_CONFIG)
  zip.file('svelte.config.js', SVELTE_CONFIG)
  zip.file('index.html', indexHtml(title, theme))
  zip.file('src/main.ts', MAIN_TS)
  zip.file('src/app.css', APP_CSS)
  zip.file('src/App.svelte', rewriteSharedImports(clean))
  zip.file('README.md', readme(title, hasEnterprise))
  zip.file('.gitignore', 'node_modules\ndist\n')

  if (needsShared) {
    for (const key in RAW_SHARED) {
      const rel = key.slice(key.indexOf('/shared/') + '/shared/'.length) // e.g. 'seed.ts'
      const content = rewriteSharedImports(await RAW_SHARED[key]!())
      zip.file(`src/shared/${rel}`, content)
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  const filename = `svgrid-${id}.zip`
  triggerDownload(blob, filename)
  return filename
}
