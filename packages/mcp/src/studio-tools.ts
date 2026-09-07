/**
 * The Studio surface, as four tools instead of twenty-seven.
 *
 * The old surface was one tool per model mutation - `studio_add_block`,
 * `studio_update_block`, `studio_remove_block`, `studio_move_block`, and ten
 * separate `studio_set_*` tools. That is the API-wrapping antipattern: it made
 * building a five-screen app twenty-odd round trips, and it cost ~3,741 tokens
 * of `tools/list` on EVERY request, to every user, including the ones who only
 * wanted to ask a question about the free grid. Studio was 79% of the payload
 * and most sessions never called it once.
 *
 * These four delegate into the same `handleProjectTool` switch, so none of the
 * behaviour is reimplemented here - only the shape a model sees. `studio_apply`
 * takes a BATCH, which is the real win: a whole screen in one call rather than
 * six.
 *
 * Off unless asked for. Set `SVGRID_MCP_STUDIO=1`, or a valid
 * `SVGRID_LICENSE_KEY` - the tools that need a licence to be useful should not
 * be charged to everyone else's context window.
 */
import { checkLicenseKey } from '@svgrid/enterprise/studio'
import { handleProjectTool, type ProjectTool } from './project-tools.js'

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

/** Studio is opt-in: an explicit flag, or a licence key that implies intent. */
export function studioEnabled(): boolean {
  if (process.env.SVGRID_MCP_STUDIO === '1') return true
  return checkLicenseKey(process.env.SVGRID_LICENSE_KEY ?? null).valid
}

const PROJECT_ACTIONS: Record<string, string> = {
  new: 'studio_new_project',
  load: 'studio_load_project',
  describe: 'studio_describe_project',
  config: 'studio_get_config',
  capabilities: 'studio_capabilities',
}

const APPLY_OPS: Record<string, string> = {
  add_entity: 'studio_add_entity',
  add_screen: 'studio_add_screen',
  add_block: 'studio_add_block',
  add_component: 'studio_add_component',
  update_block: 'studio_update_block',
  remove_block: 'studio_remove_block',
  move_block: 'studio_move_block',
  update_screen: 'studio_update_screen',
  remove_screen: 'studio_remove_screen',
}

const SETTINGS: Record<string, string> = {
  theme: 'studio_set_theme',
  access: 'studio_set_access',
  auth: 'studio_set_auth',
  data_layer: 'studio_set_data_layer',
  tenancy: 'studio_set_tenancy',
  job: 'studio_set_job',
  deploy_target: 'studio_set_deploy_target',
  screen_layout: 'studio_set_screen_layout',
  form_layout: 'studio_set_form_layout',
  field_conditions: 'studio_set_field_conditions',
  entity_source: 'studio_set_entity_source',
}

const BUILD_ACTIONS: Record<string, string> = {
  validate: 'studio_validate',
  generate: 'studio_generate_app',
}

const keys = (map: Record<string, string>) => Object.keys(map).join(' | ')

export const STUDIO_TOOLS: ProjectTool[] = [
  {
    name: 'studio_project',
    description:
      'SvGrid Studio (commercial): open or inspect the project model. `new` starts an empty one, `load` parses a studio.config.json string, `describe` summarises the current project (entities, screens, blocks, ids), `config` returns it as studio.config.json, `capabilities` lists the block kinds, UI components, themes and data sources you can use. Call `capabilities` before `studio_apply` so you use real names.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: Object.keys(PROJECT_ACTIONS), description: keys(PROJECT_ACTIONS) },
        title: { type: 'string', description: 'For action "new": the project title.' },
        config: { type: 'string', description: 'For action "load": a studio.config.json string.' },
      },
      required: ['action'],
    },
  },
  {
    name: 'studio_apply',
    description:
      'SvGrid Studio (commercial): change the project model. Takes a BATCH of operations applied in order, so a whole screen is one call rather than six. Each op is { op, ...args } where op is one of: ' +
      keys(APPLY_OPS) +
      '. The args are the same ones the individual operations took (entity, screen, kind, blockId, config, ...). Stops at the first failure and reports which op failed and what already applied. Get ids from studio_project action:"describe".',
    inputSchema: {
      type: 'object',
      properties: {
        ops: {
          type: 'array',
          description: 'Operations to apply in order.',
          items: {
            type: 'object',
            properties: {
              op: { type: 'string', enum: Object.keys(APPLY_OPS), description: 'Which operation.' },
            },
            required: ['op'],
            additionalProperties: true,
          },
        },
      },
      required: ['ops'],
    },
  },
  {
    name: 'studio_configure',
    description:
      'SvGrid Studio (commercial): set project-wide options. Pass any combination of: ' +
      keys(SETTINGS) +
      '. Each value is the argument object the individual setting took, e.g. { "theme": { "preset": "ember" }, "auth": { "enabled": true } }. Applied in one call so a full app configuration is one round trip.',
    inputSchema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.keys(SETTINGS).map((k) => [
          k,
          { type: 'object', description: `Arguments for ${SETTINGS[k]}.`, additionalProperties: true },
        ]),
      ),
      required: [],
    },
  },
  {
    name: 'studio_build',
    description:
      'SvGrid Studio (commercial): `validate` reports codegen errors and warnings for the current project; `generate` emits the full runnable SvelteKit app - every route, $lib module, package.json and config. Validate first: generate on an invalid project wastes a large response.',
    inputSchema: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: Object.keys(BUILD_ACTIONS), description: keys(BUILD_ACTIONS) },
      },
      required: ['action'],
    },
  },
]

