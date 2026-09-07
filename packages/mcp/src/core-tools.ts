/**
 * The always-on tools: find SvGrid information, read it, verify code against it.
 *
 * These four replace nine. The nine were one-per-endpoint - `list_examples`,
 * `get_example_source`, `list_docs`, `get_doc`, `search_docs`,
 * `get_api_reference` - which is the shape you get from wrapping an API rather
 * than a workflow. An agent looking for "how do I pin a column" had to guess
 * whether that lived in docs, in a demo, or in the API surface, and usually
 * paid two or three calls to find out.
 *
 * `svgrid_search` answers that question in one call across all three corpora,
 * and returns enough that `svgrid_get` is often unnecessary. Every listing
 * response is capped and paged, because returning all 375 examples cost ~31k
 * tokens on the call the old description invited a model to start with.
 */
import { apiReference, apiSurface, docs, examples } from './data.js'
import { meaningfulTerms, rankDocs } from './search.js'

export type ToolResult = {
  isError?: boolean
  content: { type: 'text'; text: string }[]
}

const DOCS_FOOTER = '\n\nSvGrid reference: full docs & 375 live demos at https://svgrid.com/docs'

const text = (body: string): ToolResult => ({ content: [{ type: 'text', text: body }] })
const withDocs = (body: string): ToolResult => text(body + DOCS_FOOTER)
const fail = (message: string): ToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
})
const json = (body: unknown) => JSON.stringify(body, null, 2)

function trimBlurb(value: string, max = 120): string {
  const flat = value.replace(/\s+/g, ' ').trim()
  return flat.length <= max ? flat : flat.slice(0, max - 1).trimEnd() + '…'
}

function countBy<T>(rows: readonly T[], key: (row: T) => string): Record<string, number> {
  const out: Record<string, number> = {}
  for (const row of rows) {
    const k = key(row)
    out[k] = (out[k] ?? 0) + 1
  }
  return out
}

/**
 * Every API name, flattened once and deduplicated by name.
 *
 * A name can legitimately appear in more than one place - `columns` is both a
 * `<SvGrid>` prop and a column option - and listing it twice wasted a result
 * slot and made the output read like a bug. Merged into one entry that names
 * every place it lives, which is more useful than either row alone.
 */
const apiNames: { name: string; group: string }[] = (() => {
  const merged = new Map<string, Set<string>>()
  const add = (name: string, group: string) => {
    const groups = merged.get(name) ?? new Set<string>()
    groups.add(group)
    merged.set(name, groups)
  }
  for (const [group, names] of Object.entries(apiReference))
    for (const name of names as readonly string[]) add(name, group)
  for (const p of apiSurface.props) add(p.name, 'SvGrid prop')
  for (const c of apiSurface.columnDef) add(c.name, 'column option')
  for (const m of apiSurface.apiMethods) add(m, 'grid api method')
  return [...merged].map(([name, groups]) => ({ name, group: [...groups].join(', ') }))
})()

