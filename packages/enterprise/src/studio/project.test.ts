import { describe, expect, it } from 'vitest'
import type { EntitySchema } from '../schema'
import {
  addBlock,
  duplicateBlock,
  blockColumns,
  blockStyleCss,
  mergeBlockStyle,
  addBlockAt,
  addComponentBlock,
  addEntity,
  addFreestandingScreen,
  addScreen,
  addScreenAction,
  addScreenFromTemplate,
  removeScreenAction,
  parseProject,
  screenFromTemplate,
  serializeProject,
  setTheme,
  blockPalette,
  createProject,
  defaultBlockConfig,
  defaultScreenFor,
  gridColumns,
  moveBlock,
  removeBlock,
  removeEntity,
  reorderBlock,
  sanitizeProject,
  setEntityDataSource,
  entityDataSource,
  defaultEntitySource,
  setShell,
  updateBlock,
  updateEntity,
  updateScreen,
  duplicateScreen,
  reorderScreen,
  insertBlock,
  validateProject,
  addTab,
  removeTab,
  renameTab,
  addTabBlock,
  removeTabBlock,
  flattenBlocks,
  TAB_CHILD_KINDS,
  type MasterDetailConfig,
  type TabsConfig,
  type StudioProject,
} from './project'

const customers: EntitySchema = {
  name: 'customers', label: 'Customer', idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, hidden: { form: true } },
    { field: 'name', type: 'text' },
    { field: 'secret', type: 'text', hidden: { grid: true } },
    { field: 'tier', type: 'enum', options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { field: 'mrr', type: 'number' },
  ],
}
const orders: EntitySchema = {
  name: 'orders', label: 'Order', idField: 'id',
  fields: [{ field: 'id', type: 'text', primaryKey: true }, { field: 'total', type: 'number' }],
}

describe('per-block style', () => {
  it('blockStyleCss emits override declarations and sanitizes the color', () => {
    expect(blockStyleCss(undefined)).toBe('')
    expect(blockStyleCss({})).toBe('')
    expect(blockStyleCss({ border: false })).toBe('border: none')
    expect(blockStyleCss({ border: true })).toContain('border: 1px solid')
    expect(blockStyleCss({ shadow: false })).toBe('box-shadow: none')
    expect(blockStyleCss({ padding: 16, margin: 8, radius: 12 })).toBe('padding: 16px; margin: 8px; border-radius: 12px')
    // A malicious color can't break out of the inline style attribute.
    expect(blockStyleCss({ background: '#fff' })).toBe('background: #fff')
    expect(blockStyleCss({ background: 'red;"><script>' })).toBe('background: redscript')
  })

  it('mergeBlockStyle merges and drops cleared keys (undefined)', () => {
    expect(mergeBlockStyle(undefined, { padding: 12 })).toEqual({ padding: 12 })
    expect(mergeBlockStyle({ padding: 12, border: false }, { margin: 4 })).toEqual({ padding: 12, border: false, margin: 4 })
    expect(mergeBlockStyle({ padding: 12, border: false }, { border: undefined })).toEqual({ padding: 12 })
    expect(mergeBlockStyle({ padding: 12 }, { padding: undefined })).toBeUndefined()
  })

  it('updateBlock merges a style patch onto the block, round-trips through parse', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    const bid = p.screens[0]!.blocks[0]!.id
    p = updateBlock(p, sid, bid, { style: { border: false, padding: 24 } })
    expect(p.screens[0]!.blocks[0]!.style).toEqual({ border: false, padding: 24 })
    p = updateBlock(p, sid, bid, { style: { padding: undefined } })
    expect(p.screens[0]!.blocks[0]!.style).toEqual({ border: false })
    const round = parseProject(serializeProject(p))
    expect(round.screens[0]!.blocks[0]!.style).toEqual({ border: false })
  })
})

