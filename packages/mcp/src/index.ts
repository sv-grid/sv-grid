#!/usr/bin/env node
/**
 * SvGrid MCP server (stdio).
 *
 * Gives an MCP-capable client accurate, version-pinned answers about SvGrid -
 * the real exported API, the shipped docs, 500+ runnable demos - and, uniquely,
 * a way to CHECK generated code against that surface before a user ever sees
 * it.
 *
 * The surface is deliberately small. It was 36 tools, which cost ~4,710 tokens
 * of `tools/list` on every single request; 79% of that was Studio, a commercial
 * feature most sessions never touch. Five always-on tools cover the whole
 * question-and-answer path - find, read, check-and-fix, preview, scaffold -
 * Studio is four more behind an opt-in flag, and the old names all still work - they are just not listed, because listing is what
 * costs tokens and calling an unlisted name costs nothing.
 *
 * Run with:
 *   npx @svgrid/mcp
 */

import { createRequire } from 'node:module'
// Our own stdio transport, not @modelcontextprotocol/sdk: the SDK's HTTP and
// OAuth dependencies were most of a cold npx install (see stdio-server.ts).
import { StdioMcpServer } from './stdio-server.js'
import type { ToolResult } from './core-tools.js'
import { CORE_TOOLS, PREVIEW_TOOL } from './tool-defs.js'
import { PROMPTS, getPrompt } from './prompts.js'
import { installedGrid, versionNote } from './installed.js'
import { applyFixes, checkSvGridCode, type ApiSurface } from './validate.js'
import { compileWithSvelte } from './compile-svelte.js'
import { ENTERPRISE_LINE, checkNeedsEnterprise } from './enterprise.js'
import type { EntitySchema } from '@svgrid/enterprise/studio'

/**
 * Studio and scaffolding run on `@svgrid/enterprise`, an optional peer.
 *
 * It used to be a dependency, so `npx -y @svgrid/mcp` unpacked enterprise and
 * the grid it peers on (about 2,200 files) before the server could answer. On
 * Windows that took 30-46 s cold, past the 30 s an MCP client waits to connect,
 * and every mcp release (one per docs change) made the next start cold again.
 * The retrieval and checking tools need none of it. So enterprise loads on the
 * first request that needs it, when it is installed beside this package (a
 * project with `npm i -D @svgrid/mcp @svgrid/enterprise`), and the Studio tools
 * answer with those steps when it is not.
 */
/**
 * The corpus (`data.js`, about 12 MB of docs, demos and API surface) and the
 * modules that read it load after the transport connects. A client times the
 * connect up to the `initialize` reply, which needs none of it, and the first
 * load of a freshly installed corpus took about 7 s on Windows. Every handler
 * that needs it awaits `corpus()`.
 */
type Corpus = {
  apiSurface: typeof import('./data.js')['apiSurface']
  core: typeof import('./core-tools.js')
  resources: typeof import('./resources.js')
  preview: typeof import('./preview.js')
}
let corpusLoad: Promise<Corpus> | undefined
function corpus(): Promise<Corpus> {
  if (!corpusLoad) {
    corpusLoad = Promise.all([
      import('./data.js'),
      import('./core-tools.js'),
      import('./resources.js'),
      import('./preview.js'),
    ]).then(([data, core, resources, preview]) => ({ apiSurface: data.apiSurface, core, resources, preview }))
    void corpusLoad.then(banner).catch(() => {})
  }
  return corpusLoad
}

type StudioApi = typeof import('@svgrid/enterprise/studio')
type StudioToolsModule = typeof import('./studio-tools.js')
type ProjectToolsModule = typeof import('./project-tools.js')
let studioApi: StudioApi | null = null
let studioTools: StudioToolsModule | null = null
let projectTools: ProjectToolsModule | null = null

