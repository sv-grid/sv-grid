/**
 * Translate a TanStack Table v9 setup (including the shadcn-svelte data-table
 * recipe, which is built on it) into an `<SvGrid>` one.
 *
 * This port is unusually shallow on purpose. SvGrid exports the same v9
 * vocabulary - `tableFeatures`, `rowSortingFeature`, `columnFilteringFeature`,
 * `rowPaginationFeature`, `rowSelectionFeature`, `rowExpandingFeature`,
 * `columnGroupingFeature` - so a `features` object does not get translated at
 * all; its import is simply re-pointed at `@svgrid/grid`. What does not carry
 * over is the rendering scaffolding: the `getHeaderGroups()` / `getRowModel()`
 * markup and the `$state` + `onXChange` pairs that existed only to hold state
 * SvGrid owns. Those are deleted, and the props they imply are set instead.
 *
 * Anything the transform cannot map is reported, never silently dropped.
 */

import { findCall, matchBracket, readObjectProps, splitTopLevel } from './scan.mjs'

export const TANSTACK_PACKAGES = [
  '@tanstack/svelte-table',
  '@tanstack/table-core',
  '@tanstack/table',
]

/**
 * v9 feature -> the `<SvGrid>` props it implies. `keep: true` means the feature
 * itself is re-exported by `@svgrid/grid`, so it stays in the `features` object.
 * Feature names verified against `packages/grid/src/index.ts`; props verified
 * against `packages/grid/src/SvGrid.types.ts`.
 */
const FEATURES = {
  rowSortingFeature: { keep: true, props: ['sortable'] },
  columnFilteringFeature: { keep: true, props: ['filterable', 'showColumnFilters'] },
  rowPaginationFeature: { keep: true, props: ['pageable', 'showPagination'] },
  rowSelectionFeature: { keep: true, props: ['showRowSelection'] },
  columnGroupingFeature: { keep: true, props: ['groupable'] },
  rowExpandingFeature: {
    keep: true,
    props: [],
    note: 'rowExpandingFeature has no single prop. SvGrid drives expansion from `treeData` (tree rows) or `isDetailRow` + `renderDetailRow` (master/detail). Pick whichever matched your use.',
  },
  // Registered in v9 but with no SvGrid feature to keep - the behaviour is
  // either built into <SvGrid> or lives on the column definitions.
  columnVisibilityFeature: {
    keep: false,
    props: [],
    note: 'columnVisibilityFeature maps to `visible: false` on the individual column definitions, plus the built-in "Choose columns" menu. The dropdown you maintained for it can go.',
  },
  columnResizingFeature: {
    keep: false,
    props: [],
    note: 'columnResizingFeature needs no prop - column resizing is built into <SvGrid>. Set a starting width per column with `width`.',
  },
  columnOrderingFeature: { keep: false, props: ['enableColumnReorder'] },
  columnPinningFeature: {
    keep: false,
    props: [],
    note: 'columnPinningFeature maps to `pinned` on the individual column definitions rather than a grid prop.',
  },
  globalFilteringFeature: { keep: false, props: ['filterable', 'showGlobalFilter'] },
}

/** Column-def key -> SvGrid key. Verified against `packages/grid/src/core.ts`. */
const COLUMN_KEYS = {
  accessorKey: 'field',
  accessorFn: 'fieldFn',
  id: 'id',
  size: 'width',
  columns: 'columns',
}

/** Boolean column options that map cleanly onto an SvGrid key. */
const COLUMN_FLAGS = {
  enableSorting: 'sortable',
  enableColumnFilter: 'filterable',
  enableResizing: 'resizable',
}

const INDENT = '  '

