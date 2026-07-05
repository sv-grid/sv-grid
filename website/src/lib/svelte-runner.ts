/**
 * In-browser Svelte 5 runner for the playground.
 *
 * Takes a demo's raw `.svelte` source (TypeScript + runes), transpiles the
 * script with the TypeScript compiler, compiles the component with the Svelte
 * compiler, then evaluates the emitted module against the app's OWN Svelte +
 * @svgrid runtimes (so reactivity and the grid are shared singletons, not a
 * second copy). The result is a real, mounted component - the actual demo,
 * editable and live.
 *
 * Both `typescript` and `svelte/compiler` are heavy, so they load lazily the
 * first time a component is compiled (only on this route).
 */

// The app's live runtimes. The compiled component imports from these exact
// specifiers; handing back the already-bundled singletons keeps one reactivity
// system and one grid instance across the app and the mounted demo.
import * as M_svelte from 'svelte'
import * as M_internal from 'svelte/internal/client'
import * as M_internal_server from 'svelte/internal/disclose-version'
import * as M_transition from 'svelte/transition'
import * as M_animate from 'svelte/animate'
import * as M_easing from 'svelte/easing'
import * as M_store from 'svelte/store'
import * as M_motion from 'svelte/motion'
import * as M_grid from '@svgrid/grid'
import * as M_enterprise from '@svgrid/enterprise'
import * as M_jszip from 'jszip'

// Shared helper modules some demos import via `../shared/...`. Eager so they
// resolve synchronously inside the evaluated module.
const SHARED = import.meta.glob('../../../examples/src/shared/**/*.{ts,js}', { eager: true }) as Record<
  string,
  Record<string, unknown>
>
const SHARED_BY_PATH: Record<string, Record<string, unknown>> = {}
for (const key in SHARED) {
  // '../../../examples/src/shared/registry.ts' -> 'examples/src/shared/registry.ts'
  SHARED_BY_PATH[key.replace(/^(\.\.\/)+/, '')] = SHARED[key]!
}

const BASE_MODULES: Record<string, unknown> = {
  svelte: M_svelte,
  'svelte/internal/client': M_internal,
  'svelte/internal/disclose-version': M_internal_server,
  'svelte/transition': M_transition,
  'svelte/animate': M_animate,
  'svelte/easing': M_easing,
  'svelte/store': M_store,
  'svelte/motion': M_motion,
  '@svgrid/grid': M_grid,
  '@svgrid/enterprise': M_enterprise,
  jszip: M_jszip,
}