const NEEDS_ENTERPRISE =
  'This tool runs on @svgrid/enterprise, which is not installed beside the MCP server. ' +
  'Install both in the project, `npm i -D @svgrid/mcp @svgrid/enterprise`, and run the local server ' +
  '(Claude Code: `claude mcp add svgrid -- npx svgrid-mcp`). ' +
  'It runs without a license key and watermarks generated apps until one is set. https://svgrid.com/pricing'

let studioLoad: Promise<void> | undefined
function loadStudio(): Promise<void> {
  studioLoad ??= (async () => {
    try {
      studioApi = await import('@svgrid/enterprise/studio')
      studioTools = await import('./studio-tools.js')
      projectTools = await import('./project-tools.js')
    } catch (err) {
      studioApi = studioTools = projectTools = null
      // Enterprise not installed is the expected case. Anything else, a module
      // missing INSIDE enterprise included, is a real failure to load it, and
      // saying so beats a Studio that silently never turns on.
      const code = (err as { code?: string })?.code
      const message = String((err as Error)?.message ?? err)
      const absent =
        (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') &&
        /Cannot find (package|module) '@svgrid\/enterprise/.test(message)
      if (!absent) process.stderr.write(`@svgrid/mcp: could not load @svgrid/enterprise/studio: ${message}\n`)
    }
  })()
  return studioLoad
}

function studioEnabled(): boolean {
  return studioTools?.studioEnabled() ?? false
}

/** The names that run on enterprise, for a useful answer when it is missing. */
function needsEnterprise(name: string): boolean {
  return name === 'svgrid_scaffold' || name === 'introspect_source' || name === 'scaffold_entity' || name.startsWith('studio')
}

/**
 * Soft commercial gate. Uses the SAME classifier as the browser
 * (checkLicenseKey), reading the key from the SVGRID_LICENSE_KEY env var. Never
 * blocks - unlicensed generation still runs, it just prepends a nudge (and the
 * generated app itself watermarks until a key is set).
 */
function studioNoteFor(api: StudioApi): string {
  return api.checkLicenseKey(process.env.SVGRID_LICENSE_KEY ?? null).valid
    ? ''
    : '// SvGrid Studio is a commercial feature. Set SVGRID_LICENSE_KEY (in your MCP\n' +
        '// server config env) for licensed use. https://svgrid.com/pricing\n\n'
}

function errText(message: string): ToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

const pkgVersion = (() => {
  try {
    const require = createRequire(import.meta.url)
    return (require('../package.json') as { version?: string }).version ?? '0.0.0'
  } catch {
    return '0.0.0'
  }
})()

const server = new StdioMcpServer(
  { name: '@svgrid/mcp', version: pkgVersion },
  {
    // Tools alone was half the protocol. The corpus is a natural fit for
    // resources (the user attaches a doc, no tool call needed) and the common
    // tasks are a natural fit for prompts.
    capabilities: { tools: {}, resources: {}, prompts: {} },
  },
)

// ---- the two tools that are not pure retrieval ----------------------------

const CHECK_TOOL = {
  name: 'svgrid_check_code',
  title: 'Check and fix SvGrid code',
  description:
    'Verify SvGrid code BEFORE handing it to the user. Checks the source against the real exported surface for this version - props, column options, api methods, imports - and compiles it. Reports unknown props, wrong imports and compile errors with the line to fix, AND returns a corrected copy of the file (`fixed`) whenever the correction is exact, with `applied` listing every edit. Nothing else in this server prevents a confidently wrong answer; call it on every component you write, then use `fixed` rather than re-deriving the edits.',
  inputSchema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'The file contents to check.' },
      filename: { type: 'string', description: 'Optional filename, used in messages, e.g. "Grid.svelte".' },
    },
    required: ['source'],
  },
}