const fail = (message: string): ToolResult => ({ isError: true, content: [{ type: 'text', text: message }] })

/**
 * Catch the shape mistakes that would otherwise surface three calls later.
 *
 * An `EntitySchema` field is `{ field, type }`. Passing `{ name, type }` is the
 * obvious guess and it is accepted silently: the entity stores, the screen
 * builds, and nothing complains until `studio_build generate` fails with
 * "no primary key ... or name a field \`id\`" - on a schema that HAS a field
 * called id. That message is about the `field` property, but it reads as the
 * `name` one, and following its advice reproduces the error exactly. It cost
 * three round trips to diagnose by hand; a model would burn the same and then
 * guess.
 *
 * So it is caught here, at the call that got it wrong, naming the fix.
 */
function checkOpShape(op: string, entry: Record<string, unknown>): string | null {
  if (op !== 'add_entity') return null
  const schema = entry.schema as { fields?: unknown } | undefined
  if (!schema || !Array.isArray(schema.fields)) return null

  const misnamed = schema.fields.filter(
    (f) => f && typeof f === 'object' && !('field' in f) && 'name' in f,
  )
  if (!misnamed.length) return null
  const names = misnamed
    .map((f) => (f as { name?: unknown }).name)
    .filter((n) => typeof n === 'string')
    .join(', ')
  return (
    `EntitySchema fields use \`field\`, not \`name\` - rewrite { "name": "id" } as ` +
    `{ "field": "id" } (affected: ${names}). Left as-is this stores fine and then ` +
    `fails at generate time with a message about the primary key.`
  )
}
const isError = (r: ToolResult | undefined) => !r || r.isError
const textOf = (r: ToolResult | undefined) => (r?.content ?? []).map((c) => c.text).join('\n')

export function handleStudioTool(name: string, args: Record<string, unknown>): ToolResult | undefined {
  if (name === 'studio_project') {
    const action = String(args.action ?? '')
    const target = PROJECT_ACTIONS[action]
    if (!target) return fail(`Unknown action "${action}". Use one of: ${keys(PROJECT_ACTIONS)}.`)
    return handleProjectTool(target, args)
  }

  if (name === 'studio_apply') {
    const ops = args.ops
    if (!Array.isArray(ops) || ops.length === 0) {
      return fail(`ops must be a non-empty array of { op, ... }. Valid ops: ${keys(APPLY_OPS)}.`)
    }
    const applied: string[] = []
    for (const [i, raw] of ops.entries()) {
      const entry = (raw ?? {}) as Record<string, unknown>
      const op = String(entry.op ?? '')
      const target = APPLY_OPS[op]
      if (!target) {
        return fail(
          `ops[${i}]: unknown op "${op}". Valid ops: ${keys(APPLY_OPS)}.` +
            (applied.length ? `\nAlready applied: ${applied.join(', ')}.` : ''),
        )
      }
      const shapeError = checkOpShape(op, entry)
      if (shapeError) {
        return fail(
          `ops[${i}] (${op}): ${shapeError}` +
            (applied.length ? `\nAlready applied: ${applied.join(', ')}.` : '\nNothing was applied.'),
        )
      }

      const result = handleProjectTool(target, entry)
      if (isError(result)) {
        // Say what landed before the failure - the model has to know whether to
        // retry the whole batch or only the tail.
        return fail(
          `ops[${i}] (${op}) failed: ${textOf(result)}` +
            (applied.length ? `\nAlready applied: ${applied.join(', ')}.` : '\nNothing was applied.'),
        )
      }
      applied.push(`${i}:${op}`)
    }
    const describe = handleProjectTool('studio_describe_project', {})
    return { content: [{ type: 'text', text: `Applied ${applied.length} op(s).\n\n${textOf(describe)}` }] }
  }

  if (name === 'studio_configure') {
    const entries = Object.keys(SETTINGS).filter((k) => args[k] !== undefined)
    if (!entries.length) {
      return fail(`Pass at least one of: ${keys(SETTINGS)}.`)
    }
    const done: string[] = []
    for (const key of entries) {
      const value = (args[key] ?? {}) as Record<string, unknown>
      const result = handleProjectTool(SETTINGS[key]!, value)
      if (isError(result)) {
        return fail(
          `${key} failed: ${textOf(result)}` +
            (done.length ? `\nAlready set: ${done.join(', ')}.` : '\nNothing was set.'),
        )
      }
      done.push(key)
    }
    return { content: [{ type: 'text', text: `Set ${done.join(', ')}.` }] }
  }

  if (name === 'studio_build') {
    const action = String(args.action ?? '')
    const target = BUILD_ACTIONS[action]
    if (!target) return fail(`Unknown action "${action}". Use one of: ${keys(BUILD_ACTIONS)}.`)
    return handleProjectTool(target, args)
  }

  return undefined
}
