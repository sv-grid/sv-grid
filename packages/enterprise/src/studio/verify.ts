/**
 * verifyScaffold - the generator's self-check. Compiles each generated
 * `.svelte` file with Svelte's own compiler and reports any errors, so
 * malformed output is caught BEFORE it's written to a project. This is the
 * cheap first gate of the verify loop; the deep gate (type resolution across
 * real imports) is the host running the project's own `svelte-check`.
 *
 * The Svelte compiler is imported dynamically and best-effort: if it can't be
 * resolved (e.g. a bare `npx @svgrid/mcp` with no svelte on disk), those files
 * are counted as `skipped` rather than failing - the function never throws and
 * carries no hard dependency, so it's safe in Node and in the browser.
 *
 * `.ts` files aren't compiled here (that needs the project's tsc + imports);
 * they're reported as skipped.
 */
import type { GeneratedFile } from './scaffold.js'

export type VerifySeverity = 'error' | 'warning'
export type VerifyIssue = { path: string; severity: VerifySeverity; message: string }
export type VerifyResult = {
  /** True when no error-level issues were found (warnings are allowed). */
  ok: boolean
  issues: VerifyIssue[]
  /** How many files were actually compiled. */
  checked: number
  /** How many files were skipped (non-svelte, or compiler unavailable). */
  skipped: number
}

export async function verifyScaffold(
  files: ReadonlyArray<GeneratedFile>,
): Promise<VerifyResult> {
  const issues: VerifyIssue[] = []
  let checked = 0
  let skipped = 0

  let compile: ((source: string, options: Record<string, unknown>) => { warnings: Array<{ message?: string }> }) | undefined
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import('svelte/compiler')
    compile = mod.compile
  } catch {
    compile = undefined
  }

  for (const file of files) {
    if (!file.path.endsWith('.svelte') || !compile) {
      skipped++
      continue
    }
    try {
      const { warnings } = compile(file.contents, { filename: file.path, generate: 'client' })
      checked++
      for (const w of warnings) {
        issues.push({ path: file.path, severity: 'warning', message: w.message ?? 'warning' })
      }
    } catch (err) {
      checked++
      issues.push({
        path: file.path,
        severity: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return { ok: !issues.some((i) => i.severity === 'error'), issues, checked, skipped }
}

/** One-line human summary of a verify result, for tool output / logs. */
export function summarizeVerify(result: VerifyResult): string {
  if (result.checked === 0) {
    return 'verification skipped (Svelte compiler unavailable) - run svelte-check in your project.'
  }
  const errors = result.issues.filter((i) => i.severity === 'error')
  if (errors.length === 0) return `verified: ${result.checked} file(s) compile.`
  return `VERIFICATION FAILED (${errors.length} error(s)):\n` +
    errors.map((e) => `  ${e.path}: ${e.message}`).join('\n')
}
