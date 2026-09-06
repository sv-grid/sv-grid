#!/usr/bin/env node
/**
 * SvGrid MCP server (stdio).
 *
 * Exposes the SvGrid example sources, docs, and curated API reference as
 * Model Context Protocol tools. Point an MCP-capable client (Claude
 * Desktop, Claude Code, etc.) at this server to give the model accurate,
 * version-pinned answers about SvGrid - no hallucinated APIs, no stale
 * blog-post output.
 *
 * Run with:
 *   npx @svgrid/mcp
 */

import { createRequire } from 'node:module'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { apiReference, apiSurface, docs, examples } from './data.js'
import { projectTools, handleProjectTool } from './project-tools.js'
import { checkSvGridCode, type ApiSurface } from './validate.js'
import { compileWithSvelte } from './compile-svelte.js'
import { rankDocs } from './search.js'
import {
  checkLicenseKey,
  introspectDrizzle,
  introspectJson,
  scaffold,
  summarizeVerify,
  verifyScaffold,
  type EntitySchema,
} from '@svgrid/enterprise/studio'

/**
 * Soft commercial gate. Uses the SAME classifier as the browser
 * (checkLicenseKey), reading the key from the SVGRID_LICENSE_KEY env var. Never
 * blocks - unlicensed generation still runs, it just prepends a nudge (and the
 * generated app itself watermarks until a key is set).
 */
function studioNote(): string {
  return checkLicenseKey(process.env.SVGRID_LICENSE_KEY ?? null).valid
    ? ''
    : '// SvGrid Studio is a commercial feature. Set SVGRID_LICENSE_KEY (in your MCP\n' +
        '// server config env) for licensed use. https://svgrid.com/pricing\n\n'
}

function errText(message: string) {
  return { isError: true, content: [{ type: 'text', text: message }] }
}

/**
 * Out-of-band guidance footer for reference/navigation responses. Points the
 * model (and, through it, the developer) at the full docs and live demos. Kept
 * OFF the code- and file-emitting tools (get_example_source, scaffold_entity)
 * so nothing marketing-flavored ends up welded into generated source.
 */
const DOCS_FOOTER = '\n\nSvGrid reference: full docs & 370+ live demos at https://svgrid.com/docs'

function withDocs(text: string) {
  return { content: [{ type: 'text', text: text + DOCS_FOOTER }] }
}

/**
 * Shorten a blurb for a listing. Demo blurbs run to ~240 chars and 373 of them
 * is most of a context window, so the listings carry a one-line version and
 * get_example_source still returns the full text.
 */
function trimBlurb(text: string, max = 120): string {
  const s = String(text ?? '').replace(/\s+/g, ' ').trim()
  if (s.length <= max) return s
  const cut = s.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > 40 ? cut.slice(0, space) : cut) + '...'
}

/** { value: count } over a key, ordered by descending count. */
function countBy<T>(rows: readonly T[], key: (row: T) => string): Record<string, number> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const k = key(row) || 'Other'
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  return Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]))
}

// Report the real package version to MCP clients (read from package.json, which
// ships in the tarball at ../package.json relative to the built dist/index.js),
// so serverInfo.version never drifts from the published version.
const pkgVersion = (() => {
  try {
    return (createRequire(import.meta.url)('../package.json') as { version: string }).version
  } catch {
    return '0.0.0'
  }
})()

