/**
 * doc-snippet-scaffold - write a tailored `{preamble}` for a grid doc page.
 *
 * The import-only generator (doc-snippet-preamble.mjs) handles component pages,
 * where the missing piece is one import. Grid pages need more: a row type, some
 * data, a `features` tuple, a column list - and which of those a page needs
 * varies. This reads the identifiers svelte-check reported as missing and emits
 * only those, so a page about column pinning does not carry a preamble about
 * editing.
 *
 *   node tools/build-doc-snippets.mjs --candidates
 *   cd examples && npx svelte-check --output human --threshold error > ../check.txt
 *   node tools/doc-snippet-scaffold.mjs ../check.txt --list
 *   node tools/doc-snippet-scaffold.mjs ../check.txt --write
 */
import { readFileSync, writeFileSync } from 'node:fs'
// @ts-expect-error - plain .mjs helper
import { parseNeeds } from './doc-snippet-needs.mjs'

const MANIFEST = 'examples/src/doc-snippets/manifest.json'

/**
 * The sample domain every generated grid preamble shares.
 *
 * One recognisable dataset across the docs is worth more than novelty per page:
 * a reader moving from sorting to grouping to pinning sees the same five people
 * and can focus on the prop that changed. This is what AG Grid's shared example
 * data buys them, and it is cheap to copy.
 */
const PIECES = {
  Person: `  type Person = {
    id: number
    name: string
    email: string
    department: string
    age: number
    salary: number
    city: string
    startDate: string
    active: boolean
  }`,
  Order: `  type Order = {
    id: string
    customer: string
    product: string
    quantity: number
    total: number
    status: 'pending' | 'shipped' | 'delivered'
    orderedAt: string
  }`,
  Row: `  type Row = Person`,
  people: `  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   email: 'ada@example.com',   department: 'Engineering', age: 36, salary: 142000, city: 'London',   startDate: '2021-03-01', active: true },
    { id: 2, name: 'Grace Hopper',   email: 'grace@example.com', department: 'Engineering', age: 45, salary: 168000, city: 'New York', startDate: '2019-07-15', active: true },
    { id: 3, name: 'Linus Torvalds', email: 'linus@example.com', department: 'Platform',    age: 54, salary: 155000, city: 'Portland', startDate: '2020-01-20', active: false },
    { id: 4, name: 'Radia Perlman',  email: 'radia@example.com', department: 'Networking',  age: 49, salary: 161000, city: 'Seattle',  startDate: '2022-09-05', active: true },
    { id: 5, name: 'Barbara Liskov', email: 'barbara@example.com', department: 'Platform',  age: 52, salary: 172000, city: 'Boston',   startDate: '2018-11-11', active: true },
  ]`,
  orders: `  const orders: Order[] = [
    { id: 'A-1001', customer: 'Northwind',  product: 'Cycling cap',  quantity: 12, total: 348.0,  status: 'delivered', orderedAt: '2026-05-02' },
    { id: 'A-1002', customer: 'Contoso',    product: 'Patch kit',    quantity: 40, total: 512.5,  status: 'shipped',   orderedAt: '2026-05-11' },
    { id: 'A-1003', customer: 'Fabrikam',   product: 'Road bottle',  quantity: 8,  total: 96.0,   status: 'pending',   orderedAt: '2026-05-19' },
  ]`,
  columns: `  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]`,
  api: `  let api = $state<SvGridApi<{}, Person> | null>(null)`,
}

/** Identifiers this scaffold knows how to satisfy. */
export const KNOWN = new Set([
  'Person', 'Order', 'Row', 'data', 'rows', 'columns', 'features', 'api', 'people', 'orders',
])

/**
 * Build a preamble covering exactly `needs`.
 *
 * `features` is only emitted when a page asks for it: the shortcut props
 * (`sortable`, `filterable`) are the documented default path, and a preamble
 * that always declared a feature tuple would teach the older, longer style on
 * every page that never mentions it.
 */
export function scaffoldFor(needs) {
  const want = new Set(needs)
  // Implied dependencies.
  if (want.has('data') || want.has('rows') || want.has('columns')) want.add('Person')
  if (want.has('columns')) want.add('people')
  if (want.has('orders')) want.add('Order')
  if (want.has('Row')) want.add('Person')

  const gridImports = ['SvGrid']
  if (want.has('columns')) gridImports.push('type GridColumns')
  if (want.has('api')) gridImports.push('type SvGridApi')
  if (want.has('features')) {
    gridImports.push('tableFeatures', 'rowSortingFeature', 'columnFilteringFeature')
  }

  const body = []
  for (const key of ['Person', 'Order', 'Row']) if (want.has(key)) body.push(PIECES[key])
  if (want.has('features')) {
    body.push(`  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })`)
  }
  if (want.has('people') || want.has('data') || want.has('rows')) body.push(PIECES.people)
  if (want.has('orders')) body.push(PIECES.orders)
  if (want.has('data')) body.push(`  const data = people`)
  if (want.has('rows')) body.push(`  let rows = $state<Person[]>(people)`)
  if (want.has('columns')) body.push(PIECES.columns)
  if (want.has('api')) body.push(PIECES.api)

  if (!body.length) return null
  return [
    'The examples on this page run against these rows:',
    '',
    '```svelte {preamble}',
    '<script lang="ts">',
    `  import { ${gridImports.join(', ')} } from '@svgrid/grid'`,
    '',
    body.join('\n\n'),
    '</script>',
    '```',
    '',
  ].join('\n')
}

/** Insert before the page's first fenced block. */
export function insertBefore(raw, block) {
  const crlf = raw.includes('\r\n')
  const text = raw.replace(/\r\n/g, '\n')
  if (/```svelte \{preamble\}/.test(text)) return null
  const lines = text.split('\n')
  const at = lines.findIndex((l) => /^```/.test(l))
  if (at === -1) return null
  lines.splice(at, 0, ...block.split('\n'))
  const out = lines.join('\n')
  return crlf ? out.replace(/\n/g, '\r\n') : out
}

if (process.argv[1]?.endsWith('doc-snippet-scaffold.mjs')) {
  const checkFile = process.argv[2] ?? 'check.txt'
  const write = process.argv.includes('--write')
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
  const docOf = new Map(manifest.snippets.map((s) => [s.id, s.doc]))

  const byDoc = new Map()
  for (const [id, names] of parseNeeds(readFileSync(checkFile, 'utf-8'))) {
    const doc = docOf.get(id)
    if (!doc) continue
    if (!byDoc.has(doc)) byDoc.set(doc, { blocks: 0, names: new Set() })
    const rec = byDoc.get(doc)
    rec.blocks += 1
    for (const n of names) rec.names.add(n)
  }

  let done = 0
  let blocks = 0
  for (const [doc, rec] of [...byDoc].sort((a, b) => b[1].blocks - a[1].blocks)) {
    // Only pages whose every missing name this scaffold can supply. A page that
    // also needs `savePersonField` needs a human.
    if (![...rec.names].every((n) => KNOWN.has(n))) continue
    const file = `docs/${doc}.md`
    const block = scaffoldFor(rec.names)
    if (!block) continue
    console.log(`${String(rec.blocks).padStart(2)} blocks  ${doc}  [${[...rec.names].join(' ')}]`)
    done += 1
    blocks += rec.blocks
    if (!write) continue
    const next = insertBefore(readFileSync(file, 'utf-8'), block)
    if (next) writeFileSync(file, next)
  }
  console.log(`\n${done} pages / ${blocks} blocks${write ? ' scaffolded' : ' would be scaffolded'}`)
}
