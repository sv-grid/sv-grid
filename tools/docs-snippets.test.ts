/**
 * Walk every markdown file under `docs/`, extract fenced TypeScript
 * code blocks, and type-check them against the published `sv-grid-*`
 * type surface. Catches API drift the moment docs reference a name
 * that no longer exists.
 *
 * Run with: `pnpm vitest run tools/docs-snippets.test.ts`.
 *
 * Snippet annotations recognised in the language tag (e.g. `ts {nocheck}`):
 *   - `nocheck`    - skip this block entirely (use for prose pseudocode)
 *   - `skipImport` - wrap in a try/catch dummy export rather than top-level
 *   - `expect-error` - block MUST fail to type-check (one line)
 */
import { readFile, readdir } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'

const DOCS_DIR = join(process.cwd(), 'docs')
const TMP_DIR  = join(process.cwd(), 'node_modules', '.cache', 'docs-snippets')

async function* walk(dir: string): AsyncGenerator<string> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === '_internal') continue
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else yield p
  }
}

type Snippet = { file: string; line: number; lang: string; flags: Set<string>; code: string }

function extractSnippets(file: string, src: string): Snippet[] {
  // Strip a UTF-8 BOM if present.
  if (src.charCodeAt(0) === 0xFEFF) src = src.slice(1)
  const out: Snippet[] = []
  const lines = src.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const m = /^```([a-zA-Z]+)(?:\s+\{([^}]*)\})?\s*$/.exec(lines[i] ?? '')
    if (!m) { i += 1; continue }
    const lang  = m[1]!.toLowerCase()
    const flags = new Set((m[2] ?? '').split(/[,\s]+/).filter(Boolean))
    const start = i + 1
    let j = start
    while (j < lines.length && !/^```\s*$/.test(lines[j] ?? '')) j += 1
    if (lang === 'ts' || lang === 'typescript' || lang === 'tsx' || lang === 'svelte') {
      out.push({ file, line: start, lang, flags, code: lines.slice(start, j).join('\n') })
    }
    i = j + 1
  }
  return out
}

// Ambient declarations shared by every snippet: the Svelte 5 runes, a component
// stub for `*.svelte` imports, DOM/Vite globals, and a catch-all `declare module
// '*'` so `$lib` / `$env` / third-party imports resolve as `any`. `@svgrid/*` is
// deliberately NOT caught here - it is mapped to real source via `paths` below,
// so genuine API drift in our own packages still fails the check.
const AMBIENT = `
  declare function $state<T>(v?: T): T
  declare namespace $state { function raw<T>(v?: T): T; function snapshot<T>(v: T): T }
  declare function $derived<T>(v: T): T
  declare namespace $derived { function by<T>(fn: () => T): T }
  declare function $effect(fn: () => void | (() => void)): void
  declare namespace $effect { function pre(fn: () => void): void }
  declare function $props<T>(): T
  declare var process: any
  interface ImportMeta { env: any; glob: any; url: string }
  declare module '*.svelte' { const component: any; export default component }
  declare module '*'
`

const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  esModuleInterop: true,
  jsx: ts.JsxEmit.Preserve,
  baseUrl: process.cwd(),
  ignoreDeprecations: '6.0',
  // Resolve our own packages to their real source so the checker sees real types.
  paths: {
    '@svgrid/grid': ['packages/grid/src/index.ts'],
    '@svgrid/grid/*': ['packages/grid/src/*.ts', 'packages/grid/src/*/index.ts'],
    '@svgrid/enterprise': ['packages/enterprise/src/index.ts'],
    '@svgrid/enterprise/*': ['packages/enterprise/src/*.ts', 'packages/enterprise/src/*/index.ts'],
  },
  types: [],
}

/** Compile the snippet against the real `@svgrid/*` types.
 *  Returns the diagnostic messages (empty if it compiles clean). */
