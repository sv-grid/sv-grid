import { describe, expect, it } from 'vitest'
import { compile } from 'svelte/compiler'
import type { EntitySchema } from '../schema'
import { addBlock, addComponentBlock, addFreestandingScreen, addScreenAction, addTabBlock, addAccordionBlock, addAccordionComponent, createProject, enableScreenCode, flattenBlocks, parseProject, serializeProject, addStateVar, setScreenLayout, setLayoutOpts, setScreenDock, setDockPaneTitle, dockPaneTitleOf, syncDockPanes, dockPaneIds, removeBlock, setAuth, setComponentBinding, setDataLayer, setDeployTarget, setEntityDataSource, setTrigger, setHandlerBody, setHandlerSteps, stepsToCode, clickSlot, setScreenHandlersSource, setScreenRenderGrid, setShell, setTheme, setThemePreset, updateBlock, updateScreen, type GridConfig, type MasterDetailConfig, type TabsConfig, type AccordionConfig, type StudioProject } from './project'
import ts from 'typescript'
import { emitStudioProject, emitStudioAppBundle, studioDeployInfo, ctxCompletions, ctxAmbientDts } from './emit-project'
import { UI_COMPONENT_REGISTRY } from './ui-components'

/** Type-check a handler BODY against a generated ambient ctx `.d.ts` using the real
 *  TypeScript compiler - the same surface the in-editor language service uses.
 *  Returns main.ts diagnostics (empty = clean). Mirrors the editor's function wrap. */
function typeCheckBody(dts: string, body: string): string[] {
  const PRE = 'async function __run(ctx: PageContext): Promise<void> {\n'
  const files: Record<string, string> = { 'env.d.ts': dts, 'main.ts': `${PRE}${body}\n}\n` }
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2021, lib: ['lib.es2021.d.ts', 'lib.dom.d.ts'],
    module: ts.ModuleKind.ESNext, strict: false, noEmit: true, skipLibCheck: true, types: [],
  }
  const host = ts.createCompilerHost(options, true)
  const origGet = host.getSourceFile.bind(host)
  const origRead = host.readFile.bind(host)
  const origExists = host.fileExists.bind(host)
  host.getSourceFile = (name, langOrOpts, onErr, shouldCreate) =>
    files[name] != null ? ts.createSourceFile(name, files[name], langOrOpts, true) : origGet(name, langOrOpts, onErr, shouldCreate)
  host.readFile = (name) => files[name] ?? origRead(name)
  host.fileExists = (name) => files[name] != null || origExists(name)
  const program = ts.createProgram(['env.d.ts', 'main.ts'], options, host)
  const main = program.getSourceFile('main.ts')
  return [...program.getSemanticDiagnostics(main), ...program.getSyntacticDiagnostics(main)]
    .map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n'))
}

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

