<!-- Documented in: docs/help/server/server-tree-data.md -->
<script lang="ts">
  /**
   * 469. Server tree data (row model)
   * ---------------------------------
   * A file tree the grid never holds whole: every expand is one `getRows`
   * whose `groupKeys` is the path of folder ids, and the "server" answers
   * with that folder's direct children, one block at a time. The row model
   * owns the lazy expand, a block cache per folder, open-by-default,
   * expand / collapse all, a per-folder refresh and race-safety; the grid
   * mounts it through the one `rowModel` prop.
   *
   * The server here generates each folder's entries from a seeded PRNG on
   * first request, so the tree is five levels deep and never built up front.
   * The row model is Enterprise; the datasource contract it runs on is free.
   */
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, type GridColumns, type ServerDataSource } from '@svgrid/grid'
  import {
    setLicenseKey,
    createServerRowModel,
    serverGroupText,
    SvGroupCell,
    type ServerRowModel,
    type ServerRowModelState,
    type ServerRowModelGridRow,
  } from '@svgrid/enterprise'
  import { createPrng } from '../shared/mock-api'

  setLicenseKey('SVENTERPRISE-DEV-LOCAL')

  const features = tableFeatures({ rowSortingFeature })

  // ---- The server ----------------------------------------------------------
  type Node = {
    id: string
    parent: string | null
    name: string
    kind: 'folder' | 'file'
    /** Bytes for a file; a folder's direct entry count is `entries`. */
    size: number | null
    entries: number | null
    modified: string
    owner: string
  }
  const FOLDERS = ['src', 'lib', 'assets', 'docs', 'tests', 'scripts', 'config', 'vendor', 'public', 'styles', 'api', 'fixtures']
  const FILES = ['index', 'main', 'utils', 'types', 'schema', 'router', 'store', 'client', 'server', 'layout', 'theme', 'hooks', 'README', 'CHANGELOG']
  const EXT = ['ts', 'svelte', 'md', 'json', 'css', 'png', 'svg', 'sql']
  const OWNERS = ['ada', 'grace', 'linus', 'margaret', 'ken', 'barbara']
  const MAX_DEPTH = 5
  const TODAY = new Date().toISOString().slice(0, 10)
  const DAY = 86_400_000

  const hash = (s: string) => {
    let h = 2166136261
    for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return h >>> 0
  }
  // Each folder's entries are made once, from a PRNG seeded by the folder id,
  // so the same path always answers the same way and nothing exists before
  // it is asked for.
  const dirs = new Map<string, Node[]>()
  function entriesOf(parent: string): Node[] {
    let list = dirs.get(parent)
    if (list) return list
    const rng = createPrng(hash(parent))
    const depth = parent === 'root' ? 1 : parent.split('/').length
    list = []
    // Both counts come first, so `countOf` can read them from a fresh PRNG
    // without replaying the names' draws.
    const folders = depth < MAX_DEPTH ? rng.int(2, 5) : 0
    const files = rng.int(4, 14)
    const used = new Set<string>()
    for (let i = 0; i < folders; i += 1) {
      let name = rng.pick(FOLDERS)
      while (used.has(name)) name = `${rng.pick(FOLDERS)}-${rng.int(2, 9)}`
      used.add(name)
      const id = `${parent}/${name}`
      list.push({ id, parent, name, kind: 'folder', size: null, entries: null, modified: stamp(rng), owner: rng.pick(OWNERS) })
    }
    for (let i = 0; i < files; i += 1) {
      let name = `${rng.pick(FILES)}.${rng.pick(EXT)}`
      while (used.has(name)) name = `${rng.pick(FILES)}-${rng.int(2, 99)}.${rng.pick(EXT)}`
      used.add(name)
      list.push({ id: `${parent}/${name}`, parent, name, kind: 'file', size: rng.int(200, 4_000_000), entries: null, modified: stamp(rng), owner: rng.pick(OWNERS) })
    }
    // A folder's count is the number of entries beneath it: that is what the
    // badge beside the name shows, so it is filled in before the parent answers.
    for (const f of list) if (f.kind === 'folder') f.entries = countOf(f.id)
    dirs.set(parent, list)
    return list
  }
  // The child count of a folder that has not been generated yet, from the
  // same seed it will use, so the badge and the real listing agree.
  function countOf(id: string): number {
    const rng = createPrng(hash(id))
    const depth = id.split('/').length
    const folders = depth < MAX_DEPTH ? rng.int(2, 5) : 0
    const files = rng.int(4, 14)
    return folders + files
  }
  function stamp(rng: ReturnType<typeof createPrng>): string {
    const day = rng.int(1, 400)
    return new Date(Date.now() - day * DAY).toISOString().slice(0, 10)
  }

  let requests = $state(0)
  const source: ServerDataSource<Node> = {
    async getRows(req) {
      requests += 1
      await new Promise((r) => setTimeout(r, 160))
      const parent = req.groupKeys?.at(-1) ?? 'root'
      let rows = [...entriesOf(parent)]
      // Folders first, then the requested order (or by name).
      const sort = req.sortModel[0] ?? { id: 'name', desc: false }
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'folder' ? -1 : 1
        const av = a[sort.id as keyof Node]
        const bv = b[sort.id as keyof Node]
        const c = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av ?? '').localeCompare(String(bv ?? ''))
        return sort.desc ? -c : c
      })
      return { rows: rows.slice(req.startRow, req.endRow), rowCount: rows.length }
    },
    async createRow(input) {
      await new Promise((r) => setTimeout(r, 120))
      const parent = String(input.parent ?? 'root')
      const list = entriesOf(parent)
      const row: Node = {
        id: `${parent}/new-${Date.now().toString(36)}.md`,
        parent,
        name: `notes-${list.filter((n) => n.kind === 'file').length + 1}.md`,
        kind: 'file',
        size: 512,
        entries: null,
        modified: TODAY,
        owner: 'you',
      }
      list.push(row)
      return row
    },
    async deleteRow(id) {
      await new Promise((r) => setTimeout(r, 120))
      const parent = id.slice(0, id.lastIndexOf('/'))
      const list = entriesOf(parent)
      const i = list.findIndex((n) => n.id === id)
      if (i >= 0) list.splice(i, 1)
    },
    // A move is an update of `parent`. Ids are paths here, so the node
    // and every folder generated beneath it take new ids on the way.
    async updateRow(id, patch) {
      await new Promise((r) => setTimeout(r, 140))
      const parent = id.slice(0, id.lastIndexOf('/'))
      const list = entriesOf(parent)
      const i = list.findIndex((n) => n.id === id)
      if (i < 0) throw new Error(`no such node: ${id}`)
      const node = list[i]!
      const to = patch.parent === undefined ? parent : String(patch.parent)
      if (to === parent) {
        Object.assign(node, patch, { modified: TODAY })
        return node
      }
      if (to === node.id || to.startsWith(node.id + '/')) throw new Error(`${node.name} cannot move into itself`)
      list.splice(i, 1)
      const target = entriesOf(to)
      if (target.some((n) => n.name === node.name)) throw new Error(`${to.replace(/^root\/?/, '') || 'the root'} already has a ${node.name}`)
      const moved: Node = { ...node, id: `${to}/${node.name}`, parent: to, modified: TODAY }
      if (node.kind === 'folder') rekey(node.id, moved.id)
      target.push(moved)
      // The badges beside both folders count their entries.
      const bump = (folderId: string, by: number) => {
        if (folderId === 'root') return
        const f = entriesOf(folderId.slice(0, folderId.lastIndexOf('/'))).find((n) => n.id === folderId)
        if (f && f.entries != null) f.entries += by
      }
      bump(parent, -1)
      bump(to, 1)
      return moved
    },
  }
  // Everything generated under a moved folder follows it, id by id.
  function rekey(oldId: string, newId: string): void {
    const list = entriesOf(oldId)
    dirs.delete(oldId)
    for (const n of list) {
      const next = `${newId}/${n.name}`
      if (n.kind === 'folder') rekey(n.id, next)
      n.id = next
      n.parent = newId
    }
    dirs.set(newId, list)
  }
  // "Someone else saved": the server changes a file behind the grid's back,
  // which is what a per-folder refresh is for.
  function touchOnServer(folder: string): string | null {
    const files = entriesOf(folder).filter((n) => n.kind === 'file')
    if (!files.length) return null
    const f = files[Math.floor(Math.random() * files.length)]!
    f.size = (f.size ?? 0) + 1024 * Math.ceil(Math.random() * 40)
    f.modified = TODAY
    f.owner = 'ci-bot'
    return f.name
  }

  // ---- The model ---------------------------------------------------------
  type Row = ServerRowModelGridRow<Node>
  let view = $state<ServerRowModelState<Node>>()
  let openRoots = $state(true)
  let ctl = $state.raw<ServerRowModel<Node>>(makeModel(true))
  function makeModel(open: boolean) {
    const model = createServerRowModel<Node>(source, {
      treeData: true,
      getRowId: (n) => n.id,
      hasChildren: (n) => n.kind === 'folder',
      childCount: (n) => n.entries ?? undefined,
      // The first level opens on arrival; deeper folders wait for a click.
      isGroupOpenByDefault: (route) => open && route.length <= 1,
      blockSize: 50,
      skeletonRows: 4,
      onChange: (s) => (view = s),
    })
    model.refresh()
    return model
  }
  function setOpenRoots(next: boolean) {
    if (next === openRoots) return
    openRoots = next
    ctl.dispose()
    ctl = makeModel(next)
  }
  $effect(() => () => ctl.dispose())

  // ---- Actions on the focused row -----------------------------------------
  // The active cell, by click or by arrow key: the buttons act on its row.
  let focused = $state<Row | null>(null)
  const focusRow = (rowIndex: number) => {
    const row = ctl.getRows()[rowIndex] as Row | undefined
    focused = row && row.__group && row.__group.kind !== 'placeholder' ? row : null
  }
  const focusedFolder = $derived.by(() => {
    if (!focused) return null
    const m = focused.__group
    if (m.kind === 'group') return { id: m.key, route: m.path }
    if (m.kind === 'leaf') return { id: m.route?.at(-1) ?? 'root', route: m.route ?? [] }
    return null
  })
  const focusedFile = $derived(focused?.__group.kind === 'leaf' ? (focused as Node) : null)
  let last = $state('')

  function refreshFolder() {
    const f = focusedFolder
    if (!f) return
    const touched = touchOnServer(f.id)
    ctl.refresh({ route: f.route })
    last = touched ? `${touched} changed on the server; ${f.id.replace(/^root\/?/, '') || 'the root'} re-read in place` : 'nothing to touch'
  }
  async function newFile() {
    const f = focusedFolder ?? { id: 'root', route: [] as string[] }
    const row = await ctl.createRow({ parent: f.id }, f.route)
    // A closed folder has no cached level to add to (the transaction reports
    // storeNotFound); opening it reads the folder, new file included.
    if (f.route.length && !ctl.isExpanded(f.route)) ctl.expandGroup(f.route)
    last = `${row.name} created under ${f.id.replace(/^root\/?/, '') || 'the root'} - one createRow, applied as a transaction`
  }
  // A drop hands the move to the model: into a folder, or beside a row,
  // which means that row's folder at that position. The server rewrites
  // `parent`; the model moves the node between the two cached levels.
  async function onRowDrop(e: { row: Row; target: Row | null; targetIndex: number | null; side: 'before' | 'after' | 'into' }) {
    const moved = e.row as unknown as Node
    const m = e.row.__group
    if (!m || (m.kind !== 'leaf' && m.kind !== 'group')) return
    let toRoute: string[]
    let addIndex: number | undefined
    const t = e.target?.__group
    if (!e.target || !t) {
      toRoute = []
    } else if (e.side === 'into' && t.kind === 'group') {
      toRoute = [...t.path]
    } else if (t.kind === 'group') {
      toRoute = t.path.slice(0, -1)
      addIndex = indexInLevel(e.targetIndex!, toRoute) + (e.side === 'after' ? 1 : 0)
    } else if (t.kind === 'leaf') {
      toRoute = [...(t.route ?? [])]
      addIndex = indexInLevel(e.targetIndex!, toRoute) + (e.side === 'after' ? 1 : 0)
    } else {
      return
    }
    const fromRoute = m.kind === 'group' ? m.path.slice(0, -1) : [...(m.route ?? [])]
    if (JSON.stringify(fromRoute) === JSON.stringify(toRoute) && e.side === 'into') return
    const toId = toRoute.length ? toRoute[toRoute.length - 1]! : 'root'
    try {
      const res = await ctl.moveRow(moved.id, toRoute, { patch: { parent: toId } as Partial<Node>, addIndex })
      const dest = toId.replace(/^root\/?/, '') || 'the root'
      last = res.status === 'applied' ? `${moved.name} moved to ${dest} - one updateRow, then a remove and an add transaction` : `${moved.name} moved to ${dest} on the server; the folder shows it when opened (${res.status})`
      if (res.status === 'storeNotFound' && toRoute.length) ctl.expandGroup(toRoute)
    } catch (err) {
      last = err instanceof Error ? err.message : String(err)
    }
  }
  // A row's position within its level: how many rows of that level sit
  // above it in the flattened list. The parent route of a display row is
  // its `route` (a leaf) or its `path` minus its own key (a folder).
  function parentRouteOf(row: Row): string[] | null {
    const g = row.__group
    if (g?.kind === 'leaf') return [...(g.route ?? [])]
    if (g?.kind === 'group') return g.path.slice(0, -1)
    return null
  }
  function indexInLevel(displayIndex: number, route: string[]): number {
    const rows = ctl.getRows() as Row[]
    const key = JSON.stringify(route)
    let n = 0
    for (let i = 0; i < displayIndex; i += 1) {
      const pr = parentRouteOf(rows[i]!)
      if (pr && JSON.stringify(pr) === key) n += 1
    }
    return n
  }
  async function deleteFile() {
    const f = focusedFile
    if (!f) return
    await ctl.deleteRow(f.id)
    focused = null
    last = `${f.name} deleted - one deleteRow, removed from the cache without a refetch`
  }

  // ---- Columns --------------------------------------------------------------
  const bytes = (n: number | null) => (n == null ? '' : n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : n >= 1000 ? `${(n / 1000).toFixed(0)} KB` : `${n} B`)
  const columns: GridColumns<Row> = [
    {
      id: 'name',
      header: 'Name',
      width: 340,
      filterable: false,
      // Under treeData the leaf field names every node's label; folders would
      // otherwise show their id, which is the route key.
      fieldFn: (row) => serverGroupText(row, 'name'),
      cell: (ctx) =>
        renderComponent(SvGroupCell, {
          row: ctx.row.original,
          onToggle: () => ctl.group.onToggle(ctx.row.original),
          leafField: 'name',
        }),
    },
    { field: 'kind', header: 'Kind', width: 90, sortable: false },
    { field: 'size', header: 'Size', width: 110, align: 'right', formatter: ({ value }) => bytes(value as number | null) },
    { field: 'modified', header: 'Modified', width: 120 },
    { field: 'owner', header: 'Owner', width: 120 },
  ]

  const levels = $derived.by(() => {
    void view
    return ctl.levelStates()
  })
  const loaded = $derived(levels.reduce((n, l) => n + l.blocks.filter((b) => b.status === 'loaded').length, 0))