export const CORE_TOOLS = [
  {
    name: 'svgrid_search',
    title: 'Search SvGrid',
    description:
      'Search SvGrid docs, example demos and the API surface in ONE call. Start here for any "how do I ..." question - it covers all three, so you do not have to guess which one holds the answer. Call with no arguments for an index of doc sections, demo categories and API groups. Returns ids/slugs you can pass to svgrid_get.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'What you are trying to do, e.g. "pin a column", "server side pagination", "kanban swimlanes". Omit for the index.',
        },
        kind: {
          type: 'string',
          enum: ['all', 'docs', 'examples', 'api'],
          description: 'Restrict the search. Default "all".',
          default: 'all',
        },
        detail: {
          type: 'string',
          enum: ['concise', 'full'],
          description:
            '"concise" (default) returns titles plus a short excerpt. "full" returns the matching doc excerpts at length - more tokens, fewer follow-up calls.',
          default: 'concise',
        },
        section: {
          type: 'string',
          description:
            'Restrict docs to one section, exactly, e.g. "Help". Call with no arguments to see the sections.',
        },
        category: {
          type: 'string',
          description:
            'Restrict demos to one category, exactly, e.g. "Kanban". Call with no arguments to see the categories.',
        },
        limit: { type: 'number', description: 'Max results per corpus. Default 10, max 50.', default: 10 },
      },
      required: [],
    },
  },
  {
    name: 'svgrid_get',
    title: 'Read a doc or demo',
    description:
      'Fetch one thing in full by reference: a doc slug ("help/columns/column-definitions"), a demo id ("11-stock-market"), or "api" for the curated API reference. Use svgrid_search first to find the reference.',
    inputSchema: {
      type: 'object',
      properties: {
        ref: {
          type: 'string',
          description:
            'A doc slug, a demo id, or "api". The kind is inferred; pass `kind` to force it.',
        },
        kind: {
          type: 'string',
          enum: ['auto', 'doc', 'example', 'api'],
          description: 'Override the inferred kind. Default "auto".',
          default: 'auto',
        },
        detail: {
          type: 'string',
          enum: ['concise', 'full'],
          description: '"full" (default) returns the whole thing; "concise" truncates long content.',
          default: 'full',
        },
      },
      required: ['ref'],
    },
  },
] as const

