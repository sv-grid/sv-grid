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

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { apiReference, docs, examples } from './data.js'

const server = new Server(
  {
    name: '@svgrid/mcp',
    version: '0.1.0',
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
          'Return the curated SvGrid public-API surface, grouped by category (components, headless, row models, features, virtualization, accessibility, utilities).',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params

  switch (name) {
    case 'list_examples': {
      const items = examples.map((e) => ({ id: e.id, title: e.title, blurb: e.blurb, path: e.path }))
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
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
      return { content: [{ type: 'text', text: JSON.stringify(items, null, 2) }] }
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
      return { content: [{ type: 'text', text: match.markdown }] }
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
      return {
        content: [{ type: 'text', text: JSON.stringify({ query, total: hits.length, hits }, null, 2) }],
      }
    }

    case 'get_api_reference': {
      return { content: [{ type: 'text', text: JSON.stringify(apiReference, null, 2) }] }
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