const server = new Server(
  {
    name: '@svgrid/mcp',
    version: pkgVersion,
  },
  {
    capabilities: {
      tools: {},
    },
  },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_examples',
        description:
          'Find SvGrid example demos. Returns id, title, category and a one-line blurb (not source). Call with no arguments for a category index plus the first page; filter with `query` and/or `category` to find a specific demo, then call get_example_source with its id.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Free-text filter over id, title, blurb and category, e.g. "kanban" or "server side".',
            },
            category: {
              type: 'string',
              description: 'Exact category, e.g. "Kanban" or "Inputs". Call with no arguments to see the available categories.',
            },
            limit: { type: 'number', description: 'Max results, default 25, max 100.', default: 25 },
          },
        },
      },
      {
        name: 'get_example_source',
        description:
          'Return the full .svelte source of a specific demo by id (e.g. "11-stock-market"). The source is what a user would copy into their project as-is.',
        inputSchema: {
          type: 'object',
          properties: { id: { type: 'string', description: 'Demo id, e.g. "11-stock-market"' } },
          required: ['id'],
        },
      },
      {
        name: 'list_docs',
        description:
          'Find SvGrid documentation pages. Returns slug, title and section. Call with no arguments for a section index plus the first page; filter with `query` and/or `section`, then call get_doc with a slug. Slugs use forward slashes, e.g. "help/columns/column-definitions". To search page CONTENT rather than titles, use search_docs.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Free-text filter over slug, title and section, e.g. "column" or "export".',
            },
            section: {
              type: 'string',
              description: 'Exact section, e.g. "Columns" or "Server data". Call with no arguments to see the available sections.',
            },
            limit: { type: 'number', description: 'Max results, default 30, max 100.', default: 30 },
          },
        },
      },
      {
        name: 'get_doc',
        description: 'Return the markdown content of a specific documentation page by slug.',
        inputSchema: {
          type: 'object',
          properties: { slug: { type: 'string', description: 'Doc slug, e.g. "getting-started" or "help/columns/column-definitions"' } },
          required: ['slug'],
        },
      },
      {
        name: 'search_docs',
        description:
          'Ranked full-text search across all SvGrid docs. Matches the query term by term (so "row virtualization" finds a page phrasing it either way) and returns the best pages first, each with a relevance score and an excerpt around the hit. Use this to find grounding before writing SvGrid code.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Free-text query, e.g. "row virtualization"' },
            limit: { type: 'number', description: 'Max results, default 10', default: 10 },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_api_reference',
        description:
          'Return the curated SvGrid public-API surface, grouped by category (components, headless, scheduler, data ops, export, row models, features, virtualization, accessibility, utilities).',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'check_svgrid_code',
        description:
          'Verify SvGrid code BEFORE handing it to the user. Checks the source against the real exported surface of the installed version - <SvGrid> prop names, ColumnDef keys, grid API methods, importable symbols and theme files - plus Svelte 5 runes rules, and compiles it with the Svelte compiler when one is reachable. Returns line-numbered diagnostics with the exact replacement for each. Run this on every .svelte or .ts file you write that uses SvGrid, then fix what it reports and run it again.',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'The full file contents to check.' },
            filename: {
              type: 'string',
              description:
                'File name, used to pick the rules that apply. Defaults to "Component.svelte". Use the real name when you have one (e.g. "src/routes/+page.svelte", "state.svelte.ts").',
            },
          },
          required: ['source'],
        },
      },
      {
        name: 'introspect_source',
        description:
          'SvGrid Studio (commercial): infer an EntitySchema from a data source. Pass a Drizzle schema file (kind:"drizzle", source: the file text) or sample rows (kind:"json", rows, name). Returns a DRAFT EntitySchema to review/refine before scaffolding code.',
        inputSchema: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: ['drizzle', 'json'], description: 'Source kind.' },
            source: {
              type: 'string',
              description:
                'For kind:"drizzle": the text of a schema file containing a pgTable / sqliteTable / mysqlTable definition.',
            },
            rows: {
              type: 'array',
              description: 'For kind:"json": a non-empty array of sample row objects.',
              items: { type: 'object' },
            },
            name: { type: 'string', description: 'Entity/table name (required for kind:"json").' },
          },
          required: ['kind'],
        },
      },
      {
        name: 'scaffold_entity',
        description:
          'SvGrid Studio (commercial): generate runnable SvelteKit files from an EntitySchema - the $lib schema module, a +server.ts API route (createKitHandlers), and a +page.svelte with SvGrid + SvGridEditPanel. Returns files as { path, contents, description }. AFTER writing the files, run the project\'s own svelte-check / tsc to verify they compile, and fix any errors. Generated bodies are wrapped in svgrid:managed markers so regeneration preserves edits outside them.',
        inputSchema: {
          type: 'object',
          properties: {
            schema: {
              type: 'object',
              description: 'The EntitySchema (from introspect_source, optionally edited).',
            },
            route: { type: 'string', description: 'Route segment. Defaults to schema.name.' },
            apiRoute: { type: 'string', description: 'API route. Defaults to /api/{route}.' },
          },
          required: ['schema'],
        },
      },
      // SvGrid Studio "drive the model" tools: build/edit the same validated project
      // model the visual designer uses, then generate the app or export the config.
      ...projectTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params

  // Project-model tools (studio_*) are handled by their own dispatcher.
  const projectResult = handleProjectTool(name, (args ?? {}) as Record<string, unknown>)
  if (projectResult) return projectResult

  switch (name) {
    // Returning all 375 demos cost ~31k tokens on the call this tool's own
    // description invites a model to start with. Filtered and capped instead,
    // and a bare call answers with the category index to drill into.
    case 'list_examples': {
      const a = (args ?? {}) as { query?: string; category?: string; limit?: number }
      const limit = Math.max(1, Math.min(100, Number(a.limit ?? 25)))
      const q = String(a.query ?? '').trim().toLowerCase()
      const category = String(a.category ?? '').trim().toLowerCase()

      const pool = examples.filter((e) => {
        if (category && e.category.toLowerCase() !== category) return false
        if (q && !`${e.id} ${e.title} ${e.blurb} ${e.category}`.toLowerCase().includes(q)) return false
        return true
      })
      const shown = pool.slice(0, limit)

      const body: Record<string, unknown> = {
        total: pool.length,
        shown: shown.length,
        examples: shown.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          blurb: trimBlurb(e.blurb),
        })),
      }
      if (!q && !category) body.categories = countBy(examples, (e) => e.category)
      if (shown.length < pool.length) {
        body.hint = `Showing ${shown.length} of ${pool.length}. Narrow with \`query\` or \`category\`, or raise \`limit\` (max 100).`
      }
      if (!pool.length) {
        body.hint = 'No match. Drop `category`, or try a broader `query`.'
      }
      return withDocs(JSON.stringify(body, null, 2))
    }

    case 'get_example_source': {
      const id = String((args as { id?: string })?.id ?? '')
      const match = examples.find((e) => e.id === id)
      if (!match) {
        return {
          isError: true,
          content: [{ type: 'text', text: `No example with id "${id}". Call list_examples for available ids.` }],
        }
      }
      return {
        content: [
          { type: 'text', text: `// ${match.path}\n// ${match.title} - ${match.blurb}\n\n${match.source}` },
        ],
      }
    }

    // Same shape as list_examples, for the same reason: all 370 pages was
    // ~12.7k tokens. `path` is dropped from the listing because it is always
    // "docs/<slug>.md" and get_doc takes the slug.
    case 'list_docs': {
      const a = (args ?? {}) as { query?: string; section?: string; limit?: number }
      const limit = Math.max(1, Math.min(100, Number(a.limit ?? 30)))
      const q = String(a.query ?? '').trim().toLowerCase()
      const section = String(a.section ?? '').trim().toLowerCase()

      const pool = docs.filter((d) => {
        if (section && d.section.toLowerCase() !== section) return false
        if (q && !`${d.slug} ${d.title} ${d.section}`.toLowerCase().includes(q)) return false
        return true
      })
      const shown = pool.slice(0, limit)

      const body: Record<string, unknown> = {
        total: pool.length,
        shown: shown.length,
        docs: shown.map((d) => ({ slug: d.slug, title: d.title, section: d.section })),
      }
      if (!q && !section) body.sections = countBy(docs, (d) => d.section)
      if (shown.length < pool.length) {
        body.hint = `Showing ${shown.length} of ${pool.length}. Narrow with \`query\` or \`section\`, raise \`limit\` (max 100), or use search_docs to search page content.`
      }
      if (!pool.length) {
        body.hint = 'No match. Drop `section`, or try search_docs to search page content instead of titles.'
      }
      return withDocs(JSON.stringify(body, null, 2))
    }

    case 'get_doc': {
      const slug = String((args as { slug?: string })?.slug ?? '')
      const match = docs.find((d) => d.slug === slug)
      if (!match) {
        return {
          isError: true,
          content: [{ type: 'text', text: `No doc with slug "${slug}". Call list_docs for available slugs.` }],
        }
      }
      return withDocs(match.markdown)
    }

    case 'search_docs': {
      const a = (args ?? {}) as { query?: string; limit?: number }
      const query = String(a.query ?? '').trim()
      const limit = Math.max(1, Math.min(50, Number(a.limit ?? 10)))
      if (!query) {
        return { isError: true, content: [{ type: 'text', text: 'query is required' }] }
      }
      // Ranking lives in ./search.ts so the remote server answers the same
      // query the same way.
      const { hits, total, partial } = rankDocs(docs, query, limit)
      return withDocs(
        JSON.stringify(
          { query, total, shown: hits.length, partial: partial || undefined, hits },
          null,
          2,
        ),
      )
    }

    case 'get_api_reference': {
      return withDocs(JSON.stringify(apiReference, null, 2))
    }

    case 'check_svgrid_code': {
      const a = (args ?? {}) as { source?: string; filename?: string }
      if (typeof a.source !== 'string' || !a.source.trim()) {
        return errText('source (the file contents to check) is required')
      }
      const result = await checkSvGridCode(a.source, apiSurface as ApiSurface, {
        filename: a.filename,
        compile: compileWithSvelte,
      })
      // No docs footer: this output is a work list, and a marketing line at the
      // end of it is noise the model has to read past on every iteration.
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
    }

    case 'introspect_source': {
      const a = (args ?? {}) as {
        kind?: string
        source?: string
        rows?: unknown[]
        name?: string
      }
      try {
        let schema: EntitySchema
        if (a.kind === 'drizzle') {
          if (!a.source) return errText('source is required for kind:"drizzle"')
          schema = introspectDrizzle(a.source)
        } else if (a.kind === 'json') {
          if (!Array.isArray(a.rows) || a.rows.length === 0) {
            return errText('rows (a non-empty array) is required for kind:"json"')
          }
          schema = introspectJson(a.name ?? 'entity', a.rows as Array<Record<string, unknown>>)
        } else {
          return errText('kind must be "drizzle" or "json"')
        }
        return { content: [{ type: 'text', text: studioNote() + JSON.stringify(schema, null, 2) }] }
      } catch (err) {
        return errText(err instanceof Error ? err.message : String(err))
      }
    }

    case 'scaffold_entity': {
      const a = (args ?? {}) as { schema?: EntitySchema; route?: string; apiRoute?: string }
      if (!a.schema || !Array.isArray(a.schema.fields) || a.schema.fields.length === 0) {
        return errText('schema (an EntitySchema with a non-empty fields array) is required')
      }
      try {
        const { files } = scaffold(a.schema, { route: a.route, apiRoute: a.apiRoute })
        // Verify loop: compile the generated .svelte before handing files back.
        const verify = await verifyScaffold(files)
        const header = `// ${summarizeVerify(verify)}\n// After writing these files, run the project's svelte-check / tsc and fix any errors.\n\n`
        return {
          content: [{ type: 'text', text: studioNote() + header + JSON.stringify({ files, verify }, null, 2) }],
        }
      } catch (err) {
        return errText(err instanceof Error ? err.message : String(err))
      }
    }

    default:
      return {
        isError: true,
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
      }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  // The MCP SDK keeps the process alive on the stdio transport, so we just
  // log a startup banner to stderr (stdout is reserved for the JSON-RPC
  // protocol) and let the SDK take over.
  process.stderr.write('@svgrid/mcp started on stdio\n')
}

main().catch((err) => {
  process.stderr.write(`@svgrid/mcp fatal: ${err?.stack ?? err}\n`)
  process.exit(1)
})