const isStringLiteral = (raw) => /^(['"]).*\1$/.test(raw.trim())
const isArrowOrFn = (raw) => /=>|^function\b/.test(raw.trim())

/**
 * Rewrite one column-definition object literal. Returns the new source text for
 * the object, or null when it is not an object literal we understand.
 */
function rewriteColumn(entryText, warnings, depth = 0) {
  const text = entryText.trim()
  const open = text.indexOf('{')
  if (open === -1) {
    warnings.push('Skipped a column entry that is not an object literal: `' + text.slice(0, 60) + '`')
    return null
  }
  const close = matchBracket(text, open)
  if (close === -1) return null

  const out = []
  for (const [key, raw] of readObjectProps(text.slice(open + 1, close))) {
    if (key === 'columns') {
      // A group column: recurse into its children.
      const arrOpen = raw.indexOf('[')
      const arrClose = arrOpen === -1 ? -1 : matchBracket(raw, arrOpen)
      if (arrClose === -1) {
        out.push(['columns', raw])
        continue
      }
      const kids = splitTopLevel(raw.slice(arrOpen + 1, arrClose), ',')
        .map((k) => rewriteColumn(k, warnings, depth + 1))
        .filter(Boolean)
      out.push(['columns', '[\n' + kids.map((k) => INDENT.repeat(depth + 2) + k).join(',\n') + '\n' + INDENT.repeat(depth + 1) + ']'])
      continue
    }

    if (COLUMN_KEYS[key]) {
      out.push([COLUMN_KEYS[key], raw])
      continue
    }

    if (COLUMN_FLAGS[key]) {
      out.push([COLUMN_FLAGS[key], raw])
      continue
    }

    if (key === 'header') {
      if (isStringLiteral(raw)) {
        out.push(['header', raw])
      } else {
        // A header render function usually existed only to draw a sort button,
        // which `sortable` now does. Keep it so nothing is lost silently.
        warnings.push(
          'A `header` render function was kept as-is. If it only rendered a sort ' +
            'button, delete it - `sortable` makes every header a sort toggle.',
        )
        out.push(['header', raw])
      }
      continue
    }

    if (key === 'cell') {
      if (isArrowOrFn(raw) || !isStringLiteral(raw)) {
        warnings.push(
          'A custom `cell` renderer was kept. SvGrid cells take a snippet: ' +
            '`cell: (ctx) => renderSnippet(MySnippet, { row: ctx.row.original })`.',
        )
      }
      out.push(['cell', raw])
      continue
    }

    if (key === 'meta') {
      warnings.push('`meta` has no SvGrid equivalent and was dropped. Use `cellClass` / `cell` instead.')
      continue
    }

    if (key === 'enableHiding') {
      warnings.push('`enableHiding` was dropped - use `visible: false` to start a column hidden.')
      continue
    }

    // Unknown key: carry it through rather than lose information.
    warnings.push('Unrecognised column option `' + key + '` was carried over unchanged.')
    out.push([key, raw])
  }

  const body = out.map(([k, v]) => k + ': ' + v).join(', ')
  return '{ ' + body + ' }'
}

/**
 * Pull the feature names out of a `tableFeatures({ ... })` call. `drop` comes
 * back holding the ones `@svgrid/grid` does not export, so the caller can take
 * them out of both the call and its import - left in, they would not resolve.
 */
function readFeatures(script, warnings, notes) {
  const call = findCall(script, 'tableFeatures')
  const props = new Set()
  const drop = new Set()
  if (!call) return { props, drop, found: false }

  const open = call.args.indexOf('{')
  if (open === -1) return { props, drop, found: true }
  const close = matchBracket(call.args, open)
  if (close === -1) return { props, drop, found: true }

  for (const [key] of readObjectProps(call.args.slice(open + 1, close))) {
    const name = key.trim()
    const spec = FEATURES[name]
    if (!spec) {
      drop.add(name)
      warnings.push('Unrecognised feature `' + name + '` - it was removed, because @svgrid/grid does not export it.')
      continue
    }
    for (const p of spec.props) props.add(p)
    if (spec.note) notes.push(spec.note)
    // Known, but with no SvGrid feature behind it: the behaviour moved to a
    // prop or to the column definitions, so the registration has to go.
    if (!spec.keep) drop.add(name)
  }
  return { props, drop, found: true }
}

/** Remove dropped feature names from a `tableFeatures({...})` call and imports. */
function stripFeatures(src, drop) {
  if (!drop.size) return src
  let out = src

  const call = findCall(out, 'tableFeatures')
  if (call) {
    const open = call.args.indexOf('{')
    const close = open === -1 ? -1 : matchBracket(call.args, open)
    if (close !== -1) {
      const body = call.args.slice(open + 1, close)
      const kept = splitTopLevel(body, ',').filter((e) => !drop.has(e.split(':')[0].trim()))
      const rebuilt = kept.length ? '\n' + kept.map((k) => INDENT + k).join(',\n') + ',\n' : ''
      const absOpen = call.argsStart + open
      const absClose = call.argsStart + close
      out = out.slice(0, absOpen + 1) + rebuilt + out.slice(absClose)
    }
  }

  // Now the import specifiers that no longer refer to anything used.
  return out
    .split('\n')
    .map((line) => {
      const m = /^([^\S\n]*)import\s*\{([^}]*)\}\s*from\s*('@svgrid\/grid')(.*)$/.exec(line)
      if (!m) return line
      const kept = splitTopLevel(m[2], ',').filter((n) => !drop.has(n.trim()))
      if (!kept.length) return null
      return m[1] + 'import { ' + kept.join(', ') + ' } from ' + m[3] + m[4]
    })
    .filter((l) => l !== null)
    .join('\n')
}

/**
 * Rewrite a TanStack column type annotation onto SvGrid's. Their `ColumnDef`
 * takes one type parameter; SvGrid's takes two (`<TFeatures, TData>`), so a
 * straight rename would not compile. `GridColumns<TData>` is the single-param
 * alias for exactly this shape.
 */
function rewriteColumnTypes(src) {
  return src
    .replace(/\bColumnDef<([^<>]*(?:<[^<>]*>)?[^<>]*)>\s*\[\s*\]/g, 'GridColumns<$1>')
    .replace(/(\bimport\s+type\s*\{[^}]*?)\bColumnDef\b/g, '$1GridColumns')
    .replace(/(\bimport\s*\{[^}]*?)\btype\s+ColumnDef\b/g, '$1type GridColumns')
}

/**
 * Follow `import { features } from './data-table-features'` and read the
 * feature list from there. `readImport(specifier)` is supplied by the CLI (the
 * transform itself never touches disk, so it stays testable); it returns the
 * module source, or null when the specifier cannot be resolved.
 */
function readFeaturesFromImport(script, readImport, warnings, notes) {
  if (typeof readImport !== 'function') return null
  const re = /import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(script))) {
    const names = splitTopLevel(m[1], ',').map((n) => n.trim())
    if (!names.includes('features')) continue
    let src
    try {
      src = readImport(m[2])
    } catch {
      src = null
    }
    if (!src) continue
    const read = readFeatures(src, warnings, notes)
    if (read.found) return read
  }
  return null
}

