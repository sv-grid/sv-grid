/**
 * Translate a `svelte-headless-table` component into an `<SvGrid>` one.
 *
 * The migration is not a 1:1 markup translation and is not pretended to be.
 * The source library is headless, so a real component spends most of its
 * template on `<Subscribe>` / `<Render>` scaffolding that exists purely to read
 * stores. SvGrid ships a renderer, so that scaffolding has no counterpart - it
 * is deleted rather than converted, and the information worth keeping lives in
 * the column definitions and the plugin list.
 *
 * Anything the transform cannot map is reported, never silently dropped.
 */

import { findCall, matchBracket, readObjectProps, skipAtomic, splitTopLevel } from './scan.mjs'

export const SOURCE_PACKAGES = [
  'svelte-headless-table',
  '@humanspeak/svelte-headless-table',
]

/**
 * Plugin -> SvGrid prop. Prop names verified against
 * `packages/grid/src/SvGrid.types.ts`.
 */
const PLUGINS = {
  addSortBy: { props: ['sortable'] },
  addTableFilter: { props: ['filterable', 'showGlobalFilter'] },
  addColumnFilters: { props: ['filterable', 'showColumnFilters'] },
  addPagination: { props: ['pageable'] },
  addSelectedRows: { props: ['showRowSelection'] },
  addGroupBy: { props: ['groupable'] },
  addSubRows: { props: ['treeData'] },
  addColumnOrder: { props: ['enableColumnReorder'] },
  addExpandedRows: {
    props: [],
    note: 'addExpandedRows has no single prop. SvGrid drives expansion from `treeData` (tree rows) or `isDetailRow` + `renderDetailRow` (master/detail). Pick whichever matched your use.',
  },
  addResizedColumns: {
    props: [],
    note: 'addResizedColumns needs no prop - column resizing is built into <SvGrid>. Set a starting width per column with `width`.',
  },
  addHiddenColumns: {
    props: [],
    note: 'addHiddenColumns maps to `visible: false` on the individual column definitions, not to a grid prop.',
  },
  addGridLayout: {
    props: [],
    note: 'addGridLayout has no counterpart - <SvGrid> owns its own layout, so the CSS-grid sizing the plugin provided is no longer yours to wire.',
  },
}

const INDENT = '  '

