import { describe, it, expect } from 'vitest'
import type { EntitySchema } from '../schema.js'
import { crudSuiteScreens, addCrudSuite, crudAppFromSchemas } from './screen-suites.js'
import {
  createProject,
  parseProject,
  serializeProject,
  validateProject,
  type DetailConfig,
  type GridConfig,
  type Screen,
} from './project.js'

const customers: EntitySchema = {
  name: 'customers',
  label: 'Customer',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', label: 'Customer' },
    { field: 'city', type: 'text' },
    { field: 'tier', type: 'enum', options: [
      { value: 'free', label: 'Free', color: '#64748b' },
      { value: 'pro', label: 'Pro', color: '#2563eb' },
    ] },
    { field: 'spend', type: 'number' },
  ],
}

const orders: EntitySchema = {
  name: 'orders',
  label: 'Order',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'reference', type: 'text' },
    { field: 'customer_id', type: 'relation', relation: { entity: 'customers', labelField: 'name' } },
    { field: 'total', type: 'number' },
    { field: 'status', type: 'enum', options: [{ value: 'paid', label: 'Paid', color: '#16a34a' }] },
    { field: 'placed', type: 'dateString' },
  ],
}

const gridOf = (screen: Screen): GridConfig =>
  screen.blocks.find((b) => b.config.kind === 'grid')!.config as GridConfig
const detailOf = (screen: Screen): DetailConfig =>
  screen.blocks.find((b) => b.config.kind === 'detail')!.config as DetailConfig

describe('crudSuiteScreens', () => {
  it('defaults to list + form, and adds a detail page when the entity has children', () => {
    // `customers` is referenced by `orders`, so it earns a detail page.
    expect(crudSuiteScreens(customers, [customers, orders]).map((s) => s.id))
      .toEqual(['customers', 'customers-manage', 'customers-detail'])
    // `orders` has no children pointing at it - list + form only.
    expect(crudSuiteScreens(orders, [customers, orders]).map((s) => s.id))
      .toEqual(['orders', 'orders-manage'])
  })

  it('honours an explicit screen selection', () => {
    const screens = crudSuiteScreens(customers, [customers, orders], { screens: ['dashboard', 'list'] })
    expect(screens.map((s) => s.id)).toEqual(['customers-overview', 'customers'])
  })

  it('puts status pills and a totals row on the list grid', () => {
    const [list] = crudSuiteScreens(customers, [customers], { screens: ['list'] })
    const grid = gridOf(list!)
    expect(grid.formatRules?.map((r) => r.value)).toEqual(['free', 'pro'])
    expect(grid.rowSummaries).toBe(true)
  })

  it('seeds a faceted filter panel, and drops it when asked', () => {
    const [withFacets] = crudSuiteScreens(customers, [customers], { screens: ['list'] })
    expect(withFacets!.blocks[0]!.config.kind).toBe('filter')
    const [plain] = crudSuiteScreens(customers, [customers], { screens: ['list'], filter: false })
    expect(plain!.blocks.every((b) => b.config.kind !== 'filter')).toBe(true)
  })

  describe('editing modes', () => {
    it("'form' (the default) edits through a popup form", () => {
      const [list] = crudSuiteScreens(customers, [customers], { screens: ['list'] })
      expect(gridOf(list!).editing).toBe('form')
      expect(gridOf(list!).rowLink).toBeUndefined()
    })

    it("'inline' edits in the grid", () => {
      const [list] = crudSuiteScreens(customers, [customers], { screens: ['list'], editing: 'inline' })
      expect(gridOf(list!).editing).toBe('inline')
    })

    it("'detail' makes the list read-only and drills into the detail screen", () => {
      const screens = crudSuiteScreens(customers, [customers, orders], { editing: 'detail' })
      const list = screens.find((s) => s.id === 'customers')!
      const detail = screens.find((s) => s.id === 'customers-detail')!
      expect(gridOf(list).editing).toBe('none')
      expect(gridOf(list).rowLink).toEqual({ screen: detail.id, targetField: 'id' })
      // A drill target is reached by clicking a row, so it stays out of the nav.
      expect(detail.nav?.show).toBe(false)
    })
  })

  it('builds related-record tabs from every relation pointing at the entity', () => {
    const [detail] = crudSuiteScreens(customers, [customers, orders], { screens: ['detail'] })
    expect(detailOf(detail!).related).toEqual([
      { entity: 'orders', foreignKey: 'customer_id', label: 'Order', titleField: 'reference', statusField: 'status', dateField: 'placed' },
    ])
  })

  it('treats a self-referential FK as a child collection (a hierarchy)', () => {
    const folders: EntitySchema = {
      name: 'folders',
      idField: 'id',
      fields: [
        { field: 'id', type: 'text', primaryKey: true },
        { field: 'name', type: 'text' },
        { field: 'parent_id', type: 'relation', relation: { entity: 'folders', labelField: 'name' } },
      ],
    }
    const [detail] = crudSuiteScreens(folders, [folders], { screens: ['detail'] })
    expect(detailOf(detail!).related?.[0]).toMatchObject({ entity: 'folders', foreignKey: 'parent_id' })
  })

  it('survives an entity with nothing but a primary key', () => {
    const bare: EntitySchema = { name: 'flags', idField: 'id', fields: [{ field: 'id', type: 'text', primaryKey: true }] }
    const screens = crudSuiteScreens(bare, [bare])
    expect(screens.map((s) => s.id)).toEqual(['flags', 'flags-manage'])
    expect(gridOf(screens[0]!).rowSummaries).toBeFalsy()
  })

  it('picks non-colliding ids AND routes, keeping drill-through pointed at the real screen', () => {
    const screens = crudSuiteScreens(customers, [customers, orders], {
      editing: 'detail',
      taken: { ids: new Set(['customers', 'customers-detail']), routes: new Set(['customers']) },
    })
    const ids = screens.map((s) => s.id)
    expect(ids).toEqual(['customers-2', 'customers-manage', 'customers-detail-2'])
    expect(screens.map((s) => s.route)).toEqual(['customers-2', 'customers-manage', 'customers-detail'])
    // The rowLink must name the RENAMED detail screen, not the original id.
    expect(gridOf(screens[0]!).rowLink?.screen).toBe('customers-detail-2')
  })
})

