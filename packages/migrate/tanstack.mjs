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
import { GRID_EXPORTS } from './grid-exports.generated.mjs'

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
 * Is `name` actually bound in this script?
 *
 * The emitted `<SvGrid {data} {columns} {features} />` used to name all three
 * unconditionally, so a component with no `tableFeatures(...)` got a reference
 * to an undefined `features` and would not compile - a codemod handing back
 * broken code, which is the one thing it must not do.
 *
 * Checked against the script AFTER the transform, because that is what the
 * markup will actually sit next to: `stripFeatures` can empty a features object
 * out, and `dropTableWiring` deletes whole declarations.
 */
function bindsIdentifier(script, name) {
  const n = name.replace(/[$]/g, '\\$&')
  return (
    // const/let/var features = ...
    new RegExp('\\b(?:const|let|var)\\s+' + n + '\\b').test(script) ||
    // let { data, columns } = $props(), also with a `: { data: Row[] }` annotation
    new RegExp('\\b(?:const|let|var)\\s*\\{[^}]*\\b' + n + '\\b[^}]*\\}\\s*(?::[^=]+)?=').test(script) ||
    // import { columns } from './columns'  (the shadcn layout)
    new RegExp('^[^\\S\\n]*import\\b[^\\n]*\\b' + n + '\\b[^\\n]*$', 'm').test(script) ||
    // export let data   (Svelte 4 props)
    new RegExp('\\bexport\\s+let\\s+' + n + '\\b').test(script)
  )
}