describe('Tabs container ops', () => {
  const base = () => defaultBlockConfig('tabs', customers) as TabsConfig

  it('defaults to two empty tabs', () => {
    const cfg = base()
    expect(cfg.tabs.map((t) => t.label)).toEqual(['Overview', 'Details'])
    expect(cfg.tabs.every((t) => t.blocks.length === 0)).toBe(true)
  })

  it('adds, renames, and removes tabs (keeps at least one)', () => {
    let cfg = addTab(base(), 'Extra')
    expect(cfg.tabs).toHaveLength(3)
    cfg = renameTab(cfg, 0, 'Home')
    expect(cfg.tabs[0]!.label).toBe('Home')
    cfg = removeTab(cfg, 2)
    expect(cfg.tabs).toHaveLength(2)
    const one = removeTab(removeTab(cfg, 1), 0)
    expect(one.tabs).toHaveLength(1) // never drops the last tab
  })

  it('adds only allowed child kinds, with unique ids, and removes them', () => {
    let cfg = addTabBlock(base(), 0, 'chart', customers)
    cfg = addTabBlock(cfg, 0, 'kpi', customers)
    expect(cfg.tabs[0]!.blocks.map((b) => b.config.kind)).toEqual(['chart', 'kpi'])
    const ids = cfg.tabs[0]!.blocks.map((b) => b.id)
    expect(new Set(ids).size).toBe(2) // unique ids
    // grid is controller-bound -> rejected inside tabs
    expect(addTabBlock(cfg, 0, 'grid', customers)).toBe(cfg)
    expect(TAB_CHILD_KINDS).not.toContain('grid')
    const removed = removeTabBlock(cfg, 0, ids[0]!)
    expect(removed.tabs[0]!.blocks.map((b) => b.config.kind)).toEqual(['kpi'])
  })

  it('flattenBlocks surfaces blocks nested in tabs', () => {
    const cfg = addTabBlock(addTabBlock(base(), 0, 'chart', customers), 1, 'gauge', customers)
    const block = { id: 'tabs-1', span: 3 as const, config: cfg }
    const kinds = flattenBlocks([block]).map((b) => b.config.kind)
    expect(kinds).toEqual(['tabs', 'chart', 'gauge'])
  })

  it('updateBlock / removeBlock reach a block nested inside a tab', () => {
    // A screen whose only block is a Tabs container with a chart in tab 0.
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = { ...p, screens: p.screens.map((s) => (s.id === sid ? { ...s, blocks: [] } : s)) }
    p = addBlock(p, sid, 'tabs')
    const tb = p.screens.find((s) => s.id === sid)!.blocks[0]!
    p = updateBlock(p, sid, tb.id, { config: addTabBlock(tb.config as TabsConfig, 0, 'chart', customers) })
    const childId = (p.screens.find((s) => s.id === sid)!.blocks[0]!.config as TabsConfig).tabs[0]!.blocks[0]!.id

    // Update the nested chart's config through the normal updateBlock path.
    p = updateBlock(p, sid, childId, { config: { measure: 'mrr', reduce: 'avg' } as Partial<import('./project').ChartConfig> })
    const child = (p.screens.find((s) => s.id === sid)!.blocks[0]!.config as TabsConfig).tabs[0]!.blocks[0]!
    expect(child.config).toMatchObject({ kind: 'chart', measure: 'mrr', reduce: 'avg' })

    // Remove the nested chart; the tab is left empty, the container survives.
    p = removeBlock(p, sid, childId)
    expect((p.screens.find((s) => s.id === sid)!.blocks[0]!.config as TabsConfig).tabs[0]!.blocks).toHaveLength(0)
    expect(p.screens.find((s) => s.id === sid)!.blocks).toHaveLength(1) // container intact
  })
})

describe('createProject / defaultScreenFor', () => {
  it('makes one default screen per entity, each with a grid (editing = form)', () => {
    const p = createProject([customers, orders])
    expect(p.screens.map((s) => s.entity)).toEqual(['customers', 'orders'])
    const screen = p.screens[0]!
    expect(screen.blocks.map((b) => b.config.kind)).toEqual(['grid']) // editing is a grid property now
    expect((screen.blocks[0]!.config as import('./project').GridConfig).editing).toBe('form')
    expect(p.dataSource).toBe('memory')
  })

  it('grid columns include non-grid-hidden fields, shown', () => {
    const cols = gridColumns(customers)
    expect(cols.map((c) => c.field)).toEqual(['id', 'name', 'tier', 'mrr']) // secret (hidden.grid) excluded
    expect(cols.find((c) => c.field === 'id')!.show).toBe(false) // raw id column hidden by default
    expect(cols.filter((c) => c.field !== 'id').every((c) => c.show)).toBe(true)
  })

  it('a chart block defaults to a low-cardinality dimension + numeric measure', () => {
    const cfg = defaultBlockConfig('chart', customers)
    expect(cfg).toMatchObject({ kind: 'chart', dimension: 'tier', measure: 'mrr', reduce: 'sum', type: 'bar' })
  })
})

