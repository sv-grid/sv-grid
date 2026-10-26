/**
 * Svelte compiler output as `check_svgrid_code` diagnostics.
 *
 * No Node imports here, on purpose: the stdio server loads the compiler from
 * the user's project (compile-svelte.ts) and the Worker bundles its own copy,
 * and both turn what it says into findings through this one function, so the
 * two servers report a broken file the same way.
 */
import type { Diagnostic } from './validate.js'

type SvelteMessage = {
  code?: string
  message?: string
  start?: { line?: number; column?: number }
}

export type CompileApi = {
  compile: (src: string, options: Record<string, unknown>) => { warnings: SvelteMessage[] }
}

/** Compiler warnings that repeat per element and drown the real findings. */
const MAX_WARNINGS = 15

export function compileDiagnostics(mod: CompileApi, source: string, filename: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  try {
    const { warnings } = mod.compile(source, { filename, generate: 'client' })
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
  return diagnostics
}