/** `columnHelper.accessor(...)` / `.display(...)` / `.group(...)`. */
const HELPER_CALL = /^[A-Za-z_$][\w$]*\s*\.\s*(accessor|display|group)\s*\(/

/**
 * Flatten a `createColumnHelper()` column into the object literal it stands for.
 *
 * The helper exists in TanStack purely to infer the row type; the column it
 * builds is an ordinary object, and SvGrid's columns are ordinary objects too.
 * So `helper.accessor('id', { header: 'ID' })` is just
 * `{ accessorKey: 'id', header: 'ID' }` - which the object path below already
 * knows how to map.
 *
 * Returning that synthetic source rather than mapping the keys here is the
 * point: every option gets the same treatment, and the same warnings, whichever
 * style the file was written in.
 *
 * Before this existed the helper form was not recognised at all. `rewriteColumn`
 * took the FIRST `{` in the entry - the options object - and emitted
 * `{ header: 'ID' }`, silently dropping the accessor. The migrated grid rendered
 * the right headers over entirely blank columns, with no warning.
 */
function helperToObjectSource(text, warnings) {
  const m = HELPER_CALL.exec(text)
  if (!m) return null
  const kind = m[1]
  const open = text.indexOf('(', m[0].length - 1)
  const close = matchBracket(text, open)
  if (close === -1) return null

  const args = splitTopLevel(text.slice(open + 1, close), ',')
    .map((a) => a.trim())
    .filter(Boolean)

  // `.display()` and `.group()` take only the options object; `.accessor()`
  // takes the accessor first.
  const accessor = kind === 'accessor' ? args.shift() : null
  const options = args.shift() ?? '{}'
  if (args.length) {
    warnings.push(
      'A `' + kind + '()` column had more arguments than expected; the extra ones were dropped.',
    )
  }
  if (!options.startsWith('{')) {
    warnings.push(
      'A `' + kind + '()` column was skipped: its options are not an object literal (`' +
        options.slice(0, 40) + '`).',
    )
    return null
  }

  const inner = options.slice(1, matchBracket(options, 0)).trim()
  const parts = []
  if (accessor) {
    // A string selects a field; anything else is a function of the row. The
    // object path maps accessorKey -> field and accessorFn -> fieldFn.
    parts.push((isStringLiteral(accessor) ? 'accessorKey: ' : 'accessorFn: ') + accessor)
    if (!isStringLiteral(accessor) && !/\bid\s*:/.test(inner)) {
      warnings.push(
        'An `accessor(fn, ...)` column has no `id`. SvGrid needs one to identify a ' +
          'computed column - add `id` to it.',
      )
    }
  }
  if (inner) parts.push(inner)
  return '{ ' + parts.join(', ') + ' }'
}

/**
 * Rewrite one column-definition object literal. Returns the new source text for
 * the object, or null when it is not an object literal we understand.
 */
function rewriteColumn(entryText, warnings, depth = 0) {
  let text = entryText.trim()

  // A column-helper call is normalised to the object literal it builds, then
  // falls through to the single mapping path below.
  if (HELPER_CALL.test(text)) {
    const flattened = helperToObjectSource(text, warnings)
    if (!flattened) return null
    text = flattened
  }

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
  return collapseGridImports(out)
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

/** The last top-level argument of a type-argument list: `typeof f, Person` -> `Person`. */
function lastTypeArg(args) {
  let depth = 0
  let cut = 0
  for (let i = 0; i < args.length; i++) {
    const c = args[i]
    if ('<([{'.includes(c)) depth++
    else if ('>)]}'.includes(c)) depth--
    else if (c === ',' && depth === 0) cut = i + 1
  }
  return args.slice(cut).trim()
}

/**
 * Every `createColumnHelper` declaration: helper name -> its row type, or ''
 * when it has none. v9 writes `createColumnHelper<typeof features, Person>()`
 * and v8 `createColumnHelper<Person>()`; the row is the last argument in both.
 */
function readColumnHelpers(src) {
  const helpers = new Map()
  const re = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*createColumnHelper\s*(?:<([^()]*)>)?\s*\(/g
  for (let m; (m = re.exec(src)); ) helpers.set(m[1], m[2] ? lastTypeArg(m[2]) : '')
  return helpers
}

/** `const x = ` -> `const x: GridColumns<Row> = `, unless it is already typed. */
function typeDeclaration(decl, row) {
  if (!row || /:/.test(decl)) return decl
  return decl.replace(/\s*=\s*$/, ': GridColumns<' + row + '> = ')
}

/**
 * Rewrite every column array in `src`, returning the new text.
 *
 * Two shapes: `const columns = [ ... ]`, and v9's `helper.columns([ ... ])`,
 * which only exists to type the array and is unwrapped to it. Missing the
 * second left the calls in place while `dropColumnHelper` deleted the helper
 * they call, so the output did not compile.
 *
 * Columns built with a typed helper lose that type when flattened to plain
 * objects (`field` widens to string, a `fieldFn` row is implicitly any), so the
 * declaration gets `: GridColumns<Row>` from the helper's row type. `typed`
 * tells the caller to import `GridColumns`.
 */
function rewriteColumnArrays(src, warnings) {
  const helpers = readColumnHelpers(src)
  // Group 1: `const columns ... = [` and `columns: ColumnDef<...>[] = [`.
  // Group 2: the receiver of `<helper>.columns([`.
  const re = /(\b(?:const|let|var)\s+columns\b[^=]*=\s*)\[|\b([A-Za-z_$][\w$]*)\s*\.\s*columns\s*\(\s*\[/g
  let out = ''
  let last = 0
  let m
  let touched = 0
  let typed = false
  while ((m = re.exec(src))) {
    const helperCall = m[2] !== undefined
    if (helperCall && !helpers.has(m[2])) continue
    const arrStart = m.index + m[0].length - 1
    const arrEnd = matchBracket(src, arrStart)
    if (arrEnd === -1) continue
    let end = arrEnd + 1
    if (helperCall) {
      // `helper.columns([ ... ])` - consume the closing paren with the array.
      const tail = /^\s*,?\s*\)/.exec(src.slice(end))
      if (!tail) {
        warnings.push('`' + m[2] + '.columns(...)` takes more than one array; it was left as-is.')
        continue
      }
      end += tail[0].length
    }
    const raw = splitTopLevel(src.slice(arrStart + 1, arrEnd), ',')
    const entries = raw.map((e) => rewriteColumn(e, warnings)).filter(Boolean)
    if (!entries.length) continue
    const array = '[\n' + entries.map((e) => INDENT + e).join(',\n') + '\n]'

    // The helper whose row type the array carries: the `.columns()` receiver,
    // or the first `helper.accessor(...)` style entry.
    const helper = helperCall ? m[2] : (/^([A-Za-z_$][\w$]*)\s*\./.exec(raw.find((e) => HELPER_CALL.test(e)) ?? '') || [])[1]
    const row = helper ? helpers.get(helper) : ''

    let before = src.slice(last, m.index)
    let decl = helperCall ? '' : m[1]
    if (row) {
      const d = helperCall ? /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*$/.exec(before) : null
      if (d) {
        const t = typeDeclaration(d[0], row)
        typed ||= t !== d[0]
        before = before.slice(0, d.index) + t
      } else if (!helperCall) {
        const t = typeDeclaration(decl, row)
        typed ||= t !== decl
        decl = t
      }
    }
    out += before + decl + array
    last = end
    touched++
    re.lastIndex = end
  }
  out += src.slice(last)
  return { code: out, touched, typed }
}

/**
 * Make sure `GridColumns` is imported from `@svgrid/grid` when a column array
 * was typed with it. Joins an existing named import when there is one.
 */
function ensureGridColumnsImport(src) {
  if (/\bimport\b[^\n]*\bGridColumns\b[^\n]*'@svgrid\/grid'/.test(src)) return src
  const named = /^([^\S\n]*)import\s*\{([^}]*)\}\s*from\s*'@svgrid\/grid'/m
  if (named.test(src)) {
    return src.replace(named, (_all, indent, names) => indent + 'import { ' + [...splitTopLevel(names, ','), 'type GridColumns'].join(', ') + " } from '@svgrid/grid'")
  }
  const firstImport = /^([^\S\n]*)import\b/m.exec(src)
  if (firstImport) {
    const at = firstImport.index
    return src.slice(0, at) + firstImport[1] + "import type { GridColumns } from '@svgrid/grid'\n" + src.slice(at)
  }
  // No imports at all: open the script (or module) with one.
  const lead = /^\s*/.exec(src)[0]
  const indent = /[^\S\n]*$/.exec(lead)[0]
  return lead + "import type { GridColumns } from '@svgrid/grid'\n" + indent + src.slice(lead.length)
}

/**
 * Drop import specifiers `@svgrid/grid` does not export.
 *
 * TanStack imports are re-pointed wholesale, and some of their names have no
 * SvGrid counterpart (`RowSelectionState`). Left in, the import does not
 * resolve. Every drop is reported; one whose name the file still uses says so,
 * because the reader has to replace those uses.
 */
function dropUnknownGridImports(src, warnings) {
  const NAMED = /^([^\S\n]*)import\s+(type\s+)?\{([^}]*)\}\s*from\s*'@svgrid\/grid'(.*)$/
  const lines = []
  const dropped = []
  for (const line of src.split('\n')) {
    const m = NAMED.exec(line)
    if (!m) {
      lines.push(line)
      continue
    }
    const [, indent, typeOnly = '', names, tail] = m
    const kept = splitTopLevel(names, ',').filter((n) => {
      const bare = n.replace(/^type\s+/, '').split(/\s+as\s+/)[0].trim()
      if (GRID_EXPORTS.has(bare)) return true
      dropped.push(n.split(/\s+as\s+/).pop().replace(/^type\s+/, '').trim())
      return false
    })
    if (kept.length) lines.push(indent + 'import ' + typeOnly + '{ ' + kept.join(', ') + " } from '@svgrid/grid'" + tail)
  }
  const out = lines.join('\n')
  for (const name of dropped) {
    const used = new RegExp('(^|[^\\w$.])' + name.replace(/[$]/g, '\\$&') + '(?![\\w$])').test(out)
    warnings.push(
      '`' + name + '` is not exported by @svgrid/grid and was removed from the import.' +
        (used ? ' The file still uses it - replace those uses.' : ''),
    )
  }
  return out
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
    const { code, touched, typed } = rewriteColumnArrays(source, warnings)
    const { props, drop } = readFeatures(source, warnings, notes)
    let next = dropColumnHelper(stripFeatures(rewriteColumnTypes(repointImports(code)), drop), warnings)
    next = dropUnknownGridImports(next, warnings)
    if (typed) next = ensureGridColumnsImport(next)
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

  const columnArrays = rewriteColumnArrays(script.body, warnings)
  let body = repointImports(columnArrays.code, { wantSvGrid: true })
  body = stripFeatures(rewriteColumnTypes(body), drop)
  body = dropColumnHelper(dropTableWiring(body, warnings), warnings)
  body = dropUnknownGridImports(body, warnings)
  if (columnArrays.typed) body = ensureGridColumnsImport(body)

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

  // `features` is optional on <SvGrid>, so it is named only when the component
  // still has one. `data` and `columns` are required, so they are always named
  // - but if nothing binds them the reader is told, rather than being handed a
  // grid that silently renders nothing.
  const attrs = ['{data}', '{columns}']
  if (bindsIdentifier(body, 'features')) attrs.push('{features}')
  for (const required of ['data', 'columns']) {
    if (!bindsIdentifier(body, required)) {
      warnings.push(
        '`' + required + '` is not declared in this component, so `{' + required + '}` on ' +
          '<SvGrid> will not resolve. Pass it in, or import it, wherever it comes from.',
      )
    }
  }
  attrs.push(...propList)
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
  // The helper only ever existed to infer the row type for `accessor()`.
  // Its columns are flattened to plain objects, and `@svgrid/grid` has no
  // `createColumnHelper` to re-point the import at - left in, the file would
  // not compile.
  'createColumnHelper',
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
 * Put every named import from `@svgrid/grid` on one line. The import passes
 * here read a line at a time, and Prettier spreads a long import over several,
 * so `createSvelteTable` and `createColumnHelper` survived in a multi-line
 * import and the output did not compile. Comments inside the braces go: a line
 * comment would swallow the rest of the collapsed line.
 */
function collapseGridImports(src) {
  return src.replace(/^([^\S\n]*)import\s*\{([^}]*)\}\s*from\s*'@svgrid\/grid'/gm, (whole, indent, names) => {
    if (!names.includes('\n')) return whole
    const list = names
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
    return `${indent}import { ${list.join(', ')} } from '@svgrid/grid'`
  })
}

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
  out = collapseGridImports(out)

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
/**
 * Delete `const columnHelper = createColumnHelper<Row>()`.
 *
 * Runs for `.ts` modules as well as components, because the shadcn layout keeps
 * columns in their own file - which is exactly where the helper is declared.
 * Its columns have already been flattened by the time this runs, so the
 * declaration is usually dead.
 *
 * Only usually: a call shape the flattening does not know leaves a reference
 * behind, and deleting the declaration under it gave `Cannot find name` with no
 * warning. So a helper that is still referenced keeps its declaration, and the
 * reader is told why the file will not compile yet.
 */
function dropColumnHelper(src, warnings) {
  // Matched with a regex rather than `findCall`, which looks for `name(` and so
  // never sees the usual `createColumnHelper<Person>()`. `[^()]*` inside the
  // angle brackets carries nested generics without being able to run past the
  // call itself.
  const DECL = /^[^\S\n]*(?:const|let|var)\s+([\w$]+)\s*(?::[^=\n]+)?=\s*createColumnHelper\s*(?:<[^()]*>)?\s*\(\s*\)[^\S\n]*;?[^\S\n]*\r?\n?/gm
  const without = src.replace(DECL, '')
  return src.replace(DECL, (decl, name) => {
    const ref = new RegExp('(^|[^\\w$.])' + name.replace(/[$]/g, '\\$&') + '(?![\\w$])', 'm').exec(without)
    if (!ref) return ''
    const at = without.slice(ref.index + ref[1].length).split('\n')[0].trim().slice(0, 40)
    warnings.push(
      '`' + name + '` is still used (`' + at + '`), so its `createColumnHelper` declaration was kept. ' +
        '@svgrid/grid has no createColumnHelper: rewrite that use as a plain column object.',
    )
    return decl
  })
}

function dropTableWiring(src, warnings) {
  let out = src

  // `$state<SortingState>([])` as well as `$state([])`.
  const STATE = /^\s*let\s+(sorting|columnFilters|globalFilter|rowSelection|pagination|columnVisibility|columnOrder)\b[^\n]*\$state\s*(?:<[^\n]*?>)?\s*\([^\n]*\n/gm
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