describe('block ops', () => {
  const base = createProject([customers])
  const sid = base.screens[0]!.id

  it('adds, removes, moves, reorders, and updates blocks immutably', () => {
    const added = addBlock(base, sid, 'chart')
    expect(added).not.toBe(base)
    expect(added.screens[0]!.blocks.map((b) => b.config.kind)).toEqual(['grid', 'chart'])

    const chartId = added.screens[0]!.blocks[1]!.id
    const removed = removeBlock(added, sid, chartId)
    expect(removed.screens[0]!.blocks).toHaveLength(1)

    const moved = moveBlock(added, sid, chartId, -1)
    expect(moved.screens[0]!.blocks.map((b) => b.config.kind)).toEqual(['chart', 'grid'])

    const reordered = reorderBlock(added, sid, chartId, 0)
    expect(reordered.screens[0]!.blocks[0]!.id).toBe(chartId)

    const gridId = base.screens[0]!.blocks[0]!.id
    const patched = updateBlock(base, sid, gridId, { span: 2, config: { pageSize: 25 } as Partial<import('./project').GridConfig> })
    const grid = patched.screens[0]!.blocks[0]!
    expect(grid.span).toBe(2)
    expect((grid.config as import('./project').GridConfig).pageSize).toBe(25)
  })

  it('duplicateBlock clones config with a fresh id, right after the original', () => {
    const base = createProject([customers])
    const sid = base.screens[0]!.id
    const gridId = base.screens[0]!.blocks[0]!.id
    const dup = duplicateBlock(base, sid, gridId)
    const blocks = dup.screens[0]!.blocks
    expect(blocks).toHaveLength(2)
    expect(blocks[1]!.id).not.toBe(gridId)                 // fresh id
    expect(blocks[1]!.config.kind).toBe('grid')            // same kind
    expect(blocks[1]!.config).not.toBe(blocks[0]!.config)  // deep-cloned config
  })

  it('blockColumns maps legacy span to 12-col and honors colSpan', () => {
    expect(blockColumns({ span: 1 })).toBe(4)
    expect(blockColumns({ span: 3 })).toBe(12)
    expect(blockColumns({ span: 1, colSpan: 5 })).toBe(5) // colSpan overrides
    expect(blockColumns({ span: 2, colSpan: 99 })).toBe(12) // clamped
  })

  it('addBlockAt inserts at the given index (palette drop)', () => {
    const p = addBlockAt(base, sid, 'chart', 0) // before the grid
    expect(p.screens[0]!.blocks.map((b) => b.config.kind)).toEqual(['chart', 'grid'])
    const end = addBlockAt(base, sid, 'kpi', 99) // clamps to end
    expect(end.screens[0]!.blocks.at(-1)!.config.kind).toBe('kpi')
  })

  it('gives every added block a unique id', () => {
    let p = createProject([customers])
    p = addBlock(p, sid, 'chart')
    p = addBlock(p, sid, 'chart')
    const ids = p.screens[0]!.blocks.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('entity + screen ops', () => {
  it('adds/removes an entity with its screen', () => {
    let p = createProject([customers])
    p = addEntity(p, orders)
    expect(p.entities).toHaveLength(2)
    expect(p.screens.some((s) => s.entity === 'orders')).toBe(true)
    p = removeEntity(p, 'orders')
    expect(p.entities).toHaveLength(1)
    expect(p.screens.some((s) => s.entity === 'orders')).toBe(false)
  })

  it('updateEntity retargets screens when the entity is renamed', () => {
    const p = createProject([customers])
    const renamed = updateEntity(p, 'customers', { ...customers, name: 'clients' })
    expect(renamed.entities[0]!.name).toBe('clients')
    expect(renamed.screens[0]!.entity).toBe('clients')
  })

  it('updateEntity retargets a master-detail childEntity when the child is renamed', () => {
    let p = createProject([customers, orders])
    const sid = p.screens.find((s) => s.entity === 'customers')!.id
    p = addBlock(p, sid, 'master-detail')
    const mdId = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!.id
    p = updateBlock(p, sid, mdId, { config: { childEntity: 'orders', foreignKey: 'id' } as Partial<MasterDetailConfig> })
    const renamed = updateEntity(p, 'orders', { ...orders, name: 'sales' })
    const md = renamed.screens.find((s) => s.id === sid)!.blocks.find((b) => b.id === mdId)!
    expect((md.config as MasterDetailConfig).childEntity).toBe('sales')
  })

  it('a second screen for an entity gets a unique id', () => {
    const p = addScreen(createProject([customers]), 'customers')
    const ids = p.screens.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('updateScreen patches title/route', () => {
    const p = createProject([customers])
    const up = updateScreen(p, p.screens[0]!.id, { title: 'People', route: 'people' })
    expect(up.screens[0]).toMatchObject({ title: 'People', route: 'people' })
  })
})

describe('freestanding screens + custom actions', () => {
  it('addFreestandingScreen creates a screen with no entity and no blocks', () => {
    const p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const s = p.screens.find((s) => s.title === 'Reports')!
    expect(s.entity).toBeUndefined()
    expect(s.blocks).toEqual([])
  })

  it('a second freestanding screen gets a unique id and route', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    p = addFreestandingScreen(p, { title: 'Sync' })
    const freestanding = p.screens.filter((s) => s.entity === undefined)
    expect(freestanding).toHaveLength(2)
    expect(new Set(freestanding.map((s) => s.id)).size).toBe(2)
    expect(new Set(freestanding.map((s) => s.route)).size).toBe(2)
  })

  it('addScreenAction generates a unique id and appends to the screen; removeScreenAction removes it', () => {
    const base = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const screenId = base.screens.find((s) => s.title === 'Reports')!.id
    let p = addScreenAction(base, screenId, { label: 'Run report', confirm: 'Run the monthly report?' })
    const screen = p.screens.find((s) => s.id === screenId)!
    expect(screen.actions).toHaveLength(1)
    expect(screen.actions![0]).toMatchObject({ label: 'Run report', confirm: 'Run the monthly report?' })
    const actionId = screen.actions![0]!.id
    expect(actionId).toBeTruthy()

    p = removeScreenAction(p, screenId, actionId)
    expect(p.screens.find((s) => s.id === screenId)!.actions).toEqual([])
  })

  it('addScreenAction ids stay unique project-wide, not just per-screen', () => {
    let p = createProject([customers])
    const s1 = p.screens[0]!.id
    p = addFreestandingScreen(p, { title: 'Reports' })
    const s2 = p.screens.find((s) => s.title === 'Reports')!.id
    p = addScreenAction(p, s1, { label: 'First' })
    p = addScreenAction(p, s2, { label: 'Second' })
    const id1 = p.screens.find((s) => s.id === s1)!.actions![0]!.id
    const id2 = p.screens.find((s) => s.id === s2)!.actions![0]!.id
    expect(id1).not.toBe(id2)
  })
})

describe('component blocks', () => {
  it('addComponentBlock adds a component block to a freestanding screen (no entity needed)', () => {
    const p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    const next = addComponentBlock(p, sid, 'button', { variant: 'primary' })
    const screen = next.screens.find((s) => s.id === sid)!
    expect(screen.blocks).toHaveLength(1)
    expect(screen.blocks[0]!.config).toMatchObject({ kind: 'component', component: 'button', props: { variant: 'primary' } })
  })

  it('addComponentBlock also works mixed onto an entity-bound screen', () => {
    const p = createProject([customers])
    const sid = p.screens[0]!.id
    const before = p.screens[0]!.blocks.length
    const next = addComponentBlock(p, sid, 'alert', {})
    const screen = next.screens.find((s) => s.id === sid)!
    expect(screen.blocks).toHaveLength(before + 1)
    expect(screen.blocks.at(-1)!.config).toMatchObject({ kind: 'component', component: 'alert' })
  })

  it('addComponentBlock inserts at an index and gives the block a unique id', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addComponentBlock(p, sid, 'button', {})
    p = addComponentBlock(p, sid, 'badge', {}, 0)
    const screen = p.screens.find((s) => s.id === sid)!
    expect(screen.blocks.map((b) => (b.config as { component: string }).component)).toEqual(['badge', 'button'])
    expect(new Set(screen.blocks.map((b) => b.id)).size).toBe(2)
  })

  it('validateProject warns on a component block with no component selected', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addComponentBlock(p, sid, '', {})
    expect(validateProject(p).some((i) => /Component block has no component selected/.test(i.message))).toBe(true)
  })

  it('a freestanding screen with only a component block does not warn about being empty', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addComponentBlock(p, sid, 'button', {})
    expect(validateProject(p).some((i) => /is empty/.test(i.message))).toBe(false)
  })
})

describe('validateProject', () => {
  it('addScreen dedupes the route so two screens for one entity do not collide', () => {
    const p = addScreen(createProject([customers]), 'customers')
    expect(new Set(p.screens.map((s) => s.route)).size).toBe(2) // customers, customers-1
    expect(validateProject(p).some((i) => /Duplicate route/.test(i.message))).toBe(false)
  })

  it('flags a genuine duplicate route and a missing-entity screen', () => {
    const p = createProject([customers])
    const twoSameRoute = { ...p, screens: [p.screens[0]!, { ...p.screens[0]!, id: 'dup' }] }
    const dup = validateProject(twoSameRoute).find((i) => /Duplicate route/.test(i.message))
    expect(dup?.level).toBe('error')

    const broken = { ...p, screens: [{ ...p.screens[0]!, entity: 'ghosts' }] }
    expect(validateProject(broken).some((i) => /missing entity/.test(i.message))).toBe(true)
  })

  it('the palette lists every block kind', () => {
    expect(blockPalette.map((p) => p.kind)).toContain('grid')
    expect(blockPalette.map((p) => p.kind)).toContain('dashboard')
  })

  it('warns when a master-detail points at a missing child entity', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'master-detail')
    const mdId = p.screens[0]!.blocks.at(-1)!.id
    p = updateBlock(p, sid, mdId, { config: { childEntity: 'ghosts', foreignKey: 'id' } as Partial<MasterDetailConfig> })
    expect(validateProject(p).some((i) => /missing child entity "ghosts"/.test(i.message))).toBe(true)
  })

  it('attributes a block issue to its screen + block id (for inline badges + jump)', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = addBlock(p, sid, 'master-detail') // unconfigured -> warns
    const mdId = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!.id
    const issue = validateProject(p).find((i) => i.block === mdId)
    expect(issue).toBeDefined()
    expect(issue!.screen).toBe(sid)
    expect(issue!.message).toMatch(/child entity/)
  })

  it('flags an empty filter panel and a tree without its fields', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    // A tree with no label/parent field warns.
    p = addBlock(p, sid, 'tree')
    const treeId = p.screens.find((s) => s.id === sid)!.blocks.at(-1)!.id
    p = updateBlock(p, sid, treeId, { config: { labelField: '', parentField: '' } as Partial<import('./project').TreeConfig> })
    const treeIssue = validateProject(p).find((i) => i.block === treeId)
    expect(treeIssue?.message).toMatch(/label field/)
  })

  it('a freestanding screen (no entity) does not trigger the missing-entity error', () => {
    const p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    expect(validateProject(p).some((i) => /missing entity/.test(i.message))).toBe(false)
  })

  it('warns that an empty freestanding screen needs an action or content', () => {
    const p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    expect(validateProject(p).some((i) => /is empty - add an action or some content/.test(i.message))).toBe(true)
  })

  it('a freestanding screen with a custom action does not warn about being empty', () => {
    let p = addFreestandingScreen(createProject([customers]), { title: 'Reports' })
    const sid = p.screens.find((s) => s.title === 'Reports')!.id
    p = addScreenAction(p, sid, { label: 'Run report' })
    expect(validateProject(p).some((i) => /is empty/.test(i.message))).toBe(false)
  })
})