describe('SSR-native screens (renderMode: ssr)', () => {
  const ssrProject = (): StudioProject => {
    const p = createProject([customers])
    return { ...p, screens: p.screens.map((s) => ({ ...s, renderMode: 'ssr' as const })) }
  }

  it('emits +page.server.ts with a load + CRUD form actions + server validation', () => {
    const server = emitStudioProject(ssrProject()).find((f) => f.path === 'src/routes/customers/+page.server.ts')
    expect(server, 'an SSR screen should emit a +page.server.ts').toBeTruthy()
    const c = server!.contents
    expect(c).toMatch(/export const load: PageServerLoad/)
    expect(c).toMatch(/export const actions: Actions/)
    expect(c).toMatch(/create:\s*async/)
    expect(c).toMatch(/update:\s*async/)
    expect(c).toMatch(/delete:\s*async/)
    expect(c).toMatch(/await validateAll\(customersSchema, values\)/) // server-side validation
    expect(c).toMatch(/return fail\(422/)
    expect(c).toMatch(/planFromSearchParams\(url/)
    expect(c).toMatch(/await customersSource\.getRows\(plan\)/)
  })

  it('emits an SSR +page.svelte: server rows, URL-driven sort/page, form-action editing', () => {
    const page = emitStudioProject(ssrProject()).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/import type \{ PageProps \} from '\.\/\$types'/)
    expect(page).toMatch(/data=\{data\.rows\}/) // renders SSR'd rows
    expect(page).toMatch(/externalSort/)
    expect(page).toMatch(/externalPagination/)
    expect(page).toMatch(/onSortingChange=/)
    expect(page).toMatch(/use:enhance=\{onSubmit\}/) // progressive enhancement
    expect(page).toMatch(/action=\{isCreate \? '\?\/create' : '\?\/update'\}/)
    // It must NOT fall back to the client data-source controller.
    expect(page).not.toMatch(/createServerDataSource/)
    // Valid Svelte 5.
    expect(() => compile(page, { generate: 'client' })).not.toThrow()
  })

  it('emits the shared server query helper once', () => {
    const files = emitStudioProject(ssrProject())
    const helpers = files.filter((f) => f.path === 'src/lib/server/query.ts')
    expect(helpers).toHaveLength(1)
    expect(helpers[0]!.contents).toMatch(/export function planFromSearchParams/)
  })

  it('sql SSR screen: load/actions proxy to the connected /api route via createKitDataSource', () => {
    const p0 = createProject([customers])
    const p: StudioProject = {
      ...p0,
      dataSource: 'sql',
      dataSources: { customers: { kind: 'sql', dialect: 'postgres', table: 'customers' } },
      screens: p0.screens.map((s) => ({ ...s, renderMode: 'ssr' as const })),
    }
    const files = emitStudioProject(p)
    const server = files.find((f) => f.path === 'src/routes/customers/+page.server.ts')!.contents
    expect(server).toMatch(/import \{ validateAll, createKitDataSource \} from '@svgrid\/enterprise'/)
    expect(server).toMatch(/createKitDataSource<Customers>\(\{ endpoint: '\/api\/customers', fetch \}\)/)
    expect(server).toMatch(/load: PageServerLoad = async \(\{ url, fetch \}\)/) // load gets event.fetch
    expect(server).not.toMatch(/from '\$lib\/data'/) // no in-process source import for sql
    // The connected /api route is still emitted - enforcement (validate/RBAC/triggers/audit) lives there.
    expect(files.find((f) => f.path === 'src/routes/api/customers/+server.ts')).toBeTruthy()
    // Page still compiles.
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(() => compile(page, { generate: 'client' })).not.toThrow()
  })

  it('memory SSR + RBAC: load/actions enforce authz inline (sql inherits from /api)', () => {
    const p0 = createProject([customers])
    const p: StudioProject = {
      ...p0,
      access: { enabled: true, defaultRole: 'viewer', roles: [{ role: 'admin', screens: '*', actions: '*' }, { role: 'viewer', screens: p0.screens.map((s) => s.id), actions: [] }] },
      screens: p0.screens.map((s) => ({ ...s, renderMode: 'ssr' as const })),
    }
    const server = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.server.ts')!.contents
    expect(server).toMatch(/import \{ fail, error \} from '@sveltejs\/kit'/)
    expect(server).toMatch(/import \{ authorizeAction, getServerRole \} from '\$lib\/access'/)
    expect(server).toMatch(/authorizeAction\(getServerRole\(\{ locals \}\), 'read', SCREEN_IDS\)/)
    expect(server).toMatch(/authorizeAction\(getServerRole\(\{ locals \}\), 'create', SCREEN_IDS\)/)
    expect(server).toMatch(/authorizeAction\(getServerRole\(\{ locals \}\), 'delete', SCREEN_IDS\)/)
  })

  it('memory SSR + relation field: prefetches options in load and renders a <select>', () => {
    const p0 = createProject([customers, orders])
    const p: StudioProject = { ...p0, screens: p0.screens.map((s) => (s.entity === 'orders' ? { ...s, renderMode: 'ssr' as const } : s)) }
    const files = emitStudioProject(p)
    const server = files.find((f) => f.path === 'src/routes/orders/+page.server.ts')!.contents
    expect(server).toMatch(/import \{ ordersSource, customersSource, nextId \} from '\$lib\/data'/)
    expect(server).toMatch(/const customer_idOptions = \(await customersSource\.getRows\(/)
    expect(server).toMatch(/label: String\(r\['name'\]/) // uses the relation's labelField
    expect(server).toMatch(/size: plan\.pageSize, customer_idOptions \}/) // options returned from load
    const page = files.find((f) => f.path === 'src/routes/orders/+page.svelte')!.contents
    expect(page).toMatch(/<select name='customer_id'/)
    expect(page).toMatch(/#each data\.customer_idOptions as o/)
    expect(() => compile(page, { generate: 'client' })).not.toThrow()
  })

  it('leaves spa screens on the client-controller path', () => {
    const p = createProject([customers]) // default renderMode is spa
    const files = emitStudioProject(p)
    expect(files.find((f) => f.path === 'src/routes/customers/+page.server.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/lib/server/query.ts')).toBeUndefined()
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/createServerDataSource/)
  })
})

describe('secure-by-default auth', () => {
  const authApp = () => emitStudioAppBundle(setAuth(createProject([customers]), { enabled: true, protect: true }))

  it('ships a git-ignored .env with a real random SESSION_SECRET (not the hardcoded fallback)', () => {
    const env = authApp().find((f) => f.path === '.env')
    expect(env, 'an auth app should ship a .env with a real secret').toBeTruthy()
    expect(env!.contents).toMatch(/SESSION_SECRET=[0-9a-f]{64}/)
    expect(env!.contents).not.toMatch(/change-me-to-a-long-random-string/)
  })

  it('hashes demo users - no plaintext store or plaintext login compare', () => {
    const files = authApp()
    const users = files.find((f) => f.path === 'src/lib/server/users.ts')!.contents
    expect(users).toMatch(/passwordHash: await hashPassword/)
    // The stored user type carries only the hash (the SEED keeps plaintext defaults,
    // which are hashed at module load).
    expect(users).toMatch(/AppUser = \{ email: string; name: string; role: string; passwordHash: string \}/)
    const login = files.find((f) => f.path === 'src/routes/login/+page.server.ts')!.contents
    expect(login).toMatch(/await verifyPassword\(password, user\.passwordHash\)/)
    expect(login).not.toMatch(/user\.password !== password/)
  })
})

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

  it('Accordion block: nests display blocks + components into SvAccordion sections', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'accordion')
    const ab = p.screens.find((s) => s.id === sid)!.blocks.find((b) => b.config.kind === 'accordion')!
    let cfg = addAccordionBlock(ab.config as AccordionConfig, 0, 'chart', customers)   // display child
    cfg = addAccordionComponent(cfg, 1, 'badge')                                       // component child
    p = updateBlock(p, sid, ab.id, { config: cfg })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toMatch(/import \{[^}]*SvAccordion[^}]*\} from '@svgrid\/grid'/)
    expect(page).toMatch(/import \{[^}]*SvBadge[^}]*\} from '@svgrid\/grid'/)  // nested component imported
    expect(page).toContain('{#snippet panel(item)}')
    expect(page).toContain('expandMode="single"')
    expect(page).toContain('<SvSchemaChart')                        // display child renders
    expect(page).toContain('<SvBadge')                              // component child renders
    expect(page).toMatch(/let accOpen_\w+ = \$state<string\[\]>\(\['/)  // expanded-ids state var
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

  it('Auth: scaffolds session + hooks + login + seed users, closes the RBAC loop, and compiles', () => {
    let p = createProject([customers])
    p = { ...p, access: { enabled: true, defaultRole: 'viewer', roles: [
      { role: 'admin', screens: '*', actions: '*' },
      { role: 'viewer', screens: ['customers'], actions: [] },
    ] } }
    p = setAuth(p, { enabled: true })
    const files = emitStudioProject(p)
    const get = (path: string) => files.find((f) => f.path === path)?.contents

    // The whole starter is emitted.
    for (const path of ['src/lib/server/auth.ts', 'src/lib/server/users.ts', 'src/hooks.server.ts', 'src/auth.d.ts', 'src/routes/+layout.server.ts', 'src/routes/login/+page.svelte', 'src/routes/login/+page.server.ts', 'src/routes/logout/+page.server.ts']) {
      expect(files.find((f) => f.path === path), path).toBeTruthy()
    }
    // SESSION_SECRET merges into the single shared .env.example (bundle level).
    const envEx = emitStudioAppBundle(p).filter((f) => f.path === '.env.example')
    expect(envEx).toHaveLength(1)
    expect(envEx[0]!.contents).toContain('SESSION_SECRET')
    // hooks resolves the session into event.locals.role - the value getServerRole reads.
    expect(get('src/hooks.server.ts')).toContain('event.locals.role = user?.role')
    // Dependency-free crypto (no external auth lib).
    expect(get('src/lib/server/auth.ts')).toContain('crypto.subtle')
    expect(get('src/lib/server/auth.ts')).toContain('export async function signSession')
    // One demo user per RBAC role.
    expect(get('src/lib/server/users.ts')).toContain('admin@example.com')
    expect(get('src/lib/server/users.ts')).toContain('viewer@example.com')
    // Protect-by-default guards the app in the root server load.
    expect(get('src/routes/+layout.server.ts')).toContain("throw redirect(302, '/login?redirectTo='")
    // Login form action signs + sets the session cookie.
    expect(get('src/routes/login/+page.server.ts')).toContain('cookies.set(SESSION_COOKIE')
    // The shell wires the session in: login bypass, real user, sign-out, role seed.
    const layout = get('src/routes/+layout.svelte')!
    expect(layout).toContain('["/login"].includes($page.url.pathname)') // login renders bare (no shell)
    expect(layout).toContain('action="/logout"')
    expect(layout).toContain('currentRole.set(data.role')
    expect(layout).toContain('data?.user?.email')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  // A SQL entity with a NUMBER primary key + a db-column alias, to exercise the
  // serial / autoincrement + dbColumn mapping paths.
  const products: EntitySchema = {
    name: 'products', label: 'Product', idField: 'id',
    fields: [
      { field: 'id', type: 'number', primaryKey: true },
      { field: 'title', type: 'text' },
      { field: 'price', type: 'number' },
      { field: 'inStock', type: 'boolean', dbColumn: 'in_stock' },
    ],
  }

  it('Data layer: Drizzle schema + typed repos + migrations config for SQL entities', () => {
    let p = createProject([products])
    p = setEntityDataSource(p, 'products', { kind: 'sql', table: 'products_tbl', dialect: 'postgres' })
    p = setDataLayer(p, true)
    const files = emitStudioProject(p)
    const get = (path: string) => files.find((f) => f.path === path)?.contents

    for (const path of ['src/lib/server/db/schema.ts', 'src/lib/server/db/index.ts', 'src/lib/server/db/products.ts', 'drizzle.config.ts']) {
      expect(files.find((f) => f.path === path), path).toBeTruthy()
    }
    const schema = get('src/lib/server/db/schema.ts')!
    expect(schema).toContain("from 'drizzle-orm/pg-core'")
    expect(schema).toContain('pgTable("products_tbl"')                  // real DB table name
    expect(schema).toContain('"id": serial("id").primaryKey()')         // number PK -> serial
    expect(schema).toContain('"inStock": boolean("in_stock")')          // dbColumn alias
    expect(schema).toContain('typeof products.$inferSelect')
    // A typed repo with returning-based CRUD, id typed from the PK.
    const repo = get('src/lib/server/db/products.ts')!
    expect(repo).toContain('export const productsRepo')
    expect(repo).toContain('.returning()).at(0)!')
    expect(repo).toContain('get: async (id: number)')
    // drizzle-kit migration config + client.
    expect(get('drizzle.config.ts')).toContain("dialect: 'postgresql'")
    expect(get('src/lib/server/db/index.ts')).toContain('drizzle-orm/node-postgres')
  })

  it('Data layer: package.json wires drizzle deps + migration scripts; SQLite maps a number id to autoincrement', () => {
    let p = createProject([products])
    p = setEntityDataSource(p, 'products', { kind: 'sql', table: 'products', dialect: 'sqlite' })
    p = setDataLayer(p, true)
    const files = emitStudioAppBundle(p)
    const pkg = JSON.parse(files.find((f) => f.path === 'package.json')!.contents)
    expect(pkg.dependencies['drizzle-orm']).toBeTruthy()
    expect(pkg.devDependencies['drizzle-kit']).toBeTruthy()
    expect(pkg.scripts['db:generate']).toBe('drizzle-kit generate')
    expect(pkg.scripts['db:migrate']).toBe('drizzle-kit migrate')
    const schema = files.find((f) => f.path === 'src/lib/server/db/schema.ts')!.contents
    expect(schema).toContain("from 'drizzle-orm/sqlite-core'")
    expect(schema).toContain('integer("id").primaryKey({ autoIncrement: true })')
  })

  it('no data layer without the toggle, without a SQL entity, or on an unsupported dialect', () => {
    // Off by default.
    let sqlOnly = setEntityDataSource(createProject([customers]), 'customers', { kind: 'sql', table: 'customers', dialect: 'postgres' })
    expect(emitStudioProject(sqlOnly).find((f) => f.path === 'src/lib/server/db/schema.ts')).toBeUndefined()
    // Toggle on but no SQL entity (memory source) -> nothing.
    expect(emitStudioProject(setDataLayer(createProject([customers]), true)).find((f) => f.path.startsWith('src/lib/server/db/'))).toBeUndefined()
    // Toggle on + MSSQL (Drizzle has no SQL Server driver) -> raw route only, no Drizzle layer.
    const mssql = setDataLayer(setEntityDataSource(createProject([customers]), 'customers', { kind: 'sql', table: 'customers', dialect: 'mssql' }), true)
    expect(emitStudioProject(mssql).find((f) => f.path === 'src/lib/server/db/schema.ts')).toBeUndefined()
  })

  it('Data layer: MySQL emits a re-select repo (no RETURNING) + int autoincrement PK', () => {
    let p = createProject([products])
    p = setEntityDataSource(p, 'products', { kind: 'sql', table: 'products', dialect: 'mysql' })
    p = setDataLayer(p, true)
    const files = emitStudioProject(p)
    const schema = files.find((f) => f.path === 'src/lib/server/db/schema.ts')!.contents
    expect(schema).toContain("from 'drizzle-orm/mysql-core'")
    expect(schema).toContain('int("id").autoincrement().primaryKey()')
    const repo = files.find((f) => f.path === 'src/lib/server/db/products.ts')!.contents
    expect(repo).toContain('async function getById')           // re-select helper
    expect(repo).toContain('.insertId')                        // uses the insert id
    expect(repo).not.toContain('.returning()')                 // MySQL has none
  })

  it('DB-backed auth: auth + data layer moves the user store into an auth_users table (hashed)', () => {
    let p = createProject([products])
    p = setEntityDataSource(p, 'products', { kind: 'sql', table: 'products', dialect: 'postgres' })
    p = setDataLayer(p, true)
    p = setAuth(p, { enabled: true })
    const files = emitStudioProject(p)
    // The auth_users table lives in the same Drizzle schema (one migration covers it).
    expect(files.find((f) => f.path === 'src/lib/server/db/schema.ts')!.contents).toContain('authUsers = pgTable("auth_users"')
    // users.ts queries the DB + seeds once; login verifies the PBKDF2 hash.
    const users = files.find((f) => f.path === 'src/lib/server/users.ts')!.contents
    expect(users).toContain("from './db/schema'")
    expect(users).toContain('function ensureSeeded')
    expect(users).toContain('passwordHash: await hashPassword(u.password)')
    const login = files.find((f) => f.path === 'src/routes/login/+page.server.ts')!.contents
    expect(login).toContain('const user = await findUser(email)')
    expect(login).toContain('await verifyPassword(password, user.passwordHash)')
    // Without the data layer, auth stays on the in-code demo store.
    const inCode = emitStudioProject(setAuth(createProject([products]), { enabled: true }))
    expect(inCode.find((f) => f.path === 'src/lib/server/users.ts')!.contents).toContain('export const USERS')
  })

  it('Auth depth: register + password reset + change-password + admin user management (DB-backed)', () => {
    let p = createProject([products])
    p = { ...p, access: { enabled: true, defaultRole: 'viewer', roles: [
      { role: 'admin', screens: '*', actions: '*' },
      { role: 'viewer', screens: ['products'], actions: [] },
    ] } }
    p = setEntityDataSource(p, 'products', { kind: 'sql', table: 'products', dialect: 'postgres' })
    p = setDataLayer(p, true)
    p = setAuth(p, { enabled: true, register: true, userAdmin: true })
    const files = emitStudioProject(p)
    const get = (path: string) => files.find((f) => f.path === path)?.contents

    // Change-password (any signed-in user), self-service sign-up + recovery, admin screen.
    for (const path of ['src/routes/account/+page.server.ts', 'src/routes/register/+page.server.ts', 'src/routes/forgot-password/+page.server.ts', 'src/routes/reset-password/+page.server.ts', 'src/routes/users/+page.server.ts', 'src/routes/users/+page.svelte']) {
      expect(files.find((f) => f.path === path), path).toBeTruthy()
    }
    // Registration assigns the (least-privileged) default role.
    expect(get('src/routes/register/+page.server.ts')).toContain('role: "viewer"')
    // Password recovery uses signed reset tokens + an email stub (no extra table).
    expect(get('src/lib/server/auth.ts')).toContain('export async function signReset')
    expect(get('src/lib/server/auth.ts')).toContain('export async function sendResetEmail')
    // User admin is role-gated server-side (only a full-access role can manage users).
    expect(get('src/routes/users/+page.server.ts')).toContain("canScreen(getServerRole(event), '__users__')")
    // The DB store gained full CRUD.
    const users = get('src/lib/server/users.ts')!
    for (const fn of ['createUser', 'updatePassword', 'setUserRole', 'deleteUser', 'listUsers']) expect(users).toContain(`export async function ${fn}`)
    // Nav gains the admin Users screen (canScreen-gated); the auth pages render bare.
    const layout = get('src/routes/+layout.svelte')!
    expect(layout).toContain('"/users"')
    expect(layout).toContain('"/register"') // bare-render set includes the sign-up flow
    expect(get('src/routes/+layout.server.ts')).toContain('const PUBLIC = new Set(["/login","/register","/forgot-password","/reset-password"])')
    expect(get('src/routes/login/+page.svelte')).toContain('href="/register"')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('Auth extras: OAuth (github/google/oidc) + email 2FA + real email, all DB-backed', () => {
    let p = createProject([products])
    p = { ...p, access: { enabled: true, defaultRole: 'viewer', roles: [{ role: 'admin', screens: '*', actions: '*' }, { role: 'viewer', screens: ['products'], actions: [] }] } }
    p = setEntityDataSource(p, 'products', { kind: 'sql', table: 'products', dialect: 'postgres' })
    p = setDataLayer(p, true)
    p = setAuth(p, { enabled: true, oauth: ['github', 'google', 'oidc'], twoFactor: true })
    const files = emitStudioProject(p)
    const bundle = emitStudioAppBundle(p)
    const get = (path: string) => files.find((f) => f.path === path)?.contents

    // OAuth: shared provider module + a [provider] start + callback endpoint.
    for (const path of ['src/lib/server/oauth.ts', 'src/routes/auth/[provider]/+server.ts', 'src/routes/auth/[provider]/callback/+server.ts']) {
      expect(files.find((f) => f.path === path), path).toBeTruthy()
    }
    expect(get('src/lib/server/oauth.ts')).toContain('export async function pkceChallenge') // PKCE
    expect(get('src/lib/server/oauth.ts')).toContain('.well-known/openid-configuration') // OIDC discovery (Azure AD)
    expect(get('src/routes/auth/[provider]/+server.ts')).toContain('code_challenge_method')
    expect(get('src/routes/auth/[provider]/+server.ts')).toContain('new Set<Provider>(["github", "google", "oidc"])')
    expect(get('src/routes/login/+page.svelte')).toContain('/auth/github')

    // Email 2FA: schema column, challenge helpers, login branch, verify route, account toggle.
    expect(get('src/lib/server/db/schema.ts')).toContain('"twoFactor": boolean("two_factor").notNull().default(false)')
    expect(get('src/lib/server/auth.ts')).toContain('export async function signChallenge')
    expect(get('src/routes/login/+page.server.ts')).toContain('if (user.twoFactor)')
    expect(files.find((f) => f.path === 'src/routes/login/verify/+page.server.ts')).toBeTruthy()
    expect(get('src/lib/server/users.ts')).toContain('export async function setTwoFactor')

    // Real email layer (2FA implies it) + nodemailer wired only as an optional SMTP dep.
    expect(get('src/lib/server/email.ts')).toContain('api.resend.com')
    expect(get('src/lib/server/email.ts')).toContain("await import('nodemailer')")
    const pkg = JSON.parse(bundle.find((f) => f.path === 'package.json')!.contents)
    expect(pkg.dependencies.nodemailer).toBeTruthy()
    expect(pkg.devDependencies['@types/nodemailer']).toBeTruthy()
    // .env.example documents the OAuth + email vars.
    const env = bundle.find((f) => f.path === '.env.example')!.contents
    expect(env).toContain('GITHUB_CLIENT_ID')
    expect(env).toContain('OIDC_ISSUER')
    expect(env).toMatch(/RESEND_API_KEY|SMTP_HOST/)

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('Auth extras: OAuth / 2FA are inert without the DB-backed store', () => {
    const p = setAuth(createProject([products]), { enabled: true, oauth: ['github'], twoFactor: true })
    const files = emitStudioProject(p) // memory source -> no data layer
    expect(files.find((f) => f.path === 'src/lib/server/oauth.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/lib/server/email.ts')).toBeUndefined()
    expect(files.find((f) => f.path === 'src/routes/login/verify/+page.server.ts')).toBeUndefined()
    // Falls back to the in-code demo store + plain login.
    expect(files.find((f) => f.path === 'src/routes/login/+page.server.ts')!.contents).not.toContain('user.twoFactor')
  })

  it('Auth depth: register/userAdmin are inert without the DB-backed store or RBAC', () => {
    // register requested but no data layer -> no register routes (needs persistence).
    const noDb = emitStudioProject(setAuth(createProject([products]), { enabled: true, register: true, userAdmin: true }))
    expect(noDb.find((f) => f.path === 'src/routes/register/+page.server.ts')).toBeUndefined()
    expect(noDb.find((f) => f.path === 'src/routes/users/+page.server.ts')).toBeUndefined()
    // DB-backed but RBAC off -> register yes, userAdmin no (needs a role to gate on).
    let p = setEntityDataSource(createProject([products]), 'products', { kind: 'sql', table: 'products', dialect: 'postgres' })
    p = setAuth(setDataLayer(p, true), { enabled: true, register: true, userAdmin: true })
    const files = emitStudioProject(p)
    expect(files.find((f) => f.path === 'src/routes/register/+page.server.ts')).toBeTruthy()
    expect(files.find((f) => f.path === 'src/routes/users/+page.server.ts')).toBeUndefined()
  })

  it('no auth files unless auth.enabled; protect:false drops the route guard', () => {
    // Off by default.
    expect(emitStudioProject(createProject([customers])).find((f) => f.path === 'src/hooks.server.ts')).toBeUndefined()
    // protect:false still scaffolds login but does not force a redirect.
    const p = setAuth(createProject([customers]), { enabled: true, protect: false })
    const layoutServer = emitStudioProject(p).find((f) => f.path === 'src/routes/+layout.server.ts')!.contents
    expect(layoutServer).not.toContain('throw redirect')
    // Single admin seed user when RBAC is off.
    const users = emitStudioProject(p).find((f) => f.path === 'src/lib/server/users.ts')!.contents
    expect(users).toContain('admin@example.com')
    expect(users).not.toContain('viewer@example.com')
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

  it('Deploy pipeline: CI workflow always, a push-to-deploy workflow + DEPLOY.md + deploy script per target', () => {
    const bundle = emitStudioAppBundle(setDeployTarget(createProject([customers]), 'vercel'))
    const get = (p: string) => bundle.find((f) => f.path === p)?.contents
    // Universal CI (robust without a committed lockfile).
    const ci = get('.github/workflows/ci.yml')!
    expect(ci).toContain('npm install')
    expect(ci).not.toContain('npm ci')       // no lockfile is shipped
    expect(ci).not.toContain('cache: npm')
    expect(ci).toContain('npm run build')
    // Push-to-deploy workflow, gated on the secret so an unconfigured repo stays green.
    const deploy = get('.github/workflows/deploy.yml')!
    expect(deploy).toContain("if: ${{ secrets.VERCEL_TOKEN != '' }}")
    expect(deploy).toContain('vercel deploy --prebuilt --prod')
    // Runbook + npm deploy script.
    expect(get('DEPLOY.md')).toContain('VERCEL_TOKEN')
    expect(JSON.parse(get('package.json')!).scripts.deploy).toBe('vercel deploy --prod')
    // Designer panel exposes the required secrets.
    expect(studioDeployInfo(setDeployTarget(createProject([customers]), 'vercel')).secrets).toEqual(['VERCEL_TOKEN', 'VERCEL_ORG_ID', 'VERCEL_PROJECT_ID'])
  })

  it('Deploy pipeline: node target ships a Dockerfile + .dockerignore and no deploy workflow', () => {
    const bundle = emitStudioAppBundle(setDeployTarget(createProject([customers], { title: 'My App' }), 'node'))
    expect(bundle.find((f) => f.path === 'Dockerfile')!.contents).toContain('CMD ["node", "build"]')
    expect(bundle.find((f) => f.path === '.dockerignore')).toBeTruthy()
    expect(bundle.find((f) => f.path === '.github/workflows/deploy.yml')).toBeUndefined() // self-hosted: no push-deploy
    expect(bundle.find((f) => f.path === '.github/workflows/ci.yml')).toBeTruthy()        // ...but still CI
    expect(bundle.find((f) => f.path === 'DEPLOY.md')!.contents).toContain('docker build')
  })

  it('Deploy pipeline: a single .env.example merges DATABASE_URL + SESSION_SECRET (no duplicate)', () => {
    let p = setEntityDataSource(createProject([customers]), 'customers', { kind: 'sql', table: 'customers', dialect: 'postgres' })
    p = setAuth(p, { enabled: true })
    const envs = emitStudioAppBundle(p).filter((f) => f.path === '.env.example')
    expect(envs).toHaveLength(1)
    expect(envs[0]!.contents).toContain('DATABASE_URL')
    expect(envs[0]!.contents).toContain('SESSION_SECRET')
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

  it('component props bound to data emit reactive expressions over allRows (aggregate / field / expr), get no code handle, and compile', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const flat = () => flattenBlocks(p.screens.find((s) => s.id === sid)!.blocks).filter((b) => b.config.kind === 'component')

    p = addComponentBlock(p, sid, 'stat', { label: 'Total spend' })
    const stat = flat()[0]!
    p = setComponentBinding(p, sid, stat.id, 'value', { kind: 'aggregate', field: 'spend', reduce: 'sum' })

    p = addComponentBlock(p, sid, 'badge', { _content: 'tier' })
    const badge = flat()[1]!
    p = setComponentBinding(p, sid, badge.id, '_content', { kind: 'field', field: 'tier' })

    p = addComponentBlock(p, sid, 'progress', { value: 0, max: 100 })
    const prog = flat()[2]!
    p = setComponentBinding(p, sid, prog.id, 'value', { kind: 'expr', code: 'rows.filter((r) => r.spend > 100).length' })

    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents

    // aggregate -> reduceValue over allRows; imported once.
    expect(page).toContain("value={(reduceValue(allRows, { measure: 'spend', reduce: 'sum' })).toLocaleString()}")
    expect(page).toMatch(/import \{[^}]*reduceValue[^}]*\} from '@svgrid\/enterprise'/)
    // field -> first row's value.
    expect(page).toContain("{String(allRows[0]?.['tier'] ?? '')}")
    // expr -> the user code wrapped with rows = allRows.
    expect(page).toContain('value={((rows) => (rows.filter((r) => r.spend > 100).length))(allRows)}')
    // the screen loads every row for the bindings.
    expect(page).toContain('async function loadAll()')
    // bound components are static reactive markup, not code handles.
    expect(page).not.toContain('= handle(')

    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('every registry component codegens to a page that compiles, from the full UI kit', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Sink', route: 'sink' })
    const sid = p.screens.find((s) => s.title === 'Sink')!.id
    for (const spec of UI_COMPONENT_REGISTRY) p = addComponentBlock(p, sid, spec.key)
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/sink/+page.svelte')!.contents
    // The kit spans well beyond the original eight (inputs, nav, display, ...).
    expect(UI_COMPONENT_REGISTRY.length).toBeGreaterThanOrEqual(24)
    // Every importName is present in the single @svgrid/grid import.
    for (const spec of UI_COMPONENT_REGISTRY) expect(page).toContain(spec.importName)
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('array/object "fixed" props (Timeline items, Sparkline data) emit verbatim, not stringified', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Viz', route: 'viz' })
    const sid = p.screens.find((s) => s.title === 'Viz')!.id
    p = addComponentBlock(p, sid, 'timeline')
    p = addComponentBlock(p, sid, 'sparkline', { type: 'line' })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/viz/+page.svelte')!.contents
    expect(page).toContain("items={[{ title: 'Order placed'")   // real array expression
    expect(page).toContain('data={[4, 8, 5, 9')                 // real number array
    expect(page).not.toContain("items={'[")                      // never quoted as a string
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

  it('filterUi picks the filter surfaces (row / menu / global); default is the global search', () => {
    // Default (no filterUi) -> global search only.
    const dflt = pageFor(withGrid({ filterable: true }))
    expect(dflt).toContain('showGlobalFilter')
    expect(dflt).not.toContain('showFilterRow')
    expect(dflt).not.toContain('showFilterMenu')
    // Explicit row + menu (no global).
    const rm = pageFor(withGrid({ filterable: true, filterUi: { row: true, menu: true } }))
    expect(rm).toContain('showFilterRow')
    expect(rm).toContain('showFilterMenu')
    expect(rm).not.toContain('showGlobalFilter')
    // Column filters still flow to the server controller.
    expect(rm).toContain('externalFilter')
    expect(rm).toContain('onFiltersChange')
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

  it('normal density emits the standard 30px row height (consistent with master-detail) + totals off', () => {
    const page = pageFor(createProject([customers]))
    expect(page).toContain('enableRowSummaries={false}')
    expect(page).toContain('rowHeight={30}')
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

  it('row grouping switches the grid to full-client mode + seeds setGroupBy + rolls up column aggregates', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    const cfg = p.screens[0]!.blocks[0]!.config as GridConfig
    const columns = cfg.columns.map((c) => (c.field === 'mrr' ? { ...c, aggregate: 'sum' as const } : c))
    p = updateBlock(p, sid, gid, { config: { grouping: ['tier'], columns } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    // Full-client data + grouping controls + seeded grouping.
    expect(page).toContain('data={allRows}')
    expect(page).toContain('loading={!allRowsReady}')
    expect(page).toContain('groupable')
    expect(page).toContain("a.setGroupBy(['tier'])")
    // Per-column aggregate flows into the column override.
    expect(page).toContain("'mrr': { aggregate: 'sum' }")
    // Client-side sort/paginate, NOT the server controller wiring.
    expect(page).not.toContain('externalSort')
    expect(page).not.toContain('externalPagination')
    expect(page).not.toContain('onSortingChange')
    // Loads the whole dataset.
    expect(page).toContain('async function loadAll()')
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('per-column value formats compile to the grid format (CellFormatConfig)', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    const cfg = p.screens[0]!.blocks[0]!.config as GridConfig
    const columns = cfg.columns.map((c) =>
      c.field === 'mrr' ? { ...c, format: { type: 'currency', currency: 'EUR' } as const } : c,
    )
    p = updateBlock(p, sid, gid, { config: { columns } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    expect(page).toContain("'mrr': { format: { type: 'currency', currency: 'EUR' } }")
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('percent + number formats emit decimals via Intl options', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    const cfg = p.screens[0]!.blocks[0]!.config as GridConfig
    const columns = cfg.columns.map((c) =>
      c.field === 'mrr' ? { ...c, format: { type: 'percent', decimals: 1, valueIsPercentPoints: true } as const } : c,
    )
    p = updateBlock(p, sid, gid, { config: { columns } as Partial<import('./project').BlockConfig> })
    expect(pageFor(p)).toContain("format: { type: 'percent', valueIsPercentPoints: true, options: { minimumFractionDigits: 1, maximumFractionDigits: 1 } }")
  })

  it('rich cell renderers emit per-column cell snippets + imports (badge / progress / link) and compile', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    const cfg = p.screens[0]!.blocks[0]!.config as GridConfig
    const columns = cfg.columns.map((c) =>
      c.field === 'tier' ? { ...c, cellType: { kind: 'badge' } as const }
      : c.field === 'mrr' ? { ...c, cellType: { kind: 'progress', max: 500 } as const }
      : c.field === 'name' ? { ...c, cellType: { kind: 'link', as: 'email' } as const }
      : c,
    )
    p = updateBlock(p, sid, gid, { config: { columns } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    // Imports pulled in for the renderers.
    expect(page).toMatch(/import \{[^}]*renderSnippet[^}]*\} from '@svgrid\/grid'/)
    expect(page).toMatch(/import \{[^}]*SvBadge[^}]*\} from '@svgrid\/grid'/)
    expect(page).toMatch(/import \{[^}]*SvProgress[^}]*\} from '@svgrid\/grid'/)
    // Cell refs + snippets.
    expect(page).toContain('cell: (ctx: CellContext<Customers>) => renderSnippet(cellRender_')
    expect(page).toContain('<SvBadge variant={stBadgeVariant(value)}')
    expect(page).toContain('max={500}')
    expect(page).toContain("href={'mailto:' + String(value ?? '')}")
    // The shared badge-intent helper is emitted once.
    expect(page.match(/function stBadgeVariant\(/g)?.length).toBe(1)
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('an export toolbar captures the grid api + wires CSV / JSON / copy buttons, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    p = updateBlock(p, sid, gid, { config: { export: { csv: true, json: true, copy: true } } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    expect(page).toMatch(/import \{[^}]*type SvGridApi[^}]*\} from '@svgrid\/grid'/)
    expect(page).toContain('let gridApi_' + gid.replace(/-/g, '_') + ' = $state<SvGridApi<any, any> | null>(null)')
    expect(page).toContain('<div class="st-grid-toolbar">')
    expect(page).toContain('.exportCsv({ filename: \'customers\' })')
    expect(page).toContain('.exportJson({ filename: \'customers\' })')
    expect(page).toContain('.copyToClipboard()')
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('no export config emits no toolbar', () => {
    expect(pageFor(createProject([customers]))).not.toContain('st-grid-toolbar')
  })

  it('tree data renders a client hierarchy: visible-row walk + tree cell on the label column, no flat sort/paginate', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    p = updateBlock(p, sid, gid, { config: { treeData: { parentField: 'tier', labelField: 'name' } } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    // Full-client tree state + derivation.
    expect(page).toContain('let treeExpanded_' + gid.replace(/-/g, '_'))
    expect(page).toContain('function treeBuild_' + gid.replace(/-/g, '_'))
    expect(page).toContain('data={tree_' + gid.replace(/-/g, '_') + '.visible}')
    expect(page).toContain('loading={!allRowsReady}')
    // Tree cell on the label column; other columns untouched.
    expect(page).toContain('renderSnippet(treeCell_' + gid.replace(/-/g, '_'))
    expect(page).toContain('{#snippet treeCell_' + gid.replace(/-/g, '_'))
    expect(page).toContain('async function loadAll()')
    // No flat sort / paginate / grouping that would break the hierarchy.
    expect(page).not.toContain('externalSort')
    expect(page).not.toContain('showPagination')
    expect(page).not.toContain('groupable')
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('scheduler view renders the grid as a calendar: enableSchedulerView + scheduler prop + write-back, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const gid = p.screens[0]!.blocks[0]!.id
    p = updateBlock(p, sid, gid, { config: { scheduler: { startField: 'mrr', titleField: 'name', colorField: 'tier', initialView: 'week', editable: true, drawer: true } } as Partial<import('./project').BlockConfig> })
    const page = pageFor(p)
    // Renderer registered once + imported.
    expect(page).toMatch(/import \{[^}]*enableSchedulerView[^}]*\} from '@svgrid\/enterprise'/)
    expect(page).toContain('enableSchedulerView()')
    // Full-client scheduler grid with the mapped config.
    expect(page).toContain('data={allRows}')
    expect(page).toContain("scheduler={{ startField: 'mrr'")
    expect(page).toContain("titleField: 'name'")
    expect(page).toContain("initialView: 'week'")
    expect(page).toContain('editable: true')
    // Optimistic write-back through the controller.
    expect(page).toContain('onEventMove:')
    expect(page).toContain('onEventCommit:')
    expect(page).toContain('controller.updateRow(')
    expect(page).toContain('async function loadAll()')
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('an ungrouped grid stays server-driven (no groupable, keeps the controller view)', () => {
    const page = pageFor(createProject([customers]))
    expect(page).not.toContain('groupable')
    expect(page).not.toContain('setGroupBy')
    expect(page).toContain('data={view.rows}')
    expect(page).toContain('externalSort')
  })
})

describe('dock layout (screen.layout = dock)', () => {
  it('a dock screen renders SvDockManager with a pane per block + persistence + mobile stack, and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'filter')
    p = addBlock(p, sid, 'kpi')
    p = setScreenLayout(p, sid, 'dock')
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    // Imports + workspace state + persistence.
    expect(page).toMatch(/import \{[^}]*SvDockManager[^}]*\} from '@svgrid\/grid'/)
    expect(page).toContain('let dockWorkspace = $state<DockManagerState>(')
    expect(page).toContain("localStorage.getItem('dock:customers')")
    expect(page).toContain('let dockNarrow = $state(false)')
    // The manager + a pane per block, wired to persist on change.
    expect(page).toContain('<SvDockManager bind:workspace={dockWorkspace} onChange={(w) => saveDock(w)}>')
    expect(page).toContain('{#snippet pane(p)}')
    for (const b of p.screens[0]!.blocks) expect(page).toContain(`{#if p.id === '${b.id}'}`)
    // Mobile fallback stacks the plain grid body.
    expect(page).toContain('{#if dockNarrow}')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('a canvas-layout screen places blocks on a 12-col grid by cell coords and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'kpi')
    p = setScreenLayout(p, sid, 'canvas')
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('<div class="st-canvas">')
    expect(page).toContain('<div class="st-canvas__cell" style="grid-column:')
    expect(page).toMatch(/grid-column: \d+ \/ span \d+; grid-row: \d+ \/ span \d+;/)
    expect(page).not.toContain('SvDockManager')
    const css = emitStudioAppBundle(p).find((f) => f.path === 'src/app.css')!.contents
    expect(css).toContain('.st-canvas { display: grid; grid-template-columns: repeat(12, 1fr);')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('layout settings flow into codegen (dock props, persist off, canvas cols, grid gap)', () => {
    // Dock with pop-out + bottom tabs + no persistence.
    let d = createProject([customers])
    const dsid = d.screens[0]!.id
    d = addBlock(d, dsid, 'kpi')
    d = setScreenLayout(d, dsid, 'dock')
    d = setLayoutOpts(d, dsid, 'dock', { allowPopout: true, headerPosition: 'bottom', persist: false })
    const dpage = emitStudioProject(d).find((f) => f.path.endsWith('/+page.svelte'))!.contents
    expect(dpage).toContain('allowPopout')
    expect(dpage).toContain('headerPosition="bottom"')
    expect(dpage).not.toContain('onChange={(w) => saveDock(w)}') // persistence off
    expect(dpage).not.toContain('function saveDock')

    // Canvas with 24 columns + custom row height.
    let c = createProject([customers])
    const csid = c.screens[0]!.id
    c = setScreenLayout(c, csid, 'canvas')
    c = setLayoutOpts(c, csid, 'canvas', { cols: 24, rowHeight: 32 })
    const cpage = emitStudioProject(c).find((f) => f.path.endsWith('/+page.svelte'))!.contents
    expect(cpage).toContain('grid-template-columns: repeat(24, 1fr); grid-auto-rows: 32px;')

    // Grid gap setting scoped into the page style.
    let g = createProject([customers])
    const gsid = g.screens[0]!.id
    g = setLayoutOpts(g, gsid, 'grid', { colGap: 24, rowGap: 8 })
    const gpage = emitStudioProject(g).find((f) => f.path.endsWith('/+page.svelte'))!.contents
    expect(gpage).toContain('.st-screen { grid-template-columns: repeat(12, 1fr); gap: 8px 24px;')

    for (const files of [emitStudioProject(d), emitStudioProject(c), emitStudioProject(g)]) {
      for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
        expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
      }
    }
  })

  it('state variables + logic-core steps emit reactive state, ctx.state, and compiled code', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addStateVar(p, sid, { name: 'query', type: 'string', initial: 'hi' })
    p = addStateVar(p, sid, { name: 'count', type: 'number', initial: '0' })
    // A click handler that sets a var, then branches on it.
    p = addComponentBlock(p, sid, 'button', {})
    const btn = flattenBlocks(p.screens[0]!.blocks).find((b) => b.config.kind === 'component')!
    p = setHandlerSteps(p, sid, `click:${btn.id}`, [
      { type: 'setVar', name: 'count', value: { kind: 'literal', value: '3' } },
      { type: 'branch', condition: { left: { kind: 'state', name: 'count' }, op: 'gt', right: { kind: 'literal', value: '2' } }, then: [{ type: 'alert', message: 'big' }] },
    ])
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path.endsWith('/+page.svelte'))!.contents
    expect(page).toContain("let query = $state<string>('hi')")
    expect(page).toContain('let count = $state<number>(0)')
    expect(page).toContain('state: { get query() { return query }, set query(x) { query = x }, get count() { return count }, set count(x) { count = x } }')
    // The compiled step code lives in the handlers.ts companion (onLoad wires the onclick).
    const handlers = files.find((f) => f.path.endsWith('/handlers.ts'))!.contents
    expect(handlers).toContain('ctx.state.count = 3')
    expect(handlers).toContain('if (Number(ctx.state.count) > Number(2)) {')
    const pctx = files.find((f) => f.path.endsWith('/page-context.ts'))!.contents
    expect(pctx).toContain('state: { query: string; count: number }')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('grid row-select event slot wires onRowClick to compiled steps (cross-block state)', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addStateVar(p, sid, { name: 'selName', type: 'string' })
    const gridBlock = flattenBlocks(p.screens[0]!.blocks).find((b) => b.config.kind === 'grid')!
    // On row select: copy the clicked row's name into state (drives sibling blocks).
    p = setHandlerSteps(p, sid, `rowSelect:${gridBlock.id}`, [
      { type: 'setVar', name: 'selName', value: { kind: 'field', name: 'name' } },
    ])
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path.endsWith('/+page.svelte'))!.contents
    expect(page).toContain('onRowClick={async (e) => {')
    expect(page).toContain('const row = e.row')
    expect(page).toContain("ctx.state.selName = row?.['name']")
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('component on-change event slot wires ctx.<name>.onchange + the wrapper fires change', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addStateVar(p, sid, { name: 'touched', type: 'boolean' })
    p = addComponentBlock(p, sid, 'button', {})
    const cmp = flattenBlocks(p.screens[0]!.blocks).find((b) => b.config.kind === 'component')!
    p = setHandlerSteps(p, sid, `change:${cmp.id}`, [{ type: 'setVar', name: 'touched', value: { kind: 'literal', value: 'true' } }])
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path.endsWith('/+page.svelte'))!.contents
    const handlers = files.find((f) => f.path.endsWith('/handlers.ts'))!.contents
    expect(page).toContain(".fire('change', e)")
    expect(handlers).toMatch(/ctx\.\w+\.onchange = async \(\) => \{/)
    expect(handlers).toContain('ctx.state.touched = true')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('on-record-saved (formSubmit) steps run inside save() with the submitted row + ctx', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    // Default CRUD screen edits via a popup form (editing = 'form').
    p = setHandlerSteps(p, sid, 'formSubmit', [
      { type: 'navigate', to: '/customers' },
    ])
    const page = emitStudioProject(p).find((f) => f.path.endsWith('/+page.svelte'))!.contents
    expect(page).toContain('async function save({ mode, id, values }')
    expect(page).toContain('const row = values')
    expect(page).toContain('const ctx = { grid: gridApi!,')
    expect(page).toContain("ctx.goto('/customers')")
    for (const f of emitStudioProject(p).filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('entity triggers compile into the SQL route as createKitHandlers hooks (server-enforced)', () => {
    let p = setEntityDataSource(createProject([customers]), 'customers', { kind: 'sql', table: 'customers', dialect: 'postgres' })
    p = setTrigger(p, 'customers', 'beforeCreate', [
      { type: 'requireField', field: 'name', message: 'Name required' },
      { type: 'setField', field: 'tier', value: { kind: 'literal', value: 'free' } },
    ])
    p = setTrigger(p, 'customers', 'afterUpdate', [{ type: 'code', code: 'console.log("updated", row)' }])
    const route = emitStudioProject(p).find((f) => f.path === 'src/routes/api/customers/+server.ts')!.contents
    expect(route).toContain('hooks: {')
    expect(route).toContain('beforeCreate: async ({ values }) => {')
    expect(route).toContain('const v = values as Record<string, unknown>')
    expect(route).toContain("if (v['name'] == null || v['name'] === '') throw new Error('Name required')")
    expect(route).toContain("v['tier'] = 'free'")
    expect(route).toContain('afterUpdate: async ({ row }) => {')
    // The route uses createKitHandlers - hooks are a valid option on it.
    expect(route).toContain('createKitHandlers({')
  })

  it('a grid-layout screen (default) emits no dock manager', () => {
    const page = emitStudioProject(createProject([customers])).find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).not.toContain('SvDockManager')
    expect(page).toContain('<div class="st-screen">')
  })

  it('a split-layout screen renders a LOCKED SvDockManager (resize-only) and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'filter')
    p = addBlock(p, sid, 'kpi')
    p = setScreenLayout(p, sid, 'split')
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    // Same SvDockManager plumbing as dock, but locked.
    expect(page).toMatch(/import \{[^}]*SvDockManager[^}]*\} from '@svgrid\/grid'/)
    expect(page).toContain('<SvDockManager bind:workspace={dockWorkspace} onChange={(w) => saveDock(w)} locked>')
    expect(page).toContain('{#snippet pane(p)}')
    for (const b of p.screens[0]!.blocks) expect(page).toContain(`{#if p.id === '${b.id}'}`)
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('a stack-layout screen wraps blocks in a single-column flow (.st-stack) and compiles', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'kpi')
    p = setScreenLayout(p, sid, 'stack')
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!.contents
    expect(page).toContain('<div class="st-stack">')
    expect(page).not.toContain('<div class="st-screen">')
    expect(page).not.toContain('SvDockManager')
    // Default stack min-height flows into the page-scoped style so blocks aren't tiny.
    expect(page).toContain('.st-stack > * { min-height: 160px; }')
    const css = emitStudioAppBundle(p).find((f) => f.path === 'src/app.css')!.contents
    expect(css).toContain('.st-stack { display: flex; flex-direction: column;')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('syncDockPanes adds a pane for a new block + strips a removed one, preserving arrangement', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = setScreenLayout(p, sid, 'dock')
    const before = p.screens[0]!.dock!
    const beforeIds = [...dockPaneIds(before)]
    // Add a block: sync appends its pane, keeps the existing ones + the main node id (arrangement).
    p = addBlock(p, sid, 'chart')
    p = { ...p, screens: p.screens.map((s) => (s.id === sid ? syncDockPanes(s) : s)) }
    const afterAdd = p.screens[0]!.dock!
    const addIds = dockPaneIds(afterAdd)
    for (const id of beforeIds) expect(addIds.has(id)).toBe(true) // existing panes preserved
    const chartId = p.screens[0]!.blocks.find((b) => b.config.kind === 'chart')!.id
    expect(addIds.has(chartId)).toBe(true) // new pane added
    expect(afterAdd.main?.id).toBe(before.main?.id) // main node reused (arrangement not rebuilt)
    // Remove the chart: its pane is stripped, the rest stay.
    p = removeBlock(p, sid, chartId)
    p = { ...p, screens: p.screens.map((s) => (s.id === sid ? syncDockPanes(s) : s)) }
    const afterRemove = dockPaneIds(p.screens[0]!.dock!)
    expect(afterRemove.has(chartId)).toBe(false)
    for (const id of beforeIds) expect(afterRemove.has(id)).toBe(true)
  })

  it('setDockPaneTitle renames a pane (tab text) + dockPaneTitleOf reads it back', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = setScreenLayout(p, sid, 'dock')
    const gridBlock = p.screens[0]!.blocks[0]!
    expect(dockPaneTitleOf(p.screens[0]!, gridBlock.id)).toBe('Grid') // auto title
    p = setDockPaneTitle(p, sid, gridBlock.id, 'Customers table')
    expect(dockPaneTitleOf(p.screens[0]!, gridBlock.id)).toBe('Customers table')
    // Custom title survives an incremental pane sync (add a block).
    p = addBlock(p, sid, 'chart')
    p = { ...p, screens: p.screens.map((s) => (s.id === sid ? syncDockPanes(s) : s)) }
    expect(dockPaneTitleOf(p.screens[0]!, gridBlock.id)).toBe('Customers table')
  })

  it('setScreenLayout(dock) seeds a workspace by role + survives serialize/parse', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'filter')
    p = setScreenLayout(p, sid, 'dock')
    const scr = p.screens[0]!
    expect(scr.layout).toBe('dock')
    expect(scr.dock).toBeTruthy()
    // Pane ids equal block ids.
    const paneIds = dockPaneIds(scr.dock!)
    for (const b of scr.blocks) expect(paneIds.has(b.id)).toBe(true)
    // Round-trips through the project (de)serializer.
    const round = parseProject(serializeProject(p))
    expect(round.screens[0]!.layout).toBe('dock')
    expect(round.screens[0]!.dock).toEqual(scr.dock)
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

  it('pins Vite 7 (not 8) so the app boots in StackBlitz WebContainer', () => {
    const bundle = emitStudioAppBundle(createProject([customers]))
    const pkg = JSON.parse(bundle.find((f) => f.path === 'package.json')!.contents)
    // Vite 8's Rolldown bundler crashes in the WebContainer; pin the Rollup-based stack.
    expect(pkg.devDependencies['vite']).toBe('^7.0.0')
    expect(pkg.devDependencies['@sveltejs/vite-plugin-svelte']).toBe('^6.0.0')
    expect(pkg.devDependencies['vitest']).toMatch(/^\^4\./) // vitest 4 supports vite 7
    // engine-strict must not hard-fail install in a sandbox whose Node may differ.
    expect(bundle.find((f) => f.path === '.npmrc')!.contents).toContain('engine-strict=false')
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

  it('custom CSS goes to its own src/custom.css, imported after app.css by the layout', () => {
    const p = setTheme(createProject([customers]), { customCss: '.st__title { letter-spacing: -0.03em; }' })
    const files = emitStudioAppBundle(p)
    const customCss = files.find((f) => f.path === 'src/custom.css')!
    expect(customCss.contents).toContain('.st__title { letter-spacing: -0.03em; }')
    // app.css no longer carries the user's CSS.
    expect(files.find((f) => f.path === 'src/app.css')!.contents).not.toContain('.st__title { letter-spacing: -0.03em; }')
    // The layout imports both, custom.css after app.css so it overrides.
    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!.contents
    expect(layout.indexOf("import '../custom.css'")).toBeGreaterThan(layout.indexOf("import '../app.css'"))
    // custom.css is always emitted (even empty) so the import never dangles.
    expect(emitStudioAppBundle(createProject([customers])).find((f) => f.path === 'src/custom.css')).toBeTruthy()
  })

  it('no "Home" nav link; / redirects to the first screen', () => {
    const files = emitStudioProject(createProject([customers, orders]))
    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!.contents
    // The auto "Home" link is gone (it duplicated the first screen's landing).
    expect(layout).not.toContain('>Home<')
    expect(layout).not.toContain("label: 'Home'")
    // `/` is a redirect to the first navigable screen, not a distinct page.
    const home = files.find((f) => f.path === 'src/routes/+page.svelte')!.contents
    expect(home).toContain('const home = "/customers"')
    expect(home).toContain('goto(home, { replaceState: true })')
  })

  it('ships a light/dark switcher: both token sets scoped by [data-theme] + a toggle', () => {
    const p = setThemePreset(createProject([customers]), 'tailwind')
    const layout = layoutOf(p)
    // Both palettes emitted, keyed off <html data-theme>.
    expect(layout).toContain(':root[data-theme="light"]')
    expect(layout).toContain(':root[data-theme="dark"]')
    expect(layout).toContain('--sg-bg: #ffffff')   // Tailwind light bg
    expect(layout).toContain('--sg-bg: #0f172a')   // Tailwind dark bg
    // The toggle + its runtime are wired in and persist the choice.
    expect(layout).toContain('function toggleTheme()')
    expect(layout).toContain("document.documentElement.dataset.theme")
    expect(layout).toContain("localStorage.setItem('svapp:theme'")
    expect(layout).toContain('sv-app__theme')
    expect(() => compile(layout, { filename: '+layout.svelte', generate: 'client' })).not.toThrow()
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
    // onLoad runs on mount and onDestroy on unmount, both with the full ctx (grid +
    // the settable data battery, since this freestanding page owns its rows).
    expect(page.contents).toContain('const ctx = { grid: gridApi!, data: { get rows() { return rows }, setRows: (r) => (rows = r) }')
    expect(page.contents).toContain('as PageContext')
    expect(page.contents).toContain('handlers.onLoad(ctx)')
    expect(page.contents).toContain('return () => handlers.onDestroy(ctx)')
    expect(page.contents).toContain('<SvGrid data={rows} columns={columns} features={features}')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('the Grid is exposed as its real SvGridApi (ctx.grid), typed to the row in page-context', () => {
    const { p } = build()
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/report/+page.svelte')!
    const ctx = files.find((f) => f.path === 'src/routes/report/page-context.ts')!
    expect(page.contents).toContain('let gridApi = $state<SvGridApi<any, any> | null>(null)')
    expect(page.contents).toContain('onApiReady={(a) => (gridApi = a)}')
    expect(page.contents).toMatch(/import type \{[^}]*\bSvGridApi\b/)
    // Freestanding data-grid rows are RowData; the grid api is typed to it.
    expect(ctx.contents).toContain('grid: SvGridApi<any, RowData>')
    expect(ctx.contents).toContain("import type { RowData } from '@svgrid/grid'")
    expect(ctx.contents).toMatch(/import type \{[^}]*\bSvGridApi\b/)
  })

  it('a dropped component becomes a named, typed handle in code + markup', () => {
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
    expect(page.contents).toContain('const ctx = { grid: gridApi!, button1, data:')
    expect(page.contents).toContain('handlers.onLoad(ctx)')
    // Typed handle: ButtonHandle intersects Handle with the button's real setters.
    expect(ctx.contents).toContain('button1: ButtonHandle')
    expect(ctx.contents).toContain('type ButtonHandle = Handle & {')
    expect(ctx.contents).toContain("setVariant(value: \"primary\" | \"secondary\" | \"outline\" | \"ghost\" | \"danger\"): void")
    // Each prop is ALSO a read/write property (button1.variant = 'danger'), not just a setter.
    expect(ctx.contents).toContain("variant: \"primary\" | \"secondary\" | \"outline\" | \"ghost\" | \"danger\"")
    expect(ctx.contents).toContain('disabled: boolean')
    expect(ctx.contents).toContain('text: string')
    expect(companion.contents).toContain('ctx.button1')
    expect(companion.contents).not.toContain('getElementById')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('Methods panel: visual action steps compile to the ctx handler body + component onclick', () => {
    const { p: base, sid } = build()
    const withGrid = setScreenRenderGrid(base, sid, true) // gives ctx.grid
    let p = addComponentBlock(withGrid, sid, 'button', { _content: 'Export' })
    const btn = p.screens.find((s) => s.id === sid)!.blocks.find((b) => b.config.kind === 'component')!
    // onLoad steps + the button's on-click steps.
    p = setHandlerSteps(p, sid, 'onLoad', [
      { type: 'gridSort', field: 'name', dir: 'desc' },
      { type: 'setText', target: 'button1', value: 'Download' },
    ])
    p = setHandlerSteps(p, sid, clickSlot(btn.id), [
      { type: 'gridExport', format: 'csv' },
      { type: 'navigate', to: '/other' },
      { type: 'alert', message: 'Done' },
    ])
    const files = emitStudioProject(p)
    const handlers = files.find((f) => f.path === 'src/routes/report/handlers.ts')!.contents
    // onLoad compiled from steps.
    expect(handlers).toContain("ctx.grid.setSort('name', 'desc')")
    expect(handlers).toContain("ctx.button1.text = 'Download'")
    // The button's click steps become an onclick assignment inside onLoad.
    expect(handlers).toContain('ctx.button1.onclick = async () => {')
    expect(handlers).toContain('await ctx.grid.exportCsv()')
    expect(handlers).toContain("ctx.goto('/other')")
    expect(handlers).toContain("alert('Done')")
    // The page runs it + compiles.
    const page = files.find((f) => f.path === 'src/routes/report/+page.svelte')!
    expect(page.contents).toContain('handlers.onLoad(ctx)')
    for (const f of files.filter((f) => f.path.endsWith('.svelte'))) {
      expect(() => compile(f.contents, { filename: f.path, generate: 'client' }), f.path).not.toThrow()
    }
  })

  it('Methods: stepsToCode drops the visual steps into the raw code editor (take over)', () => {
    const { p: base, sid } = build()
    let p = setHandlerSteps(base, sid, 'onLoad', [{ type: 'alert', message: 'hi' }, { type: 'navigate', to: '/x' }])
    p = stepsToCode(p, sid, 'onLoad')
    const screen = p.screens.find((s) => s.id === sid)!
    expect(screen.handlerSteps?.onLoad).toBeUndefined()        // steps cleared
    expect(screen.handlerBodies?.onLoad).toBe("alert('hi')\nctx.goto('/x')") // compiled to raw body
  })

  it('Methods: a hand-written onLoad body MERGES with component on-click wiring (neither replaces the other)', () => {
    const { p: base, sid } = build()
    const withGrid = setScreenRenderGrid(base, sid, true)
    let p = addComponentBlock(withGrid, sid, 'button', { _content: 'Go' })
    const btn = p.screens.find((s) => s.id === sid)!.blocks.find((b) => b.config.kind === 'component')!
    // Hand-written onLoad code AND a button with on-click steps.
    p = setHandlerBody(p, sid, 'onLoad', "console.log('mounted')")
    p = setHandlerSteps(p, sid, clickSlot(btn.id), [{ type: 'navigate', to: '/next' }])
    const handlers = emitStudioProject(p).find((f) => f.path === 'src/routes/report/handlers.ts')!.contents
    expect(handlers).toContain("console.log('mounted')")          // the hand-written body survives
    expect(handlers).toContain('ctx.button1.onclick = async () => {') // + the onclick wiring is added
    expect(handlers).toContain("ctx.goto('/next')")
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

  it('entity screens wire onLoad/onDestroy + expose their grid as ctx.grid (reload, not setRows)', () => {
    let p = createProject([customers, orders])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = setHandlerBody(p, sid, 'onLoad', 'ctx.grid.autosizeAllColumns()')
    const route = p.screens.find((s) => s.id === sid)!.route
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === `src/routes/${route}/+page.svelte`)!
    const ctx = files.find((f) => f.path === `src/routes/${route}/page-context.ts`)!
    expect(page.contents).toContain("import * as handlers from './handlers'")
    expect(page.contents).toContain('let gridApi = $state<SvGridApi<any, any> | null>(null)')
    expect(page.contents).toContain('onApiReady={(a) => (gridApi = a)}')
    // Full ctx on mount + cleanup on unmount; the grid exposes reload(), not setRows.
    expect(page.contents).toContain('const ctx = { grid: gridApi!, data: { get rows() { return view.rows }, reload: () => controller.refresh(), create: (v) => controller.createRow(v), update: (id, v) => controller.updateRow(id, v), delete: (id) => controller.deleteRow(id) }, goto, params: Object.fromEntries($page.url.searchParams) } as unknown as PageContext')
    expect(page.contents).toContain('handlers.onLoad(ctx)')
    expect(page.contents).toContain('return () => handlers.onDestroy(ctx)')
    // The grid api is typed to the entity's row (Customers), not any.
    expect(ctx.contents).toContain('grid: SvGridApi<any, Customers>')
    expect(ctx.contents).toContain("import type { Customers } from '$lib/schemas'")
    expect(ctx.contents).not.toContain('setRows: (rows') // the entity grid is controller-fed, no setRows member
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('data-viz blocks become setData handles; entity components + batteries are in ctx', () => {
    let p = createProject([customers, orders])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    // A chart + a KPI + a button on the customers screen, with code enabled.
    p = addBlock(p, sid, 'chart')
    p = addBlock(p, sid, 'kpi')
    p = addComponentBlock(p, sid, 'button', { variant: 'primary' })
    p = enableScreenCode(p, sid)
    const route = p.screens.find((s) => s.id === sid)!.route
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === `src/routes/${route}/+page.svelte`)!
    const ctx = files.find((f) => f.path === `src/routes/${route}/page-context.ts`)!
    // Per-block DataHandles declared and fed to the chart/kpi markup.
    expect(page.contents).toContain('const chart1 = dataHandle<Customers>(() => allRows)')
    expect(page.contents).toContain('const kpi1 = dataHandle<Customers>(() => allRows)')
    expect(page.contents).toContain('rows={chart1.rows}')
    expect(page.contents).toContain("import { handle, dataHandle } from '$lib/handles.svelte'")
    // ctx carries the data handles + the entity component handle + batteries.
    expect(ctx.contents).toContain('chart1: DataHandle<Customers>')
    expect(ctx.contents).toContain('kpi1: DataHandle<Customers>')
    expect(ctx.contents).toContain('button1: ButtonHandle')
    expect(ctx.contents).toContain('goto: (path: string) => void')
    expect(ctx.contents).toContain('params: Record<string, string>')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('emits the shared DataHandle runtime, and its private-$state pattern is valid Svelte', () => {
    let p = createProject([customers])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'chart') // needs a DataHandle
    p = addComponentBlock(p, sid, 'button', {}) // needs a ComponentHandle
    p = enableScreenCode(p, sid)
    const mod = emitStudioProject(p).find((f) => f.path === 'src/lib/handles.svelte.ts')!
    expect(mod.contents).toContain('export class DataHandle')
    expect(mod.contents).toContain('setData(rows: T[]): void')
    // The generated .svelte.ts is stripped of types + compiled by the bundler's
    // svelte plugin; here we prove the reactive private-field pattern it relies on
    // (a `#field = $state()` read through a getter) is valid Svelte 5 via the
    // component compiler (which strips TS in `<script lang="ts">`).
    const probe = `<script lang="ts">
  class DataHandle<T> {
    #override = $state<T[] | null>(null)
    #fallback: () => T[]
    constructor(fallback: () => T[]) { this.#fallback = fallback }
    get rows(): T[] { return this.#override ?? this.#fallback() }
    setData(rows: T[]): void { this.#override = rows }
    clear(): void { this.#override = null }
  }
  let all = $state<number[]>([1, 2])
  const h = new DataHandle<number>(() => all)
</script>
<p>{h.rows.length}</p>`
    expect(() => compile(probe, { filename: 'probe.svelte', generate: 'client' })).not.toThrow()
  })

  it('ctxCompletions exposes the FULL grid api + every handle member + batteries', () => {
    let p = createProject([customers])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'chart')
    p = addComponentBlock(p, sid, 'button', {})
    p = enableScreenCode(p, sid)
    const screen = p.screens.find((s) => s.id === sid)!
    const comp = ctxCompletions(screen)
    // The whole grid surface, not a handful.
    expect(comp).toContain('ctx.grid.exportCsv()')
    expect(comp).toContain('ctx.grid.autosizeAllColumns()')
    expect(comp).toContain('ctx.grid.applyTransaction()')
    expect(comp.filter((c) => c.startsWith('ctx.grid.')).length).toBeGreaterThan(40)
    // Data handle + typed component setters + batteries.
    expect(comp).toContain('ctx.chart1.setData()')
    expect(comp).toContain('ctx.chart1.rows')
    expect(comp).toContain('ctx.button1.setVariant()')
    expect(comp).toContain('ctx.button1.onclick')
    expect(comp).toContain('ctx.data.reload()')
    expect(comp).toContain('ctx.goto()')
    expect(comp).toContain('ctx.params')
  })

  it('per-block style overrides are emitted as inline CSS on the block wrapper', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    // Give the grid block a border-off + padding + margin override.
    const bid = p.screens[0]!.blocks[0]!.id
    p = updateBlock(p, sid, bid, { style: { border: false, padding: 24, margin: 8, radius: 10, background: '#fafafa' } })
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!
    expect(page.contents).toContain('border: none')
    expect(page.contents).toContain('padding: 24px')
    expect(page.contents).toContain('margin: 8px')
    expect(page.contents).toContain('border-radius: 10px')
    expect(page.contents).toContain('background: #fafafa')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('per-block className is emitted on the wrapper (merged with base classes) + sanitized', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'kpi')
    const gridId = p.screens[0]!.blocks.find((b) => b.config.kind === 'grid')!.id
    const kpiId = p.screens[0]!.blocks.find((b) => b.config.kind === 'kpi')!.id
    p = updateBlock(p, sid, gridId, { className: 'my-grid highlight' })
    p = updateBlock(p, sid, kpiId, { className: 'evil"onload=x' }) // sanitized
    const page = emitStudioProject(p).find((f) => f.path === 'src/routes/customers/+page.svelte')!
    expect(page.contents).toContain('class="my-grid highlight"')
    // kpi keeps its base class, appends the (sanitized) user class - no attribute break-out.
    expect(page.contents).toContain('class="kpi evilonloadx"')
    expect(page.contents).not.toContain('onload=x')
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
  })

  it('per-screen className lands on .st-screen; app className lands on the shell root', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = updateScreen(p, sid, { className: 'crm-screen' })
    p = setTheme(p, { appClass: 'brand-app' })
    const files = emitStudioProject(p)
    const page = files.find((f) => f.path === 'src/routes/customers/+page.svelte')!
    expect(page.contents).toContain('<div class="st-screen crm-screen">')
    const layout = files.find((f) => f.path === 'src/routes/+layout.svelte')!
    expect(layout.contents).toMatch(/class="sv-app sv-app--\w+ brand-app"/)
    expect(() => compile(page.contents, { filename: page.path, generate: 'client' })).not.toThrow()
    expect(() => compile(layout.contents, { filename: layout.path, generate: 'client' })).not.toThrow()
  })

  it('ctxAmbientDts type-checks real ctx usage and catches grid/data typos (editor TS surface)', () => {
    let p = createProject([customers])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'chart')
    p = addComponentBlock(p, sid, 'button', {})
    p = enableScreenCode(p, sid)
    const screen = p.screens.find((s) => s.id === sid)!
    const dts = ctxAmbientDts(screen, customers)
    // Valid, real code compiles clean: awaited grid export, feed a chart from the
    // dataset, type a component setter, navigate, read a param.
    expect(typeCheckBody(dts, [
      'const csv = await ctx.grid.exportCsv()',
      'console.log(csv.length)',
      'ctx.chart1.setData(ctx.data.rows)',
      "ctx.button1.setVariant('danger')",
      "ctx.button1.variant = 'ghost'",        // prop assignment, not just the setter
      'ctx.button1.disabled = true',
      "ctx.button1.text = 'Save'",
      "ctx.goto('/orders')",
      'const id = ctx.params.id',
      'ctx.grid.setSort("mrr", "desc")',
    ].join('\n'))).toEqual([])
    // Assigning the wrong type to a typed prop is caught.
    expect(typeCheckBody(dts, "ctx.button1.variant = 'nope'").length).toBeGreaterThan(0)
    expect(typeCheckBody(dts, 'ctx.button1.disabled = 5').length).toBeGreaterThan(0)
    // A misspelled grid method is a hard error (SvGridApi is precisely typed).
    const gridTypo = typeCheckBody(dts, 'ctx.grid.exprtCsv()')
    expect(gridTypo.length).toBeGreaterThan(0)
    expect(gridTypo.join(' ')).toMatch(/exprtCsv/)
    // Feeding a chart the wrong element type is caught (DataHandle<Customers>).
    expect(typeCheckBody(dts, 'ctx.chart1.setData([1, 2, 3])').length).toBeGreaterThan(0)
    // An unknown ctx member is caught.
    expect(typeCheckBody(dts, 'ctx.notAThing()').length).toBeGreaterThan(0)
  })

  it('onDestroy is a first-class slot in handlers.ts + page-context manifest', () => {
    let p = createProject([customers])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = setHandlerBody(p, sid, 'onDestroy', 'clearInterval(timer)')
    const route = p.screens.find((s) => s.id === sid)!.route
    const companion = emitStudioProject(p).find((f) => f.path === `src/routes/${route}/handlers.ts`)!
    expect(companion.contents).toContain('export function onDestroy(ctx: PageContext): void')
    expect(companion.contents).toContain('clearInterval(timer)')
  })
})
