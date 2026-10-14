<script lang="ts">
  /**
   * The view bar's "Hide fields": a switch per field, a search, hide all /
   * show all, and drag to reorder. The primary field is always shown.
   */
  import { panelFocus } from './panel-focus'
  import { fieldColumns, primaryIdOf, type FieldColumn } from '../grid-access'
  import { orderKeepingScreen } from '../column-order'
  import FieldIcon from './FieldIcon.svelte'

  let { ctrl, api }: { ctrl: any; api: any } = $props()

  let query = $state('')
  const primary = $derived(primaryIdOf(ctrl))
  const columns = $derived(fieldColumns(ctrl))
  const shown = $derived(columns.filter((c) => !query.trim() || c.header.toLowerCase().includes(query.trim().toLowerCase())))

  function setVisible(c: FieldColumn, visible: boolean) {
    if (c.id === primary && !visible) return
    api.setColumnVisible(c.id, visible)
  }
  function setAll(visible: boolean) {
    for (const c of columns) if (c.id !== primary) api.setColumnVisible(c.id, visible)
  }

  // Drag to reorder: the new order is the list's, with columns not in it kept in their slots.
  let dragId = $state<string | null>(null)
  let overId = $state<string | null>(null)
  function drop(targetId: string) {
    const from = dragId
    dragId = overId = null
    if (!from || from === targetId || from === primary || targetId === primary) return
    const ids = columns.map((c) => c.id)
    const without = ids.filter((id) => id !== from)
    without.splice(without.indexOf(targetId) + (ids.indexOf(from) < ids.indexOf(targetId) ? 1 : 0), 0, from)
    const all: string[] = ctrl.grid.getAllColumns().map((c: { id: string }) => c.id)
    const user: string[] = ctrl.userColumnOrder ?? []
    const base = user.length ? [...user, ...all.filter((id) => !user.includes(id))] : all
    ctrl.setColumnOrderInternal(orderKeepingScreen(base, without))
  }
</script>

<div class="sv-fvb-panel sv-fhide" use:panelFocus>
  <input class="sv-fvb-input" type="search" placeholder="Find a field" aria-label="Find a field" bind:value={query} />
  <ul class="sv-fhide-list" role="list">
    {#each shown as c (c.id)}
      <li
        class="sv-fhide-item"
        class:is-over={overId === c.id && dragId !== c.id}
        draggable={c.id !== primary && !query}
        ondragstart={(e) => {
          dragId = c.id
          e.dataTransfer?.setData('text/plain', c.id)
        }}
        ondragover={(e) => {
          if (!dragId) return
          e.preventDefault()
          overId = c.id
        }}
        ondragleave={() => {
          if (overId === c.id) overId = null
        }}
        ondrop={(e) => {
          e.preventDefault()
          drop(c.id)
        }}
        ondragend={() => (dragId = overId = null)}
      >
        <label class="sv-fhide-row" title={c.id === primary ? 'The primary field is always shown' : undefined}>
          <input
            type="checkbox"
            role="switch"
            class="sv-fvb-switch"
            checked={c.visible}
            disabled={c.id === primary}
            onchange={(e) => setVisible(c, (e.currentTarget as HTMLInputElement).checked)}
          />
          <FieldIcon column={c} />
          <span class="sv-fhide-name">{c.header}</span>
        </label>
        {#if c.id !== primary && !query}
          <span class="sv-fhide-grip" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
          </span>
        {/if}
      </li>
    {/each}
  </ul>
  <div class="sv-fvb-foot">
    <button type="button" class="sv-fvb-text-btn" onclick={() => setAll(false)}>Hide all</button>
    <button type="button" class="sv-fvb-text-btn" onclick={() => setAll(true)}>Show all</button>
  </div>
</div>

<style>
  .sv-fhide { width: 300px; }
  .sv-fhide-list { list-style: none; margin: 8px 0; padding: 0; max-height: 320px; overflow: auto; }
  .sv-fhide-item { display: flex; align-items: center; gap: 4px; border-radius: 6px; padding: 0 4px; }
  .sv-fhide-item:hover { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fhide-item.is-over { box-shadow: inset 0 2px 0 var(--sg-accent, #2563eb); }
  .sv-fhide-row { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; padding: 5px 0; cursor: pointer; }
  .sv-fhide-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-fhide-grip { color: var(--sg-muted, #64748b); cursor: grab; display: inline-flex; }
</style>