describe('block/screen efficiency ops', () => {
  it('insertBlock pastes a block into a screen with a fresh id', () => {
    let p = createProject([customers, orders])
    const src = p.screens.find((s) => s.entity === 'customers')!.blocks[0]! // the default grid
    const target = p.screens.find((s) => s.entity === 'orders')!.id
    const before = p.screens.find((s) => s.id === target)!.blocks.length
    p = insertBlock(p, target, src)
    const blocks = p.screens.find((s) => s.id === target)!.blocks
    expect(blocks).toHaveLength(before + 1)
    expect(blocks.at(-1)!.id).not.toBe(src.id)          // fresh id, no collision
    expect(blocks.at(-1)!.config.kind).toBe(src.config.kind)
  })

  it('duplicateScreen clones a screen (fresh id/route/title + fresh block ids), inserted after', () => {
    let p = createProject([customers])
    const sid = p.screens[0]!.id
    p = duplicateScreen(p, sid)
    expect(p.screens).toHaveLength(2)
    const [a, b] = p.screens
    expect(b!.id).not.toBe(a!.id)
    expect(b!.route).not.toBe(a!.route)
    expect(b!.title).toMatch(/copy/)
    // Block ids in the clone are unique vs the source.
    const aIds = new Set(a!.blocks.map((x) => x.id))
    expect(b!.blocks.every((x) => !aIds.has(x.id))).toBe(true)
  })

  it('reorderScreen moves a screen to a new index', () => {
    let p = createProject([customers, orders])
    const [first, second] = p.screens
    p = reorderScreen(p, first!.id, 1)
    expect(p.screens.map((s) => s.id)).toEqual([second!.id, first!.id])
  })
})

