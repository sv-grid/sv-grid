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
  import { SvGrid, renderComponent, tableFeatures, rowSortingFeature, type GridColumns, type ServerDataSource, type SvGridApi } from '@svgrid/grid'
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
    const day = rng.int(0, 400)
    return new Date(Date.UTC(2026, 8, 17) - day * 86_400_000).toISOString().slice(0, 10)
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
        modified: '2026-09-18',
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
  }
  // "Someone else saved": the server changes a file behind the grid's back,
  // which is what a per-folder refresh is for.
  function touchOnServer(folder: string): string | null {
    const files = entriesOf(folder).filter((n) => n.kind === 'file')
    if (!files.length) return null
    const f = files[Math.floor(Math.random() * files.length)]!
    f.size = (f.size ?? 0) + 1024 * Math.ceil(Math.random() * 40)
    f.modified = '2026-09-18'
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
  let api = $state<SvGridApi<typeof features, Row> | null>(null)
  let focused = $state<Row | null>(null)
  const focusedFolder = $derived.by(() => {
    if (!focused) return null
    const m = focused.__group
    if (m.kind === 'group') return { id: m.key, route: m.path }
    if (m.kind === 'leaf') return { id: m.route?.at(-1) ?? 'root', route: m.route ?? [] }
    return null
  })
  const focusedFile = $derived(focused?.__group.kind === 'leaf' ? (focused as Node) : null)
  let last = $state('')

  async function refreshFolder() {
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
  async function deleteFile() {
    const f = focusedFile
    if (!f) return
    await ctl.deleteRow(f.id)
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

<section class="wrap">
  <header class="chrome">
    <div class="actions">
      <button type="button" class="btn" onclick={() => ctl.expandAll()}>Expand loaded</button>
      <button type="button" class="btn" onclick={() => ctl.collapseAll()}>Collapse all</button>
      <button type="button" class="btn" disabled={!focusedFolder} onclick={refreshFolder} title="The server changes a file in the focused folder, then that folder alone is re-read">Refresh folder</button>
      <button type="button" class="btn" onclick={newFile} title="A file under the focused folder, or the root">New file</button>
      <button type="button" class="btn btn-danger" disabled={!focusedFile} onclick={deleteFile}>Delete file</button>
    </div>
    <label class="chk"><input type="checkbox" checked={openRoots} onchange={(e) => setOpenRoots(e.currentTarget.checked)} /> Open the first level on load</label>
    <span class="note">
      Click a folder: one <code>getRows</code> with its path as <code>groupKeys</code>, answered with that folder's
      entries and nothing else. Sort a header and every open folder re-sorts on the server. Focus a row to
      refresh its folder, add a file beside it, or delete it.
    </span>
  </header>
  <div class="gridpane">
    <SvGrid
      responsive={true}
      columnResize
      fitColumns
      rowModel={ctl}
      {columns}
      {features}
      sortable
      selectionMode="none"
      rowHeight={32}
      containerHeight="100%"
      onCellClick={(e) => (focused = (e.row as Row) ?? null)}
      onApiReady={(next) => (api = next)}
    />
  </div>
  <footer class="foot">
    <span class="stat"><span class="stat-label">Requests</span><strong>{requests}</strong></span>
    <span class="stat"><span class="stat-label">Folders read</span><strong>{levels.length}</strong></span>
    <span class="stat"><span class="stat-label">Blocks cached</span><strong>{loaded}</strong></span>
    <span class="stat"><span class="stat-label">Focused</span>{focusedFolder ? focusedFolder.id.replace(/^root\/?/, '') || 'root' : 'nothing'}</span>
    {#if last}<span class="stat last">{last}</span>{/if}
  </footer>
</section>

<style>
  .wrap { display: flex; flex-direction: column; flex: 1; gap: 10px; height: 100%; min-height: 0; }
  .chrome { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; flex: none; }
  .note { font-size: 12px; color: var(--sg-muted, #64748b); flex: 1 1 320px; }
  .chk {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    color: var(--sg-fg, #0f172a);
    white-space: nowrap;
  }
  .chk input { accent-color: var(--sg-accent, #2563eb); }
  .actions { display: inline-flex; gap: 4px; flex-wrap: wrap; }
  .btn {
    font: inherit;
    font-size: 13px;
    padding: 5px 12px;
    border-radius: 6px;
    border: 1px solid var(--sg-border, #e2e8f0);
    background: var(--sg-bg, #fff);
    color: var(--sg-fg, #0f172a);
    cursor: pointer;
    white-space: nowrap;
  }
  .btn:hover:not(:disabled) { background: var(--sg-row-hover-bg, #f8fafc); }
  .btn:disabled { opacity: 0.45; cursor: default; }
  .btn-danger { color: var(--sg-danger, #b91c1c); }
  .gridpane { flex: 1; min-height: 0; }
  .foot {
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
    flex: none;
    align-items: center;
    padding: 6px 12px;
    border: 1px solid var(--sg-border, #e2e8f0);
    border-radius: 8px;
    background: var(--sg-header-bg, #f8fafc);
    font-size: 12px;
    color: var(--sg-muted, #64748b);
    font-variant-numeric: tabular-nums;
  }
  .stat { display: inline-flex; align-items: baseline; gap: 5px; white-space: nowrap; }
  .stat.last { white-space: normal; color: var(--sg-fg, #0f172a); }
  .stat-label { font-size: 10.5px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; }
  .foot strong { color: var(--sg-fg, #0f172a); font-weight: 600; }
</style>
