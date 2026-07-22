/**
 * Studio bug-report core (pure + node-safe, usable from the CLI and the
 * designer). Two pieces:
 *
 *   - `sanitizeStudioProject` - strip credentials + seed DATA from a project so
 *     a bug report never leaks a user's database or rows. It keeps the SCHEMA,
 *     screens, and block structure (what actually reproduces a Studio bug) and
 *     returns a plain-language list of what was removed, so the user sees it.
 *   - `buildStudioBugReport` - assemble a markdown report + a prefilled GitHub
 *     "new issue" URL. The URL carries a short summary (GitHub caps the prefill
 *     ~8 KB); the full sanitized report goes in `markdown` for the caller to
 *     copy to the clipboard / write to a file and paste in.
 *
 * The caller supplies `env` (version / node / os) so this stays free of any
 * process or DOM access and is trivially testable.
 */
import type { EntityDataSource, StudioProject } from './project.js'

const REDACTED = '<redacted>'
const DEFAULT_REPO = 'sv-grid/sv-grid'
/** Keep the prefilled issue URL comfortably under browser / GitHub limits. */
const MAX_URL = 7500
/** Param names that carry secrets (substring, case-insensitive). */
const SECRET_NAME_RE = /(key|token|secret|auth|password|pass|bearer|credential)/i

export type SanitizeResult = { project: StudioProject; redactions: string[] }

/** Redact one entity's data source; push a human note for anything removed. */
function sanitizeSource(entity: string, src: EntityDataSource, redactions: string[]): EntityDataSource {
  if (src.kind === 'memory') {
    const { seed, ...rest } = src
    if (seed?.length) redactions.push(`${entity}: ${seed.length} in-memory seed row(s) omitted`)
    return rest
  }
  if (src.kind === 'pglite') {
    const { seed, ...rest } = src
    if (seed?.length) redactions.push(`${entity}: ${seed.length} local-database seed row(s) omitted`)
    return rest
  }
  if (src.kind === 'supabase') {
    const out = { ...src }
    if (out.url) { out.url = REDACTED; redactions.push(`${entity}: Supabase URL redacted`) }
    if (out.key) { out.key = REDACTED; redactions.push(`${entity}: Supabase key redacted`) }
    return out
  }
  if (src.kind === 'rest') {
    const params = src.params.map((p) => {
      // Header params and secret-named params carry auth; drop their values.
      if (p.value && (p.location === 'header' || SECRET_NAME_RE.test(p.name))) {
        redactions.push(`${entity}: REST ${p.location} param "${p.name}" value redacted`)
        return { ...p, value: REDACTED }
      }
      return p
    })
    let baseUrl = src.baseUrl
    if (/[?&](key|token|apikey|secret|auth|password)=/i.test(baseUrl)) {
      baseUrl = baseUrl.replace(/([?&](?:key|token|apikey|secret|auth|password)=)[^&]*/gi, `$1${REDACTED}`)
      redactions.push(`${entity}: credentials in REST baseUrl redacted`)
    }
    return { ...src, baseUrl, params }
  }
  // sql: the connection string lives in the host env, not the model - nothing to strip.
  return src
}

/**
 * Return a copy of the project safe to attach to a bug report: credentials and
 * seeded rows removed, schema + screens + blocks intact. Also returns a list of
 * exactly what was stripped, for transparency.
 */
export function sanitizeStudioProject(project: StudioProject): SanitizeResult {
  const redactions: string[] = []
  if (!project.dataSources) return { project, redactions }
  const nextSources: Record<string, EntityDataSource> = {}
  for (const [name, src] of Object.entries(project.dataSources)) {
    nextSources[name] = sanitizeSource(name, src, redactions)
  }
  return { project: { ...project, dataSources: nextSources }, redactions }
}

export type StudioEnv = { studioVersion?: string; node?: string; os?: string }

export type BugReportInput = {
  /** The current project model (studio.config.json). Sanitized before use. */
  project?: StudioProject
  /** The error that triggered the report (on a crash), if any. */
  error?: Error | { message: string; stack?: string } | string
  /** What the user was doing (e.g. "generating the app", "editing the CRM board"). */
  action?: string
  env?: StudioEnv
  /** `owner/repo` the issue targets (default the public SvGrid repo). */
  repo?: string
}

export type BugReport = {
  title: string
  /** Full markdown report - copy to clipboard / write to a file and paste in. */
  markdown: string
  /** Prefilled GitHub "new issue" URL. */
  issueUrl: string
  redactions: string[]
  /** True when the report was too big for the URL, so `markdown` must be pasted. */
  truncated: boolean
}

function normalizeError(e: BugReportInput['error']): { message: string; stack?: string } | undefined {
  if (!e) return undefined
  if (typeof e === 'string') return { message: e }
  return { message: e.message, stack: 'stack' in e ? e.stack : undefined }
}

function newIssueUrl(repo: string, title: string, body: string): string {
  const q = new URLSearchParams({ title, body, labels: 'studio,bug' })
  return `https://github.com/${repo}/issues/new?${q.toString()}`
}

function envLines(env: StudioEnv): string[] {
  return [
    `- Studio: ${env.studioVersion ?? 'unknown'}`,
    `- Node: ${env.node ?? 'unknown'}`,
    `- OS: ${env.os ?? 'unknown'}`,
  ]
}

function renderSummary(env: StudioEnv, err: ReturnType<typeof normalizeError>, action: string | undefined, redactions: string[]): string {
  const lines = ['### Environment', ...envLines(env), '']
  if (action) lines.push('### What I was doing', action, '')
  if (err) lines.push('### Error', '```', err.message, '```', '')
  lines.push(`_${redactions.length} item(s) redacted (credentials + seed data)._`)
  return lines.join('\n')
}

/**
 * Build a shareable bug report from the current Studio state. The project is
 * sanitized first; secrets never reach the markdown or the URL.
 */
export function buildStudioBugReport(input: BugReportInput): BugReport {
  const env = input.env ?? {}
  const err = normalizeError(input.error)
  const { project, redactions } = input.project
    ? sanitizeStudioProject(input.project)
    : { project: undefined as StudioProject | undefined, redactions: [] as string[] }

  const firstLine = (err?.message ?? 'Bug report').split('\n')[0]!.trim().slice(0, 100)
  const title = `[Studio] ${firstLine}`

  const md: string[] = ['## SvGrid Studio bug report', '', '### Environment', ...envLines(env), '']
  if (input.action) md.push('### What I was doing', input.action, '')
  if (err) md.push('### Error', '```', err.message, ...(err.stack ? ['', err.stack] : []), '```', '')
  if (project) md.push('### Project', `${project.entities?.length ?? 0} entities, ${project.screens?.length ?? 0} screens.`, '')
  md.push('### Redactions', redactions.length ? redactions.map((r) => `- ${r}`).join('\n') : '- none', '')
  if (project) md.push('### Sanitized studio.config.json', '```json', JSON.stringify(project, null, 2), '```')
  const markdown = md.join('\n')

  const repo = input.repo ?? DEFAULT_REPO
  let issueUrl = newIssueUrl(repo, title, markdown)
  let truncated = false
  if (issueUrl.length > MAX_URL) {
    truncated = true
    const body = `${renderSummary(env, err, input.action, redactions)}\n\n> The full sanitized report was copied to your clipboard - paste it below.`
    issueUrl = newIssueUrl(repo, title, body)
  }

  return { title, markdown, issueUrl, redactions, truncated }
}