describe('sanitizeProject (loaded-config hardening)', () => {
  it('is idempotent on a clean project', () => {
    const p = createProject([customers, orders])
    expect(sanitizeProject(p)).toEqual(p)
  })

  it('dedupes duplicate field names, screen ids, routes, and block ids', () => {
    const bad: StudioProject = {
      title: 'x', dataSource: 'memory',
      entities: [{ name: 'a', idField: 'id', fields: [{ field: 'id', type: 'text' }, { field: 'id', type: 'text' }] }],
      screens: [
        { id: 's', entity: 'a', title: 'S1', route: 'r', blocks: [
          { id: 'b', span: 1, config: { kind: 'form', presentation: 'modal' } },
          { id: 'b', span: 1, config: { kind: 'form', presentation: 'modal' } },
        ] },
        { id: 's', entity: 'a', title: 'S2', route: 'r', blocks: [] },
      ],
    }
    const clean = sanitizeProject(bad)
    expect(new Set(clean.entities[0]!.fields.map((f) => f.field)).size).toBe(2)
    expect(new Set(clean.screens.map((s) => s.id)).size).toBe(2)
    expect(new Set(clean.screens.map((s) => s.route)).size).toBe(2)
    expect(new Set(clean.screens[0]!.blocks.map((b) => b.id)).size).toBe(2)
  })

  it('drops a duplicate-named entity (the first survives, keeping the name)', () => {
    const clean = sanitizeProject({ ...createProject([customers]), entities: [customers, { ...customers, label: 'Dup' }] })
    expect(clean.entities).toHaveLength(1)
    expect(clean.entities[0]!.label).toBe('Customer')
  })

  it('parseProject sanitizes a dup-id config so keyed lists cannot collide', () => {
    const raw = JSON.stringify({
      entities: [customers],
      screens: [
        { id: 'x', entity: 'customers', title: 'A', route: 'c', blocks: [] },
        { id: 'x', entity: 'customers', title: 'B', route: 'c', blocks: [] },
      ],
    })
    const p = parseProject(raw)
    expect(new Set(p.screens.map((s) => s.id)).size).toBe(2)
    expect(new Set(p.screens.map((s) => s.route)).size).toBe(2)
  })
})

