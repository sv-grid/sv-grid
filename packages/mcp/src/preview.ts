/**
 * A live, interactive grid rendered inside the conversation.
 *
 * Every other tool here hands the model TEXT and asks a person to imagine the
 * result. This renders the real grid - sortable, filterable, scrollable - in
 * the client, using MCP Apps, the official UI extension: a tool points at a
 * `ui://` resource through `_meta`, the client loads that HTML in a sandboxed
 * iframe, and the tool's `structuredContent` arrives over a postMessage bridge.
 *
 * It is the same custom element a real page would use, from the published
 * package on a CDN - not a screenshot, not a mock table. What you see is what
 * `<sv-grid>` does with those columns.
 *
 * Progressive enhancement is the rule the extension is built around: clients
 * without MCP Apps ignore the `_meta` and still get the text summary, which is
 * why the text half has to stand on its own rather than say "see the preview".
 */
import { examples } from './data.js'

/** MCP Apps constants, inlined rather than depending on the extension SDK server-side. */
export const UI_MIME_TYPE = 'text/html;profile=mcp-app'
export const UI_RESOURCE_URI = 'ui://svgrid/preview.html'
const UI_RESOURCE_META_KEY = 'ui/resourceUri'

/**
 * The published versions the preview loads from the CDN.
 *
 * Pinned, not `@latest`: a preview that silently follows a future major would
 * start failing in a way nobody is watching for. `tools/mcp-tools.test.ts` checks these
 * against the workspace so they cannot quietly rot either.
 */
export const PREVIEW_GRID_WC_VERSION = '3.0.0'
const EXT_APPS_VERSION = '1.7.5'
const CDN = 'https://cdn.jsdelivr.net/npm'

/**
 * The UI itself.
 *
 * Deliberately small and dependency-light: two module imports, one element, no
 * framework. The iframe is sandboxed and the client enforces the CSP declared
 * beside this resource, so anything else would just be blocked.
 */
