import { describe, expect, it } from 'vitest'
import { buildCopilotMessages, projectFromModelText } from './copilot-core'
import { createProject, serializeProject } from './project'
import type { EntitySchema } from '../schema'

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customers',
  idField: 'id',
  fields: [
    { field: 'id', label: 'Id', type: 'text', primaryKey: true },
    { field: 'name', label: 'Name', type: 'text' },
  ],
}

describe('copilot core', () => {
  it('builds a request carrying the model rules, the current project, and the instruction', () => {
    const p = createProject([customers])
    const { system, messages } = buildCopilotMessages('Add a status enum field to customers', p)
    expect(system).toMatch(/COMPLETE updated project as JSON/)
    expect(system).toMatch(/PRESERVE everything/)
    expect(system).toContain('board') // block kinds listed from the palette
    expect(system).toContain('radio-group') // component keys listed from the registry
    expect(messages).toHaveLength(1)
    expect(messages[0]!.content).toContain('"customers"') // current project inlined
    expect(messages[0]!.content).toContain('Add a status enum field to customers')
  })

  it('parses a clean JSON reply into a validated project', () => {
    const p = createProject([customers])
    const out = projectFromModelText(serializeProject(p))
    expect(out.entities[0]!.name).toBe('customers')
  })

  it('tolerates fenced and prose-wrapped replies', () => {
    const json = serializeProject(createProject([customers]))
    expect(projectFromModelText('```json\n' + json + '\n```').entities).toHaveLength(1)
    expect(projectFromModelText('Here is the updated project:\n' + json + '\nDone!').entities).toHaveLength(1)
  })

  it('rejects non-JSON and invalid projects with useful errors', () => {
    expect(() => projectFromModelText('Sorry, I cannot do that.')).toThrow(/no JSON object/)
    expect(() => projectFromModelText('{"entities": [], "screens": []}')).toThrow(/invalid project|entity/i)
  })
})