describe('per-entity data sources', () => {
  it('defaults to in-memory and resolves an explicit binding', () => {
    const p0 = createProject([customers])
    expect(entityDataSource(p0, 'customers')).toEqual({ kind: 'memory' })
    const p1 = setEntityDataSource(p0, 'customers', { kind: 'rest', baseUrl: 'https://api', path: 'customers', method: 'GET', params: [] })
    expect(entityDataSource(p1, 'customers').kind).toBe('rest')
    expect(p1.dataSources).toMatchObject({ customers: { kind: 'rest' } })
  })

  it('defaultEntitySource seeds a skeleton per kind', () => {
    expect(defaultEntitySource('rest', 'customers')).toMatchObject({ kind: 'rest', path: 'customers', method: 'GET', params: [] })
    expect(defaultEntitySource('sql', 'orders')).toEqual({ kind: 'sql', table: 'orders' })
    expect(defaultEntitySource('supabase', 'orders')).toEqual({ kind: 'supabase', table: 'orders' })
    expect(defaultEntitySource('memory', 'x')).toEqual({ kind: 'memory' })
  })

  it('round-trips dataSources through serialize / parse', () => {
    const p = setEntityDataSource(createProject([customers, orders]), 'orders', { kind: 'sql', table: 'orders', dialect: 'postgres' })
    expect(parseProject(serializeProject(p)).dataSources).toEqual(p.dataSources)
  })

  it('sanitize prunes bindings for removed entities', () => {
    let p = setEntityDataSource(createProject([customers, orders]), 'orders', { kind: 'supabase', table: 'orders' })
    p = removeEntity(p, 'orders')
    expect(sanitizeProject(p).dataSources).toBeUndefined()
  })
})