/** Rank examples by a term match over id/title/blurb, optionally within a category. */
function searchExamples(query: string, limit: number, category: string) {
  const pool = category
    ? examples.filter((e) => e.category.toLowerCase() === category.toLowerCase())
    : examples

  const terms = meaningfulTerms(query)
  if (!terms.length) {
    // No query at all is a browse - list the category. A query that reduces to
    // nothing usable ("how do I") is NOT a browse: returning the first ten
    // demos would look like an answer and be pure coincidence.
    return query ? { total: 0, hits: [] } : { total: pool.length, hits: pool.slice(0, limit) }
  }

  // Rank by how much of the query a demo matches, rather than demanding all of
  // it. Requiring every term looked precise and quietly returned NOTHING for
  // "how do I sort by two columns" - no demo contains "two". A title match
  // still outweighs a passing mention, so "kanban board" stays on
  // 343-kanban-board rather than drifting to whatever mentions boards.
  const scored = pool
    .map((e) => {
      const title = `${e.id} ${e.title}`.toLowerCase()
      const hay = `${title} ${e.blurb} ${e.category}`.toLowerCase()
      const inTitle = terms.filter((t) => title.includes(t)).length
      const anywhere = terms.filter((t) => hay.includes(t)).length
      if (!anywhere) return null
      return { e, score: inTitle * 10 + anywhere }
    })
    .filter((x): x is { e: (typeof examples)[number]; score: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.e.id.localeCompare(b.e.id))
  return { total: scored.length, hits: scored.slice(0, limit).map((x) => x.e) }
}

function searchApi(query: string, limit: number) {
  const terms = meaningfulTerms(query)
  if (!terms.length) return { total: 0, hits: [] as typeof apiNames }

  // Ranked, not just filtered: an exact name beats a prefix, which beats a
  // substring, and matching more of the query beats matching less of it.
  const scored = apiNames
    .map((a) => {
      const name = a.name.toLowerCase()
      let score = 0
      for (const t of terms) {
        if (name === t) score += 100
        else if (name.startsWith(t)) score += 10
        else if (name.includes(t)) score += 3
      }
      return score > 0 ? { a, score } : null
    })
    .filter((x): x is { a: (typeof apiNames)[number]; score: number } => x !== null)
    .sort((x, y) => y.score - x.score || x.a.name.length - y.a.name.length)

  return { total: scored.length, hits: scored.slice(0, limit).map((x) => x.a) }
}

export function handleCoreTool(name: string, args: Record<string, unknown>): ToolResult | undefined {
  if (name === 'svgrid_search') return search(args)
  if (name === 'svgrid_get') return get(args)
  return undefined
}

function search(args: Record<string, unknown>): ToolResult {
  const query = String(args.query ?? '').trim()
  const kind = String(args.kind ?? 'all')
  const detail = String(args.detail ?? 'concise')
  const section = String(args.section ?? '').trim()
  const category = String(args.category ?? '').trim()
  const rawLimit = Number(args.limit)
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(50, Math.floor(rawLimit)) : 10

  // A bare call is an index request, not an error. It is the cheapest way for
  // a model to orient itself, and it costs a fraction of listing everything.
  // A section or category with no query is a legitimate browse, so only a
  // completely bare call is an index request.
  if (!query && !section && !category) {
    return withDocs(
      json({
        docSections: countBy(docs, (d) => d.section),
        exampleCategories: countBy(examples, (e) => e.category),
        apiGroups: Object.fromEntries(
          Object.entries(apiReference).map(([g, names]) => [g, (names as readonly string[]).length]),
        ),
        totals: { docs: docs.length, examples: examples.length, apiNames: apiNames.length },
        hint: 'Pass `query` to search. Then svgrid_get with a doc slug, a demo id, or "api".',
      }),
    )
  }

  const body: Record<string, unknown> = { query }
  if (section) body.section = section
  if (category) body.category = category

  if (kind === 'all' || kind === 'docs') {
    const pool = section
      ? docs.filter((d) => d.section.toLowerCase() === section.toLowerCase())
      : docs
    // An exact section with no query is a browse: list the section rather than
    // running a search for the empty string.
    const ranked = query
      ? rankDocs(pool, query, limit)
      : {
          hits: pool.slice(0, limit).map((d) => ({ slug: d.slug, title: d.title, section: d.section })),
          total: pool.length,
          partial: false,
        }

    // `partial` means NO page matched all the terms - these are pages that
    // matched some. `rankDocs` has always computed it and this tool used to
    // throw it away, so "kubernetes ingress controller" came back as 36
    // confident-looking doc hits (matching only "controller") with nothing to
    // say they were loose. Plausible noise reads like an answer, and a model
    // will cite it.
    //
    // Surfaced, and trimmed: a partial match is a lead, not a result set.
    const partial = 'partial' in ranked && ranked.partial === true
    const shown = partial ? ranked.hits.slice(0, 3) : ranked.hits

    body.docs = {
      total: ranked.total,
      partial: partial || undefined,
      hits: shown.map((h: Record<string, unknown>) =>
        detail === 'full' ? h : { ...h, excerpt: trimBlurb(String(h.excerpt ?? ''), 200) },
      ),
    }
    if (partial) {
      body.hint = `No page matched all of "${query}". These matched some of it - treat them as leads, not answers.`
    }
    if (section && !pool.length) {
      body.hint = `No section "${section}". Call with no arguments to see the sections.`
    }
  }

  if (kind === 'all' || kind === 'examples') {
    const { hits, total } = searchExamples(query, limit, category)
    body.examples = {
      total,
      hits: hits.map((e) => ({
        id: e.id,
        title: e.title,
        category: e.category,
        blurb: detail === 'full' ? e.blurb : trimBlurb(e.blurb),
      })),
    }
  }

  if (kind === 'all' || kind === 'api') {
    const { hits, total } = searchApi(query, limit)
    body.api = { total, hits }
  }

  const empty =
    !(body.docs as { total?: number })?.total &&
    !(body.examples as { total?: number })?.total &&
    !(body.api as { total?: number })?.total

  if (!empty) {
    // A partial-match warning outranks the generic next-step hint: it is the
    // one thing the caller must not miss, and it is set above.
    const docs = body.docs as { partial?: boolean } | undefined
    if (!docs?.partial) {
      body.hint = 'Pass a doc slug, demo id, or "api" to svgrid_get for the full text.'
    }
    return withDocs(json(body))
  }

  // Say WHICH input was wrong, and what the valid values are. "Try fewer terms"
  // is useless advice when the caller passed no terms at all - it sends a model
  // round the same loop instead of correcting the one thing it got wrong.
  const knownSections = Object.keys(countBy(docs, (d) => d.section))
  const knownCategories = Object.keys(countBy(examples, (e) => e.category))
  const badSection = section && !knownSections.some((s) => s.toLowerCase() === section.toLowerCase())
  const badCategory =
    category && !knownCategories.some((c) => c.toLowerCase() === category.toLowerCase())

  if (badSection) {
    body.hint = `No doc section "${section}". Sections: ${knownSections.join(', ')}.`
  } else if (badCategory) {
    body.hint = `No demo category "${category}". Categories: ${knownCategories.join(', ')}.`
  } else if (!query) {
    body.hint = 'That filter matched nothing. Call with no arguments to see what exists.'
  } else {
    const usable = meaningfulTerms(query)
    body.hint = usable.length
      ? `Nothing matched all of: ${usable.join(', ')}. Every term must appear - try fewer, or more general ones.`
      : `"${query}" has no terms specific enough to search on. Use a feature or API name, e.g. "pinned columns".`
  }
  return withDocs(json(body))
}

const MAX_CONCISE = 4000
/**
 * Hard ceiling on any single response, ~20k tokens.
 *
 * `detail:"full"` had no cap at all, so `svgrid_get` on the largest demo
 * returned 51,549 chars - about 12,900 tokens - and nothing stopped a bigger
 * one from being added tomorrow. A tool that can silently eat a fifth of the
 * context window is a tool an agent learns to avoid.
 */
const MAX_RESPONSE = 80_000

/** Truncate on a line boundary: cutting mid-token leaves `ret` and a puzzle. */
function truncate(body: string, max: number, hint: string): string {
  if (body.length <= max) return body
  const cut = body.slice(0, max)
  const lastBreak = cut.lastIndexOf('\n')
  const kept = lastBreak > max * 0.8 ? cut.slice(0, lastBreak) : cut
  return `${kept}\n\n… truncated at ${kept.length} of ${body.length} chars. ${hint}`
}

function get(args: Record<string, unknown>): ToolResult {
  const ref = String(args.ref ?? '').trim()
  const kind = String(args.kind ?? 'auto')
  const detail = String(args.detail ?? 'full')
  if (!ref) return fail('ref is required: a doc slug, a demo id, or "api".')

  const clip = (body: string) =>
    detail === 'concise'
      ? truncate(body, MAX_CONCISE, 'Call again with detail:"full" for the rest.')
      : truncate(body, MAX_RESPONSE, 'This is the whole of what fits in one response.')

  if (kind === 'api' || (kind === 'auto' && /^api(:|$)/.test(ref))) {
    const group = ref.includes(':') ? ref.split(':')[1] : ''
    if (group) {
      const names = (apiReference as Record<string, readonly string[]>)[group]
      if (!names) {
        return fail(
          `No API group "${group}". Available: ${Object.keys(apiReference).join(', ')}.`,
        )
      }
      return withDocs(json({ group, names }))
    }
    return withDocs(json(apiReference))
  }

  if (kind === 'doc' || kind === 'auto') {
    const doc = docs.find((d) => d.slug === ref)
    if (doc) return withDocs(clip(doc.markdown))
    if (kind === 'doc') {
      return fail(`No doc with slug "${ref}". Use svgrid_search to find one.`)
    }
  }

  const example = examples.find((e) => e.id === ref)
  if (example) {
    return text(clip(`// ${example.path}\n// ${example.title} - ${example.blurb}\n\n${example.source}`))
  }

  // A miss is a chance to point somewhere useful rather than just say no.
  const near = [
    ...docs.filter((d) => d.slug.includes(ref)).slice(0, 3).map((d) => d.slug),
    ...examples.filter((e) => e.id.includes(ref)).slice(0, 3).map((e) => e.id),
  ]
  return fail(
    `No doc, demo or API group matches "${ref}".` +
      (near.length ? ` Did you mean: ${near.join(', ')}?` : ' Call svgrid_search to find one.'),
  )
}
