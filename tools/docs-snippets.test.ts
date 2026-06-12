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
import { readFile, readdir, mkdir, writeFile, rm } from 'node:fs/promises'
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

/** Compile the snippet against the workspace's published types.
 *  Returns the diagnostic messages (empty if it compiles clean). */
function compile(snippet: Snippet, mock = false): string[] {
  // Wrap svelte blocks in a comment-stripped TS shim so we type-check
  // the <script lang="ts"> body rather than the markup.
  let code = snippet.code
  if (snippet.lang === 'svelte') {
    const scriptMatch = /<script[^>]*lang=['"]ts['"][^>]*>([\s\S]*?)<\/script>/.exec(code)
    if (!scriptMatch) return []        // no TS section, nothing to compile
    code = scriptMatch[1]!
  }
  // Provide an ambient $state / $derived / $effect stub so Svelte 5
  // rune usage type-checks without a Svelte compiler.
  const runeShim = `
    declare function $state<T>(v?: T): T
    declare function $derived<T>(v: T): T
    declare namespace $derived {
      function by<T>(fn: () => T): T
    }
    declare function $effect(fn: () => void | (() => void)): void
    declare namespace $effect {
      function pre(fn: () => void): void
    }
    declare function $props<T>(): T
  `
  const wrapped = runeShim + '\n' + code

  const host = ts.createCompilerHost({
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    allowImportingTsExtensions: false,
    jsx: ts.JsxEmit.Preserve,
  })

  const virtualFile = `__snippet_${snippet.line}__.ts`
  const originalRead = host.readFile
  host.readFile = (name) => name === virtualFile ? wrapped : originalRead?.(name)
  const originalExists = host.fileExists
  host.fileExists = (name) => name === virtualFile ? true : originalExists?.(name) ?? false

  const program = ts.createProgram([virtualFile], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
  }, host)

  const sf = program.getSourceFile(virtualFile)
  if (!sf) return ['Source file missing']
  return ts.getPreEmitDiagnostics(program, sf)
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

describe('docs code snippets', () => {
  it('exist + compile cleanly', async () => {
    const all: Snippet[] = []
    for await (const f of walk(DOCS_DIR)) {
      if (!f.endsWith('.md')) continue
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
      const expectError = s.flags.has('expect-error')
      if (expectError && diagnostics.length === 0) {
        failures.push(`${relative(process.cwd(), s.file)}:${s.line} - flagged \`expect-error\` but compiled clean`)
      } else if (!expectError && diagnostics.length > 0) {
        failures.push(`${relative(process.cwd(), s.file)}:${s.line}\n  ${diagnostics.join('\n  ')}`)
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} of ${all.length} doc snippets failed to compile:\n\n` +
        failures.slice(0, 20).join('\n\n') +
        (failures.length > 20 ? `\n\n…and ${failures.length - 20} more.` : ''),
      )
    }
  }, 60_000)
})