describe('pages (nav) + shell', () => {
  it('updateScreen sets nav show / label / order', () => {
    const p = createProject([customers])
    const up = updateScreen(p, p.screens[0]!.id, { nav: { show: false, label: 'People', order: 3 } })
    expect(up.screens[0]!.nav).toEqual({ show: false, label: 'People', order: 3 })
  })

  it('the empty template makes a blank screen', () => {
    expect(screenFromTemplate(customers, 'empty').blocks).toEqual([])
  })

  it('setShell merges shell config into the theme', () => {
    const p = setShell(setShell(createProject([customers]), { style: 'top-nav' }), { brand: 'Acme' })
    expect(p.theme?.shell).toEqual({ style: 'top-nav', brand: 'Acme' })
  })

  it('round-trips nav + shell', () => {
    let p = updateScreen(createProject([customers]), 'customers', { nav: { order: 2 } })
    p = setShell(p, { style: 'top-nav', footer: '' })
    const back = parseProject(serializeProject(p))
    expect(back.screens[0]!.nav).toEqual({ order: 2 })
    expect(back.theme?.shell).toEqual({ style: 'top-nav', footer: '' })
  })
})

describe('screen templates', () => {
  it('crud -> grid; dashboard -> kpis + chart + grid; master-detail -> grid + md (editing is a grid property)', () => {
    expect(screenFromTemplate(customers, 'crud').blocks.map((b) => b.config.kind)).toEqual(['grid'])
    const dash = screenFromTemplate(customers, 'dashboard').blocks.map((b) => b.config.kind)
    expect(dash).toContain('kpi')
    expect(dash).toContain('chart')
    expect(dash).toContain('grid')
    const md = screenFromTemplate(customers, 'master-detail', { child: orders }).blocks
    expect(md.map((b) => b.config.kind)).toEqual(['grid', 'master-detail'])
    const mdBlock = md.find((b) => b.config.kind === 'master-detail')!
    expect(mdBlock.config).toMatchObject({ childEntity: 'orders' })
  })

  it('addScreenFromTemplate appends a screen with a unique id', () => {
    const p = addScreenFromTemplate(createProject([customers]), 'customers', 'dashboard')
    expect(p.screens).toHaveLength(2)
    expect(new Set(p.screens.map((s) => s.id)).size).toBe(2)
    expect(p.screens[1]!.blocks.some((b) => b.config.kind === 'chart')).toBe(true)
  })
})

describe('serialize / parse (studio.config round-trip)', () => {
  it('round-trips a project', () => {
    const p = setTheme(addBlock(createProject([customers, orders]), 'customers', 'chart'), { accent: '#e11d48' })
    const back = parseProject(serializeProject(p))
    expect(back).toEqual(p)
  })

  it('defaults missing fields and rejects invalid input', () => {
    const min = parseProject(JSON.stringify({ entities: [customers], screens: [] }))
    expect(min.title).toBe('My Studio App')
    expect(min.dataSource).toBe('memory')
    expect(() => parseProject('not json')).toThrow(/not valid JSON/)
    expect(() => parseProject(JSON.stringify({ screens: [] }))).toThrow(/entities/)
  })
})
