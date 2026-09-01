/**
 * The second gate of `check_svgrid_code`: the real Svelte compiler.
 *
 * Kept in its own module, and imported dynamically, for two reasons. The
 * compiler is only present when the server runs next to a project that has
 * Svelte installed (a bare `npx @svgrid/mcp` in an empty directory does not),
 * and a Worker build must be able to leave it out entirely - which it can,
 * because nothing outside the stdio entry point imports this file.
 */
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import type { CompileFn, Diagnostic } from './validate.js'

type SvelteMessage = {
  code?: string
  message?: string
  start?: { line?: number; column?: number }
}

/** Compiler warnings that repeat per element and drown the real findings. */
const MAX_WARNINGS = 15

type CompileApi = {
  compile: (src: string, options: Record<string, unknown>) => { warnings: SvelteMessage[] }
}

/**
 * Prefer the Svelte the USER's project is on, so the check matches what their
 * build will do; fall back to the copy that ships with this package. Resolved
 * once and reused - the compiler is not cheap to load.
 */
let cached: CompileApi | null | undefined

async function loadCompiler(): Promise<CompileApi | null> {
  if (cached !== undefined) return cached
  const attempts: Array<() => Promise<CompileApi>> = [
    async () => {
      const require = createRequire(join(process.cwd(), 'package.json'))
      return (await import(pathToFileURL(require.resolve('svelte/compiler')).href)) as CompileApi
    },
    async () => (await import('svelte/compiler')) as unknown as CompileApi,
  ]
  for (const attempt of attempts) {
    try {
      const mod = await attempt()
      if (typeof mod.compile === 'function') {
        cached = mod
        return cached
      }
    } catch {
      // Try the next source.
    }
  }
  cached = null
  return cached
}

export const compileWithSvelte: CompileFn = async (source, filename) => {
  const mod = await loadCompiler()
  if (!mod) return { available: false, diagnostics: [] }
  const compile = mod.compile

  const diagnostics: Diagnostic[] = []
  try {
    const { warnings } = compile(source, { filename, generate: 'client' })
    for (const w of warnings.slice(0, MAX_WARNINGS)) {
      diagnostics.push({
        rule: `svelte/${w.code ?? 'warning'}`,
        severity: 'warning',
        line: w.start?.line ?? 1,
        message: w.message ?? 'compiler warning',
      })
    }
  } catch (err) {
    const e = err as SvelteMessage & { name?: string }
    diagnostics.push({
      rule: `svelte/${e.code ?? 'compile-error'}`,
      severity: 'error',
      line: e.start?.line ?? 1,
      message: (e.message ?? String(err)).split('\n')[0],
      fix: 'The file does not parse. Fix this first - every other check ran on unparsed text.',
    })
  }

  return { available: true, diagnostics }
}
