/**
 * check_svgrid_code - the verification half of the MCP server.
 *
 * Retrieval tools (docs, demos, API listing) only ever give a model something
 * to read. This one closes the loop: the model writes SvGrid code, this checks
 * it against the REAL exported surface of the installed version and hands back
 * diagnostics it can act on. A wrong prop name, a symbol imported from the
 * wrong package, or Svelte 4 syntax in a Svelte 5 component all come back with
 * the exact replacement rather than "hmm, that didn't work" three edits later.
 *
 * Two layers:
 *   1. Static analysis (this file) - pure, no dependencies, no filesystem, so
 *      it runs identically in the Node stdio server and in a Worker.
 *   2. The Svelte compiler - injected by the caller when it is available
 *      (`compile` option). Node has it; the Worker does not, and skips.
 *
 * The API surface is generated from the workspace sources at build time by
 * scripts/api-surface.mjs, so it cannot drift from what the package exports.
 */

export type Severity = 'error' | 'warning' | 'info'

export type Diagnostic = {
  /** Stable rule id, e.g. "svgrid/unknown-prop". */
  rule: string
  severity: Severity
  /** 1-based line in the checked source. */
  line: number
  message: string
  /** The concrete edit that fixes it, when there is one. */
  fix?: string
  /** Doc slug or demo id to read for the full story. */
  see?: string
}

export type TypeMember = { readonly name: string; readonly optional: boolean; readonly type: string }

export type ApiSurface = {
  readonly gridVersion: string
  readonly enterpriseVersion: string
  readonly grid: {
    readonly values: readonly string[]
    readonly types: readonly string[]
    readonly subpaths: readonly string[]
  }
  readonly enterprise: {
    readonly values: readonly string[]
    readonly types: readonly string[]
    readonly subpaths: readonly string[]
  }
  readonly props: readonly TypeMember[]
  readonly columnDef: readonly TypeMember[]
  /** Methods on the free `SvGridApi`. */
  readonly apiMethods: readonly string[]
  /** Methods `installEnterprise(api)` adds on top. */
  readonly enterpriseApiMethods: readonly string[]
  readonly themes: readonly string[]
  readonly features: readonly string[]
  readonly rowModels: readonly string[]
}

export type CheckResult = {
  ok: boolean
  /** Which version the code was checked against. */
  checkedAgainst: string
  compiler: 'svelte' | 'unavailable' | 'not-svelte'
  counts: { errors: number; warnings: number; info: number }
  diagnostics: Diagnostic[]
  summary: string
}

/** A compile pass supplied by the host when a Svelte compiler is reachable. */
export type CompileFn = (
  source: string,
  filename: string,
) => Promise<{ available: boolean; diagnostics: Diagnostic[] }>

// ---------------------------------------------------------------------------
// Text scanning helpers
// ---------------------------------------------------------------------------

/**
 * Blank out comments and the inside of strings, keeping every offset and line
 * break intact. All structural scanning runs on this copy so a prop name in a
 * doc comment or a `<SvGrid>` inside a template string never trips a rule.
 */
export function blankOut(src: string): string {
  const out = src.split('')
  const n = src.length
  let i = 0
  const blank = (from: number, to: number) => {
    for (let k = from; k < to && k < n; k++) if (out[k] !== '\n') out[k] = ' '
  }
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      let j = i
      while (j < n && src[j] !== '\n') j++
      blank(i, j)
      i = j
      continue
    }
    if (c === '/' && d === '*') {
      const close = src.indexOf('*/', i + 2)
      const j = close === -1 ? n : close + 2
      blank(i, j)
      i = j
      continue
    }
    if (c === '<' && src.startsWith('<!--', i)) {
      const close = src.indexOf('-->', i + 4)
      const j = close === -1 ? n : close + 3
      blank(i, j)
      i = j
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < n) {
        if (src[j] === '\\') {
          j += 2
          continue
        }
        if (src[j] === c) break
        j++
      }
      blank(i + 1, Math.min(j, n))
      i = Math.min(j + 1, n)
      continue
    }
    i++
  }
  return out.join('')
}

/** 1-based line number for a character offset. */
function lineAt(src: string, offset: number): number {
  let line = 1
  for (let i = 0; i < offset && i < src.length; i++) if (src[i] === '\n') line++
  return line
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (!m) return n
  if (!n) return m
  let prev = Array.from({ length: n + 1 }, (_, i) => i)
  const curr = new Array<number>(n + 1)
  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = curr.slice()
  }
  return prev[n]
}

/**
 * Closest known name to `word`, or null when nothing is near enough. A
 * case-only difference always wins; otherwise the edit distance has to be
 * small relative to the word so "foo" does not "resolve" to "bar".
 */
export function nearest(word: string, candidates: readonly string[]): string | null {
  const lower = word.toLowerCase()
  const exactCase = candidates.find((c) => c.toLowerCase() === lower)
  if (exactCase && exactCase !== word) return exactCase

  // `getSortedRowModel` and `createSortedRowModel` are 5 edits apart but the
  // same idea, so the comparison also runs with the verb prefix removed.
  const core = (s: string) => s.replace(/^(?:get|set|create|make|build|use|enable|with)/i, '')
  const lowerCore = core(lower)

  const budget = word.length <= 4 ? 1 : word.length <= 8 ? 2 : 3
  let best: string | null = null
  let bestScore = Infinity
  for (const c of candidates) {
    const cl = c.toLowerCase()
    const d = Math.min(levenshtein(lower, cl), levenshtein(lowerCore, core(cl)))
    if (d < bestScore && d <= budget) {
      bestScore = d
      best = c
    }
  }
  return best
}

