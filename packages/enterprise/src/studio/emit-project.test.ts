import { describe, expect, it } from 'vitest'
import { compile } from 'svelte/compiler'
import type { EntitySchema } from '../schema'
import { addBlock, addComponentBlock, addFreestandingScreen, addScreenAction, addTabBlock, createProject, enableScreenCode, parseProject, setDeployTarget, setEntityDataSource, setHandlerBody, setScreenHandlersSource, setScreenRenderGrid, setShell, setTheme, setThemePreset, updateBlock, updateScreen, type GridConfig, type MasterDetailConfig, type TabsConfig, type StudioProject } from './project'
import { emitStudioProject, emitStudioAppBundle, studioDeployInfo } from './emit-project'

const customers: EntitySchema = {
  name: 'customers', label: 'Customer', idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, hidden: { form: true } },
    { field: 'name', type: 'text' },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { field: 'mrr', type: 'number' },
  ],
}
const orders: EntitySchema = {
  name: 'orders', label: 'Order', idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true },
    { field: 'total', type: 'number' },
    { field: 'customer_id', type: 'relation', relation: { entity: 'customers', foreignKey: 'customer_id', labelField: 'name' } },
  ],
}

describe('emitStudioProject (per-block screens)', () => {
  const project = createProject([customers, orders])
  const files = emitStudioProject(project)
  const byPath = (p: string) => files.find((f) => f.path === p)

  it('emits shared modules, a page per screen, and the shell', () => {
    expect(files.map((f) => f.path)).toEqual(
      expect.arrayContaining([
        'src/lib/schemas.ts',
        'src/lib/data.ts',
        'src/routes/customers/+page.svelte',
        'src/routes/orders/+page.svelte',
        'src/routes/+layout.svelte',
        'src/routes/+page.svelte',
      ]),
    )
  })

  it('composes a grid + form screen (grid, controller, edit modal, New button)', () => {
    const page = byPath('src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('createServerDataSource')
    expect(page).toContain('<SvGrid')
    expect(page).toContain('onRowDoubleClick={(e) => (editing = e.row)}')
    expect(page).toContain('<SvGridEditPanel')
    expect(page).toContain('+ New Customer')
    // grid columns honor the block config (visible fields, in order)
    expect(page).toMatch(/const columns_grid_\d+ =/)
  })

  it('data.ts gives every row type its own `type` keyword (verbatimModuleSyntax-safe)', () => {
    // SvelteKit enables verbatimModuleSyntax; `type A, B` (B unmarked) is an error.
    const dataTs = byPath('src/lib/data.ts')!.contents
    const importLine = dataTs.split('\n').find((l) => l.includes("from './schemas'"))!
    expect(importLine).toMatch(/\btype Customers\b/)
    expect(importLine).toMatch(/\btype Orders\b/) // would be a bare `Orders` before the fix
  })

  it('matches the data.ts lookup var name for a snake_case relation field', () => {
    const page = byPath('src/routes/orders/+page.svelte')!.contents
    const dataTs = byPath('src/lib/data.ts')!.contents
    // orders.customer_id -> ordersCustomerIdLookup in both places
    expect(page).toContain('ordersCustomerIdLookup')
    expect(dataTs).toContain('ordersCustomerIdLookup')
  })

  it('emits chart / dashboard / kpi blocks bound to allRows', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'chart')
    p = addBlock(p, sid, 'dashboard')
    p = addBlock(p, sid, 'kpi')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('<SvSchemaChart')
    expect(page).toContain('<SvSchemaDashboard')
    expect(page).toContain('reduceValue(allRows,')
    expect(page).toContain('async function loadAll()')
  })

  it('Gauge block: emits SvGauge bound to a reduced measure over allRows', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'gauge')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/import \{[^}]*SvGauge[^}]*\} from '@svgrid\/grid'/)
    expect(page).toContain('<SvGauge value={reduceValue(allRows,')
    expect(page).toContain('min={0} max={100}')
    expect(page).toContain('.gaugecard')
  })

  it('Tree block: folds rows into SvTree nodes by a self-referential parent', () => {
    // A category entity that references itself via parent_id.
    const categories: EntitySchema = {
      name: 'categories', label: 'Category', idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'name', type: 'text' },
        { field: 'parent_id', type: 'relation', relation: { entity: 'categories', labelField: 'name' } },
      ],
    }
    let p = createProject([categories])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'tree')
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/categories/+page.svelte')!.contents
    expect(page).toMatch(/import \{[^}]*SvTree[^}]*\} from '@svgrid\/grid'/)
    expect(page).toContain('function toTreeNodes(')
    expect(page).toContain('<SvTree nodes={toTreeNodes(allRows')
    // Default config picked the self-referential FK as the parent link.
    expect(page).toContain('"name", "parent_id"')
    // The configured tree page (SvTree markup + helper) compiles.
    expect(() => compile(page, { filename: 'categories/+page.svelte', generate: 'client' })).not.toThrow()
  })

  it('Tabs block: nests display blocks into SvTabs panels bound to allRows', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'tabs')
    const tb = p.screens.find((s) => s.id === sid)!.blocks.find((b) => b.config.kind === 'tabs')!
    // Nest a chart in the first tab and a KPI in the second.
    let cfg = addTabBlock(tb.config as TabsConfig, 0, 'chart', customers)
    cfg = addTabBlock(cfg, 1, 'kpi', customers)
    p = updateBlock(p, sid, tb.id, { config: cfg })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/import \{[^}]*SvTabs[^}]*\} from '@svgrid\/grid'/)
    expect(page).toContain('{#snippet panel(id)}')
    expect(page).toContain('<SvSchemaChart')                 // chart child in tab 1
    expect(page).toContain('reduceValue(allRows,')            // kpi child in tab 2 uses allRows
    expect(page).toMatch(/let activeTab_\w+ = \$state\(/)      // one active-tab state var
    expect(page).toContain('async function loadAll()')        // nested aggs still load allRows
    expect(() => compile(page, { filename: 'customers/+page.svelte', generate: 'client' })).not.toThrow()
  })

  it('a chart-only screen has no controller/edit modal', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    // remove the default grid + form, leave a chart
    p = { ...p, screens: [{ ...p.screens[0]!, blocks: [] }] }
    p = addBlock(p, sid, 'chart')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).not.toContain('createServerDataSource')
    expect(page).not.toContain('SvGridEditPanel')
    expect(page).toContain('<SvSchemaChart')
  })

  it('honors a custom screen route + title', () => {
    const renamed = updateScreen(project, project.screens[0]!.id, { route: 'people', title: 'People' })
    const page = emitStudioProject(renamed).find((f) => f.path === 'src/routes/people/+page.svelte')!
    expect(page.contents).toContain('<h1 class="st__title">People</h1>')
  })

  it('every emitted .svelte compiles', () => {
    // Cover a screen with every block kind, with master-detail fully configured.
    let p = createProject([customers, orders])
    const sid = p.screens[0]!.id
    for (const k of ['chart', 'dashboard', 'kpi', 'gauge', 'tree', 'tabs', 'master-detail', 'lookup', 'pivot', 'filter', 'record'] as const) p = addBlock(p, sid, k)
    const mdId = p.screens.find((s) => s.id === sid)!.blocks.find((b) => b.config.kind === 'master-detail')!.id
    p = updateBlock(p, sid, mdId, { config: { childEntity: 'orders', foreignKey: 'customer_id' } as Partial<MasterDetailConfig> })
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('emits a real SvGridMasterDetail when the block has a child entity + foreign key', () => {
    // A customers screen with a master-detail into orders, linked by orders.customer_id.
    let p = createProject([customers, orders])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'master-detail')
    const mdId = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!.id
    p = updateBlock(p, sid, mdId, { config: { childEntity: 'orders', foreignKey: 'customer_id' } as Partial<MasterDetailConfig> })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents

    expect(page).toContain('<SvGridMasterDetail')
    expect(page).toContain('SvGridMasterDetail } from') // imported (part of the @svgrid/enterprise import)
    expect(page).toContain('detailSchema={ordersSchema}')
    expect(page).toContain('load_md_orders_rows()')       // child rows loaded in full
    expect(page).toContain("['customer_id']")             // getChildren keys on the FK
    expect(page).toContain('async function loadAll()')    // parent rows for the master grid
    // child schema + source come from the shared modules
    expect(page).toMatch(/import \{[^}]*\bordersSchema\b/)
    expect(page).toMatch(/import \{[^}]*\bordersSource\b/)
  })

  it('reloads allRows in save() so the master grid is not stale after an edit (no chart/kpi needed)', () => {
    // A default customers screen (grid + form) plus a master-detail into orders.
    let p = createProject([customers, orders])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'master-detail')
    const mdId = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!.id
    p = updateBlock(p, sid, mdId, { config: { childEntity: 'orders', foreignKey: 'customer_id' } as Partial<MasterDetailConfig> })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/editing = undefined\s*\n\s*await loadAll\(\)/)
  })

  it('a self-referential master-detail emits no duplicate imports and compiles', () => {
    const employees: EntitySchema = {
      name: 'employees', label: 'Employee', idField: 'id',
      fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'managerId', type: 'text' }],
    }
    let p = createProject([employees])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'master-detail')
    const mdId = p.screens[0]!.blocks.at(-1)!.id
    p = updateBlock(p, sid, mdId, { config: { childEntity: 'employees', foreignKey: 'managerId' } as Partial<MasterDetailConfig> })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/employees/+page.svelte')!.contents
    const importLine = page.split('\n').find((l) => l.includes("from '$lib/schemas'"))!
    expect(importLine.match(/employeesSchema/g)!).toHaveLength(1) // not duplicated
    expect(importLine.match(/\bEmployees\b/g)!).toHaveLength(1)  // pascal(employees) = Employees
    expect(() => compile(page, { filename: 'employees.svelte', generate: 'client' })).not.toThrow()
  })

  it('leaves a placeholder (and still compiles) when master-detail is unconfigured', () => {
    let p = createProject([customers, orders])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'master-detail')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('<!-- master-detail: set a child entity')
    expect(page).not.toContain('<SvGridMasterDetail')
    expect(() => compile(page, { filename: 'md.svelte', generate: 'client' })).not.toThrow()
  })

  it('emits a pivot block (SvPivotDesigner + fields/layout, loads all rows)', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'pivot')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('<SvPivotDesigner')
    expect(page).toMatch(/import \{[^}]*\bSvPivotDesigner\b/)
    expect(page).toContain('async function loadAll()')     // pivot reads the whole table
    expect(page).toContain("kind: 'measure', defaultAgg: 'sum'") // mrr becomes a measure
    expect(page).toContain("agg: 'sum'")
  })

  it('emits a filter panel that drives the grid controller', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'filter') // seeds tier (enum) + name (text) facets
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('class="st-filter"')
    expect(page).toContain('controller.setFilter({ columns: c })')
    expect(page).toContain("operator: 'equals'")   // enum facet
    expect(page).toContain("operator: 'contains'") // text facet
  })

  it('renders an error banner (with retry) + a friendly grid empty message', () => {
    const page = emitStudioProject(createProject([customers])).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('{#if view.error}')                 // no longer a silent empty grid
    expect(page).toContain('class="st-error"')
    expect(page).toContain('controller.refresh()')             // retry
    expect(page).toContain('emptyMessage="No customer yet."')  // friendly empty state
  })

  it('emits a record panel wired to the grid selection', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'record') // read-only by default
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('let selectedRecord = $state')
    expect(page).toContain('onRowClick={(e) => (selectedRecord = e.row)}') // grid publishes selection
    expect(page).toContain('<dl class="st-record">')                        // read-only field list
  })

  it('record panel honors its presentation (inline / modal / drawer)', () => {
    const pageFor = (presentation: 'inline' | 'modal' | 'drawer') => {
      let p = createProject([customers])
      const sid = p.screens[0]!.id
      p = addBlock(p, sid, 'record')
      const rid = p.screens.find((s) => s.id === sid)!.blocks.find((b) => b.config.kind === 'record')!.id
      p = updateBlock(p, sid, rid, { config: { editable: true, presentation } as Partial<import('./project').RecordConfig> })
      return emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    }
    expect(pageFor('inline')).toContain('<SvGridEditPanel schema={customersSchema} row={selectedRecord} presentation="inline"')
    expect(pageFor('modal')).toContain('presentation="modal"')
    expect(pageFor('drawer')).toContain('presentation="drawer"')
    // Modal/drawer only mount while a row is selected (float over the page).
    expect(pageFor('modal')).toContain('Select a row to open its edit dialog')
    expect(pageFor('drawer')).toContain('Select a row to open its editor drawer')
  })

  it('RBAC: emits access.ts, gates the UI, guards the server route + nav, and compiles', () => {
    let p = createProject([customers, orders])
    // Both entities get a +server.ts, so we can prove each route's authorize call
    // is bound to ITS OWN entity's screen id, not a shared/blanket value.
    p = setEntityDataSource(p, 'customers', { kind: 'sql', table: 'customers', dialect: 'postgres' })
    p = setEntityDataSource(p, 'orders', { kind: 'sql', table: 'orders', dialect: 'postgres' })
    p = { ...p, access: { enabled: true, defaultRole: 'viewer', roles: [
      { role: 'admin', screens: '*', actions: '*' },
      { role: 'viewer', screens: ['customers'], actions: [] },
    ] } }
    const files = emitStudioProject(p)

    const access = files.find((f) => f.path === 'src/lib/access.ts')!.contents
    expect(access).toContain('export type AppRole = "admin" | "viewer"')
    expect(access).toContain('export const currentRole = writable<AppRole>("viewer")')
    expect(access).toContain('export function authorizeAction')
    expect(access).toContain('export function getServerRole')
    // Reads are gated by screen access now (server-enforced), not blanket-allowed:
    // an entity with no bound screen (e.g. a lookup-only relation target) stays
    // open since there's nothing to gate it by.
    expect(access).toContain("if (action !== 'read') return can(role, action)")
    expect(access).toContain('if (screenIds.length === 0) return true')
    expect(access).toContain('return screenIds.some((id) => canScreen(role, id))')

    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain("import { currentRole, can } from '$lib/access'")
    expect(page).toContain("{#if can($currentRole, 'create')}") // New button gated
    expect(page).toContain("if (can($currentRole, 'update'))")   // edit gated

    // Each entity's route carries its OWN screen id(s) - not a shared/static value.
    const customersRoute = files.find((f) => f.path === 'src/routes/api/customers/+server.ts')!.contents
    expect(customersRoute).toContain('authorize: ({ action, event }) => authorizeAction(getServerRole(event), action, ["customers"])')
    const ordersRoute = files.find((f) => f.path === 'src/routes/api/orders/+server.ts')!.contents
    expect(ordersRoute).toContain('authorize: ({ action, event }) => authorizeAction(getServerRole(event), action, ["orders"])')

    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!.contents
    expect(layout).toContain('canScreen($currentRole, item.id)') // nav hides forbidden screens

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('emits no access.ts and no gating when RBAC is off', () => {
    const files = emitStudioProject(createProject([customers]))
    expect(files.find((f) => f.path === 'src/lib/access.ts')).toBeUndefined()
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).not.toContain('$lib/access')
    expect(page).not.toContain('$currentRole')
  })

  it('Audit: emits the store + route + viewer, wires connected routes, and compiles', () => {
    let p = createProject([customers, orders])
    p = setEntityDataSource(p, 'orders', { kind: 'sql', table: 'orders', dialect: 'postgres' })
    p = { ...p, audit: true }
    const files = emitStudioProject(p)

    expect(files.find((f) => f.path === 'src/lib/audit.ts')).toBeTruthy()
    expect(files.find((f) => f.path === 'src/routes/api/audit/+server.ts')).toBeTruthy()
    const viewer = files.find((f) => f.path === 'src/routes/audit/+page.svelte')!.contents
    expect(viewer).toContain("endpoint: '/api/audit'")

    const route = files.find((f) => f.path === 'src/routes/api/orders/+server.ts')!.contents
    expect(route).toContain("import { recordAudit } from '$lib/audit'")
    expect(route).toContain('audit: (e) => recordAudit(')
    expect(route).toContain('entity: "orders"')

    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!.contents
    expect(layout).toContain('Audit log') // nav gains the viewer link

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('emits no audit files without a SQL-bound entity (audit needs a server route)', () => {
    const files = emitStudioProject({ ...createProject([customers]), audit: true })
    expect(files.find((f) => f.path === 'src/lib/audit.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/routes/audit/+page.svelte')).toBeUndefined()
  })

  it('Layout: 12-col grid, colSpan gives finer widths (legacy span still works)', () => {
    let p = createProject([customers, orders])
    const cid = p.screens.find((s) => s.entity === 'customers')!.id
    const gridId = p.screens.find((s) => s.id === cid)!.blocks[0]!.id
    p = updateBlock(p, cid, gridId, { colSpan: 5 }) // finer than 1/2/3
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('class="st-screen"')    // 12-col grid lives in the responsive app.css class
    expect(page).toContain('grid-column: span 5') // colSpan honored
    // A legacy block with only `span` (default grid span 3) maps to 12 columns.
    const ordPage = emitStudioProject(p).find((f) => f.path === 'src/routes/orders/+page.svelte')!.contents
    expect(ordPage).toContain('grid-column: span 12')
  })

  it('No-code business logic: compiles formula -> computed and validations -> hooks.validate', () => {
    const invoices: EntitySchema = {
      name: 'invoices', label: 'Invoice', idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'qty', type: 'number' },
        { field: 'price', type: 'number' },
        { field: 'total', type: 'number', formula: 'qty * price' },
      ],
      validations: [
        { field: 'qty', op: 'gt', value: 0, message: 'Quantity must be positive' },
        { field: 'price', op: 'gte', compareTo: 'qty', message: 'Price must be at least qty' },
      ],
    }
    const files = emitStudioProject(createProject([invoices]))
    const schemas = files.find((f) => f.path === 'src/lib/schemas.ts')!.contents
    expect(schemas).toContain('.computed = (row) =>')
    expect(schemas).toContain('$.qty * $.price')                 // field names resolved to the row
    expect(schemas).toContain('.hooks = {')
    expect(schemas).toContain('errors["qty"] = "Quantity must be positive"')
    expect(schemas).toContain('Number($["price"]) >= Number($["qty"])') // cross-field compare
    // The no-code specs are NOT left in the data literal.
    expect(schemas).not.toContain('"formula"')
    expect(schemas).not.toContain('"validations"')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('PGlite: a zero-setup embedded-Postgres entity generates a client DB + seed, no server route', () => {
    let p = createProject([customers])
    p = setEntityDataSource(p, 'customers', { kind: 'pglite', table: 'customers' })
    const files = emitStudioProject(p)
    const data = files.find((f) => f.path === 'src/lib/data.ts')!.contents
    expect(data).toContain("import { PGlite } from '@electric-sql/pglite'")
    expect(data).toContain("new PGlite('idb://svgrid-studio')")
    expect(data).toContain('CREATE TABLE IF NOT EXISTS "customers"')
    // Schema-additions migrate on reload (CREATE TABLE IF NOT EXISTS is a no-op once the table exists).
    expect(data).toContain('ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "mrr" double precision')
    expect(data).not.toMatch(/ADD COLUMN IF NOT EXISTS "id"/) // never re-add the primary key
    expect(data).toContain('"mrr" double precision')            // typed column
    expect(data).toContain('createSqlDataSource<Customers>')     // real SQL source
    expect(data).toContain('await pgReady')                      // gated on bootstrap
    expect(data).toContain('_pgSeed(')                           // seeded once
    // Runs in the browser: NO server route.
    expect(files.find((f) => f.path === 'src/routes/api/customers/+server.ts')).toBeUndefined()
    // The exported app declares the dependency.
    const pkg = emitStudioAppBundle(p).find((f) => f.path === 'package.json')!.contents
    expect(pkg).toContain('@electric-sql/pglite')
  })

  it('PGlite: a curated seed on the source (e.g. an imported CSV) is what the local DB seeds', () => {
    let p = createProject([customers])
    const seed = [{ id: 7, name: 'Zaphod', email: 'z@beeble.brox', mrr: 999, active: true }]
    p = setEntityDataSource(p, 'customers', { kind: 'pglite', table: 'customers', seed })
    const data = emitStudioProject(p).find((f) => f.path === 'src/lib/data.ts')!.contents
    expect(data).toContain('"Zaphod"')          // the imported row, not the generator's
    expect(data).toContain('_pgSeed("customers"')
  })

  it('Deploy: default (auto) ships adapter-auto and no provider config', () => {
    const bundle = emitStudioAppBundle(createProject([customers]))
    const svelteCfg = bundle.find((f) => f.path === 'svelte.config.js')!.contents
    const pkg = bundle.find((f) => f.path === 'package.json')!.contents
    expect(svelteCfg).toContain("import adapter from '@sveltejs/adapter-auto'")
    expect(pkg).toContain('@sveltejs/adapter-auto')
    // No provider-specific config files in auto mode.
    expect(bundle.find((f) => f.path === 'netlify.toml')).toBeUndefined()
    expect(bundle.find((f) => f.path === 'wrangler.toml')).toBeUndefined()
  })

  it('Deploy: picking a target swaps the adapter + config and the README deploy steps', () => {
    const netlify = emitStudioAppBundle(setDeployTarget(createProject([customers]), 'netlify'))
    expect(netlify.find((f) => f.path === 'svelte.config.js')!.contents).toContain("'@sveltejs/adapter-netlify'")
    expect(netlify.find((f) => f.path === 'package.json')!.contents).toContain('@sveltejs/adapter-netlify')
    expect(netlify.find((f) => f.path === 'netlify.toml')!.contents).toContain('npm run build')
    expect(netlify.find((f) => f.path === 'README.md')!.contents).toContain('netlify deploy')

    const cf = emitStudioAppBundle(setDeployTarget(createProject([customers], { title: 'My App' }), 'cloudflare'))
    const wrangler = cf.find((f) => f.path === 'wrangler.toml')!.contents
    expect(wrangler).toContain('name = "my-app"')
    expect(wrangler).toContain('pages_build_output_dir = ".svelte-kit/cloudflare"')
    expect(cf.find((f) => f.path === 'svelte.config.js')!.contents).toContain("'@sveltejs/adapter-cloudflare'")

    // The designer's Deploy panel reads the same facts.
    const info = studioDeployInfo(setDeployTarget(createProject([customers]), 'vercel'))
    expect(info).toMatchObject({ label: 'Vercel', cli: 'npx vercel --prod', dashboard: 'https://vercel.com/new' })
  })

  it('Deploy: setDeployTarget(auto) clears the target (round-trips clean)', () => {
    const p = setDeployTarget(setDeployTarget(createProject([customers]), 'vercel'), 'auto')
    expect(p.deploy).toBeUndefined()
    expect(parseProject(JSON.stringify(p)).deploy).toBeUndefined()
  })

  it('Round-trip: the exported bundle ships studio.config.json that re-parses into the designer', () => {
    const p = setShell(createProject([customers, orders]), { brand: 'Acme', logo: 'data:image/png;base64,AA' })
    const bundle = emitStudioAppBundle(p)
    const cfg = bundle.find((f) => f.path === 'studio.config.json')
    expect(cfg).toBeTruthy()
    const reparsed = parseProject(cfg!.contents)         // Load-able back into the designer
    expect(reparsed.entities.map((e) => e.name)).toEqual(['customers', 'orders'])
    expect(reparsed.screens.length).toBe(p.screens.length)
    expect(reparsed.theme?.shell?.logo).toBe('data:image/png;base64,AA') // logo survives the round-trip
    expect(bundle.find((f) => f.path === 'README.md')!.contents).toContain('Round-tripping back into the designer')
  })

  it('Shell: responsive sidebar (burger + drawer), a company logo, and a stacking screen grid', () => {
    let p = createProject([customers])
    p = setShell(p, { style: 'sidebar', brand: 'Acme', logo: 'data:image/png;base64,AAAA' })
    const files = emitStudioProject(p)
    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!.contents
    expect(layout).toContain('sv-app__mobilebar')                       // mobile bar
    expect(layout).toContain('sv-app__burger')                          // hamburger toggle
    expect(layout).toContain('let navOpen = $state(false)')             // drawer state
    expect(layout).toContain('sv-app__backdrop')
    expect(layout).toContain('const logo = "data:image/png;base64,AAAA"')
    expect(layout).toContain('<img class="sv-app__logo"')              // logo rendered
    // Collapsible sidebar: docks on desktop, collapses to a drawer on tablet/phone.
    expect(layout).toContain('sv-app__collapse')                        // desktop collapse toggle
    expect(layout).toContain('class:is-drawer={drawer}')               // drawer class binding
    expect(layout).toContain("matchMedia('(max-width: 1024px)')")      // tablet/phone -> collapsed
    expect(layout).toContain("localStorage.setItem('svapp:nav'")       // collapse choice persists

    const appcss = emitStudioAppBundle(p).find((f) => f.path === 'src/app.css')!.contents
    expect(appcss).toContain('.st-screen')
    expect(appcss).toContain('grid-template-columns: repeat(12, 1fr)')
    expect(appcss).toContain('@media (max-width: 720px)')              // blocks stack on mobile

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('Conditional formatting: compiles no-code rules into the grid rule engine', () => {
    let p = createProject([customers])
    const cid = p.screens[0]!.id
    const gridId = p.screens[0]!.blocks.find((b) => b.config.kind === 'grid')!.id
    p = updateBlock(p, cid, gridId, { config: { formatRules: [
      { field: 'mrr', op: 'lt', value: 0, color: '#dc2626', bold: true },
      { field: 'tier', op: 'eq', value: 'pro', background: '#eef2ff' },
    ] } as Partial<GridConfig> })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('conditionalFormats={[')
    expect(page).toContain("type: 'rule' as const")
    expect(page).toContain("columns: ['mrr']")
    expect(page).toContain('Number(value) < 0')
    expect(page).toContain('fontWeight: 700')
    expect(page).toContain("String(value) === \"pro\"")
    expect(() => compile(page, { filename: 'cf.svelte', generate: 'client' })).not.toThrow()
  })

  it('Navigation: drill-through, chart drill, URL filters, and row actions - and compiles', () => {
    let p = createProject([customers, orders])
    const cid = p.screens.find((s) => s.entity === 'customers')!.id
    const gridId = p.screens.find((s) => s.id === cid)!.blocks.find((b) => b.config.kind === 'grid')!.id
    p = updateBlock(p, cid, gridId, { config: {
      rowLink: { screen: 'orders', sourceField: 'id', targetField: 'customer_id' },
      rowActions: [{ kind: 'edit' }, { kind: 'delete' }, { kind: 'navigate', screen: 'orders', sourceField: 'id', targetField: 'customer_id', label: 'Orders' }],
    } as Partial<GridConfig> })
    const files = emitStudioProject(p)

    const cust = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(cust).toContain("import { goto } from '$app/navigation'")
    expect(cust).toContain("onRowClick={(e) => goto('/orders?customer_id='") // drill-through on row click
    expect(cust).toContain("id: '__actions'")                                // synthetic action column
    expect(cust).toContain('renderSnippet(rowActions_')
    expect(cust).toContain('{#snippet rowActions_')
    expect(cust).toContain('controller.deleteRow(')                          // delete button (fills the missing affordance)

    const ord = files.find((f) => f.path === 'src/routes/orders/+page.svelte')!.contents
    expect(ord).toContain("import { page } from '$app/stores'")              // drill TARGET reads URL params
    expect(ord).toContain('sp.get(_f)')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('i18n: emits the catalog, routes labels + headers through t(), and compiles', () => {
    const p = { ...createProject([customers]), i18n: { enabled: true, locales: ['en', 'es'], defaultLocale: 'en' } }
    const files = emitStudioProject(p)

    const cat = files.find((f) => f.path === 'src/lib/i18n.ts')!.contents
    expect(cat).toContain('export type Locale = "en" | "es"')
    expect(cat).toContain('export const currentLocale = writable<Locale>("en")')
    expect(cat).toContain('export function localizeCols')
    expect(cat).toContain('"col.customers.name"')  // seeded from the schema
    expect(cat).toContain('"nav.customers"')
    expect(cat).toContain('"es": {}')              // other locale left for translators

    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain("import { t, localizeCols } from '$lib/i18n'")
    expect(page).toContain("$t('screen.customers'")   // localized title
    expect(page).toContain('localizeCols(')            // localized column headers

    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!.contents
    expect(layout).toContain("import { t, currentLocale, locales } from '$lib/i18n'")
    expect(layout).toContain('sv-app__locale')         // the language switcher

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('i18n: KPI / Gauge / Tab labels route through t() (not raw literals)', () => {
    let p: StudioProject = { ...createProject([customers]), i18n: { enabled: true, locales: ['en', 'es'], defaultLocale: 'en' } }
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'kpi')
    p = addBlock(p, sid, 'gauge')
    p = addBlock(p, sid, 'tabs')
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/\{\$t\('block\.kpi-[^']+', /)   // KPI label localized
    expect(page).toMatch(/\{\$t\('block\.gauge-[^']+', /) // Gauge label localized
    expect(page).toMatch(/label: \$t\('tab\.tabs-[^']+'/) // Tab labels localized in the tabs array
    // Without i18n the same labels stay raw literals (no $t wrapper).
    let plain = createProject([customers])
    plain = addBlock(plain, plain.screens[0]!.id, 'kpi')
    const plainPage = emitStudioProject(plain).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(plainPage).not.toContain("$t('block.")
  })

  it('throws on a screen pointing at a missing entity', () => {
    const broken = { ...project, screens: [{ ...project.screens[0]!, entity: 'ghosts' }] }
    expect(() => emitStudioProject(broken)).toThrow(/missing entity/)
  })
})

describe('Custom actions', () => {
  it('a toolbar action on an entity-bound screen emits a wired handler + button + stub route, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addScreenAction(p, sid, { label: 'Sync now', icon: '\u{1F504}', confirm: 'Sync now?' })
    const actionId = p.screens[0]!.actions![0]!.id
    const files = emitStudioProject(p)

    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain(`let actionBusy_${actionId.replace(/-/g, '_')} = $state(false)`)
    expect(page).toContain(`fetch('/api/actions/${actionId}'`)
    expect(page).toContain('Sync now')
    expect(page).toContain(`confirm('Sync now?')`)

    const route = files.find((f) => f.path === `src/routes/api/actions/${actionId}/+server.ts`)!.contents
    expect(route).toContain('export async function POST')
    expect(route).toContain('TODO: your business logic here')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('a row-level custom action renders per row, wired to the same stub route, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gridId = p.screens[0]!.blocks.find((b) => b.config.kind === 'grid')!.id
    p = addScreenAction(p, sid, { label: 'Resend invoice' })
    const actionId = p.screens[0]!.actions![0]!.id
    p = updateScreen(p, sid, { actions: [] }) // the action now lives only on the row, not the toolbar
    p = updateBlock(p, sid, gridId, { config: {
      rowActions: [{ kind: 'custom', id: actionId, label: 'Resend invoice' }],
    } as Partial<GridConfig> })
    const files = emitStudioProject(p)

    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain("id: '__actions'") // synthetic action column
    expect(page).toContain(`runAction_${actionId.replace(/-/g, '_')}({ id: `)
    expect(page).toContain('Resend invoice')

    expect(files.find((f) => f.path === `src/routes/api/actions/${actionId}/+server.ts`)).toBeTruthy()

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('a freestanding screen (no entity) renders a toolbar action and no grid/data plumbing, and compiles', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports', route: 'reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addScreenAction(p, sid, { label: 'Run report' })
    const actionId = p.screens.find((s) => s.id === sid)!.actions![0]!.id
    const files = emitStudioProject(p)

    const page = files.find((f) => f.path === 'src/routes/reports/+page.svelte')!.contents
    expect(page).toContain('Run report')
    expect(page).toContain(`fetch('/api/actions/${actionId}'`)
    expect(page).not.toContain('createServerDataSource')
    expect(page).not.toContain('<SvGrid')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('RBAC-gated action: the toolbar button and the stub route both check canScreen', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports', route: 'reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addScreenAction(p, sid, { label: 'Run report' })
    const actionId = p.screens.find((s) => s.id === sid)!.actions![0]!.id
    p = { ...p, access: { enabled: true, defaultRole: 'viewer', roles: [
      { role: 'admin', screens: '*', actions: '*' },
      { role: 'viewer', screens: [], actions: [] },
    ] } }
    const files = emitStudioProject(p)

    const page = files.find((f) => f.path === 'src/routes/reports/+page.svelte')!.contents
    expect(page).toContain(`{#if canScreen($currentRole, '${sid}')}`)

    const route = files.find((f) => f.path === `src/routes/api/actions/${actionId}/+server.ts`)!.contents
    expect(route).toContain("import { getServerRole, canScreen } from '$lib/access'")
    expect(route).toContain(`if (!canScreen(getServerRole(event), '${sid}'))`)
    expect(route).toContain('status: 403')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })
})

describe('Component blocks', () => {
  it('a component block mixed onto an entity-bound screen emits the import + literal markup, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addComponentBlock(p, sid, 'button', { variant: 'primary', block: true }, 0)
    const files = emitStudioProject(p)

    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    const importLine = page.split('\n').find((l) => l.includes("from '@svgrid/grid'"))!
    expect(importLine).toContain('SvButton') // merged into the screen's one @svgrid/grid import
    expect(page).toContain("<SvButton variant={'primary'} size={'md'} block>{'Click me'}</SvButton>")

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('a freestanding screen with component blocks emits deduped imports + markup for each, and compiles', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports', route: 'reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addComponentBlock(p, sid, 'button', { variant: 'secondary' })
    p = addComponentBlock(p, sid, 'badge', { variant: 'success' })
    const files = emitStudioProject(p)

    const page = files.find((f) => f.path === 'src/routes/reports/+page.svelte')!.contents
    expect(page).toContain("import { SvBadge, SvButton } from '@svgrid/grid'") // sorted, deduped
    expect(page).toContain("<SvButton variant={'secondary'} size={'md'}>{'Click me'}</SvButton>")
    expect(page).toContain("<SvBadge variant={'success'} size={'md'} pill>{'Badge'}</SvBadge>")
    expect(page).not.toContain('Add your own content here')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('an empty freestanding screen (no blocks) still emits the placeholder comment', () => {
    const p = addFreestandingScreen(createProject([customers]), { title: 'Reports', route: 'reports' })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/reports/+page.svelte')!.contents
    expect(page).toContain('Add your own content here')
  })

  it('a component with a free-typed label containing quotes/braces cannot break out of the markup, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addComponentBlock(p, sid, 'button', { _content: `it's a "test" {value}` }, 0)
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(() => compile(page, { filename: 'page.svelte', generate: 'client' })).not.toThrow()
  })

  it('an unrecognized component key emits a harmless placeholder comment instead of throwing', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports', route: 'reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addComponentBlock(p, sid, 'not-a-real-component', {})
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/reports/+page.svelte')!.contents
    expect(page).toContain('unknown component "not-a-real-component"')
    expect(() => compile(page, { filename: 'page.svelte', generate: 'client' })).not.toThrow()
  })
})

describe('data-source codegen', () => {
  const byPathOf = (files: ReturnType<typeof emitStudioProject>, path: string) => files.find((f) => f.path === path)

  it('emits createRestDataSource for a REST-bound entity with response mapping', () => {
    let p = createProject([customers])
    p = setEntityDataSource(p, 'customers', {
      kind: 'rest', baseUrl: 'https://api.example.com/v1', path: 'customers', method: 'GET',
      params: [
        { name: 'X-Key', location: 'header', type: 'string', value: 'abc' },
        { name: 'region', location: 'query', type: 'string', value: 'eu' },
      ],
      rowsPath: 'data.items', totalPath: 'data.total',
    })
    const dataTs = byPathOf(emitStudioProject(p), 'src/lib/data.ts')!.contents
    expect(dataTs).toContain('createRestDataSource')
    expect(dataTs).toContain("url: 'https://api.example.com/v1/customers'")
    expect(dataTs).toContain("headers: { 'X-Key': 'abc' }")
    expect(dataTs).toContain("query: { 'region': 'eu' }") // static query params baked into every read
    expect(dataTs).toContain('body?.data?.items')
    expect(dataTs).not.toContain('createInMemoryDataSource') // customers is REST-bound
  })

  it('substitutes static path params into the URL', () => {
    let p = createProject([customers])
    p = setEntityDataSource(p, 'customers', {
      kind: 'rest', baseUrl: 'https://api', path: 'albums/{id}/tracks', method: 'GET',
      params: [{ name: 'id', location: 'path', type: 'string', value: '5' }],
    })
    const dataTs = byPathOf(emitStudioProject(p), 'src/lib/data.ts')!.contents
    expect(dataTs).toContain("url: 'https://api/albums/5/tracks'")
  })

  it('SQL-bound entity emits a connected +server.ts route + a Kit transport client', () => {
    let p = createProject([customers, orders])
    p = setEntityDataSource(p, 'orders', { kind: 'sql', table: 'orders', dialect: 'postgres' })
    const files = emitStudioProject(p)
    const dataTs = byPathOf(files, 'src/lib/data.ts')!.contents
    // Client talks to the API route, not a raw SQL source in the browser.
    expect(dataTs).toContain("createKitDataSource<Orders>({ endpoint: '/api/orders' })")
    expect(dataTs).not.toContain('createSqlDataSource')
    const route = byPathOf(files, 'src/routes/api/orders/+server.ts')
    expect(route).toBeTruthy()
    expect(route!.contents).toContain("import pg from 'pg'")
    expect(route!.contents).toContain("import { env } from '$env/dynamic/private'")
    expect(route!.contents).toContain('createSqlDataSource<Orders>')
    expect(route!.contents).toContain("dialect: { placeholders: '$', ilike: true }")
    expect(route!.contents).toContain('createKitHandlers({')
    expect(route!.contents).toContain('schema: ordersSchema')
    expect(route!.contents).toContain('validate: true') // server-enforced validation on every connected route
    // No connections.ts when nothing needs a browser-side client.
    expect(byPathOf(files, 'src/lib/connections.ts')).toBeUndefined()
  })

  it('picks the right driver per dialect', () => {
    for (const [dialect, needle] of [['mysql', "import mysql from 'mysql2/promise'"], ['sqlite', "import Database from 'better-sqlite3'"], ['mssql', "import mssql from 'mssql'"], ['turso', "import { createClient } from '@libsql/client'"]] as const) {
      let p = createProject([customers])
      p = setEntityDataSource(p, 'customers', { kind: 'sql', table: 'customers', dialect })
      const route = byPathOf(emitStudioProject(p), 'src/routes/api/customers/+server.ts')!
      expect(route.contents).toContain(needle)
    }
  })

  it('Provisioning: a Turso (libSQL) entity wires the client + auth token + a .env.example', () => {
    let p = createProject([customers])
    p = setEntityDataSource(p, 'customers', { kind: 'sql', table: 'customers', dialect: 'turso' })
    const bundle = emitStudioAppBundle(p)
    const route = bundle.find((f) => f.path === 'src/routes/api/customers/+server.ts')!.contents
    expect(route).toContain("import { createClient } from '@libsql/client'")
    expect(route).toContain('env.DATABASE_AUTH_TOKEN')
    expect(route).toContain("dialect: { placeholders: '?' }")
    const pkg = bundle.find((f) => f.path === 'package.json')!.contents
    expect(pkg).toContain('@libsql/client')
    const envEx = bundle.find((f) => f.path === '.env.example')!.contents
    expect(envEx).toContain('DATABASE_URL=')
    expect(envEx).toContain('DATABASE_AUTH_TOKEN=')
  })

  it('.env.example lists DATABASE_URL for SQL apps, and is omitted for zero-setup apps', () => {
    let sql = createProject([customers])
    sql = setEntityDataSource(sql, 'customers', { kind: 'sql', table: 'customers', dialect: 'postgres' })
    const envEx = emitStudioAppBundle(sql).find((f) => f.path === '.env.example')!.contents
    expect(envEx).toContain('DATABASE_URL=')
    expect(envEx).not.toContain('DATABASE_AUTH_TOKEN')
    // In-memory / PGlite apps need no env, so no .env.example.
    expect(emitStudioAppBundle(createProject([customers])).find((f) => f.path === '.env.example')).toBeUndefined()
  })

  it('emits a real Supabase client from a project URL + anon key', () => {
    let p = createProject([customers])
    p = setEntityDataSource(p, 'customers', { kind: 'supabase', table: 'customers', url: 'https://x.supabase.co', key: 'anon123' })
    const conn = byPathOf(emitStudioProject(p), 'src/lib/connections.ts')!.contents
    expect(conn).toContain("import { createClient } from '@supabase/supabase-js'")
    expect(conn).toContain("createClient('https://x.supabase.co', 'anon123')")
  })

  it('falls back to a Supabase null stub without url/key', () => {
    let p = createProject([customers])
    p = setEntityDataSource(p, 'customers', { kind: 'supabase', table: 'customers' })
    const conn = byPathOf(emitStudioProject(p), 'src/lib/connections.ts')!.contents
    expect(conn).toContain('supabaseClient = null as unknown as SupabaseClientLike')
    expect(conn).not.toMatch(/^import \{ createClient \}/m) // no real client import without creds
  })

  it('every emitted .svelte compiles with mixed REST + Supabase sources', () => {
    let p = createProject([customers, orders])
    p = setEntityDataSource(p, 'customers', { kind: 'rest', baseUrl: 'https://api', path: 'customers', method: 'GET', params: [] })
    p = setEntityDataSource(p, 'orders', { kind: 'supabase', table: 'orders' })
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })
})

describe('grid editing (a Grid property) -> codegen', () => {
  const pageFor = (p: Parameters<typeof emitStudioProject>[0]) =>
    emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
  const withGrid = (patch: Partial<GridConfig>) => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    p = updateBlock(p, sid, gid, { config: patch as Partial<import('./project').BlockConfig> })
    return p
  }

  it('form editing (default) emits the edit panel + New button + non-editable cells', () => {
    const page = pageFor(createProject([customers]))
    expect(page).toContain('<SvGridEditPanel')
    expect(page).toContain('+ New Customer')
    expect(page).toContain('onRowDoubleClick')
    expect(page).toContain('editable: false')
  })

  it('inline editing emits onCellValueChange -> updateRow, editable cells, no edit panel', () => {
    const page = pageFor(withGrid({ editing: 'inline' }))
    expect(page).toContain('onCellValueChange')
    expect(page).toContain('controller.updateRow(')
    expect(page).not.toContain('<SvGridEditPanel')
    expect(page).not.toContain('editable: false')
  })

  it('read-only editing emits no editors', () => {
    const page = pageFor(withGrid({ editing: 'none' }))
    expect(page).not.toContain('onCellValueChange')
    expect(page).not.toContain('<SvGridEditPanel')
    expect(page).not.toContain('onRowDoubleClick')
    expect(page).toContain('editable: false')
  })

  it('sortable / filterable toggles gate the grid props', () => {
    const page = pageFor(withGrid({ sortable: false, filterable: true }))
    expect(page).not.toContain('onSortingChange')
    expect(page).toContain('onFiltersChange')
    expect(page).toContain('controller.setFilter')
  })

  it('form presentation is honored', () => {
    expect(pageFor(withGrid({ formPresentation: 'drawer' }))).toContain('presentation="drawer"')
  })

  it('page size flows into the controller', () => {
    expect(pageFor(withGrid({ pageSize: 25 }))).toContain('pageSize: 25')
  })

  it('striped / cell-selection / totals / density map to grid props', () => {
    const page = pageFor(withGrid({ striped: true, cellSelection: true, rowSummaries: true, density: 'compact' }))
    expect(page).toContain('zebraRows')
    expect(page).toContain('enableCellSelection')
    expect(page).toContain('enableRowSummaries={true}')
    expect(page).toContain('rowHeight={28}')
  })

  it('normal density + defaults emit no rowHeight and totals off', () => {
    const page = pageFor(createProject([customers]))
    expect(page).toContain('enableRowSummaries={false}')
    expect(page).not.toContain('rowHeight=')
  })

  it('per-column header / width / align overrides flow into the columns', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    const cfg = p.screens[0]!.blocks[0]!.config as GridConfig
    const columns = cfg.columns.map((c) => (c.field === 'name' ? { ...c, header: 'Full name', width: 220, align: 'center' as const } : c))
    p = updateBlock(p, sid, gid, { config: { columns } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    expect(page).toContain("'name': { header: \"Full name\", width: 220, align: 'center' }")
    expect(page).toContain('...(ov[String(c.field)] ?? {})')
  })

  it('pager position + page-size options map to grid props', () => {
    const page = pageFor(withGrid({ paginationPosition: 'both', pageSizeOptions: [20, 40, 80] }))
    expect(page).toContain('showPagination')
    expect(page).toContain('paginationPosition="both"')
    expect(page).toContain('pageSizeOptions={[20, 40, 80]}')
  })

  it('default paging (bottom, [10,25,50,100]) stays implicit', () => {
    const page = pageFor(createProject([customers]))
    expect(page).toContain('showPagination')
    expect(page).not.toContain('paginationPosition=')
    expect(page).not.toContain('pageSizeOptions=')
  })

  it('an unpaginated grid loads all rows and shows no pager', () => {
    const page = pageFor(withGrid({ paginated: false }))
    expect(page).not.toContain('showPagination')
    expect(page).toContain('pageSize: 1000') // controller loads everything at once
  })

  it('column pinning emits initialColumnPinning + disables column virtualization', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    const cfg = p.screens[0]!.blocks[0]!.config as GridConfig
    const columns = cfg.columns.map((c) => (c.field === 'name' ? { ...c, pin: 'left' as const } : c))
    p = updateBlock(p, sid, gid, { config: { columns } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    expect(page).toContain("initialColumnPinning={{ left: ['name'] }}")
    expect(page).toContain('columnVirtualization={false}')
  })
})

describe('emitStudioAppBundle (full runnable app)', () => {
  it('emits a complete SvelteKit + Vite project (scaffolding + screens)', () => {
    const paths = emitStudioAppBundle(createProject([customers, orders], { title: 'My Sales App' })).map((f) => f.path)
    for (const p of [
      'package.json', 'svelte.config.js', 'vite.config.ts', 'tsconfig.json',
      'src/app.html', 'src/app.css', 'src/app.d.ts', 'src/routes/+layout.ts', 'README.md',
      'src/lib/schemas.ts', 'src/lib/data.ts', 'src/routes/+layout.svelte', 'src/routes/customers/+page.svelte',
    ]) {
      expect(paths).toContain(p)
    }
  })

  it('package.json has a slugged name, run scripts, and the runtime deps', () => {
    const pkg = JSON.parse(emitStudioAppBundle(createProject([customers], { title: 'My Sales App!' })).find((f) => f.path === 'package.json')!.contents)
    expect(pkg.name).toBe('my-sales-app')
    expect(pkg.scripts.dev).toBe('vite dev')
    expect(pkg.dependencies['@svgrid/grid']).toBeTruthy()
    expect(pkg.dependencies['@svgrid/enterprise']).toBeTruthy()
    expect(pkg.devDependencies['@sveltejs/kit']).toBeTruthy()
    expect(pkg.devDependencies['vite']).toBeTruthy()
  })

  it('ships a per-entity smoke test + vitest wiring', () => {
    const bundle = emitStudioAppBundle(createProject([customers, orders], { title: 'My Sales App' }))
    const pkg = JSON.parse(bundle.find((f) => f.path === 'package.json')!.contents)
    expect(pkg.scripts.test).toBe('vitest run')
    expect(pkg.devDependencies['vitest']).toBeTruthy()
    expect(bundle.find((f) => f.path === 'vitest.config.ts')).toBeTruthy()
    const test = bundle.find((f) => f.path === 'src/lib/schemas.test.ts')!.contents
    // one describe block per entity, asserting render + data-source round-trip
    expect(test).toContain('describe("Customer"')
    expect(test).toContain('describe("Order"')
    expect(test).toContain('schemaToColumns(customersSchema)')
    expect(test).toContain('schemaToFormFields(customersSchema)')
    expect(test).toContain('createInMemoryDataSource<Customers>([], customersSchema)')
    expect(test).toContain('round-trips create -> read -> delete')
    expect(test).toContain("from './schemas'")
  })

  it('adds the driver dep when an entity binds to Supabase / SQL', () => {
    let sb = createProject([customers])
    sb = setEntityDataSource(sb, 'customers', { kind: 'supabase', table: 'customers', url: 'https://x.supabase.co', key: 'k' })
    expect(JSON.parse(emitStudioAppBundle(sb).find((f) => f.path === 'package.json')!.contents).dependencies['@supabase/supabase-js']).toBeTruthy()

    let sql = createProject([customers])
    sql = setEntityDataSource(sql, 'customers', { kind: 'sql', table: 'customers', dialect: 'postgres' })
    expect(JSON.parse(emitStudioAppBundle(sql).find((f) => f.path === 'package.json')!.contents).dependencies['pg']).toBeTruthy()
  })
})

describe('pages (nav) + shell codegen', () => {
  const layoutOf = (p: Parameters<typeof emitStudioProject>[0]) =>
    emitStudioProject(p).find((f) => f.path === 'src/routes/+layout.svelte')!.contents

  it('drops hidden pages from nav and honors label + order', () => {
    let p = createProject([customers, orders])
    p = updateScreen(p, 'orders', { nav: { show: false } })
    p = updateScreen(p, 'customers', { nav: { label: 'Clients', order: 5 } })
    const layout = layoutOf(p)
    expect(layout).toContain('Clients')
    expect(layout).not.toContain('"/orders"') // orders excluded from the nav json
  })

  it('emits a top-nav shell with brand + footer', () => {
    const p = setShell(createProject([customers]), { style: 'top-nav', brand: 'Acme', footer: '(c) Acme' })
    const layout = layoutOf(p)
    expect(layout).toContain('sv-app--top')
    expect(layout).toContain('Acme')
    expect(layout).toContain('(c) Acme')
  })

  it('emits a bottom-nav shell (fixed bar, no sidebar drawer state, footer text dropped) that compiles', () => {
    const p = setShell(createProject([customers, orders]), { style: 'bottom-nav', brand: 'Acme', footer: '(c) Acme' })
    const layout = layoutOf(p)
    expect(layout).toContain('sv-app--bottom')
    expect(layout).toContain('sv-app__bar--bottom')
    expect(layout).toContain('Acme')
    // The bottom bar occupies that visual role; footer text is intentionally not rendered
    // in the markup (the `const footer = ...` script declaration is unconditional and stays,
    // but nothing in the bottom-nav body dereferences it).
    expect(layout).not.toContain('<footer class="sv-app__footbar">')
    // top-nav/sidebar-only collapse state must not leak into the bottom-nav shell.
    expect(layout).not.toContain('let collapsed = $state')
    expect(() => compile(layout, { filename: '+layout.svelte', generate: 'client' })).not.toThrow()
  })

  it('defaults to sidebar; an empty footer omits the footer element', () => {
    const p = setShell(createProject([customers]), { footer: '' })
    const layout = layoutOf(p)
    expect(layout).toContain('sv-app--side')
    expect(layout).not.toContain('class="sv-app__foot"')
  })

  it('emits the chosen theme preset tokens into :root', () => {
    const p = setThemePreset(createProject([customers]), 'material')
    const layout = layoutOf(p)
    expect(layout).toContain('--sg-accent: #6750a4')     // Material 3 light accent
    expect(layout).toContain('--sg-header-bg: #f3edf7')  // Material 3 light surface
    expect(layout).toContain('--sg-radius: 8px')
  })

  it('dark mode emits the dark palette + color-scheme: dark', () => {
    const p = setTheme(setThemePreset(createProject([customers]), 'tailwind'), { mode: 'dark' })
    const layout = layoutOf(p)
    expect(layout).toContain('--sg-bg: #0f172a')   // Tailwind dark bg
    expect(layout).toContain('color-scheme: dark')
  })

  it('an accent override wins over the preset default accent', () => {
    const p = setTheme(setThemePreset(createProject([customers]), 'github'), { accent: '#123456' })
    const layout = layoutOf(p)
    expect(layout).toContain('--sg-accent: #123456')
    expect(layout).not.toContain('--sg-accent: #0969da')
  })

  it('custom CSS is appended to the generated app.css', () => {
    const p = setTheme(createProject([customers]), { customCss: '.st__title { letter-spacing: -0.03em; }' })
    const appcss = emitStudioAppBundle(p).find((f) => f.path === 'src/app.css')!.contents
    expect(appcss).toContain('Custom CSS (from the designer)')
    expect(appcss).toContain('.st__title { letter-spacing: -0.03em; }')
    // No custom block when unset.
    expect(emitStudioAppBundle(createProject([customers])).find((f) => f.path === 'src/app.css')!.contents).not.toContain('Custom CSS (from the designer)')
  })
})

describe('code companion (design + your own code)', () => {
  // A blank page with code enabled + a Grid fed by onLoad.
  const build = () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Report', route: 'report' })
    const sid = p.screens.find((s) => s.route === 'report')!.id
    p = setScreenRenderGrid(p, sid, true) // implies code enabled
    return { p, sid }
  }

  it('emits a user-owned handlers.ts (onLoad) + a regenerated page-context.ts', () => {
    const { p } = build()
    const files = emitStudioProject(p)
    const companion = files.find((f) => f.path === 'src/routes/report/handlers.ts')
    expect(companion, 'companion emitted').toBeTruthy()
    expect(companion!.userOwned).toBe(true)
    expect(companion!.contents).toContain('export async function onLoad(ctx: PageContext): Promise<void>')
    expect(companion!.contents).toContain("import type { PageContext } from './page-context'")
    expect(companion!.contents).toContain('never overwrites')
    // The context type + shared handle runtime are generated (not user-owned).
    const ctx = files.find((f) => f.path === 'src/routes/report/page-context.ts')!
    expect(ctx.userOwned).toBeFalsy()
    expect(ctx.contents).toContain('export type PageContext')
    expect(files.find((f) => f.path === 'src/lib/handles.svelte.ts')).toBeTruthy()
  })

  it('onLoad exists even with no Grid (a general mount hook, not grid-gated)', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Plain', route: 'plain' })
    const sid = p.screens.find((s) => s.route === 'plain')!.id
    p = enableScreenCode(p, sid) // code on, but renderGrid off
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/plain/+page.svelte')!
    expect(emitStudioProject(p).find((f) => f.path === 'src/routes/plain/handlers.ts')!.contents).toContain('export async function onLoad(ctx: PageContext)')
    expect(page.contents).not.toContain('<SvGrid')
    expect(page.contents).toContain('handlers.onLoad(') // still wired on mount
  })

  it('the page runs onLoad in onMount, renders the Grid, and compiles', () => {
    const { p } = build()
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/report/+page.svelte')!
    expect(page.contents).toContain("import * as handlers from './handlers'")
    expect(page.contents).toContain('handlers.onLoad({ grid: gridApi!, setRows:')
    expect(page.contents).toContain('<SvGrid data={rows} columns={columns} features={features}')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('the Grid is exposed as its real SvGridApi (ctx.grid), typed in page-context', () => {
    const { p } = build()
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/report/+page.svelte')!
    const ctx = files.find((f) => f.path === 'src/routes/report/page-context.ts')!
    expect(page.contents).toContain('let gridApi = $state<SvGridApi<any, any> | null>(null)')
    expect(page.contents).toContain('onApiReady={(a) => (gridApi = a)}')
    expect(page.contents).toMatch(/import type \{[^}]*\bSvGridApi\b/)
    expect(ctx.contents).toContain('grid: SvGridApi<any, any>')
    expect(ctx.contents).toMatch(/import type \{[^}]*\bSvGridApi\b/)
  })

  it('a dropped component becomes a named, imperative handle in code + markup', () => {
    const { p: base, sid } = build()
    const p = addComponentBlock(base, sid, 'button', { variant: 'primary' })
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/report/+page.svelte')!
    const ctx = files.find((f) => f.path === 'src/routes/report/page-context.ts')!
    const companion = files.find((f) => f.path === 'src/routes/report/handlers.ts')!
    // Named handle (button1) created + wired into the component markup.
    expect(page.contents).toContain('const button1 = handle(')
    expect(page.contents).toContain('<SvButton {...button1.props}>{button1.text}</SvButton>')
    expect(page.contents).toContain("import { handle } from '$lib/handles.svelte'")
    expect(page.contents).toContain('button1.fire(\'click\', e)')
    expect(page.contents).toContain('handlers.onLoad({ grid: gridApi!, button1, setRows:')
    // Typed in the context; suggested in the manifest.
    expect(ctx.contents).toContain('button1: Handle')
    expect(companion.contents).toContain('ctx.button1')
    expect(companion.contents).not.toContain('getElementById')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('handlersSource from the designer is emitted verbatim (advanced override)', () => {
    const { p: base, sid } = build()
    const src = "export async function onLoad() {\n  await fetch('/api/report')\n}"
    const p = setScreenHandlersSource(base, sid, src)
    const companion = emitStudioProject(p).find((f) => f.path === 'src/routes/report/handlers.ts')!
    expect(companion.userOwned).toBe(true)
    expect(companion.contents).toContain("await fetch('/api/report')")
    expect(companion.contents).not.toContain('export async function onLoad(ctx') // structured shell replaced
  })

  it('no companion and no wiring when the screen has no code', () => {
    const p = addFreestandingScreen(createProject([customers]), { title: 'Bare', route: 'bare' })
    const files = emitStudioProject(p)
    expect(files.find((f) => f.path === 'src/routes/bare/handlers.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/routes/bare/+page.svelte')!.contents).not.toContain("from './handlers'")
  })
})