describe('addCrudSuite', () => {
  it('appends a suite without disturbing the existing screens', () => {
    const project = createProject([customers, orders])
    const next = addCrudSuite(project, 'orders')
    expect(next.screens.slice(0, 2).map((s) => s.id)).toEqual(['customers', 'orders'])
    // 'orders' is taken by the default screen, so the suite claims fresh ids.
    expect(next.screens.slice(2).map((s) => s.id)).toEqual(['orders-2', 'orders-manage'])
    expect(project.screens).toHaveLength(2) // immutable
  })

  it('ignores an unknown entity', () => {
    const project = createProject([customers])
    expect(addCrudSuite(project, 'nope')).toBe(project)
  })
})

describe('crudAppFromSchemas', () => {
  it('leads with an overview dashboard over the most-referenced entity', () => {
    const app = crudAppFromSchemas([orders, customers])
    const first = app.screens[0]!
    expect(first.title).toBe('Overview')
    expect(first.entity).toBe('customers') // orders point at customers
    expect(first.nav?.order).toBe(0)
    expect(first.blocks.some((b) => b.config.kind === 'kpi')).toBe(true)
  })

  it('can skip the dashboard', () => {
    const app = crudAppFromSchemas([customers, orders], { overviewDashboard: false })
    expect(app.screens[0]!.id).toBe('customers')
  })

  it('generates a suite per entity with unique ids, routes and ordered nav', () => {
    const app = crudAppFromSchemas([customers, orders])
    const ids = app.screens.map((s) => s.id)
    const routes = app.screens.map((s) => s.route)
    expect(new Set(ids).size).toBe(ids.length)
    expect(new Set(routes).size).toBe(routes.length)
    const orders2 = app.screens.map((s) => s.nav?.order).filter((n): n is number => n != null)
    expect([...orders2].sort((a, b) => a - b)).toEqual(orders2)
  })

  it('binds sources per entity and merges seed rows into memory bindings', () => {
    const app = crudAppFromSchemas([customers], { seed: { customers: [{ id: 'c1', name: 'Acme' }] } })
    expect(app.dataSources?.customers).toEqual({ kind: 'memory', seed: [{ id: 'c1', name: 'Acme' }] })
  })

  it('carries seed into a PGlite binding and leaves SQL bindings alone', () => {
    const app = crudAppFromSchemas([customers, orders], {
      dataSource: 'sql',
      sources: { customers: { kind: 'pglite', table: 'customers' }, orders: { kind: 'sql', table: 'orders', dialect: 'postgres' } },
      seed: { customers: [{ id: 'c1' }], orders: [{ id: 'o1' }] },
    })
    expect(app.dataSources?.customers).toEqual({ kind: 'pglite', table: 'customers', seed: [{ id: 'c1' }] })
    expect(app.dataSources?.orders).toEqual({ kind: 'sql', table: 'orders', dialect: 'postgres' })
    expect(app.dataSource).toBe('sql')
  })

  it('applies per-entity overrides', () => {
    const app = crudAppFromSchemas([customers, orders], {
      overviewDashboard: false,
      perEntity: { orders: { screens: ['list'] } },
    })
    expect(app.screens.filter((s) => s.entity === 'orders').map((s) => s.id)).toEqual(['orders'])
  })

  it('produces a valid project that round-trips through parse/serialize', () => {
    const app = crudAppFromSchemas([customers, orders], { title: 'Sales desk' })
    expect(validateProject(app).filter((i) => i.level === 'error')).toEqual([])
    const round = parseProject(serializeProject(app))
    expect(round).toEqual(app)
    expect(round.title).toBe('Sales desk')
  })

  it('every rowLink names a screen that exists', () => {
    const app = crudAppFromSchemas([customers, orders], { perEntity: { customers: { editing: 'detail' } } })
    const ids = new Set(app.screens.map((s) => s.id))
    for (const screen of app.screens) {
      for (const block of screen.blocks) {
        if (block.config.kind !== 'grid') continue
        const link = (block.config as GridConfig).rowLink
        if (link) expect(ids.has(link.screen), `dangling rowLink -> ${link.screen}`).toBe(true)
      }
    }
  })
})