/** The `<script>` block of a .svelte file, or the whole source for a .ts file. */
function findScript(source) {
  const m = /<script\b[^>]*>/i.exec(source)
  if (!m) return null
  const openEnd = m.index + m[0].length
  const close = source.toLowerCase().indexOf('</script>', openEnd)
  if (close === -1) return null
  return { tag: m[0], openStart: m.index, openEnd, body: source.slice(openEnd, close), closeStart: close }
}

/** Rewrite every column array in `src`, returning the new text. */
function rewriteColumnArrays(src, warnings) {
  // Match `const columns ... = [` and `columns: ColumnDef<...>[] = [`.
  const re = /(\b(?:const|let|var)\s+columns\b[^=]*=\s*)\[/g
  let out = ''
  let last = 0
  let m
  let touched = 0
  while ((m = re.exec(src))) {
    const arrStart = m.index + m[0].length - 1
    const arrEnd = matchBracket(src, arrStart)
    if (arrEnd === -1) continue
    const entries = splitTopLevel(src.slice(arrStart + 1, arrEnd), ',')
      .map((e) => rewriteColumn(e, warnings))
      .filter(Boolean)
    if (!entries.length) continue
    out += src.slice(last, m.index) + m[1] + '[\n' + entries.map((e) => INDENT + e).join(',\n') + '\n]'
    last = arrEnd + 1
    touched++
    re.lastIndex = arrEnd + 1
  }
  out += src.slice(last)
  return { code: out, touched }
}

/**
 * Port a TanStack v9 file. `.ts` files get their column definitions rewritten;
 * `.svelte` files additionally lose their table markup and gain `<SvGrid>`.
 */
export function migrateTanstack(source, { svelte = true, readImport = null } = {}) {
  const warnings = []
  const notes = []

  if (!TANSTACK_PACKAGES.some((p) => source.includes(p))) {
    return { applicable: false, code: source, warnings, notes }
  }

  // ---- a plain .ts module (columns.ts / data-table-features.ts) ----
  if (!svelte || !/<script\b/i.test(source)) {
    const { code, touched } = rewriteColumnArrays(source, warnings)
    const { props, drop } = readFeatures(source, warnings, notes)
    const next = stripFeatures(rewriteColumnTypes(repointImports(code)), drop)
    if (!touched && !props.size && next === source) {
      return { applicable: false, code: source, warnings, notes }
    }
    if (props.size) {
      notes.push(
        'This module only declares features. The props they imply - ' +
          [...props].join(', ') +
          ' - belong on the `<SvGrid>` element in the component that renders it.',
      )
    }
    return { applicable: true, code: next, warnings, notes: [...new Set(notes)] }
  }

  // ---- a .svelte component ----
  const script = findScript(source)
  if (!script) return { applicable: false, code: source, warnings, notes }

  let { props, drop, found } = readFeatures(script.body, warnings, notes)

  // The shadcn layout keeps `features` in its own module, so the component that
  // needs the props has no `tableFeatures(...)` to read. Follow the import.
  if (!found) {
    const resolved = readFeaturesFromImport(script.body, readImport, warnings, notes)
    if (resolved) {
      props = resolved.props
      drop = resolved.drop
    } else if (/\bfeatures\b/.test(script.body)) {
      warnings.push(
        'This component uses a `features` object declared elsewhere, so the props ' +
          'it implies could not be set. Add them to <SvGrid> by hand - see the note ' +
          'printed for the module that declares them.',
      )
    }
  }

  let body = rewriteColumnArrays(script.body, warnings).code
  body = repointImports(body, { wantSvGrid: true })
  body = stripFeatures(rewriteColumnTypes(body), drop)
  body = dropTableWiring(body, warnings)

  const pageSize = (script.body.match(/pageSize\s*:\s*(\d+)/) || [])[1]

  const propList = [
    'sortable',
    'filterable',
    'showGlobalFilter',
    'showColumnFilters',
    'pageable',
    'showPagination',
    'showRowSelection',
    'groupable',
    'enableColumnReorder',
  ].filter((p) => props.has(p))

  const attrs = ['{data}', '{columns}', '{features}', ...propList]
  if (pageSize) attrs.push('pageSize={' + pageSize + '}')

  let markup = source.slice(script.closeStart + '</script>'.length)
  markup = replaceTableMarkup(markup, attrs, warnings)

  notes.push(
    'Column resizing, keyboard navigation and ARIA grid semantics are built into <SvGrid>; the markup that provided them is intentionally gone.',
  )

  return {
    applicable: true,
    code: source.slice(0, script.openStart) + script.tag + body + '</script>' + markup,
    warnings,
    notes: [...new Set(notes)],
  }
}

/**
 * Names that only ever existed to build or render the markup we delete. Left in
 * an import they would not resolve against `@svgrid/grid`, so the file would
 * not compile - the codemod has to take them out with the code that used them.
 */
const DEAD_IMPORTS = new Set([
  'createSvelteTable',
  'useTable',
  'useReactTable',
  'createTable',
  'FlexRender',
  'flexRender',
  'getCoreRowModel',
  'getSortedRowModel',
  'getFilteredRowModel',
  'getPaginationRowModel',
  'getExpandedRowModel',
  'getGroupedRowModel',
])

/**
 * Re-point TanStack imports at `@svgrid/grid`, which exports the same names,
 * then drop the specifiers that no longer refer to anything. `wantSvGrid` adds
 * the component itself, since the markup we emit needs it.
 */
function repointImports(src, { wantSvGrid = false } = {}) {
  let out = src
  for (const pkg of TANSTACK_PACKAGES) {
    out = out.replace(
      new RegExp("(['\"])" + pkg.replace(/[/@]/g, '\\$&') + "\\1", 'g'),
      "'@svgrid/grid'",
    )
  }

  // A default import of the render component has no counterpart at all.
  out = out.replace(/^[^\S\n]*import\s+(?:FlexRender|flexRender)\s+from\s+'@svgrid\/grid'[^\n]*\n?/gm, '')

  // Rewritten line by line rather than with one global regex, so an import left
  // with no specifiers can simply not be emitted. An earlier version marked
  // those with a placeholder string and substituted it back out, which is one
  // more thing to get wrong for no benefit.
  const NAMED = /^([^\S\n]*)import\s*\{([^}]*)\}\s*from\s*'@svgrid\/grid'(.*)$/
  const kept_lines = []
  let injected = false

  for (const line of out.split('\n')) {
    const m = NAMED.exec(line)
    if (!m) {
      kept_lines.push(line)
      continue
    }
    const [, indent, names, tail] = m
    const kept = splitTopLevel(names, ',').filter((n) => {
      // `type Foo` / `Foo as Bar` - judge on the imported name.
      const bare = n.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      return !DEAD_IMPORTS.has(bare)
    })
    if (wantSvGrid && !injected && !kept.some((n) => n.trim() === 'SvGrid')) {
      kept.unshift('SvGrid')
      injected = true
    }
    // The whole import died with the code that used it.
    if (!kept.length) continue
    kept_lines.push(indent + 'import { ' + kept.join(', ') + " } from '@svgrid/grid'" + tail)
  }
  out = kept_lines.join('\n')

  if (wantSvGrid && !injected && !/\bSvGrid\b/.test(out)) {
    out = out.replace(/^([^\S\n]*)(import\b)/m, "$1import { SvGrid } from '@svgrid/grid'\n$1$2")
  }
  return out
}

