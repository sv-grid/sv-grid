/**
 * The docs and demo corpus as MCP resources.
 *
 * A resource is content the CLIENT can pull in and attach - the user picks it,
 * rather than the model having to think of a tool call. That is the right shape
 * for a fixed corpus of 408 pages and 375 demos, and it is the half of MCP this
 * server never implemented: it advertised `{"tools":{}}` and answered
 * `resources/list` with "Method not found".
 *
 * Listed lazily and by reference. `resources/list` returns names and URIs only,
 * never content, so the listing stays cheap however large the corpus grows -
 * the same reason the tools cap their listings.
 */
import { docs, examples } from './data.js'
import { previewResource } from './preview.js'

export type Resource = {
  uri: string
  name: string
  title?: string
  description?: string
  mimeType: string
}

/** `svgrid://doc/help/columns/x` and `svgrid://example/11-stock-market`. */
function allResources(): Resource[] {
  return [
    // The preview UI belongs in the list, not bolted on beside it: prepending
    // it to page one made that page 101 items, one over the page size, which is
    // exactly the kind of off-by-one a paginating client trips on.
    previewResource(),
    ...docs.map((d) => ({
      uri: `svgrid://doc/${d.slug}`,
      name: d.slug,
      title: d.title,
      description: `${d.section} - SvGrid documentation`,
      mimeType: 'text/markdown',
    })),
    ...examples.map((e) => ({
      uri: `svgrid://example/${e.id}`,
      name: e.id,
      title: e.title,
      description: `${e.category} - runnable SvGrid demo`,
      mimeType: 'text/x-svelte',
    })),
  ]
}

/**
 * One page of resources.
 *
 * 783 resources in a single response is 147,604 chars - about 36,900 tokens,
 * which is worse than the 36-tool listing this redesign set out to fix, and it
 * lands in the client the moment anything enumerates resources. The protocol
 * has cursor pagination for exactly this; the first version here did not use
 * it, which is the sort of thing you only notice by measuring the payload.
 *
 * The cursor is just the offset. It is opaque to the client by contract, so
 * there is no need for it to be anything cleverer, but it IS validated - a
 * malformed cursor restarts from the beginning rather than throwing.
 */
const PAGE_SIZE = 100

export function listResources(cursor?: string): { resources: Resource[]; nextCursor?: string } {
  const all = allResources()
  const start = Number.isSafeInteger(Number(cursor)) && Number(cursor) > 0 ? Number(cursor) : 0
  const page = all.slice(start, start + PAGE_SIZE)
  const next = start + PAGE_SIZE
  return next < all.length ? { resources: page, nextCursor: String(next) } : { resources: page }
}

export type ResourceContents = {
  contents: { uri: string; mimeType: string; text: string }[]
}

export function readResource(uri: string): ResourceContents | undefined {
  const doc = /^svgrid:\/\/doc\/(.+)$/.exec(uri)
  if (doc) {
    const match = docs.find((d) => d.slug === doc[1])
    if (!match) return undefined
    return { contents: [{ uri, mimeType: 'text/markdown', text: match.markdown }] }
  }

  const example = /^svgrid:\/\/example\/(.+)$/.exec(uri)
  if (example) {
    const match = examples.find((e) => e.id === example[1])
    if (!match) return undefined
    return {
      contents: [
        {
          uri,
          mimeType: 'text/x-svelte',
          text: `// ${match.path}\n// ${match.title} - ${match.blurb}\n\n${match.source}`,
        },
      ],
    }
  }

  return undefined
}
