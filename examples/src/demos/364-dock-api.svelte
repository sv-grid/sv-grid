<script lang="ts">
  /**
   * SvDockManager - the imperative API + event stream. A toolbar drives the
   * manager through `onReady`'s handle (float / pop-out / maximize / auto-hide /
   * close / focus), and every user action is logged from `onEvent`.
   */
  import { SvDockManager, dockGroup, dockTabs, dockPane } from '@svgrid/grid'
  import type { DockManagerState, DockManagerApi, DockEvent } from '@svgrid/grid'

  let workspace = $state<DockManagerState>({
    main: dockGroup('row', [
      dockTabs([dockPane('files', 'Files')]),
      dockTabs([dockPane('editor', 'Editor'), dockPane('preview', 'Preview')]),
    ], [0.3, 0.7]),
    floating: [],
    autoHide: [],
  })

  let api = $state<DockManagerApi | null>(null)
  let log = $state<string[]>([])
  const record = (e: DockEvent) => (log = [`${e.type}  ${JSON.stringify(e).slice(0, 60)}`, ...log].slice(0, 12))
</script>

<div class="wrap">
  <header>
    <h2>Imperative API &amp; events</h2>
    <p>Drive the manager from code; watch <code>onEvent</code> stream every action.</p>
  </header>

  <div class="toolbar">
    <button onclick={() => api?.float('preview')}>float Preview</button>
    <button onclick={() => api?.popout('editor')}>pop out Editor</button>
    <button onclick={() => api?.autoHide('files')}>auto-hide Files</button>
    <button onclick={() => api?.focus('editor')}>focus Editor</button>
    <button onclick={() => api?.close('preview')}>close Preview</button>
    <button onclick={() => (workspace = { main: dockGroup('row', [dockTabs([dockPane('files', 'Files')]), dockTabs([dockPane('editor', 'Editor'), dockPane('preview', 'Preview')])], [0.3, 0.7]), floating: [], autoHide: [] })}>reset</button>
  </div>

  <div class="body">
    <div class="stage">
      <SvDockManager bind:workspace onReady={(a) => (api = a)} onEvent={record}>
        {#snippet pane(p)}<div class="panel"><h3>{p.title}</h3></div>{/snippet}
      </SvDockManager>
    </div>
    <aside class="events">
      <div class="events-title">Event log</div>
      {#if log.length === 0}<div class="empty">Interact to see events…</div>{/if}
      {#each log as line, i (i + line)}<div class="ev">{line}</div>{/each}
    </aside>
  </div>
</div>

<style>
  .wrap { padding: 20px; display: flex; flex-direction: column; gap: 12px; height: 100%; box-sizing: border-box; }
  header h2 { margin: 0 0 2px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13px; }
  .toolbar { display: flex; gap: 8px; flex-wrap: wrap; }
  .toolbar button { font: inherit; font-size: 12.5px; font-weight: 600; padding: 5px 11px; cursor: pointer;
    color: var(--sg-fg, #0f172a); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 7px; }
  .toolbar button:hover { border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb); }
  .body { flex: 1; min-height: 420px; display: flex; gap: 12px; }
  .stage { flex: 1; min-width: 0; }
  .events { width: 260px; flex: none; display: flex; flex-direction: column; gap: 2px; overflow: auto;
    background: var(--sg-header-bg, #f6f7f9); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; padding: 10px; }
  .events-title { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em; color: var(--sg-muted, #94a3b8); margin-bottom: 6px; }
  .empty { color: var(--sg-muted, #94a3b8); font-size: 12.5px; }
  .ev { font-family: ui-monospace, monospace; font-size: 11.5px; padding: 3px 6px; border-radius: 5px; background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .panel { padding: 16px; } .panel h3 { margin: 0; font-size: 14px; }
</style>