const SCAFFOLD_TOOL = {
  name: 'svgrid_scaffold',
  title: 'Scaffold a CRUD screen',
  description:
    'SvGrid Studio (commercial): turn a data source into runnable SvelteKit files - the $lib schema module, a +server.ts API route, and a +page.svelte with SvGrid + SvGridEditPanel. Accepts a Drizzle schema, sample JSON rows, or an EntitySchema you already have; infers the schema and generates in one call. Set schemaOnly to stop after inference. Generated bodies carry svgrid:managed markers so regeneration preserves your edits outside them.',
  inputSchema: {
    type: 'object',
    properties: {
      from: {
        type: 'string',
        enum: ['drizzle', 'json', 'schema'],
        description: '"drizzle" a schema file, "json" sample rows, or "schema" an EntitySchema.',
      },
      drizzle: { type: 'string', description: 'For from:"drizzle": the schema source.' },
      rows: { type: 'array', description: 'For from:"json": a non-empty array of sample rows.' },
      name: { type: 'string', description: 'For from:"json": the entity name.' },
      schema: { type: 'object', description: 'For from:"schema": an EntitySchema.', additionalProperties: true },
      route: { type: 'string', description: 'Page route, e.g. "/people".' },
      apiRoute: { type: 'string', description: 'API route, e.g. "/api/people".' },
      schemaOnly: { type: 'boolean', description: 'Return the inferred EntitySchema without generating files.' },
    },
    required: ['from'],
  },
}

async function listedTools() {
  // The definitions, not the corpus: listing must not wait for data.js.
  await loadStudio()
  const tools: unknown[] = [...CORE_TOOLS, CHECK_TOOL, PREVIEW_TOOL, SCAFFOLD_TOOL]
  if (studioTools && studioEnabled()) tools.push(...studioTools.STUDIO_TOOLS)
  return tools
}

server.setRequestHandler('tools/list', async () => {
  const tools = await listedTools()
  // Warm the corpus once this reply is on the wire, so its first load overlaps
  // the model choosing a tool rather than the first call.
  setTimeout(() => void corpus().catch(() => {}), 50)
  return { tools }
})

// ---- resources ------------------------------------------------------------

server.setRequestHandler('resources/list', async (req) =>
  (await corpus()).resources.listResources(req.params?.cursor),
)

server.setRequestHandler('resources/read', async (req) => {
  const { preview, resources } = await corpus()
  const found = preview.readPreviewResource(req.params.uri) ?? resources.readResource(req.params.uri)
  if (!found) throw new Error(`No SvGrid resource at "${req.params.uri}".`)
  return found
})

// ---- prompts --------------------------------------------------------------

server.setRequestHandler('prompts/list', async () => ({ prompts: PROMPTS }))

server.setRequestHandler('prompts/get', async (req) => {
  const found = getPrompt(req.params.name, (req.params.arguments ?? {}) as Record<string, unknown>)
  if (!found) throw new Error(`No SvGrid prompt named "${req.params.name}".`)
  return found
})

// ---- tool calls -----------------------------------------------------------

async function runCheck(args: Record<string, unknown>): Promise<ToolResult> {
  const source = args.source
  if (typeof source !== 'string' || !source.trim()) {
    return errText('source (the file contents to check) is required')
  }
  const { apiSurface } = await corpus()
  const result = await checkSvGridCode(source, apiSurface as ApiSurface, {
    filename: typeof args.filename === 'string' ? args.filename : undefined,
    compile: compileWithSvelte,
  })

  // Reporting the mistake and stopping leaves the caller to re-derive the edit
  // from prose, which is the loop this tool exists to shorten. Where the
  // correction is exact, hand back the corrected file too - and an audit trail,
  // so it can be reviewed rather than trusted. Both omitted when nothing was
  // mechanically fixable, so the common clean case does not grow.
  const { fixed, applied } = applyFixes(source, result.diagnostics)

  // Which version this was actually checked against. A proxy-shaped server
  // answers from one global "latest" and cannot know what the caller has
  // installed; we ship the corpus, so we can say when the two disagree instead
  // of letting a model assert an API the user does not have.
  const version = versionNote(apiSurface.gridVersion)
  const payload = {
    ...result,
    ...(version ? { version } : {}),
    ...(applied.length ? { applied, fixed } : {}),
    // The one exception to "no marketing in a work list": a fix that sends the
    // caller to the paid package says so, because installing it is the next step.
    ...(checkNeedsEnterprise(result.diagnostics) ? { enterprise: ENTERPRISE_LINE } : {}),
  }

  // No docs footer: this output is a work list, and a marketing line at the end
  // of it is noise the model has to read past on every iteration.
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] }
}

