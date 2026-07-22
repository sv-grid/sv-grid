import { describe, it, expect } from 'vitest'
import type { EntitySchema } from '../schema.js'
import { createProject, setEntityDataSource } from './project.js'
import { sanitizeStudioProject, buildStudioBugReport } from './bug-report.js'

const SUPABASE_URL = 'https://myproject.supabase.co'
const SUPABASE_KEY = 'sb_secret_TOP_SECRET_KEY_123'
const REST_TOKEN = 'Bearer LEAKED_AUTH_TOKEN_XYZ'
const PRIVATE_ROW = 'Jane Doe SSN 123-45-6789'

function entity(name: string): EntitySchema {
  return { name, label: name, idField: 'id', fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text' },
  ] }
}

function projectWithSecrets() {
  let p = createProject([entity('customers'), entity('orders'), entity('notes')])
  p = setEntityDataSource(p, 'customers', { kind: 'supabase', table: 'customers', url: SUPABASE_URL, key: SUPABASE_KEY })
  p = setEntityDataSource(p, 'orders', {
    kind: 'rest', baseUrl: 'https://api.example.com', path: 'orders', method: 'GET',
    params: [
      { name: 'Authorization', location: 'header', type: 'string', value: REST_TOKEN },
      { name: 'region', location: 'query', type: 'string', value: 'eu' },
    ],
  })
  p = setEntityDataSource(p, 'notes', { kind: 'memory', seed: [{ id: 'n1', name: PRIVATE_ROW }] })
  return p
}

describe('sanitizeStudioProject', () => {
  it('strips credentials + seed rows but keeps schema/screens', () => {
    const { project, redactions } = sanitizeStudioProject(projectWithSecrets())
    const json = JSON.stringify(project)

    // No secret of any kind survives.
    expect(json).not.toContain(SUPABASE_URL)
    expect(json).not.toContain(SUPABASE_KEY)
    expect(json).not.toContain(REST_TOKEN)
    expect(json).not.toContain(PRIVATE_ROW)

    // Non-secret structure is preserved (repro value).
    expect(json).toContain('"region"') // a non-secret query param name stays
    expect(json).toContain('eu')        // ...and its value
    expect(project.entities.map((e) => e.name).sort()).toEqual(['customers', 'notes', 'orders'])

    // Every removal is reported to the user.
    expect(redactions.join('\n')).toMatch(/Supabase URL redacted/)
    expect(redactions.join('\n')).toMatch(/Supabase key redacted/)
    expect(redactions.join('\n')).toMatch(/Authorization.*redacted/)
    expect(redactions.join('\n')).toMatch(/seed row\(s\) omitted/)
    expect(redactions.length).toBe(4)
  })

  it('leaves a project with no secrets unchanged (no false redactions)', () => {
    const p = createProject([entity('a')])
    const { redactions } = sanitizeStudioProject(p)
    // createProject defaults to a memory source with generated seed rows -> that
    // seed IS data, so it's the only thing (if any) reported; never a credential.
    expect(redactions.every((r) => !/redacted/i.test(r) || /seed/i.test(r))).toBe(true)
  })
})

describe('buildStudioBugReport', () => {
  it('never leaks secrets into the markdown or the prefilled issue URL', () => {
    const report = buildStudioBugReport({
      project: projectWithSecrets(),
      error: new Error('Cannot read properties of undefined (reading "blocks")'),
      action: 'generating the app',
      env: { studioVersion: '0.1.0', node: 'v22.0.0', os: 'win32' },
    })
    for (const secret of [SUPABASE_URL, SUPABASE_KEY, REST_TOKEN, PRIVATE_ROW]) {
      expect(report.markdown).not.toContain(secret)
      expect(report.issueUrl).not.toContain(encodeURIComponent(secret))
      expect(report.issueUrl).not.toContain(secret)
    }
    expect(report.title).toContain('[Studio]')
    expect(report.issueUrl).toContain('https://github.com/sv-grid/sv-grid/issues/new')
    expect(report.markdown).toContain('Sanitized studio.config.json')
    expect(report.redactions.length).toBe(4)
  })

  it('truncates the URL for a large project (falls back to paste-the-markdown)', () => {
    // A project big enough that the full report exceeds the URL cap.
    const many = Array.from({ length: 40 }, (_, i) => entity(`e${i}`))
    let p = createProject(many)
    for (const e of many) p = setEntityDataSource(p, e.name, { kind: 'memory', seed: [] })
    const report = buildStudioBugReport({ project: p, env: {} })
    expect(report.truncated).toBe(true)
    expect(report.issueUrl.length).toBeLessThanOrEqual(7500)
    expect(report.issueUrl).toContain('issues/new')
  })

  it('works with no project (a plain crash report)', () => {
    const report = buildStudioBugReport({ error: 'boom', env: { studioVersion: '0.1.0' } })
    expect(report.title).toBe('[Studio] boom')
    expect(report.markdown).toContain('boom')
    expect(report.redactions).toEqual([])
  })
})