</script>

<section class="wrap demo-kit">
  <header class="chrome">
    <div class="actions">
      <button type="button" class="btn" onclick={() => ctl.expandAll()} title="Open every folder the grid has read">Expand loaded</button>
      <button type="button" class="btn" onclick={() => ctl.collapseAll()} title="Close every folder; their entries stay cached">Collapse all</button>
      <button type="button" class="btn" disabled={!focusedFolder} onclick={refreshFolder} title="The server changes a file in the focused folder, then that folder alone is re-read">Refresh folder</button>
      <button type="button" class="btn" onclick={newFile} title="A file under the focused folder, or the root">New file</button>
      <button type="button" class="btn btn-danger" disabled={!focusedFile} onclick={deleteFile} title="Delete the focused file">Delete file</button>
    </div>
    <label class="chk"><input type="checkbox" checked={openRoots} onchange={(e) => setOpenRoots(e.currentTarget.checked)} /> Open the first level on load</label>
    <span class="note">
      Click a folder: one <code>getRows</code> with its path as <code>groupKeys</code>, answered with that folder's
      entries and nothing else. Sort Name, Size, Modified or Owner and every open folder re-sorts on the server.
      Focus a row, by click or arrow key, to refresh its folder, add a file beside it, or delete it.
      Drag a row onto a folder to move it there (the server rewrites its parent), or
      between two rows to place it in their folder.
    </span>
  </header>
  <div class="gridpane">
    <SvGrid
      responsive={true}
      columnResize
      fitColumns
      rowModel={ctl}
      stickyGroupRows
      {columns}
      {features}
      sortable
      selectionMode="none"
      rowHeight={32}
      containerHeight="100%"
      rowDragManaged
      onRowDrop={onRowDrop}
      onActiveCellChange={(cell) => focusRow(cell.rowIndex)}
    />
  </div>
  <footer class="foot">
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    <span class="stat"><span class="stat-label">Folders read</span><strong>{levels.length}</strong></span>
    <span class="stat"><span class="stat-label">Blocks cached</span><strong>{loaded}</strong></span>
    <span class="stat"><span class="stat-label">Focused</span>{focusedFolder ? focusedFolder.id.replace(/^root\/?/, '') || 'root' : 'nothing'}</span>
    {#if view?.error}<span class="stat err">{String((view.error as Error).message ?? view.error)}</span>{/if}
    {#if last}<span class="stat last">{last}</span>{/if}
  </footer>
</section>