const PREVIEW_HTML = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>SvGrid preview</title>
    <style>
      html, body { margin: 0; height: 100%; font: 13px system-ui, sans-serif; }
      #root { display: flex; flex-direction: column; height: 100%; min-height: 0; }
      #note { padding: 8px 12px; color: #64748b; }
      #host { flex: 1; min-width: 0; min-height: 0; }
      sv-grid { display: block; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root">
      <div id="note">Loading the grid…</div>
      <div id="host"></div>
    </div>
    <script type="module">
      import { App } from '${CDN}/@modelcontextprotocol/ext-apps@${EXT_APPS_VERSION}/dist/src/app-with-deps.js'
      import '${CDN}/@svgrid/grid-wc@${PREVIEW_GRID_WC_VERSION}/dist/sv-grid-element.js'

      const note = document.getElementById('note')
      const host = document.getElementById('host')

      function render(payload) {
        const { columns, data, title, ...rest } = payload ?? {}
        if (!Array.isArray(columns) || !Array.isArray(data)) {
          note.textContent = 'No grid data arrived from the tool.'
          return
        }
        host.replaceChildren()
        const el = document.createElement('sv-grid')
        el.data = data
        el.columns = columns
        // Whatever else the tool passed - sortable, filterable, pageable,
        // groupBy - goes straight through as a property, exactly as a host page
        // would set it. Arrays and objects cannot cross as attributes, which is
        // the whole reason the element takes properties.
        for (const [key, value] of Object.entries(rest)) {
          if (value !== undefined) el[key] = value
        }
        host.appendChild(el)
        note.textContent = title
          ? title + ' - ' + data.length + ' rows'
          : data.length + ' rows, ' + columns.length + ' columns'
      }

      try {
        const app = new App()
        app.ontoolresult = (params) => render(params?.structuredContent)
        await app.connect()
      } catch (err) {
        note.textContent = 'Preview bridge unavailable: ' + (err && err.message ? err.message : err)
      }
    </script>
  </body>
</html>
`

export function previewResource() {
  return {
    uri: UI_RESOURCE_URI,
    name: 'SvGrid preview',
    title: 'SvGrid preview',
    description: 'A live, interactive SvGrid rendered from the data a tool returns.',
    mimeType: UI_MIME_TYPE,
    _meta: {
      // The iframe is offline-hostile by default; these are the only two
      // origins it needs, and they are the ones the HTML imports from.
      'ui/csp': { resourceDomains: [CDN.replace('https://', '').split('/')[0]] },
      'ui/prefersBorder': true,
    },
  }
}

export function readPreviewResource(uri: string) {
  if (uri !== UI_RESOURCE_URI) return undefined
  return { contents: [{ uri, mimeType: UI_MIME_TYPE, text: PREVIEW_HTML }] }
}

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

type ToolResult = {
  isError?: boolean
  content: { type: 'text'; text: string }[]
  structuredContent?: Record<string, unknown>
  _meta?: Record<string, unknown>
}

const fail = (message: string): ToolResult => ({
  isError: true,
  content: [{ type: 'text', text: message }],
})

export function handlePreview(args: Record<string, unknown>): ToolResult {
  const demoId = typeof args.demo === 'string' ? args.demo.trim() : ''
  if (demoId) {
    const demo = examples.find((e) => e.id === demoId)
    if (!demo) {
      return fail(`No demo with id "${demoId}". Use svgrid_search to find one.`)
    }
    // A demo is a Svelte component, not data: there is nothing to hand the
    // element. Return the source and say so, rather than rendering an empty
    // grid and letting it look like the demo is broken.
    return {
      content: [
        {
          type: 'text',
          text:
            `// ${demo.path}\n// ${demo.title} - ${demo.blurb}\n` +
            `//\n// Demos are Svelte components, so this is the source rather than a live\n` +
            `// render. To preview a grid interactively, pass \`columns\` and \`data\`.\n\n` +
            demo.source,
        },
      ],
    }
  }

  const columns = args.columns
  const data = args.data
  if (!Array.isArray(columns) || !columns.length) {
    return fail('columns is required: an array of column definitions, or pass `demo` for a shipped example.')
  }
  if (!Array.isArray(data)) {
    return fail('data is required: an array of rows.')
  }

  // A preview is a picture, not a dataset. `structuredContent` crosses into the
  // conversation, so an unbounded `data` would put the caller's whole table in
  // the context window - 200 rows is already ~2,900 tokens. Cap it and say so,
  // rather than quietly rendering a truncated grid that looks complete.
  const MAX_ROWS = 100
  const shown = data.slice(0, MAX_ROWS)
  const truncated = data.length > shown.length

  const payload: Record<string, unknown> = { columns, data: shown }
  for (const key of ['title', 'sortable', 'filterable', 'pageable', 'groupBy'] as const) {
    if (args[key] !== undefined) payload[key] = args[key]
  }

  // The text half has to stand alone: a client without UI support shows only
  // this, and "see the preview above" would be nonsense there.
  const headers = columns
    .map((c) => (c as { header?: string; field?: string }).header ?? (c as { field?: string }).field ?? '?')
    .join(', ')
  const summary =
    `SvGrid preview: ${shown.length} row${shown.length === 1 ? '' : 's'} x ${columns.length} column${columns.length === 1 ? '' : 's'}` +
    (typeof args.title === 'string' && args.title ? ` - ${args.title}` : '') +
    `\nColumns: ${headers}` +
    (truncated ? `\nShowing the first ${MAX_ROWS} of ${data.length} rows - a preview is a picture, not the dataset.` : '') +
    `\n\nIn a client with MCP Apps support this renders as a live, interactive grid.`

  return {
    content: [{ type: 'text', text: summary }],
    // What the UI reads. Kept separate from the text so the model is not made
    // to re-read the whole dataset it just sent.
    structuredContent: payload,
    _meta: { [UI_RESOURCE_META_KEY]: UI_RESOURCE_URI },
  }
}
