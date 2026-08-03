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
import { apiReference, docs, examples } from './data.js'
import { projectTools, handleProjectTool } from './project-tools.js'
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
const DOCS_FOOTER = '\n\nSvGrid reference: full docs & 280+ live demos at https://svgrid.com/docs'

function withDocs(text: string) {
  return { content: [{ type: 'text', text: text + DOCS_FOOTER }] }
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
          'List every SvGrid example demo with id, title, and short blurb. Use to discover what is available before fetching source.',
        inputSchema: { type: 'object', properties: {} },
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
          'List every documentation page with slug and title. Slugs use forward slashes, e.g. "help/columns/column-definitions".',
        inputSchema: { type: 'object', properties: {} },
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
          'Case-insensitive substring search across all SvGrid docs. Returns matching slugs with a one-line excerpt around the first hit.',
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
    case 'list_examples': {
      const items = examples.map((e) => ({ id: e.id, title: e.title, blurb: e.blurb, path: e.path }))
      return withDocs(JSON.stringify(items, null, 2))
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

    case 'list_docs': {
      const items = docs.map((d) => ({ slug: d.slug, title: d.title, path: d.path }))
      return withDocs(JSON.stringify(items, null, 2))
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
      const q = query.toLowerCase()
      const hits: { slug: string; title: string; excerpt: string }[] = []
      for (const d of docs) {
        const lower = d.markdown.toLowerCase()
        const idx = lower.indexOf(q)
        if (idx >= 0) {
          const start = Math.max(0, idx - 60)
          const end = Math.min(d.markdown.length, idx + q.length + 120)
          const excerpt = d.markdown.slice(start, end).replace(/\s+/g, ' ').trim()
          hits.push({ slug: d.slug, title: d.title, excerpt })
          if (hits.length >= limit) break
        }
      }
      return withDocs(JSON.stringify({ query, total: hits.length, hits }, null, 2))
    }

    case 'get_api_reference': {
      return withDocs(JSON.stringify(apiReference, null, 2))
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