async function runScaffold(args: Record<string, unknown>): Promise<ToolResult> {
  const api = studioApi
  if (!api) return errText(NEEDS_ENTERPRISE)
  const { introspectDrizzle, introspectJson, scaffold, verifyScaffold, summarizeVerify } = api
  const studioNote = () => studioNoteFor(api)
  const from = String(args.from ?? '')
  try {
    let schema: EntitySchema
    if (from === 'drizzle') {
      if (typeof args.drizzle !== 'string' || !args.drizzle.trim()) {
        return errText('drizzle (the schema source) is required for from:"drizzle"')
      }
      schema = introspectDrizzle(args.drizzle)
    } else if (from === 'json') {
      if (!Array.isArray(args.rows) || args.rows.length === 0) {
        return errText('rows (a non-empty array) is required for from:"json"')
      }
      schema = introspectJson(
        typeof args.name === 'string' ? args.name : 'entity',
        args.rows as Array<Record<string, unknown>>,
      )
    } else if (from === 'schema') {
      const given = args.schema as EntitySchema | undefined
      if (!given || !Array.isArray(given.fields) || given.fields.length === 0) {
        return errText('schema (an EntitySchema with a non-empty fields array) is required for from:"schema"')
      }
      schema = given
    } else {
      return errText('from must be "drizzle", "json" or "schema"')
    }

    if (args.schemaOnly === true) {
      return { content: [{ type: 'text', text: studioNote() + JSON.stringify(schema, null, 2) }] }
    }

    const { files } = scaffold(schema, {
      route: typeof args.route === 'string' ? args.route : undefined,
      apiRoute: typeof args.apiRoute === 'string' ? args.apiRoute : undefined,
    })
    // Verify loop: compile the generated .svelte before handing files back.
    const verify = await verifyScaffold(files)
    const header =
      `// ${summarizeVerify(verify)}\n` +
      "// After writing these files, run the project's svelte-check / tsc and fix any errors.\n\n"
    return {
      content: [{ type: 'text', text: studioNote() + header + JSON.stringify({ files, verify }, null, 2) }],
    }
  } catch (err) {
    return errText(err instanceof Error ? err.message : String(err))
  }
}

/**
 * The pre-3.0 tool names.
 *
 * Kept working but NOT listed. `tools/list` is what costs context on every
 * request; `tools/call` accepting a name it did not advertise costs nothing. So
 * anyone with a saved prompt, skill or script written against the old surface
 * keeps working, and nobody pays for the compatibility.
 */
const LEGACY: Record<string, (args: Record<string, unknown>) => Record<string, unknown>> = {
  list_examples: (a) => ({ ...a, kind: 'examples', query: a.query ?? a.category ?? '' }),
  list_docs: (a) => ({ ...a, kind: 'docs', query: a.query ?? a.section ?? '' }),
  search_docs: (a) => ({ ...a, kind: 'docs' }),
  get_example_source: (a) => ({ ref: a.id, kind: 'example' }),
  get_doc: (a) => ({ ref: a.slug, kind: 'doc' }),
  get_api_reference: () => ({ ref: 'api', kind: 'api' }),
}
const LEGACY_TARGET: Record<string, string> = {
  list_examples: 'svgrid_search',
  list_docs: 'svgrid_search',
  search_docs: 'svgrid_search',
  get_example_source: 'svgrid_get',
  get_doc: 'svgrid_get',
  get_api_reference: 'svgrid_get',
}

