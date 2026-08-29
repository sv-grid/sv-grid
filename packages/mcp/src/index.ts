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

function occurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let n = 0
  let i = haystack.indexOf(needle)
  while (i !== -1) {
    n += 1
    i = haystack.indexOf(needle, i + needle.length)
  }
  return n
}

/** Split a query into distinct lowercase terms, dropping one-character noise. */
function queryTokens(query: string): string[] {
  const tokens = [...new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1))]
  return tokens.length ? tokens : [query.toLowerCase().trim()]
}

/** A window of text around the first needle that appears, for search results. */
function excerptAround(markdown: string, needles: string[]): string {
  const lower = markdown.toLowerCase()
  let idx = -1
  for (const n of needles) {
    idx = lower.indexOf(n)
    if (idx >= 0) break
  }
  if (idx < 0) idx = 0
  const start = Math.max(0, idx - 60)
  const end = Math.min(markdown.length, idx + 180)
  return markdown.slice(start, end).replace(/\s+/g, ' ').trim()
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
    // Returning all 373 demos cost ~31k tokens on the call this tool's own
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
      // Previously this matched the query only as one contiguous substring and
      // returned hits in directory order, so the canonical page for a topic
      // routinely lost to an incidental mention. Score per doc, rank, and treat
      // the query as terms so word order and joining words stop mattering.
      const phrase = query.toLowerCase()
      const tokens = queryTokens(query)

      const scored: { d: (typeof docs)[number]; score: number; complete: boolean }[] = []
      for (const d of docs) {
        const title = d.title.toLowerCase()
        const markdown = d.markdown.toLowerCase()
        const headings = (d.markdown.match(/^#{1,6}\s+.*$/gm) ?? []).join('\n').toLowerCase()
        // "help/rows/kanban-board" -> "help rows kanban board". The slug is the
        // strongest canonical signal there is: a page named after the topic is
        // the reference page for it, where a recipe merely mentioning it is not.
        const slugWords = d.slug.toLowerCase().replace(/[/-]/g, ' ')

        let score = 0
        // Whole-phrase hits are the strongest signal, title strongest of all.
        if (title.includes(phrase)) score += 100
        if (slugWords.includes(phrase)) score += 60
        if (headings.includes(phrase)) score += 30
        if (markdown.includes(phrase)) score += 20

        let matched = 0
        for (const t of tokens) {
          const inTitle = title.includes(t)
          const inHeading = headings.includes(t)
          const count = occurrences(markdown, t)
          if (inTitle || inHeading || count > 0) matched += 1
          if (inTitle) score += 25
          if (slugWords.includes(t)) score += 10
          if (inHeading) score += 8
          // Capped so a long page cannot outrank a precise one on bulk alone.
          score += Math.min(count, 5)
        }
        if (score > 0) scored.push({ d, score, complete: matched === tokens.length })
      }

      // Prefer pages containing every term; fall back to partial matches only
      // when nothing covers the whole query.
      const complete = scored.filter((s) => s.complete)
      const ranked = (complete.length ? complete : scored)
        .sort((a, b) => b.score - a.score || a.d.slug.localeCompare(b.d.slug))
        .slice(0, limit)

      const hits = ranked.map((s) => ({
        slug: s.d.slug,
        title: s.d.title,
        section: s.d.section,
        score: s.score,
        excerpt: excerptAround(s.d.markdown, [phrase, ...tokens]),
      }))
      const matchedTotal = complete.length || scored.length
      return withDocs(
        JSON.stringify(
          {
            query,
            total: matchedTotal,
            shown: hits.length,
            partial: complete.length === 0 && scored.length > 0 ? true : undefined,
            hits,
          },
          null,
          2,
        ),
      )
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