// Normalise a relative import against the importing file's directory.
function resolveRelative(fromDir: string, spec: string): Record<string, unknown> {
  const parts = (fromDir + '/' + spec).split('/')
  const out: string[] = []
  for (const p of parts) {
    if (p === '' || p === '.') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  const base = out.join('/')
  const candidates = [base, base + '.ts', base + '.js', base + '/index.ts', base + '/index.js']
  for (const c of candidates) {
    if (SHARED_BY_PATH[c]) return SHARED_BY_PATH[c]!
  }
  throw new Error(`Cannot resolve import "${spec}" (only @svgrid/*, svelte/*, and ../shared/* are available in the playground)`)
}

function makeRequire(demoPath: string) {
  const dir = demoPath.replace(/\/[^/]*$/, '') // strip filename
  return (spec: string): Record<string, unknown> => {
    if (spec in BASE_MODULES) return BASE_MODULES[spec] as Record<string, unknown>
    if (spec.startsWith('.')) return resolveRelative(dir, spec)
    throw new Error(`"${spec}" isn't available in the in-browser playground. Use "Edit in StackBlitz" on the demo for the full project.`)
  }
}

// Rewrite a compiled ESM into a factory body: imports -> __require() consts,
// `export default X` -> `__exports.default = X`.
function toFactoryBody(jsCode: string): string {
  let code = jsCode
  let counter = 0

  // Side-effect imports: `import 'x';`  -> drop (styles are global; version
  // markers are no-ops here).
  code = code.replace(/^\s*import\s*(['"])[^'"]+\1\s*;?\s*$/gm, '')

  // `import <clause> from 'spec';`
  code = code.replace(
    /^\s*import\b([\s\S]*?)from\s*(['"])([^'"]+)\2\s*;?/gm,
    (_m, clauseRaw: string, _q: string, spec: string) => {
      const id = `__m${counter++}`
      const lines = [`const ${id} = __require(${JSON.stringify(spec)});`]
      let clause = clauseRaw.trim()
      // default import possibly followed by ", { ... }" or ", * as N"
      const defMatch = /^([A-Za-z_$][\w$]*)\s*(?:,\s*([\s\S]+))?$/.exec(clause)
      if (clause && !clause.startsWith('{') && !clause.startsWith('*') && defMatch) {
        lines.push(`const ${defMatch[1]} = ${id}.default ?? ${id};`)
        clause = defMatch[2] ? defMatch[2].trim() : ''
      }
      if (clause.startsWith('*')) {
        const ns = /\*\s*as\s*([A-Za-z_$][\w$]*)/.exec(clause)
        if (ns) lines.push(`const ${ns[1]} = ${id};`)
      } else if (clause.startsWith('{')) {
        const inner = clause.slice(1, clause.lastIndexOf('}'))
        const names = inner
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .map((s) => s.replace(/^type\s+/, '')) // drop any residual type imports
          .filter(Boolean)
          .map((s) => {
            const as = /^(.+?)\s+as\s+(.+)$/.exec(s)
            return as ? `${as[1].trim()}: ${as[2].trim()}` : s
          })
        if (names.length) lines.push(`const { ${names.join(', ')} } = ${id};`)
      }
      return lines.join('\n')
    },
  )

  // `export default X;` -> `__exports.default = X;`
  code = code.replace(/^\s*export\s+default\s+/gm, '__exports.default = ')
  // Strip any remaining named `export { ... }` (not used by client components).
  code = code.replace(/^\s*export\s*\{[^}]*\}\s*;?\s*$/gm, '')

  return code
}

let _ts: typeof import('typescript') | null = null
let _svelte: typeof import('svelte/compiler') | null = null

async function loadTools() {
  if (!_ts) _ts = await import('typescript')
  if (!_svelte) _svelte = await import('svelte/compiler')
  return { ts: _ts, svelte: _svelte }
}

export type CompiledComponent = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Component: any
  css: string
}

/**
 * Compile a `.svelte` source string to a runnable component + its scoped CSS.
 * Throws on TS / Svelte / evaluation errors with a readable message.
 */
export async function compileComponent(source: string, demoPath: string): Promise<CompiledComponent> {
  const { ts, svelte } = await loadTools()

  // 1. Transpile the <script lang="ts"> blocks to JS (types stripped, no
  //    type-checking) so the Svelte compiler sees plain JS.
  const processed = await svelte.preprocess(
    source,
    {
      script: ({ content }) => {
        const out = ts.transpileModule(content, {
          compilerOptions: {
            target: ts.ScriptTarget.ES2022,
            module: ts.ModuleKind.ESNext,
            isolatedModules: true,
            // Preserve value imports verbatim (only strip `type` ones). Without
            // this, TS elides imports that are used only in the component's
            // markup (e.g. `SvGrid`), which TS never sees - breaking the render.
            verbatimModuleSyntax: true,
          },
        })
        return { code: out.outputText }
      },
    },
    { filename: 'Demo.svelte' },
  )

  // 2. Compile the component to client-side JS + external CSS.
  const compiled = svelte.compile(processed.code, {
    generate: 'client',
    dev: false,
    css: 'external',
    filename: 'Demo.svelte',
    name: 'PlaygroundDemo',
  })

  // 3. Evaluate the emitted module against the app's runtimes.
  const body = toFactoryBody(compiled.js.code)
  const __require = makeRequire(demoPath)
  const exportsObj: { default?: unknown } = {}
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const factory = new Function('__require', '__exports', body)
  factory(__require, exportsObj)

  if (!exportsObj.default) throw new Error('Component has no default export')
  return { Component: exportsObj.default, css: compiled.css?.code ?? '' }
}