/** Index of the bracket matching the one at `open`, or -1. */
function matchBracket(src: string, open: number): number {
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' }
  const close = pairs[src[open]]
  if (!close) return -1
  let depth = 0
  for (let i = open; i < src.length; i++) {
    const c = src[i]
    if (c === '{' || c === '[' || c === '(') depth++
    else if (c === '}' || c === ']' || c === ')') {
      depth--
      if (depth === 0) return src[i] === close ? i : -1
    }
  }
  return -1
}

// ---------------------------------------------------------------------------
// Rename tables
//
// Names developers (and models trained on other table libraries) reach for,
// mapped to the SvGrid equivalent. These are the highest-value diagnostics in
// the file: a plain "unknown prop" makes a model guess again, a rename makes it
// write the right line.
// ---------------------------------------------------------------------------

const PROP_RENAMES: Record<string, string> = {
  rowData: 'data',
  rows: 'data',
  columnDefs: 'columns',
  colDefs: 'columns',
  columnDefinitions: 'columns',
  defaultColDef: '',
  rowModelType: '',
  enableSorting: 'sortable',
  enableFilter: 'filterable',
  enableFiltering: 'filterable',
  enableEditing: 'editable',
  enableSelection: 'selectable',
  enableGrouping: 'groupable',
  enablePagination: 'pageable',
  pagination: 'pageable',
  paginationPageSize: 'pageSize',
  rowSelection: 'selectionMode',
  onGridReady: 'onApiReady',
  onSelectionChanged: 'onRowSelectionChange',
  onCellValueChanged: 'onCellValueChange',
  onRowClicked: 'onRowClick',
  onCellClicked: 'onCellClick',
  getRowClass: 'rowClass',
  getRowNodeId: 'getRowId',
  height: 'containerHeight',
  domLayout: 'autoRowHeight',
  theme: '',
  striped: 'zebraRows',
  stripe: 'zebraRows',
  loadingMessage: 'loadingOverlay',
  noDataMessage: 'emptyMessage',
  placeholder: 'emptyMessage',
}

const PROP_RENAME_NOTES: Record<string, string> = {
  defaultColDef: 'SvGrid has no shared column default; set the key on each column, or map over your columns to add it.',
  rowModelType: 'SvGrid always renders from `data`. For server-side paging/sorting, build the rows with `createServerDataSource` and feed its result into `data`.',
  theme: 'Themes are stylesheets, not a prop: import one, e.g. `import "@svgrid/grid/themes/shadcn.css"`.',
}

const COLUMN_RENAMES: Record<string, string> = {
  accessorKey: 'field',
  accessor: 'field',
  key: 'field',
  dataIndex: 'field',
  name: 'field',
  accessorFn: 'fieldFn',
  valueGetter: 'fieldFn',
  headerName: 'header',
  title: 'header',
  label: 'header',
  cellRenderer: 'cell',
  render: 'cell',
  renderCell: 'cell',
  component: 'cell',
  valueFormatter: 'formatter',
  enableSorting: 'sortable',
  sorting: 'sortable',
  sortingFn: 'sortable',
  enableColumnFilter: 'filterable',
  filterFn: 'filterable',
  filter: 'filterable',
  hide: 'visible',
  hidden: 'visible',
  type: 'cellDataType',
  size: 'width',
  flex: 'width',
  minWidth: 'width',
  maxWidth: 'width',
  pinned: '',
  frozen: '',
  rowGroup: '',
  resizable: '',
  meta: '',
}

const COLUMN_RENAME_NOTES: Record<string, string> = {
  hide: 'Inverted in SvGrid: `hide: true` becomes `visible: false`.',
  hidden: 'Inverted in SvGrid: `hidden: true` becomes `visible: false`.',
  pinned: 'Column pinning is set on the grid, not the column: `initialColumnPinning={{ left: ["id"] }}`.',
  frozen: 'Column pinning is set on the grid, not the column: `initialColumnPinning={{ left: ["id"] }}`.',
  rowGroup: 'Grouping is set on the grid: `groupable` plus `groupBy={["field"]}`.',
  resizable: 'Columns resize by default; there is no per-column switch.',
  meta: 'SvGrid has no per-column `meta` bag. Put extra data on your row type, or close over it in a `cell` snippet.',
}

/**
 * Wrong names common enough to be worth an exact replacement. Everything else
 * is checked against the generated method list, so this stays short on purpose
 * - a guessed entry here would reject a method that really exists.
 */
