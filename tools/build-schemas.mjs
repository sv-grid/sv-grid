#!/usr/bin/env node
/**
 * Emit JSON Schemas for the public TypeScript types so AI agents, IDEs,
 * and validators can ground themselves against the same surface
 * consumers see:
 *
 *   docs/schemas/column-def.json       — one column entry on `columns={...}`
 *   docs/schemas/svgrid-options.json   — `<SvGrid>` prop bag + headless options
 *   docs/schemas/exportoptions.json    — `api.exportData({...})` argument
 *   docs/schemas/index.json            — manifest listing every schema
 *
 * Hand-written rather than generated through ts-json-schema-generator
 * because the TS types are heavily generic (`ColumnDef<TFeatures, TData>`)
 * and the schemas should describe the runtime surface, not the type
 * parameters. Each schema's `$comment` points back to the .ts source so
 * a reviewer can diff for drift.
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const SCHEMAS_DIR = join(process.cwd(), 'docs', 'schemas')
const BASE_URI    = 'https://svgrid.dev/schemas'

function schema(id, body) {
  return {
    $schema:    'https://json-schema.org/draft/2020-12/schema',
    $id:        `${BASE_URI}/${id}.json`,
    ...body,
  }
}

// ---- ColumnDef ----------------------------------------------------------
const columnDef = schema('column-def', {
  title:       'ColumnDef',
  description: 'One entry in the `columns` array passed to `<SvGrid>`. ' +
               'Source: packages/sv-grid-core/src/core.ts (ColumnDef<TFeatures, TData>).',
  type:        'object',
  $comment:    'Hand-curated to mirror packages/sv-grid-core/src/core.ts. Update both sides if the runtime surface changes.',
  properties: {
    id: {
      type: 'string',
      description: 'Stable identifier. Defaults to `field` or a generated path id. Required for grouped header columns.',
    },
    field: {
      type: 'string',
      description: 'Dot-free property name on each row. Drives the default accessor + the editor write-back target.',
    },
    accessorFn: {
      description: 'Function `(row: TData) => unknown` returning the cell value. Use when `field` is insufficient (computed cells, nested paths).',
    },
    header: {
      description: 'String label OR `(ctx) => any` snippet/component for the column header.',
    },
    footer: { description: 'Same shape as header, for the column footer row.' },
    cell:   { description: 'Custom cell renderer: a string OR `(ctx) => any` snippet/component.' },
    columns: {
      type: 'array',
      description: 'Nested column-group children. When non-empty, this column becomes a header-only group and its `cell` / `field` are ignored.',
      items: { $ref: '#' },
    },
    editorType: {
      type: 'string',
      enum: ['text', 'number', 'date', 'datetime', 'checkbox', 'list', 'chips'],
      description: 'Built-in editor used during inline editing. Defaults to "text".',
    },
    editable: {
      description: '`true` (default), `false` (read-only column), or `(ctx) => boolean` for per-cell gating.',
      oneOf: [
        { type: 'boolean' },
        { type: 'string', description: '(ctx) => boolean - rendered as a function reference in code.' },
      ],
    },
    sortable: {
      type: 'boolean',
      description: 'When false, the column is exempt from sorting (header click is a no-op, sort indicator hidden, api.setSort ignored).',
      default: true,
    },
    filterable: {
      type: 'boolean',
      description: 'When false, the column is exempt from filtering (funnel + menu hidden, api.setFilter ignored).',
      default: true,
    },
    editorOptions: {
      description: 'Options for `editorType: "list" | "chips"`. Array of bare values OR `{ value, label, color? }` objects, OR `(row) => options` for cascading dropdowns.',
    },
    editorMultiple:  { type: 'boolean', description: 'list / chips allow multiple values.' },
    editorSeparator: { type: 'string',  description: 'Read-only display separator for array-valued cells. Defaults to ", ".' },
    format: {
      type: 'object',
      description: 'Built-in cell formatter (currency / number / percent / date / datetime).',
      properties: {
        type:     { type: 'string', enum: ['currency', 'number', 'percent', 'date', 'datetime'] },
        currency: { type: 'string', description: 'ISO 4217 code for `type: "currency"` (e.g. "USD").' },
        pattern:  { type: 'string', description: 'Date pattern: "y-m-d", "d/m/y", etc.' },
        options:  { type: 'object', description: 'Intl.NumberFormatOptions / Intl.DateTimeFormatOptions, depending on `type`.' },
      },
    },
    formatter: { description: 'Free-form `(value, row) => string` when `format` is not enough.' },
    width:     { type: 'integer', minimum: 1, description: 'Initial column width in pixels.' },
    align:     { type: 'string',  enum: ['left', 'center', 'right'], description: 'Horizontal alignment. Defaults derived from editorType.' },
    cellClass: {
      description: 'String, array of strings, OR `(ctx) => string | string[] | Record<string, boolean>`. Applied to each <td>.',
    },
  },
  additionalProperties: false,
})

// ---- SvGridOptions / SvGrid props --------------------------------------
const svgridOptions = schema('svgrid-options', {
  title:       'SvGridProps',
  description: 'Props on the `<SvGrid>` Svelte component plus headless `createSvGrid` options.',
  type:        'object',
  $comment:    'Mirrors packages/sv-grid-core/src/SvGrid.svelte top-of-file Props type + core.ts SvGridOptions.',
  required:    ['data', 'columns', 'features'],
  properties: {
    data:     { type: 'array', description: 'Source rows (any TypeScript object shape).' },
    columns:  { type: 'array', description: 'Column definitions.', items: { $ref: 'column-def.json' } },
    features: { type: 'object', description: 'Result of `tableFeatures({...})`. Opts the engine into sorting/filtering/grouping/etc.' },

    // Identity + selection
    getRowId:           { description: '`(row, index) => string` - stable row id. Defaults to the array index.' },
    selectionMode:      { type: 'string', enum: ['row', 'cell', 'both', 'none'], default: 'both' },
    enableCellSelection:{ type: 'boolean', default: true },
    onRowSelectionChange:{ description: '`(selection, rows) => void`' },

    // Editing
    enableInlineEditing: { type: 'boolean', default: true },
    onCellValueChange:   { description: '`(event: { rowIndex, columnId, oldValue, newValue, row }) => void`' },

    // Filtering
    filterMode:          { type: 'string', enum: ['menu', 'row', 'none'], default: 'menu' },
    externalFilter:      { type: 'boolean', description: 'When true, the grid records filter state but does NOT filter `data`. Pair with `onFiltersChange` for server-side filtering.' },
    onFiltersChange:     { description: '`(payload: { global, columns }) => void`' },

    // Sorting
    externalSort:        { type: 'boolean' },
    onSortingChange:     { description: '`(clauses: { id, desc }[]) => void`' },

    // Layout
    rowHeight:           { type: 'integer', default: 32 },
    columnWidth:         { type: 'integer', default: 140 },
    fitColumns:          { type: 'boolean', default: false },
    containerHeight:     { description: 'Pixel number or "100%" - the grid scrolls inside this.' },
    virtualization:      { type: 'boolean', default: true },
    columnVirtualization:{ type: 'boolean', default: true },
    overscan:            { type: 'integer', default: 8 },
    columnOverscan:      { type: 'integer', default: 3 },

    // Toolbar / pagination
    showRowNumbers:      { type: 'boolean', default: false },
    showPagination:      { type: 'boolean', default: false },
    pageSize:            { type: 'integer', default: 10 },
    showGlobalFilter:    { type: 'boolean' },
    showColumnFilters:   { type: 'boolean' },
    showGroupingControls:{ type: 'boolean' },

    // Cosmetics + class hooks
    rowClass:            { description: '`(ctx: { row, rowIndex }) => string | string[] | Record<string, boolean> | null`' },
    emptyMessage:        { type: 'string', default: 'No rows to display.' },
    loading:             { type: 'boolean' },
    error:               { type: 'string' },

    // Imperative API
    onApiReady:          { description: '`(api: SvGridApi<TFeatures, TData>) => void` - fires once when the grid is ready.' },
  },
})

// ---- ExportOptions (Pro) -----------------------------------------------
const exportOptions = schema('export-options', {
  title:       'ExportOptions',
  description: '`api.exportData({...})` argument from sv-grid-pro.',
  type:        'object',
  $comment:    'Mirrors packages/sv-grid-pro/src/export.ts ExportOptions<TData>.',
  required:    ['format'],
  properties: {
    format:    { type: 'string', enum: ['xlsx', 'pdf', 'csv', 'tsv', 'html'] },
    filename:  { type: 'string', default: 'grid' },
    columns:   { type: 'array', items: { type: 'object', properties: { field: { type: 'string' }, header: { type: 'string' } }, required: ['field'] } },
    rows:      { type: 'array', description: 'Override the displayed rows. Defaults to `api.getDisplayedRows()`.' },
    pageOrientation: { type: 'string', enum: ['portrait', 'landscape'], default: 'portrait' },
    styles: {
      type: 'object',
      description: 'Header / body / alternate-row styles. Cell-style sub-properties accept CSS-named keys (color, backgroundColor, fontWeight, fontStyle, fontSize, fontFamily, textAlign, verticalAlign, textDecoration, numFmt).',
      properties: {
        headerRow:    { type: 'object' },
        rows:         { type: 'object' },
        rowAlternate: { type: 'object' },
        cells:        { type: 'object', description: 'HTML-only: per-cell-ref overrides keyed by Excel-style reference (e.g. "B1").' },
      },
    },
    header: { type: 'array', description: 'Page-header lines: `{ text, style? } | { image, width?, height? } | { left?, center?, right? }`.' },
    footer: { type: 'array', description: 'Page-footer lines, same shape as `header`.' },
    sheets: { type: 'array', description: 'Multi-sheet export (xlsx only). Each entry becomes one tab.' },
    imageFields: { type: 'array', items: { type: 'string' }, description: 'Fields whose value is a data URL get embedded as a real image cell.' },
    imageSize:   { type: 'object', properties: { width: { type: 'integer' }, height: { type: 'integer' } }, default: { width: 32, height: 32 } },
  },
})

// ---- Manifest ----------------------------------------------------------
const manifest = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id:     `${BASE_URI}/index.json`,
  title:   'sv-grid schema index',
  schemas: [
    { id: 'column-def',     file: 'column-def.json',     describes: 'One entry in <SvGrid columns={...}>.' },
    { id: 'svgrid-options', file: 'svgrid-options.json', describes: '<SvGrid> Svelte prop bag + createSvGrid options.' },
    { id: 'export-options', file: 'export-options.json', describes: 'sv-grid-pro api.exportData({...}) argument.' },
  ],
}

async function main() {
  await mkdir(SCHEMAS_DIR, { recursive: true })
  await writeFile(join(SCHEMAS_DIR, 'column-def.json'),     JSON.stringify(columnDef,     null, 2) + '\n', 'utf-8')
  await writeFile(join(SCHEMAS_DIR, 'svgrid-options.json'), JSON.stringify(svgridOptions, null, 2) + '\n', 'utf-8')
  await writeFile(join(SCHEMAS_DIR, 'export-options.json'), JSON.stringify(exportOptions, null, 2) + '\n', 'utf-8')
  await writeFile(join(SCHEMAS_DIR, 'index.json'),          JSON.stringify(manifest,      null, 2) + '\n', 'utf-8')
  process.stdout.write(`build-schemas: wrote ${manifest.schemas.length} schemas to docs/schemas/\n`)
}

main().catch((err) => { console.error(err); process.exit(1) })