function stripQuotes(raw) {
  const t = raw.trim()
  return /^(['"]).*\1$/.test(t) ? t.slice(1, -1) : null
}

function isStringLiteral(raw) {
  return stripQuotes(raw) !== null
}

/** Locate the `<script>` block that imports the source library. */
function findScript(source) {
  const re = /<script\b[^>]*>/gi
  let m
  while ((m = re.exec(source))) {
    const openEnd = m.index + m[0].length
    const closeIdx = source.indexOf('</script>', openEnd)
    if (closeIdx === -1) continue
    const body = source.slice(openEnd, closeIdx)
    if (SOURCE_PACKAGES.some((p) => body.includes(p))) {
      return { tag: m[0], openStart: m.index, openEnd, closeIdx, body }
    }
  }
  return null
}

/** `const table = createTable(...)` -> the identifier bound to the table. */
function findTableIdent(script) {
  const m = script.match(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*createTable\s*\(/)
  return m ? m[1] : null
}

/**
 * Read the initialiser of `const <ident> = ...` out of the script.
 *
 * `createTable(data, ...)` almost always receives an identifier rather than a
 * literal, so resolving one hop is what turns `const data = data` into the
 * array the component actually declared.
 */
function resolveIdent(script, ident) {
  const re = new RegExp('(?:const|let|var)\\s+' + ident + '\\s*=\\s*')
  const m = script.match(re)
  if (!m) return null
  let i = m.index + m[0].length
  let depth = 0
  for (; i < script.length; i++) {
    const skipped = skipAtomic(script, i)
    if (skipped !== -1) { i = skipped - 1; continue }
    const c = script[i]
    if ('([{'.includes(c)) depth++
    else if (')]}'.includes(c)) depth--
    else if (depth === 0 && (c === ';' || c === '\n')) break
  }
  const expr = script.slice(m.index + m[0].length, i).trim()
  return expr || null
}

/** Unwrap `readable(x)` / `writable(x)` / `derived(...)` down to a plain value. */
function unwrapStore(expr, warnings) {
  const trimmed = expr.trim()
  for (const fn of ['readable', 'writable']) {
    const call = findCall(trimmed, fn)
    if (call && call.start === 0) {
      // `readable(value, start?)` - only the first argument is the data.
      const args = splitTopLevel(call.args, ',')
      return args[0] ?? trimmed
    }
  }
  if (/^derived\s*\(/.test(trimmed)) {
    warnings.push(
      'Data came from a `derived` store. SvGrid takes a plain array, so pass the derived value with `$` (e.g. `data={$myDerived}`) or convert it to a `$derived` rune.',
    )
    return '$' + trimmed
  }
  return trimmed
}

function parseColumnEntry(entryText, tableIdent, warnings, depth = 0) {
  const groupCall = findCall(entryText, tableIdent + '.group')
  const displayCall = findCall(entryText, tableIdent + '.display')
  const columnCall = findCall(entryText, tableIdent + '.column')
  const call = groupCall || displayCall || columnCall
  if (!call) {
    warnings.push('Skipped a column entry that is not a .column() / .group() / .display() call: ' + entryText.slice(0, 60))
    return null
  }

  const objStart = call.args.indexOf('{')
  if (objStart === -1) return null
  const objEnd = matchBracket(call.args, objStart)
  const props = readObjectProps(call.args.slice(objStart + 1, objEnd))

  const out = []
  let nested = null

  for (const [key, raw] of props) {
    if (key === 'accessor') {
      if (isStringLiteral(raw)) out.push(["field", raw])
      else {
        out.push(['fieldFn', raw])
        warnings.push('Column accessor was a function; emitted as `fieldFn`. Verify the row argument still matches.')
      }
    } else if (key === 'header') {
      if (isStringLiteral(raw)) out.push(['header', raw])
      else {
        out.push(['header', raw])
        warnings.push('Column header was not a plain string. SvGrid accepts a string or a snippet - check the emitted `header` compiles.')
      }
    } else if (key === 'id') {
      out.push(['id', raw])
    } else if (key === 'columns') {
      const arrStart = raw.indexOf('[')
      if (arrStart !== -1) {
        const arrEnd = matchBracket(raw, arrStart)
        nested = splitTopLevel(raw.slice(arrStart + 1, arrEnd), ',')
          .map((e) => parseColumnEntry(e, tableIdent, warnings, depth + 1))
          .filter(Boolean)
      }
    } else if (key === 'cell') {
      warnings.push(
        'A custom `cell` renderer was found. SvGrid renders cells with a snippet, not `createRender`, so this one needs porting by hand - it is preserved as a comment.',
      )
      out.push(['__comment', 'cell: ' + raw.replace(/\s+/g, ' ').slice(0, 80)])
    } else if (key === 'plugins') {
      warnings.push('Per-column `plugins` config was dropped; configure the equivalent on the SvGrid column or grid prop.')
    } else {
      out.push([key, raw])
    }
  }

  if (displayCall && !out.some(([k]) => k === 'field' || k === 'fieldFn')) {
    warnings.push('A `.display()` column has no accessor. Give it an `id` and a cell snippet in SvGrid.')
  }
  return { props: out, nested }
}

function renderColumn(col, indent) {
  const pad = INDENT.repeat(indent)
  const inner = INDENT.repeat(indent + 1)
  const lines = []
  for (const [k, v] of col.props) {
    if (k === '__comment') lines.push(inner + '// TODO port: ' + v)
    else lines.push(inner + k + ': ' + v + ',')
  }
  if (col.nested && col.nested.length) {
    lines.push(inner + 'columns: [')
    for (const child of col.nested) lines.push(renderColumn(child, indent + 2))
    lines.push(inner + '],')
  }
  return pad + '{\n' + lines.join('\n') + '\n' + pad + '},'
}

/**
 * @returns {{applicable: boolean, code: string, warnings: string[], notes: string[]}}
 */
export function migrate(source) {
  const warnings = []
  const notes = []

  const script = findScript(source)
  if (!script) return { applicable: false, code: source, warnings, notes }

  const tableIdent = findTableIdent(script.body)
  if (!tableIdent) {
    return {
      applicable: false,
      code: source,
      warnings: ['Found a svelte-headless-table import but no `const x = createTable(...)`, so there was nothing to translate.'],
      notes,
    }
  }

  const createTableCall = findCall(script.body, 'createTable')
  const ctArgs = splitTopLevel(createTableCall.args, ',')
  let dataArg = (ctArgs[0] ?? 'data').trim()
  if (/^[A-Za-z_$][\w$]*$/.test(dataArg)) {
    const resolved = resolveIdent(script.body, dataArg)
    if (resolved) dataArg = resolved
  }
  const dataExpr = unwrapStore(dataArg, warnings)

  // ---- plugins -> props ----
  const props = new Set()
  let pageSize = null
  if (ctArgs[1] && ctArgs[1].includes('{')) {
    const objStart = ctArgs[1].indexOf('{')
    const objEnd = matchBracket(ctArgs[1], objStart)
    for (const [, raw] of readObjectProps(ctArgs[1].slice(objStart + 1, objEnd))) {
      const name = (raw.match(/([A-Za-z_$][\w$]*)\s*\(/) || [])[1]
      const spec = PLUGINS[name]
      if (!spec) {
        if (name) warnings.push('Unrecognised plugin `' + name + '` - no SvGrid equivalent was applied.')
        continue
      }
      for (const p of spec.props) props.add(p)
      if (spec.note) notes.push(spec.note)
      if (name === 'addPagination') {
        const ps = raw.match(/initialPageSize\s*:\s*(\d+)/)
        if (ps) pageSize = ps[1]
      }
    }
  }

  // ---- columns ----
  const colsCall = findCall(script.body, tableIdent + '.createColumns')
  let columnsSrc = '[]'
  if (colsCall) {
    const arrStart = colsCall.args.indexOf('[')
    const arrEnd = arrStart === -1 ? -1 : matchBracket(colsCall.args, arrStart)
    if (arrEnd !== -1) {
      const entries = splitTopLevel(colsCall.args.slice(arrStart + 1, arrEnd), ',')
        .map((e) => parseColumnEntry(e, tableIdent, warnings))
        .filter(Boolean)
      columnsSrc = entries.length
        ? '[\n' + entries.map((c) => renderColumn(c, 1)).join('\n') + '\n]'
        : '[]'
    }
  } else {
    warnings.push('No `' + tableIdent + '.createColumns(...)` call was found, so no columns were translated.')
  }

  // ---- emit ----
  const isTs = /lang\s*=\s*["']ts["']/.test(script.tag)
  // Bind the column type to the data's element type. A bare `GridColumns`
  // defaults TData to RowData, which makes `field` an unconstrained string and
  // leaves a `fieldFn` row parameter as `unknown` - both of which fail
  // svelte-check against the TData that <SvGrid> infers from `data`.
  const typeAnn = isTs ? ': GridColumns<(typeof data)[number]>' : ''
  const importLine = isTs
    ? "import { SvGrid, type GridColumns } from '@svgrid/grid'"
    : "import { SvGrid } from '@svgrid/grid'"

  const propList = ['sortable', 'filterable', 'showGlobalFilter', 'showColumnFilters',
    'pageable', 'showRowSelection', 'groupable', 'treeData', 'enableColumnReorder']
    .filter((p) => props.has(p))
  const attrs = ['{data}', '{columns}', ...propList]
  if (pageSize) attrs.push('pageSize={' + pageSize + '}')

  // Carry over any user code that was not part of the table wiring.
  const leftovers = script.body
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      if (!t) return false
      if (t.startsWith('import ') && SOURCE_PACKAGES.some((p) => t.includes(p))) return false
      if (/^import\s+\{[^}]*\}\s+from\s+['"]svelte\/store['"]/.test(t)) return false
      return false // conservative: the CLI shows the original for anything hand-written
    })

  const scriptBody = [
    '',
    INDENT + importLine,
    '',
    INDENT + 'const data = ' + dataExpr.replace(/\n/g, '\n' + INDENT),
    '',
    INDENT + 'const columns' + typeAnn + ' = ' + columnsSrc.replace(/\n/g, '\n' + INDENT),
    '',
    ...leftovers,
  ].join('\n')

  const newScript = script.tag + scriptBody + '\n</script>'

  // Replace the whole `<table>` element the view model fed.
  let body = source.slice(source.indexOf('</script>', script.openEnd) + '</script>'.length)
  const tableOpen = body.search(/<table\b/i)
  if (tableOpen !== -1) {
    const tableClose = body.toLowerCase().indexOf('</table>', tableOpen)
    if (tableClose !== -1) {
      body = body.slice(0, tableOpen) + '<SvGrid ' + attrs.join(' ') + ' />' + body.slice(tableClose + '</table>'.length)
    } else {
      warnings.push('Found a `<table>` with no closing tag; the markup was left alone.')
    }
  } else {
    warnings.push('No `<table>` element was found, so the grid markup was appended rather than replacing anything.')
    body = '\n\n<SvGrid ' + attrs.join(' ') + ' />\n' + body
  }

  if (/\bSubscribe\b|\bRender\b/.test(body)) {
    warnings.push('`<Subscribe>` or `<Render>` still appears outside the main table. Those have no SvGrid equivalent and need removing by hand.')
  }

  notes.push('Column resizing, keyboard navigation and ARIA grid semantics are built into <SvGrid>; the markup that provided them is intentionally gone.')

  return {
    applicable: true,
    code: source.slice(0, script.openStart) + newScript + body,
    warnings,
    notes: [...new Set(notes)],
  }
}