const API_METHOD_HINTS: Record<string, string> = {
  exportExcel: 'exportData({ format: "xlsx" })',
  exportXlsx: 'exportData({ format: "xlsx" })',
  exportPdf: 'exportData({ format: "pdf" })',
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

type Ctx = {
  raw: string
  scan: string
  surface: ApiSurface
  filename: string
  isSvelte: boolean
  /**
   * A markup-only excerpt with no script block and no imports - the shape a
   * model pastes to check one tag. Rules about what the WHOLE file must
   * contain (imports present, required props set) do not apply to an excerpt.
   */
  isFragment: boolean
  /** Package specifiers the file imports from, e.g. "@svgrid/enterprise". */
  importedFrom: Set<string>
  /** Every named symbol imported from an svgrid package. */
  importedNames: Set<string>
  out: Diagnostic[]
}

function push(ctx: Ctx, d: Diagnostic) {
  ctx.out.push(d)
}

/** Imports: unknown symbols, unknown subpaths, wrong package, missing themes. */
function checkImports(ctx: Ctx) {
  const { scan, raw, surface } = ctx
  // Both `import { a } from 'x'` and the bare `import 'x'` a stylesheet uses.
  const re = /import\s+(?:(type\s+)?([\s\S]*?)\s+from\s*)?(['"])([^'"]*)\3/g

  for (let m: RegExpExecArray | null; (m = re.exec(scan)); ) {
    const clause = m[2] ?? ''
    // The specifier text was blanked out by `blankOut`; read it back from the
    // raw source. The blanked copy is the same length, so the opening quote sits
    // exactly one specifier-length + one quote before the end of the match.
    const specStart = m.index + m[0].length - m[4].length - 1
    const spec = raw.slice(specStart, specStart + m[4].length)
    const line = lineAt(raw, m.index)
    if (!spec.startsWith('@svgrid/')) continue

    ctx.importedFrom.add(spec)

    const isGrid = spec === '@svgrid/grid' || spec.startsWith('@svgrid/grid/')
    const isEnt = spec === '@svgrid/enterprise' || spec.startsWith('@svgrid/enterprise/')

    // Theme stylesheets are files, not module exports.
    if (spec.startsWith('@svgrid/grid/themes/')) {
      const file = spec.slice('@svgrid/grid/themes/'.length)
      if (surface.themes.length && !surface.themes.includes(file)) {
        const guess = nearest(file, surface.themes)
        push(ctx, {
          rule: 'svgrid/unknown-theme',
          severity: 'error',
          line,
          message: `There is no theme "${file}" in @svgrid/grid.`,
          fix: guess
            ? `Use "@svgrid/grid/themes/${guess}".`
            : `Shipped themes: ${surface.themes.join(', ')}.`,
          see: 'help/theming',
        })
      }
      continue
    }

    if (isGrid || isEnt) {
      const known = isGrid ? surface.grid : surface.enterprise
      const other = isGrid ? surface.enterprise : surface.grid
      const otherName = isGrid ? '@svgrid/enterprise' : '@svgrid/grid'
      const pkgName = isGrid ? '@svgrid/grid' : '@svgrid/enterprise'

      if (!known.subpaths.includes(spec) && !spec.endsWith('.css')) {
        push(ctx, {
          rule: 'svgrid/unknown-subpath',
          severity: 'error',
          line,
          message: `"${spec}" is not an export path of ${pkgName}.`,
          fix: `Importable paths: ${known.subpaths.join(', ')}.`,
        })
        continue
      }

      // Only the package root re-exports everything; the subpaths are narrow
      // and would produce noise, so names are only checked against the root.
      if (spec !== pkgName) continue

      const defaultImport = /^\s*([A-Za-z_$][\w$]*)\s*(?:,|$)/.exec(clause.replace(/\{[\s\S]*$/, ''))
      if (defaultImport && !clause.trimStart().startsWith('{') && !clause.includes('* as')) {
        push(ctx, {
          rule: 'svgrid/default-import',
          severity: 'error',
          line,
          message: `${pkgName} has no default export.`,
          fix: `Use a named import: import { ${defaultImport[1]} } from '${pkgName}'`,
        })
      }

      const braces = /\{([\s\S]*)\}/.exec(clause)
      if (!braces) continue
      for (const rawName of braces[1].split(',')) {
        const part = rawName.trim().replace(/^type\s+/, '')
        if (!part) continue
        const name = /^([A-Za-z_$][\w$]*)/.exec(part)?.[1]
        if (!name) continue
        ctx.importedNames.add(name)
        if (known.values.includes(name) || known.types.includes(name)) continue

        if (other.values.includes(name) || other.types.includes(name)) {
          push(ctx, {
            rule: 'svgrid/wrong-package',
            severity: 'error',
            line,
            message: `\`${name}\` is exported by ${otherName}, not ${pkgName}.`,
            fix: `import { ${name} } from '${otherName}'`,
          })
          continue
        }
        const guess = nearest(name, [...known.values, ...known.types])
        push(ctx, {
          rule: 'svgrid/unknown-import',
          severity: 'error',
          line,
          message: `${pkgName}@${isGrid ? surface.gridVersion : surface.enterpriseVersion} does not export \`${name}\`.`,
          fix: guess ? `Did you mean \`${guess}\`?` : 'Call get_api_reference for the exported surface.',
        })
      }
    }
  }
}

type TagAttr = { name: string; line: number; valueRaw: string; shorthand: boolean }

/** Attributes on every `<Tag ...>` occurrence, expressions and shorthands included. */
function readTagAttrs(ctx: Ctx, tag: string): { attrs: TagAttr[]; spread: boolean; count: number }[] {
  const { scan, raw } = ctx
  const out: { attrs: TagAttr[]; spread: boolean; count: number }[] = []
  const re = new RegExp(`<${tag}(?=[\\s/>])`, 'g')

  for (let m: RegExpExecArray | null; (m = re.exec(scan)); ) {
    let i = m.index + tag.length + 1
    const attrs: TagAttr[] = []
    let spread = false
    let guard = 0

    while (i < scan.length && guard++ < 20000) {
      const c = scan[i]
      if (c === '>' ) break
      if (c === '/' && scan[i + 1] === '>') break
      if (/\s/.test(c)) {
        i++
        continue
      }
      if (c === '{') {
        const end = matchBracket(scan, i)
        if (end === -1) break
        const inner = scan.slice(i + 1, end).trim()
        if (inner.startsWith('...')) spread = true
        else {
          const short = /^([A-Za-z_$][\w$]*)$/.exec(inner)
          if (short) {
            attrs.push({ name: short[1], line: lineAt(raw, i), valueRaw: short[1], shorthand: true })
          }
        }
        i = end + 1
        continue
      }
      // A literal `...` inside a tag is prose shorthand for "and the rest";
      // treat it like a spread so nothing is reported as missing.
      if (c === '.' && scan.startsWith('...', i)) {
        spread = true
        i += 3
        continue
      }
      const nameMatch = /^([A-Za-z_$@#][\w$:.-]*)/.exec(scan.slice(i))
      if (!nameMatch) {
        i++
        continue
      }
      const name = nameMatch[1]
      const line = lineAt(raw, i)
      let j = i + name.length
      while (j < scan.length && /\s/.test(scan[j])) j++
      let valueRaw = ''
      if (scan[j] === '=') {
        j++
        while (j < scan.length && /\s/.test(scan[j])) j++
        if (scan[j] === '{') {
          const end = matchBracket(scan, j)
          if (end === -1) break
          valueRaw = raw.slice(j, end + 1)
          j = end + 1
        } else if (scan[j] === '"' || scan[j] === "'") {
          const quote = scan[j]
          let k = j + 1
          while (k < scan.length && scan[k] !== quote) k++
          valueRaw = raw.slice(j, k + 1)
          j = k + 1
        } else {
          const bare = /^[^\s/>]*/.exec(scan.slice(j))![0]
          valueRaw = bare
          j += bare.length
        }
      }
      attrs.push({ name, line, valueRaw, shorthand: false })
      i = j
    }
    out.push({ attrs, spread, count: out.length })
  }
  return out
}

/** `<SvGrid>` props: unknown names, renamed names, required ones, string booleans. */
function checkGridProps(ctx: Ctx) {
  const { surface } = ctx
  const known = surface.props.map((p) => p.name)
  const booleanProps = new Set(surface.props.filter((p) => p.type.trim() === 'boolean').map((p) => p.name))
  const usages = readTagAttrs(ctx, 'SvGrid')

  for (const usage of usages) {
    const seen = new Set<string>()
    for (const attr of usage.attrs) {
      let name = attr.name
      if (name.startsWith('--')) continue
      if (name.startsWith('bind:')) name = name.slice(5)
      if (name.startsWith('use:') || name.startsWith('transition:') || name.startsWith('animate:')) continue
      if (name.startsWith('in:') || name.startsWith('out:')) continue
      seen.add(name)

      if (name.startsWith('on:')) {
        const evt = name.slice(3)
        const callback = `on${evt.charAt(0).toUpperCase()}${evt.slice(1)}`
        const real = known.find((k) => k.toLowerCase() === callback.toLowerCase())
        push(ctx, {
          rule: 'svelte/legacy-event-directive',
          severity: 'error',
          line: attr.line,
          message: `\`on:${evt}\` never fires: SvGrid dispatches no component events, it takes callback props.`,
          fix: real
            ? `Use \`${real}={...}\`.`
            : `Look for the matching \`on...\` prop - call get_api_reference or read reference/SvGrid.`,
          see: 'reference/SvGrid',
        })
        continue
      }

      if (known.includes(name)) {
        // `sortable="true"` is a string, which is truthy even when it says "false".
        if (booleanProps.has(name) && /^["']/.test(attr.valueRaw)) {
          const literal = attr.valueRaw.slice(1, -1)
          push(ctx, {
            rule: 'svgrid/boolean-prop-string',
            severity: 'error',
            line: attr.line,
            message: `\`${name}\` is a boolean, and "${literal}" is a string (always truthy).`,
            fix: literal === 'false' ? `Write \`${name}={false}\`.` : `Write \`${name}\` on its own, or \`${name}={true}\`.`,
          })
        }
        continue
      }

      const renamed = PROP_RENAMES[name]
      if (renamed !== undefined) {
        push(ctx, {
          rule: 'svgrid/renamed-prop',
          severity: 'error',
          line: attr.line,
          message: `\`${name}\` is not a SvGrid prop.`,
          fix: renamed ? `Use \`${renamed}\`.` : PROP_RENAME_NOTES[name],
          see: 'reference/SvGrid',
        })
        continue
      }

      if (name === 'class' || name === 'style') {
        push(ctx, {
          rule: 'svgrid/unstyled-prop',
          severity: 'warning',
          line: attr.line,
          message: `\`${name}\` is ignored: SvGrid does not forward unknown attributes to its root element.`,
          fix: 'Wrap the grid in an element and style that, or set `--sg-*` custom properties on the component.',
          see: 'help/theming',
        })
        continue
      }

      const guess = nearest(name, known)
      push(ctx, {
        rule: 'svgrid/unknown-prop',
        severity: 'error',
        line: attr.line,
        message: `\`${name}\` is not a prop of <SvGrid> in @svgrid/grid@${surface.gridVersion}.`,
        fix: guess ? `Did you mean \`${guess}\`?` : 'Call get_api_reference, or read the reference/SvGrid doc for the prop list.',
        see: 'reference/SvGrid',
      })
    }

    // Only a file that imports SvGrid itself is complete enough to be missing
    // a required prop; anything else is an excerpt.
    if (usage.spread || ctx.isFragment || !ctx.importedNames.has('SvGrid')) continue
    for (const required of surface.props.filter((p) => !p.optional)) {
      if (!seen.has(required.name)) {
        push(ctx, {
          rule: 'svgrid/missing-required-prop',
          severity: 'error',
          line: usage.attrs[0]?.line ?? 1,
          message: `<SvGrid> requires \`${required.name}\`.`,
          fix: `Add \`${required.name}={...}\` (${required.type}).`,
          see: 'getting-started',
        })
      }
    }
  }
}

/** Depth-1 keys of every object literal directly inside an array. */
function objectKeysInArray(scan: string, arrOpen: number): { key: string; offset: number }[][] {
  const arrClose = matchBracket(scan, arrOpen)
  if (arrClose === -1) return []
  const objects: { key: string; offset: number }[][] = []

  let i = arrOpen + 1
  let depth = 0
  while (i < arrClose) {
    const c = scan[i]
    if (depth === 0 && c === '{') {
      const objClose = matchBracket(scan, i)
      if (objClose === -1) break
      const keys: { key: string; offset: number }[] = []
      let d = 0
      for (let j = i; j < objClose; j++) {
        const ch = scan[j]
        if (ch === '{' || ch === '[' || ch === '(') d++
        else if (ch === '}' || ch === ']' || ch === ')') d--
        else if (d === 1) {
          const rest = scan.slice(j)
          const km = /^([A-Za-z_$][\w$]*)\s*:/.exec(rest)
          if (km && !/[\w$.]/.test(scan[j - 1] ?? '')) {
            keys.push({ key: km[1], offset: j })
            // A column group nests real column definitions under `columns`,
            // so those get collected too.
            if (km[1] === 'columns') {
              let v = j + km[0].length
              while (v < objClose && /\s/.test(scan[v])) v++
              if (scan[v] === '[') objects.push(...objectKeysInArray(scan, v))
            }
            // Skip past the value so nested keys are not collected here.
            let k = j + km[0].length
            let vd = 0
            for (; k < objClose; k++) {
              const t = scan[k]
              if (t === '{' || t === '[' || t === '(') vd++
              else if (t === '}' || t === ']' || t === ')') {
                if (vd === 0) break
                vd--
              } else if (vd === 0 && (t === ',' || t === '\n')) break
            }
            j = k - 1
          }
        }
      }
      objects.push(keys)
      i = objClose + 1
      continue
    }
    if (c === '{' || c === '[' || c === '(') depth++
    else if (c === '}' || c === ']' || c === ')') depth--
    i++
  }
  return objects
}

/** Column definition keys, checked only inside things actually named `columns`. */
function checkColumns(ctx: Ctx) {
  const { scan, raw, surface } = ctx
  const known = surface.columnDef.map((c) => c.name)
  const anchors = new Set(['field', 'fieldFn', 'header', 'id', 'cell', 'columns'])

  // Two shapes, kept separate on purpose. An assignment may carry a type
  // annotation containing commas (`ColumnDef<TFeatures, TData>[]`), so it is
  // anchored on the `=`; a plain property must be followed immediately by the
  // array, or `columns: 2, fields: [...]` in an unrelated config object would
  // hand us the wrong array.
  const arrayOpens = new Set<number>()

  // `const columns: ExprColumn[] = [...]` is somebody else's `columns`. When a
  // declaration names its type, believe it.
  const assigned = /(?:^|[\s({,])columns\s*(?::([^=\n]*))?=\s*\{?\s*\[/g
  for (let m: RegExpExecArray | null; (m = assigned.exec(scan)); ) {
    const annotation = m[1]
    if (annotation && !/ColumnDef|SvColumn|any\b|unknown\b/.test(annotation)) continue
    arrayOpens.add(m.index + m[0].lastIndexOf('['))
  }
  // A bare `columns: [...]` PROPERTY is deliberately not a starting point:
  // export options and other config objects have one too, holding a different
  // shape. Column groups are reached by recursing from a real column instead.

  for (const arrOpen of arrayOpens) {
    for (const obj of objectKeysInArray(scan, arrOpen)) {
      const names = obj.map((k) => k.key)
      // Only judge objects that look like column definitions. A real one has a
      // SvGrid key, or one of the keys other table libraries use for the same
      // job - which is exactly the case worth reporting. Anything else inside
      // an array that happens to be called `columns` is left alone.
      const looksLikeColumn = names.some(
        (n) => anchors.has(n) || known.includes(n) || n in COLUMN_RENAMES,
      )
      if (!looksLikeColumn) continue

      for (const { key, offset } of obj) {
        if (known.includes(key)) continue
        const line = lineAt(raw, offset)
        const renamed = COLUMN_RENAMES[key]
        if (renamed !== undefined) {
          push(ctx, {
            rule: 'svgrid/renamed-column-key',
            severity: 'error',
            line,
            message: `\`${key}\` is not a SvGrid column key.`,
            fix: renamed ? `Use \`${renamed}\`.` : COLUMN_RENAME_NOTES[key],
            see: 'help/columns/column-definitions',
          })
          continue
        }
        const guess = nearest(key, known)
        push(ctx, {
          rule: 'svgrid/unknown-column-key',
          severity: 'error',
          line,
          message: `\`${key}\` is not a key of ColumnDef in @svgrid/grid@${surface.gridVersion}.`,
          fix: guess ? `Did you mean \`${guess}\`?` : `Valid keys: ${known.join(', ')}.`,
          see: 'help/columns/column-definitions',
        })
      }
    }
  }
}

/**
 * Svelte 4 syntax in a Svelte 5 file. Severities here match what the compiler
 * actually does: `export let` and `$:` are hard errors once the file uses any
 * rune, while `on:`, `<slot>` and `<svelte:component>` still work and only
 * warn. Nothing is reported as fatal that the compiler accepts.
 */
function checkSvelteVersion(ctx: Ctx) {
  const { scan, raw, isSvelte } = ctx
  const usesRunes = /\$state\b|\$props\b|\$derived\b|\$effect\b|\$bindable\b/.test(scan)

  const rules: { re: RegExp; rule: string; severity: Severity; message: string; fix: string }[] = [
    {
      re: /(^|\n)\s*export\s+let\s+([A-Za-z_$][\w$]*)/g,
      rule: 'svelte/legacy-export-let',
      severity: usesRunes ? 'error' : 'warning',
      message: usesRunes
        ? '`export let` is not allowed in runes mode, and this file uses runes.'
        : '`export let` is the Svelte 4 way to declare a prop.',
      fix: 'let { name } = $props()',
    },
    {
      re: /(^|\n)\s*\$:\s/g,
      rule: 'svelte/legacy-reactive-statement',
      severity: usesRunes ? 'error' : 'warning',
      message: usesRunes
        ? '`$:` is not allowed in runes mode, and this file uses runes.'
        : '`$:` is the Svelte 4 reactive statement.',
      fix: 'Use `const x = $derived(...)` for values, `$effect(() => {...})` for side effects.',
    },
    {
      re: /createEventDispatcher\s*\(/g,
      rule: 'svelte/legacy-dispatcher',
      severity: 'warning',
      message: 'createEventDispatcher is the Svelte 4 event model and is deprecated in Svelte 5.',
      fix: 'Take a callback prop instead: `let { onchange } = $props()`.',
    },
    {
      re: /<slot\b/g,
      rule: 'svelte/legacy-slot',
      severity: 'warning',
      message: '`<slot>` is deprecated in Svelte 5, which uses snippets.',
      fix: 'Take a `children` prop and render it with `{@render children()}`.',
    },
    {
      re: /<svelte:component\b/g,
      rule: 'svelte/legacy-component-tag',
      severity: 'warning',
      message: '`<svelte:component>` is deprecated in Svelte 5 - components are dynamic by default.',
      fix: 'Render the variable directly: `<Thing />` where `Thing` holds the component.',
    },
    {
      re: /\son:[a-zA-Z]+[={\s]/g,
      rule: 'svelte/legacy-event-directive',
      severity: 'warning',
      message: 'The `on:` event directive is deprecated in Svelte 5.',
      fix: 'Use the plain attribute form: `onclick={...}`.',
    },
  ]

  for (const r of rules) {
    if (!isSvelte && (r.rule === 'svelte/legacy-slot' || r.rule === 'svelte/legacy-component-tag')) continue
    for (let m: RegExpExecArray | null; (m = r.re.exec(scan)); ) {
      push(ctx, {
        rule: r.rule,
        severity: r.severity,
        line: lineAt(raw, m.index),
        message: r.message,
        fix: r.fix,
      })
    }
  }

  // A plain `let` array that is later mutated is not reactive under runes: the
  // grid keeps rendering the first snapshot and nothing errors. Only counts
  // for a value the markup actually reads - mutating a local accumulator
  // inside a function is ordinary code.
  if (!isSvelte || !usesRunes) return
  const markupStart = scan.lastIndexOf('</script>')
  const markup = markupStart === -1 ? '' : scan.slice(markupStart)

  const decls = /(^|\n)\s*let\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]*)?=\s*(\[|\{)/g
  for (let m: RegExpExecArray | null; (m = decls.exec(scan)); ) {
    const name = m[2]
    const tail = scan.slice(m.index + m[0].length)
    if (/\$state|\$derived|\$props/.test(scan.slice(m.index, m.index + m[0].length + 40))) continue
    if (!new RegExp(`[^\\w$]${name}[^\\w$]`).test(markup)) continue
    const mutated = new RegExp(`\\b${name}\\s*(?:\\.(?:push|pop|splice|shift|unshift|sort|reverse)\\s*\\(|\\[[^\\]]*\\]\\s*=[^=])`)
    if (mutated.test(tail)) {
      push(ctx, {
        rule: 'svelte/non-reactive-mutation',
        severity: 'error',
        line: lineAt(raw, m.index),
        message: `\`${name}\` is a plain \`let\` but is mutated later, so the UI will not update.`,
        fix: `Declare it as \`let ${name} = $state(...)\`, or replace the value instead of mutating it.`,
        see: 'help/reactivity',
      })
    }
  }
}

/**
 * Traps specific to this codebase's Svelte version, each one a bug that has
 * shipped here before and compiled without complaint.
 */
function checkKnownTraps(ctx: Ctx) {
  const { scan, raw, filename, isSvelte } = ctx

  // A `$derived` read before its own declaration in a .svelte.ts module
  // compiles to a getter that returns undefined - silently.
  if (filename.endsWith('.svelte.ts')) {
    const derived = /(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\$derived/g
    for (let m: RegExpExecArray | null; (m = derived.exec(scan)); ) {
      const name = m[1]
      const before = scan.slice(0, m.index)
      const used = new RegExp(`[^\\w$.]${name}[^\\w$:]`).test(before)
      if (used) {
        push(ctx, {
          rule: 'svelte/derived-before-use',
          severity: 'error',
          line: lineAt(raw, m.index),
          message: `\`${name}\` is a $derived that is referenced above its own declaration; that compiles to an empty getter with no error.`,
          fix: `Move the \`${name}\` declaration above its first use.`,
        })
      }
    }
  }

  // Excerpts routinely elide their import block, and a doc snippet that shows
  // only the interesting lines is not broken. So "you forgot to import X" is
  // only claimed for a file that demonstrably lists its svgrid imports.
  if (!isSvelte || ctx.isFragment || ctx.importedNames.size === 0) return

  // A component reference that is never imported: the template renders nothing
  // and, in a runes file, the compiler does not complain either.
  const used = new Set<string>()
  for (const m of scan.matchAll(/<(Sv[A-Z][\w$]*)\b/g)) used.add(m[1])
  if (used.size) {
    const imported = new Set<string>()
    for (const m of scan.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s*['"]/g)) {
      for (const part of m[1].replace(/[{}]/g, ' ').split(',')) {
        const name = /([A-Za-z_$][\w$]*)\s*$/.exec(part.trim())?.[1]
        if (name) imported.add(name)
      }
    }
    for (const name of used) {
      if (imported.has(name)) continue
      // A locally declared component (a snippet-bound const, a lazy import
      // assigned to a variable) is not an import but is perfectly valid.
      if (new RegExp(`(?:const|let|var|function)\\s+${name}\\b`).test(scan)) continue
      const at = scan.indexOf(`<${name}`)
      push(ctx, {
        rule: 'svgrid/component-not-imported',
        // A warning, not an error: an excerpt that shows only the interesting
        // imports is legitimate, and this must not fail an otherwise good file.
        severity: 'warning',
        line: lineAt(raw, at < 0 ? 0 : at),
        message: `<${name}> is used but never imported.`,
        fix: `import { ${name} } from '@svgrid/grid'`,
      })
    }
  }
}

/** Features that exist only in the paid package, used without importing it. */
function checkEnterpriseUsage(ctx: Ctx) {
  const { scan, raw, importedFrom, importedNames } = ctx
  const hasEnterprise = [...importedFrom].some((s) => s.startsWith('@svgrid/enterprise'))

  // Only calls on a receiver whose name ends in "api" - how the docs, the
  // demos and `onApiReady` all name it. Widening this to `grid` immediately
  // starts flagging `grid.cloneNode()` on a DOM ref, and one bad finding makes
  // every other one suspect.
  const receiver = '(?:^|[^\\w$.])(?:[\\w$]*[Aa]pi)'

  // `api` is a popular variable name, and the UI kit's other components hand
  // out their own (a dock manager's `api.float()` is not a grid method). Only
  // check it where the file shows where the handle came from.
  const holdsGridApi =
    /onApiReady/.test(scan) ||
    /\b(?:SvGridApi|EnterpriseGridApi)\b/.test(scan) ||
    /createSvGrid\s*\(|createGridState\s*\(/.test(scan) ||
    /<SvGrid[\s/>]/.test(scan)

  // Same excerpt rule as the import checks: a file that never shows an svgrid
  // import is an excerpt, and its `api` may not even be ours.
  if (ctx.surface.apiMethods.length && importedFrom.size > 0 && holdsGridApi) {
    const free = new Set(ctx.surface.apiMethods)
    const paid = new Set(ctx.surface.enterpriseApiMethods)
    const all = [...free, ...paid]
    const calls = new RegExp(`${receiver}\\.([A-Za-z_$][\\w$]*)\\s*\\(`, 'g')

    for (let m: RegExpExecArray | null; (m = calls.exec(scan)); ) {
      const method = m[1]
      const line = lineAt(raw, m.index)
      if (free.has(method)) continue

      if (paid.has(method)) {
        if (hasEnterprise) continue
        push(ctx, {
          rule: 'svgrid/enterprise-not-installed',
          severity: 'error',
          line,
          message: `\`${method}()\` is added by @svgrid/enterprise, and this file never imports it.`,
          fix: "import { installEnterprise } from '@svgrid/enterprise' and call installEnterprise(api) once the grid is ready.",
          see: 'help/export',
        })
        continue
      }

      const hint = API_METHOD_HINTS[method]
      const guess = hint ?? nearest(method, all)
      push(ctx, {
        rule: 'svgrid/unknown-api-method',
        severity: 'error',
        line,
        message: `The grid API has no \`${method}()\` in @svgrid/grid@${ctx.surface.gridVersion}.`,
        fix: guess ? `Use \`${guess}\`.` : 'Call get_api_reference for the api surface.',
        see: 'reference/SvGrid',
      })
    }
  }

  // The pivot ENGINE lives in the paid package; the prop alone renders an
  // upsell note instead of a pivot.
  if (/<SvGrid[^>]*\spivot=/.test(scan) && !importedNames.has('enablePivot') && !importedNames.has('installEnterprise')) {
    const at = scan.search(/<SvGrid[^>]*\spivot=/)
    push(ctx, {
      rule: 'svgrid/pivot-needs-engine',
      severity: 'warning',
      line: lineAt(raw, at < 0 ? 0 : at),
      message: 'The `pivot` prop needs the pivot engine registered, which ships in @svgrid/enterprise.',
      fix: "import { enablePivot } from '@svgrid/enterprise' and call enablePivot() before the grid renders.",
      see: 'help/pivot',
    })
  }
}

/** Feature constants referenced in `tableFeatures({...})` but never imported. */
function checkFeatures(ctx: Ctx) {
  const { scan, raw, surface, importedNames } = ctx
  const re = /tableFeatures\s*\(\s*\{/g
  for (let m: RegExpExecArray | null; (m = re.exec(scan)); ) {
    const open = scan.indexOf('{', m.index)
    const close = matchBracket(scan, open)
    if (close === -1) continue
    const body = scan.slice(open + 1, close)
    for (const km of body.matchAll(/([A-Za-z_$][\w$]*)\s*[,:}]/g)) {
      const name = km[1]
      if (surface.features.includes(name)) {
        if (!importedNames.has(name) && importedNames.size > 0) {
          push(ctx, {
            rule: 'svgrid/feature-not-imported',
            severity: 'error',
            line: lineAt(raw, open + 1 + km.index!),
            message: `\`${name}\` is used in tableFeatures() but never imported.`,
            fix: `import { ${name} } from '@svgrid/grid'`,
          })
        }
        continue
      }
      if (name.endsWith('Feature')) {
        const guess = nearest(name, surface.features)
        push(ctx, {
          rule: 'svgrid/unknown-feature',
          severity: 'error',
          line: lineAt(raw, open + 1 + km.index!),
          message: `\`${name}\` is not a SvGrid feature.`,
          fix: guess ? `Did you mean \`${guess}\`?` : `Available: ${surface.features.join(', ')}.`,
          see: 'help/features',
        })
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Run every static rule. Exported for tests and for hosts that skip compiling. */
export function checkStatic(source: string, surface: ApiSurface, filename = 'Component.svelte'): Diagnostic[] {
  const ctx: Ctx = {
    raw: source,
    scan: blankOut(source),
    surface,
    filename,
    isSvelte: filename.endsWith('.svelte') || /<script[\s>]/.test(source),
    isFragment: !/<script[\s>]/.test(source) && !/^\s*import\s/m.test(source),
    importedFrom: new Set(),
    importedNames: new Set(),
    out: [],
  }

  checkImports(ctx)
  checkGridProps(ctx)
  checkColumns(ctx)
  checkSvelteVersion(ctx)
  checkKnownTraps(ctx)
  checkEnterpriseUsage(ctx)
  checkFeatures(ctx)

  const rank: Record<Severity, number> = { error: 0, warning: 1, info: 2 }
  const unique = new Map<string, Diagnostic>()
  for (const d of ctx.out) unique.set(`${d.rule}|${d.line}|${d.message}`, d)

  // Where a specific rule and the generic one it supersedes both fired (the
  // `on:` directive is both "deprecated syntax" and "this component has no
  // events"), keep only the error.
  const hasError = new Set(
    [...unique.values()].filter((d) => d.severity === 'error').map((d) => `${d.rule}|${d.line}`),
  )
  return [...unique.values()]
    .filter((d) => d.severity === 'error' || !hasError.has(`${d.rule}|${d.line}`))
    .sort((a, b) => rank[a.severity] - rank[b.severity] || a.line - b.line)
}

/**
 * Check a snippet and report what a model should do next. `compile` is the
 * optional second gate: when the host can reach a Svelte compiler, real parse
 * errors are merged in with the static findings.
 */
export async function checkSvGridCode(
  source: string,
  surface: ApiSurface,
  opts: { filename?: string; compile?: CompileFn } = {},
): Promise<CheckResult> {
  const filename = opts.filename ?? 'Component.svelte'
  const diagnostics = checkStatic(source, surface, filename)

  let compiler: CheckResult['compiler'] = 'not-svelte'
  if (filename.endsWith('.svelte')) {
    compiler = 'unavailable'
    if (opts.compile) {
      const res = await opts.compile(source, filename)
      if (res.available) {
        compiler = 'svelte'
        diagnostics.unshift(...res.diagnostics)
      }
    }
  }

  const counts = {
    errors: diagnostics.filter((d) => d.severity === 'error').length,
    warnings: diagnostics.filter((d) => d.severity === 'warning').length,
    info: diagnostics.filter((d) => d.severity === 'info').length,
  }
  const ok = counts.errors === 0

  const parts: string[] = []
  if (ok && counts.warnings === 0) parts.push(`Clean against @svgrid/grid@${surface.gridVersion}.`)
  else if (ok) parts.push(`No errors against @svgrid/grid@${surface.gridVersion}, ${counts.warnings} warning(s).`)
  else parts.push(`${counts.errors} error(s) against @svgrid/grid@${surface.gridVersion}. Fix them and check again.`)
  if (compiler === 'unavailable' && filename.endsWith('.svelte')) {
    parts.push('The Svelte compiler was not reachable here, so this is API validation only - run svelte-check in the project too.')
  }

  return {
    ok,
    checkedAgainst: `@svgrid/grid@${surface.gridVersion}`,
    compiler,
    counts,
    diagnostics,
    summary: parts.join(' '),
  }
}
