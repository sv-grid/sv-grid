/**
 * Studio Copilot - the pure, testable core. Builds the model request for "edit
 * this project per the user's instruction" and parses/validates the model's
 * reply back into a StudioProject. No network here: the CLI designer server
 * does the actual Anthropic call (keys stay server-side), and the designer
 * additionally re-validates + puts the result on the undo stack, so a bad
 * edit is one Ctrl+Z away.
 */
import { parseProject, serializeProject, validateProject, blockPalette, type StudioProject } from './project.js'
import { UI_COMPONENT_REGISTRY } from './ui-components.js'

export type CopilotMessages = {
  system: string
  messages: Array<{ role: 'user'; content: string }>
}

/** The system + user messages for one copilot edit round. */
export function buildCopilotMessages(prompt: string, project: StudioProject): CopilotMessages {
  const kinds = blockPalette.map((p) => p.kind).join(', ')
  const components = UI_COMPONENT_REGISTRY.map((c) => c.key).join(', ')
  const system = `You are SvGrid Studio's copilot. You edit a Studio project - the JSON model of a data app - according to the user's instruction, and return the COMPLETE updated project as JSON.

The model, briefly:
- entities: EntitySchema[] - { name, label, idField, fields: [{ field, label, type, primaryKey?, required?, formula?, options?: [{value,label,color?}], relation?: { entity, labelField } }] }. Field types: text | number | boolean | date | datetime | enum | relation | json.
- screens: [{ id, title, route, entity?, blocks: [{ id, config: { kind, ... } }], nav?: { show, label?, order? } }]. Block kinds: ${kinds}. A 'component' block is { kind: 'component', component: <key>, props: {...} } with component keys: ${components}.
- dataSources: { [entityName]: { kind: 'memory'|'sql'|'rest'|'supabase'|'pglite', ... } }. theme, auth, access (RBAC), i18n, deploy as configured.
- validations on an entity: [{ field, op, value|compareTo, message }].

Rules:
- Return ONLY the full updated project JSON (no prose, no markdown fence).
- PRESERVE everything the instruction does not ask to change - ids, screens, entities, config. Never renumber or drop existing ids.
- New ids: short kebab/lower-camel strings unique within the project.
- New entities need at least an id/primary-key field and a label-ish field; give enum fields options with value+label; seed realistic demo data is NOT required.
- New screens need a unique route and at least one block bound to their entity.
- Prefer editing over rebuilding; keep the user's structure and naming style.`
  return {
    system,
    messages: [
      {
        role: 'user',
        content: `Current project JSON:\n${serializeProject(project)}\n\nInstruction: ${prompt}\n\nReturn the complete updated project JSON.`,
      },
    ],
  }
}

/** Parse the model's reply into a validated StudioProject. Tolerates a fenced
 *  code block or stray prose around the JSON; throws with a useful message when
 *  the reply isn't a valid project. */
export function projectFromModelText(text: string): StudioProject {
  let candidate = text.trim()
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) candidate = fence[1]!.trim()
  if (!candidate.startsWith('{')) {
    // Stray prose: cut to the outermost object literal.
    const start = candidate.indexOf('{')
    const end = candidate.lastIndexOf('}')
    if (start === -1 || end <= start) throw new Error('Copilot reply contained no JSON object.')
    candidate = candidate.slice(start, end + 1)
  }
  const project = parseProject(candidate) // throws on malformed/invalid shapes
  const errors = validateProject(project).filter((i) => i.level === 'error')
  if (errors.length) throw new Error(`Copilot returned an invalid project: ${errors.map((e) => e.message).join(' ')}`)
  return project
}
