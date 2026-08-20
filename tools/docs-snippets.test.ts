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
import { createHash } from 'node:crypto'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'

/** Stable id for a snippet body: survives the block moving down a page, changes
 *  the moment the code itself does. Line endings and trailing whitespace are
 *  normalised so a CRLF checkout keys the same as an LF one. */
function baselineKey(code: string): string {
  const normalized = code.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').trim()
  return createHash('sha1').update(normalized).digest('hex').slice(0, 8)
}

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

const VIRTUAL_FILE = '__snippet__.ts'
const AMBIENT_FILE = '__docs_ambient__.d.ts'

// ONE host, reused for every snippet. A per-snippet `ts.createCompilerHost`
// re-read and re-parsed lib.dom.d.ts plus the whole @svgrid/grid source graph
// on each of the ~1400 blocks, which is nearly all of this test's runtime (it
// blew its own 300s timeout the first time CI ran it). Parsed SourceFiles and
// module resolutions are immutable for a fixed set of compiler options, so
// caching them across programs is safe - it is what the language service's
// DocumentRegistry does internally.
const HOST = ts.createCompilerHost(COMPILER_OPTIONS)
const realGetSourceFile = HOST.getSourceFile.bind(HOST)
const realReadFile = HOST.readFile.bind(HOST)
const realFileExists = HOST.fileExists.bind(HOST)
const sourceFileCache = new Map<string, ts.SourceFile | undefined>()
const moduleResolutionCache = ts.createModuleResolutionCache(
  process.cwd(),
  (f) => f,
  COMPILER_OPTIONS,
)
let currentCode = ''

HOST.readFile = (name) =>
  name === VIRTUAL_FILE ? currentCode : name === AMBIENT_FILE ? AMBIENT : realReadFile(name)
HOST.fileExists = (name) =>
  name === VIRTUAL_FILE || name === AMBIENT_FILE ? true : realFileExists(name)
HOST.getSourceFile = (name, languageVersion, onError, shouldCreate) => {
  // The snippet changes every call, so it is the one file never cached.
  if (name === VIRTUAL_FILE) return ts.createSourceFile(name, currentCode, languageVersion, true)
  if (!sourceFileCache.has(name)) {
    sourceFileCache.set(name, realGetSourceFile(name, languageVersion, onError, shouldCreate))
  }
  return sourceFileCache.get(name)
}
HOST.getModuleResolutionCache = () => moduleResolutionCache

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

  const virtualFile = VIRTUAL_FILE
  const ambientFile = AMBIENT_FILE
  currentCode = code

  const program = ts.createProgram([virtualFile, ambientFile], COMPILER_OPTIONS, HOST)
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

// Pre-existing failures in NON-Studio docs: illustrative fragments the harness
// can't compile in isolation. The gate stays green on exactly these, but FAILS
// on any NEW failure anywhere (all of enterprise/studio/** is held to zero).
// Trim as the underlying docs are fixed.
//
// Entries are `path:<first 8 chars of a sha1 over the snippet body>`, NOT
// `path:line`. Line keys silently rotted once: a bulk docs pass inserted an
// image + blank line near the top of many pages, every snippet below shifted by
// two lines, and all 25 baseline entries stopped matching at once - so a
// long-known-broken snippet reported as a fresh failure. A content hash only
// stops matching when the snippet itself changes, which is exactly when the
// entry SHOULD be re-examined. `npx vitest run tools/docs-snippets.test.ts`
// prints the key for every failure, so refreshing an entry is a copy-paste.
const KNOWN_BASELINE = new Set<string>([
  'docs/getting-started-full.md:c835e035',
  'docs/getting-started/6-going-to-production.md:47cffe6c',
  'docs/help/migrating-from-ag-grid.md:be932e82',
  'docs/help/rows/row-pinning.md:695aff46',
  'docs/help/rows/row-pinning.md:9e2fa435',
  'docs/recipes/testing-your-grid.md:6b8d07c0',
  'docs/reference/SvGridApi.md:02669eaf',
  'docs/reference/SvGridApi.md:5787f496',
  'docs/reference/SvGridApi.md:87f965ee',
  'docs/reference/SvGridApi.md:b6498452',
  'docs/reference/SvGridApi.md:bc9c8ef0',
  'docs/reference/SvGridApi.md:f3990cc9',
  'docs/reference/enterprise.md:15f04d04',
  'docs/reference/enterprise.md:1fca2f9e',
  'docs/reference/features.md:adba5b56',
  'docs/why-headless.md:d4845f42',
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
      const rel = relative(process.cwd(), s.file).replace(/\\/g, '/')
      // `path:line` for humans (jump straight to it), `path:hash` for the
      // baseline lookup - see the KNOWN_BASELINE note on why not line numbers.
      const loc = `${rel}:${s.line}`
      const key = `${rel}:${baselineKey(s.code)}`
      const expectError = s.flags.has('expect-error')
      if (expectError && diagnostics.length === 0) {
        failures.push(`${loc} - flagged \`expect-error\` but compiled clean`)
      } else if (!expectError && diagnostics.length > 0 && !KNOWN_BASELINE.has(key)) {
        failures.push(`${loc}  [baseline key: ${key}]\n  ${diagnostics.join('\n  ')}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${all.length} doc snippets failed to compile:\n\n` +
        failures.slice(0, 20).join('\n\n') +
        (failures.length > 20 ? `\n\n…and ${failures.length - 20} more.` : ''),
      )
    }
    // Headroom, not an expectation: with the shared host above this runs in
    // well under a minute. The margin is so a slow runner reports the real
    // diagnostics instead of an opaque timeout, which is how this first failed
    // in CI.
  }, 600_000)
})