/**
 * Delete the state + updater pairs that existed only to hold what SvGrid owns:
 * `let sorting = $state(...)` and its `onSortingChange`, and the
 * `createSvelteTable(...)` / `useTable(...)` call itself.
 */
function dropTableWiring(src, warnings) {
  let out = src

  const STATE = /^\s*let\s+(sorting|columnFilters|globalFilter|rowSelection|pagination|columnVisibility|columnOrder)\b[^\n]*\$state\([^\n]*\n/gm
  out = out.replace(STATE, '')

  for (const name of ['createSvelteTable', 'useTable', 'createTable']) {
    for (;;) {
      const call = findCall(out, name)
      if (!call) break
      // Walk back to the start of the declaration so `const table = ...` goes too.
      let start = call.start
      const declStart = out.lastIndexOf('\n', start)
      const line = out.slice(declStart + 1, start)
      if (/^\s*(const|let|var)\s+[\w$]+\s*=\s*$/.test(line)) start = declStart + 1
      let end = call.end
      while (end < out.length && /[\s;]/.test(out[end])) end++
      out = out.slice(0, start) + out.slice(end)
    }
  }

  if (/on[A-Z]\w*Change\s*:/.test(out)) {
    warnings.push('An `onXChange` updater survived the cut. SvGrid owns that state, so it can usually be deleted.')
  }
  return out
}

/** Swap the `<table>` (or shadcn `<Table.Root>`) block for `<SvGrid ... />`. */
function replaceTableMarkup(markup, attrs, warnings) {
  const el = '<SvGrid ' + attrs.join(' ') + ' />'

  const rootOpen = markup.search(/<Table\.Root\b/)
  if (rootOpen !== -1) {
    const rootClose = markup.indexOf('</Table.Root>', rootOpen)
    if (rootClose !== -1) {
      return markup.slice(0, rootOpen) + el + markup.slice(rootClose + '</Table.Root>'.length)
    }
  }

  const tableOpen = markup.search(/<table\b/i)
  if (tableOpen !== -1) {
    const tableClose = markup.toLowerCase().indexOf('</table>', tableOpen)
    if (tableClose !== -1) {
      return markup.slice(0, tableOpen) + el + markup.slice(tableClose + '</table>'.length)
    }
    warnings.push('Found a `<table>` with no closing tag; the markup was left alone.')
    return markup
  }

  warnings.push('No table markup was found, so the grid element was appended rather than replacing anything.')
  return '\n\n' + el + '\n' + markup
}
