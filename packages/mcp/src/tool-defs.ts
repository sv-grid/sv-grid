/**
 * The tool definitions `tools/list` returns, kept free of the corpus.
 *
 * `core-tools.ts` and `preview.ts` read `data.js` (about 12 MB), whose first
 * load after install took seconds. Defining the tools here lets the server
 * list them without loading it; the handlers stay in those modules, which
 * re-export these for existing imports.
 */

/**
 * The `instructions` both servers send in `initialize`. A client puts this in
 * front of the model on every turn, which no tool description gets, so it
 * carries the two habits that decide whether the code works: look the API up,
 * then check the file. The tool names differ between the npm server and the
 * hosted one (`search` and `fetch` are fixed names there), hence the argument.
 */
export function serverInstructions(names: { search: string; get: string; check: string }): string {
  return [
    'SvGrid is a Svelte 5 data grid (@svgrid/grid, MIT; @svgrid/enterprise adds export, import, pivot, print, Kanban, scheduler and spreadsheet).',
    'Svelte 5 only: runes ($state, $derived, $props) and snippets, callback props such as onCellClick, never `export let`, `on:` directives or stores.',
    `Before writing grid code, call ${names.search} for the feature and ${names.get} for the page or demo it returns, so prop and option names come from this version rather than from memory.`,
    `Run ${names.check} on every file you write that uses SvGrid, before showing it to the user, and use its \`fixed\` copy when it returns one.`,
  ].join(' ')
}

export const UI_RESOURCE_URI = 'ui://svgrid/preview.html'
export const UI_RESOURCE_META_KEY = 'ui/resourceUri'

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
            'A doc slug, a demo id, "api", or a schema id such as "chart-spec" (or "chart spec schema"). The kind is inferred; pass `kind` to force it.',
        },
        kind: {
          type: 'string',
          enum: ['auto', 'doc', 'example', 'api', 'schema'],
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

export const PREVIEW_TOOL = {
  name: 'svgrid_preview',
  title: 'Preview a grid',
  description:
    'Render a REAL, interactive SvGrid in the conversation - sortable, filterable, scrollable - from columns and rows you pass, or from a demo id. Use it to show the user what a grid will look like before they build it, and after svgrid_check_code to demonstrate the result. In clients without UI support it returns a text summary instead, so it is always safe to call.',
  inputSchema: {
    type: 'object',
    properties: {
      columns: {
        type: 'array',
        description:
          'Column definitions, e.g. [{ "field": "name", "header": "Name", "width": 160 }]. Required unless `demo` is set.',
      },
      data: {
        type: 'array',
        description: 'Rows to display. Required unless `demo` is set. Keep it under a few hundred for a preview.',
      },
      demo: {
        type: 'string',
        description:
          'Preview a shipped demo instead, by id (e.g. "11-stock-market"). Its source is returned as text; find ids with svgrid_search.',
      },
      title: { type: 'string', description: 'Caption shown above the grid.' },
      sortable: { type: 'boolean', description: 'Sortable headers. Default true.' },
      filterable: { type: 'boolean', description: 'Filtering. Default true.' },
      pageable: { type: 'boolean', description: 'Pagination footer.' },
      groupBy: { type: 'array', description: 'Group by these column ids.' },
    },
    required: [],
  },
  _meta: { [UI_RESOURCE_META_KEY]: UI_RESOURCE_URI },
}