server.setRequestHandler('tools/call', async (req) => {
  const { name, arguments: rawArgs } = req.params
  // As the SDK answered it: a call that names no tool is invalid params.
  if (typeof name !== 'string') throw Object.assign(new Error('Invalid params: tools/call needs a tool name'), { code: -32602 })
  const args = (rawArgs ?? {}) as Record<string, unknown>
  const [{ core: coreTools, preview }] = await Promise.all([corpus(), loadStudio()])

  // Retrieval tools, old names mapped onto the new ones.
  const legacy = LEGACY[name]
  if (legacy) {
    const mapped = coreTools.handleCoreTool(LEGACY_TARGET[name]!, legacy(args))
    if (mapped) return mapped
  }

  const core = coreTools.handleCoreTool(name, args)
  if (core) return core

  if (name === 'svgrid_preview') return preview.handlePreview(args)
  if (name === 'svgrid_check_code' || name === 'check_svgrid_code') return runCheck(args)

  if (name === 'svgrid_scaffold') return runScaffold(args)
  // The two pre-3.0 scaffold tools, expressed as the one that replaced them.
  if (name === 'introspect_source') {
    return runScaffold({
      from: args.kind === 'drizzle' ? 'drizzle' : 'json',
      drizzle: args.source,
      rows: args.rows,
      name: args.name,
      schemaOnly: true,
    })
  }
  if (name === 'scaffold_entity') {
    return runScaffold({ from: 'schema', schema: args.schema, route: args.route, apiRoute: args.apiRoute })
  }

  // Consolidated Studio tools, then the 27 individual pre-3.0 ones, which the
  // project dispatcher still understands.
  if (studioTools && projectTools) {
    const studio = studioTools.handleStudioTool(name, args)
    if (studio) return studio
    const project = projectTools.handleProjectTool(name, args)
    if (project) return project
  } else if (needsEnterprise(name)) {
    return errText(NEEDS_ENTERPRISE)
  }

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text:
          `Unknown tool: ${name}. Available: ${(await listedTools())
            .map((t) => (t as { name: string }).name)
            .join(', ')}` +
          (studioEnabled()
            ? ''
            : '. SvGrid Studio tools are off - set SVGRID_MCP_STUDIO=1 or SVGRID_LICENSE_KEY to enable them.'),
      },
    ],
  }
})

async function main() {
  // Connect and nothing else: `initialize` is answered by the transport and
  // needs neither the corpus nor enterprise. They load on the first request that
  // does (normally tools/list). Loading them eagerly after connect did not
  // help: the first read of the 12 MB corpus held the event loop for seconds,
  // and the initialize reply waited behind it.
  server.connect()
  process.stderr.write(`@svgrid/mcp ${pkgVersion} on stdio\n`)
}

/** The fuller banner, once the corpus is in, naming both grid versions. */
async function banner() {
  const [{ apiSurface }] = await Promise.all([corpus(), loadStudio()])
  // stderr: stdout is reserved for the JSON-RPC protocol.
  // Name both versions. A corpus that describes a different grid than the one
  // installed is the quietest way for this server to be confidently wrong, and
  // the banner is where someone would actually notice.
  const found = installedGrid()
  const versions =
    found && found.version !== apiSurface.gridVersion
      ? ` - describes grid ${apiSurface.gridVersion}, but ${found.version} is installed here`
      : ` - grid ${apiSurface.gridVersion}${found ? ' (matches installed)' : ''}`

  process.stderr.write(
    `@svgrid/mcp ${pkgVersion} ready - ${(await listedTools()).length} tools` +
      (studioEnabled() ? ' (Studio on)' : studioApi ? '' : ' (Studio off: @svgrid/enterprise not installed)') +
      versions +
      '\n',
  )
}

main().catch((err) => {
  process.stderr.write(`@svgrid/mcp fatal: ${err?.stack ?? err}\n`)
  process.exit(1)
})