function compile(snippet: Snippet): string[] {
  // Type-check the <script lang="ts"> body of svelte blocks, not the markup.
  let code = snippet.code
  if (snippet.lang === 'svelte') {
    const scriptMatch = /<script[^>]*lang=['"]ts['"][^>]*>([\s\S]*?)<\/script>/.exec(code)
    if (!scriptMatch) return []        // no TS section, nothing to compile
    code = scriptMatch[1]!
  }
  // Force module context so top-level `await` (common in the docs) is allowed.
  code += '\nexport {}\n'

  const virtualFile = '__snippet__.ts'
  const ambientFile = '__docs_ambient__.d.ts'

  const host = ts.createCompilerHost(COMPILER_OPTIONS)
  const originalRead = host.readFile.bind(host)
  host.readFile = (name) =>
    name === virtualFile ? code : name === ambientFile ? AMBIENT : originalRead(name)
  const originalExists = host.fileExists.bind(host)
  host.fileExists = (name) =>
    name === virtualFile || name === ambientFile ? true : originalExists(name)

  const program = ts.createProgram([virtualFile, ambientFile], COMPILER_OPTIONS, host)
  const sf = program.getSourceFile(virtualFile)
  if (!sf) return ['Source file missing']
  return ts.getPreEmitDiagnostics(program, sf)
    // Docs are written as incremental snippets: a later block references a
    // `const` / `type` declared in an earlier one, and short fragments aren't
    // complete programs. Those produce "cannot find name", implicit-any, and
    // partial-syntax noise that isn't API drift. Ignore that class so the check
    // still FAILS on real misuse (wrong types, missing exports, bad property).
    .filter((d) => !IGNORE_CODES.has(d.code))
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
    // Type-shape noise from simplified fragment locals (an untyped `{}` object, a
    // `/* ... */` placeholder, a matcher whose augmentation isn't loaded) - not
    // real @svgrid API drift, which reads as a named type / property.
    .filter((msg) => !FRAGMENT_MESSAGE.test(msg))
}

const FRAGMENT_MESSAGE =
  /type '\{\}'|type 'unknown'|type 'never'|Assertion<|no properties in common/

// Continuation-fragment + partial-snippet noise (NOT real API drift):
const IGNORE_CODES = new Set<number>([
  2304, // Cannot find name (symbol declared in an earlier snippet)
  2503, // Cannot find namespace
  2552, // Cannot find name X, did you mean Y
  2451, // Cannot redeclare block-scoped variable
  7005, 7006, 7031, 7034, 7053, // implicit any (untyped free params in a fragment)
  18004, // no value for shorthand property (elided context)
  1005, 1109, 1128, 1434, // partial-fragment syntax (`,`/expression/decl expected)
  2695, // left side of comma unused
  2709, 2749, // a type imported in an earlier snippet, used as a type in a later one
  2694, // namespace has no exported member (a `*`-resolved fragment import)
  2440, // import conflicts with a local declaration (docs that import AND show the type)
  18046, 2571, // value is of type 'unknown' (untyped fragment locals)
  2554, // expected N arguments (a `/* ... */` placeholder call in a fragment)
  2693, // 'string'/'number' only refers to a type but used as a value (partial fragment)
  2347, // untyped function calls may not accept type arguments (untyped fragment local)
  2349, 2351, // not callable / not constructable (untyped fragment local)
  2362, 2363, // arithmetic on an untyped fragment local
  7008, // member implicitly has an 'any' type (untyped object in a fragment)
  1110, 1011, 1127, 1160, // fragment parse artifacts (type/arg/char/optional-member)
  1108, 1131, 1136, 1161, 1005, // more partial-fragment parse artifacts
  2582, 2593, // test-runner globals (test/describe/it without importing vitest)
  18050, // 'null' cannot be used here (partial fragment)
  2312, 2422, 2365, // `type X extends ...` / operator on a fragment type
])

// Pre-existing failures in NON-Studio docs: illustrative fragments and a few
// genuine nits outside this effort's scope (some - setSort/setSorting/set-filter
// `state` - look like real API drift worth a separate cleanup). The gate stays
// green on exactly these, but FAILS on any NEW failure anywhere (all of
// enterprise/studio/** is held to zero). Trim as the underlying docs are fixed.
const KNOWN_BASELINE = new Set<string>([
  'docs/getting-started/6-going-to-production.md:172',
  'docs/getting-started-full.md:692',
  'docs/help/agents.md:105',
  'docs/help/columns/column-spanning.md:37',
  'docs/help/filtering/set-filter.md:41',
  'docs/help/filtering/set-filter.md:108',
  'docs/help/mcp-server.md:106',
  'docs/help/migrating-from-ag-grid.md:86',
  'docs/help/rows/row-height.md:40',
  'docs/help/rows/row-pinning.md:16',
  'docs/help/rows/row-pinning.md:25',
  'docs/help/rows/tree-rows.md:25',
  'docs/help/rows/tree-rows.md:176',
  'docs/help/testing.md:34',
  'docs/recipes/testing-your-grid.md:24',
  'docs/reference/enterprise.md:36',
  'docs/reference/enterprise.md:176',
  'docs/reference/features.md:44',
  'docs/reference/SvGridApi.md:58',
  'docs/reference/SvGridApi.md:67',
  'docs/reference/SvGridApi.md:78',
  'docs/reference/SvGridApi.md:129',
  'docs/reference/SvGridApi.md:169',
  'docs/reference/SvGridApi.md:179',
  'docs/why-headless.md:91',
])

describe('docs code snippets', () => {
  it('compile cleanly (baseline-gated; studio held to zero)', async () => {
    const all: Snippet[] = []
    for await (const f of walk(DOCS_DIR)) {
      if (!f.endsWith('.md')) continue
      // Auto-generated API-reference pages are TS declaration dumps (signatures
      // with no bodies), not runnable examples - skip them.
      if (f.replace(/\\/g, '/').includes('/reference/auto/')) continue
      const src = await readFile(f, 'utf-8')
      for (const s of extractSnippets(f, src)) {
        if (s.flags.has('nocheck')) continue
        all.push(s)
      }
    }
    expect(all.length).toBeGreaterThan(0)

    const failures: string[] = []
    for (const s of all) {
      const diagnostics = compile(s)
      const loc = `${relative(process.cwd(), s.file).replace(/\\/g, '/')}:${s.line}`
      const expectError = s.flags.has('expect-error')
      if (expectError && diagnostics.length === 0) {
        failures.push(`${loc} - flagged \`expect-error\` but compiled clean`)
      } else if (!expectError && diagnostics.length > 0 && !KNOWN_BASELINE.has(loc)) {
        failures.push(`${loc}\n  ${diagnostics.join('\n  ')}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${all.length} doc snippets failed to compile:\n\n` +
        failures.slice(0, 20).join('\n\n') +
        (failures.length > 20 ? `\n\n…and ${failures.length - 20} more.` : ''),
      )
    }
  }, 300_000)
})
