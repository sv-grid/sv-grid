<script lang="ts">
  /**
   * The tables of a base as tabs: click one to show it, double-click to
   * rename it, and the active tab's menu renames, duplicates or deletes it.
   * "+ Add table" makes a new one. Deleting asks first and says which link
   * fields of other tables go with it, and the lookups, rollups and counts
   * that read them.
   */
  import { tick } from 'svelte'
  import { SvModal, SvPopover } from '@svgrid/grid'
  import { linkReaders, type BaseTable } from './base-tables'

  let {
    tables,
    activeId,
    onSwitch,
    onAdd,
    onRename,
    onDuplicate,
    onDelete,
    onExportSql,
    status = null,
  }: {
    tables: ReadonlyArray<BaseTable>
    activeId: string
    onSwitch: (id: string) => void
    onAdd: () => void
    onRename: (id: string, name: string) => void
    onDuplicate: (id: string) => void
    onDelete: (id: string) => void
    /** Download the base as Postgres SQL (from the list of tables). */
    onExportSql?: () => void
    /** A line at the end of the bar: loading, saving, a failed save. */
    status?: { text: string; tone?: 'muted' | 'error'; title?: string } | null
  } = $props()

  let menuOpen = $state(false)
  let listOpen = $state(false)
  let renaming = $state<string | null>(null)
  let draft = $state('')
  let deleting = $state<BaseTable | null>(null)
  let confirmOpen = $state(false)
  let strip = $state<HTMLElement | null>(null)

  const active = $derived(tables.find((t) => t.id === activeId))

  /**
   * The fields of other tables that link to `t`, as "Deals: Account", each
   * followed by the fields that read it, as "Deals: Industry (reads Account)".
   */
  function linksTo(t: BaseTable): string[] {
    const out: string[] = []
    for (const o of tables) {
      if (o.id === t.id) continue
      for (const d of o.columns) {
        if (d.fieldType !== 'link' || d.fieldProps?.table !== t.id) continue
        const name = String(d.header ?? d.field)
        out.push(`${o.name}: ${name}`)
        for (const r of linkReaders(o, d)) out.push(`${o.name}: ${String(r.header ?? r.field)} (reads ${name})`)
      }
    }
    return out
  }

  async function startRename(id: string) {
    menuOpen = false
    renaming = id
    draft = tables.find((t) => t.id === id)?.name ?? ''
    await tick()
    const input = strip?.querySelector<HTMLInputElement>('.sv-btabs-input')
    input?.focus()
    input?.select()
  }
  function commitRename() {
    const id = renaming
    renaming = null
    const name = draft.trim()
    if (id && name && name !== tables.find((t) => t.id === id)?.name) onRename(id, name)
  }
  function renameKey(e: KeyboardEvent) {
    if (e.key === 'Enter') commitRename()
    else if (e.key === 'Escape') renaming = null
  }

  function askDelete() {
    menuOpen = false
    deleting = active ?? null
    confirmOpen = !!deleting
  }
  function confirmDelete() {
    const t = deleting
    confirmOpen = false
    deleting = null
    if (t) onDelete(t.id)
  }

  /** Arrow keys walk the tabs, Home and End jump, as a tab list does. */
  function tabKey(e: KeyboardEvent, i: number) {
    let to = -1
    if (e.key === 'ArrowRight') to = (i + 1) % tables.length
    else if (e.key === 'ArrowLeft') to = (i - 1 + tables.length) % tables.length
    else if (e.key === 'Home') to = 0
    else if (e.key === 'End') to = tables.length - 1
    else if (e.key === 'F2') {
      e.preventDefault()
      void startRename(tables[i]!.id)
      return
    }
    if (to < 0) return
    e.preventDefault()
    onSwitch(tables[to]!.id)
    void tick().then(() => strip?.querySelectorAll<HTMLElement>('[role="tab"]')[to]?.focus())
  }
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value
</script>

<div class="sv-btabs" bind:this={strip}>
  <div class="sv-btabs-list" role="tablist" aria-label="Tables">
    {#each tables as t, i (t.id)}
      {@const on = t.id === activeId}
      <div class="sv-btabs-tab" class:is-active={on}>
        {#if renaming === t.id}
          <input
            class="sv-btabs-input"
            aria-label="Table name"
            value={draft}
            oninput={(e) => (draft = inputValue(e))}
            onkeydown={renameKey}
            onblur={commitRename}
          />
        {:else}
          <button
            type="button"
            role="tab"
            class="sv-btabs-name"
            aria-selected={on}
            tabindex={on ? 0 : -1}
            title={t.name}
            onclick={() => onSwitch(t.id)}
            ondblclick={() => startRename(t.id)}
            onkeydown={(e) => tabKey(e, i)}>{t.name}</button
          >
          {#if on}
            <SvPopover bind:open={menuOpen} arrow={false} placement="bottom-start" ariaLabel="Table actions">
              {#snippet anchor()}
                <button type="button" class="sv-btabs-more" aria-label={`${t.name} table options`} aria-haspopup="menu" aria-expanded={menuOpen}>
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
                </button>
              {/snippet}
              <div class="sv-btabs-menu" role="menu">
                <button type="button" role="menuitem" class="sv-btabs-item" onclick={() => startRename(t.id)}>Rename table</button>
                <button type="button" role="menuitem" class="sv-btabs-item" onclick={() => { menuOpen = false; onDuplicate(t.id) }}>Duplicate table</button>
                <button type="button" role="menuitem" class="sv-btabs-item is-danger" disabled={tables.length < 2} title={tables.length < 2 ? 'A base keeps at least one table' : undefined} onclick={askDelete}>Delete table</button>
              </div>
            </SvPopover>
          {/if}
        {/if}
      </div>
    {/each}
  </div>
  <div class="sv-btabs-tools">
    <!-- Every table in a list: the way to one whose tab has scrolled out of sight. -->
    <SvPopover bind:open={listOpen} arrow={false} placement="bottom-start" ariaLabel="All tables">
      {#snippet anchor()}
        <button type="button" class="sv-btabs-tool sv-btabs-icon" aria-label="All tables" title="All tables" aria-haspopup="menu" aria-expanded={listOpen}>
          <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
        </button>
      {/snippet}
      <div class="sv-btabs-menu" role="menu">
        {#each tables as t (t.id)}
          <button type="button" role="menuitem" class="sv-btabs-item" class:is-current={t.id === activeId} onclick={() => { listOpen = false; onSwitch(t.id) }}>
            <span class="sv-btabs-check" aria-hidden="true">{t.id === activeId ? '✓' : ''}</span>{t.name}
          </button>
        {/each}
        {#if onExportSql}
          <div class="sv-btabs-sep" role="separator"></div>
          <button type="button" role="menuitem" class="sv-btabs-item" title="The tables, links, records, views and automations, ready for Postgres or Supabase" onclick={() => { listOpen = false; onExportSql() }}>
            <span class="sv-btabs-check" aria-hidden="true"></span>Download as SQL
          </button>
        {/if}
      </div>
    </SvPopover>
    <button type="button" class="sv-btabs-tool sv-btabs-add" onclick={onAdd}>
      <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
      <span>Add table</span>
    </button>
  </div>
  {#if status}
    <span class="sv-btabs-status" class:is-error={status.tone === 'error'} role="status" title={status.title ?? status.text}>{status.text}</span>
  {/if}
</div>

{#if deleting}
  {@const links = linksTo(deleting)}
  <SvModal bind:open={confirmOpen} title={`Delete ${deleting.name}?`} width={440} onClose={() => (deleting = null)}>
    <p class="sv-btabs-warn">
      Its {deleting.data.length} {deleting.data.length === 1 ? 'record goes' : 'records go'} with it, and so do its views.
    </p>
    {#if links.length}
      <p class="sv-btabs-warn">These fields of other tables link to it, or read a link to it, and are deleted too:</p>
      <ul class="sv-btabs-links">
        {#each links as l (l)}<li>{l}</li>{/each}
      </ul>
    {/if}
    {#snippet footer()}
      <div class="sv-btabs-foot">
        <button type="button" class="sv-btabs-btn" onclick={() => { confirmOpen = false; deleting = null }}>Cancel</button>
        <button type="button" class="sv-btabs-btn is-danger" onclick={confirmDelete}>Delete table</button>
      </div>
    {/snippet}
  </SvModal>
{/if}

<style>
  /* The table bar, from the theme's own tokens. The tables sit on a band of
     the theme's muted surface, closed by a hairline. The other tables are
     muted text divided by hairlines. The shown table is a tab of the
     toolbar's surface, outlined like the grid, open at the bottom: it covers
     the band's hairline and runs into the toolbar below. The theme's accent
     marks it along the top, as the accent marks a selection everywhere. */
  .sv-btabs {
    --sv-btabs-h: 33px;
    display: flex; align-items: flex-end; gap: 2px; box-sizing: border-box;
    height: calc(var(--sv-btabs-h) + 7px); padding: 0 6px 0 0;
    font-family: var(--sg-font, inherit); font-size: 13px; line-height: 1;
    background: var(--sg-muted-bg, var(--sg-header-bg, #f5f5f4));
    box-shadow: inset 0 -1px 0 var(--sg-border, #e7e5e4);
  }
  .sv-btabs-list { display: flex; align-items: flex-end; min-width: 0; height: 100%; padding: 0 0 0 8px; overflow-x: auto; scrollbar-width: none; }
  .sv-btabs-list::-webkit-scrollbar { display: none; }
  .sv-btabs-tab {
    position: relative; flex: none; display: flex; align-items: center; gap: 2px; box-sizing: border-box;
    height: var(--sv-btabs-h); padding: 0 6px 1px 4px;
    border: 1px solid transparent; border-bottom: 0; border-radius: var(--sg-radius, 6px) var(--sg-radius, 6px) 0 0;
    color: var(--sg-muted, #78716c);
    transition: color 120ms ease, background-color 120ms ease;
  }
  /* A hairline between two tables, unless one of them is the shown one. */
  .sv-btabs-tab:not(.is-active) + .sv-btabs-tab:not(.is-active)::before {
    content: ''; position: absolute; left: -2px; top: 10px; bottom: 10px; width: 1px;
    background: var(--sg-border, #e7e5e4);
  }
  /* No hairline beside a hovered tab: its own surface marks it. */
  .sv-btabs-tab:hover::before, .sv-btabs-tab:hover + .sv-btabs-tab::before { opacity: 0; }
  .sv-btabs-tab:not(.is-active):hover {
    color: var(--sg-fg, #1c1917);
    background: color-mix(in srgb, var(--sg-bg, #fff) 55%, transparent);
  }
  .sv-btabs-tab.is-active {
    z-index: 1; height: calc(var(--sv-btabs-h) + 1px); margin-bottom: -1px; padding-bottom: 2px;
    color: var(--sg-fg, #1c1917); background: var(--sg-bg, #fff); border-color: var(--sg-border, #e7e5e4);
    box-shadow: inset 0 2px 0 var(--sg-accent, #2563eb);
  }
  .sv-btabs-name {
    max-width: 220px; height: 26px; padding: 0 8px; border: 0; border-radius: var(--sg-radius, 6px); background: none;
    color: inherit; font: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: pointer;
  }
  .is-active .sv-btabs-name { font-weight: 600; padding-right: 2px; }
  .sv-btabs-more {
    display: grid; place-items: center; width: 22px; height: 22px; padding: 0; border: 0; border-radius: var(--sg-radius, 6px);
    background: none; color: var(--sg-muted, #78716c); cursor: pointer;
  }
  /* A tint of the text color, not a surface token: it reads on any theme, light or dark. */
  .sv-btabs-more:hover { background: color-mix(in srgb, var(--sg-fg, #1c1917) 10%, transparent); color: var(--sg-fg, #1c1917); }
  .sv-btabs-input {
    width: 160px; height: 24px; margin: 0 2px; padding: 0 6px; box-sizing: border-box; font: inherit; font-weight: 600;
    color: var(--sg-fg, #1c1917); background: var(--sg-input-bg, var(--sg-bg, #fff));
    border: 1px solid var(--sg-accent, #2563eb); border-radius: var(--sg-radius, 6px); outline: none;
  }
  .sv-btabs-tools { flex: none; display: flex; align-items: center; gap: 2px; height: var(--sv-btabs-h); margin-left: 0; }
  .sv-btabs-status {
    flex: 0 1 auto; align-self: center; min-width: 0; margin-left: auto; padding: 0 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    font-size: 12px; color: var(--sg-muted, #78716c);
  }
  .sv-btabs-status.is-error { color: var(--sg-danger, #dc2626); }
  .sv-btabs-tool {
    display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 8px; border: 0; border-radius: var(--sg-radius, 6px);
    background: none; color: var(--sg-muted, #78716c); font: inherit; cursor: pointer; white-space: nowrap;
    transition: color 120ms ease, background-color 120ms ease;
  }
  .sv-btabs-icon { width: 26px; padding: 0; justify-content: center; }
  .sv-btabs-tool:hover { color: var(--sg-fg, #1c1917); background: color-mix(in srgb, var(--sg-bg, #fff) 55%, transparent); }
  .sv-btabs-name:focus-visible, .sv-btabs-more:focus-visible, .sv-btabs-tool:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--sg-accent, #2563eb)); outline-offset: -2px;
  }
  @media (prefers-reduced-motion: reduce) {
    .sv-btabs-tab, .sv-btabs-tool { transition: none; }
  }
  .sv-btabs-menu { display: flex; flex-direction: column; min-width: 190px; max-height: 320px; overflow-y: auto; padding: 4px; font-size: 13px; }
  .sv-btabs-sep { height: 1px; margin: 4px 6px; background: var(--sg-border, #e2e8f0); }
  .sv-btabs-item {
    display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 10px; text-align: start; border: 0; border-radius: 6px;
    background: none; color: var(--sg-fg, #0f172a); font: inherit; cursor: pointer;
  }
  .sv-btabs-item:hover:not(:disabled), .sv-btabs-item:focus-visible { background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); outline: none; }
  .sv-btabs-item:disabled { color: var(--sg-muted, #64748b); cursor: default; }
  .sv-btabs-item.is-danger:not(:disabled) { color: var(--sg-danger, #dc2626); }
  .sv-btabs-item.is-current { font-weight: 600; }
  .sv-btabs-check { width: 14px; flex: none; color: var(--sg-muted, #64748b); }
  .sv-btabs-warn { margin: 0 0 8px; font-size: 14px; color: var(--sg-fg, #0f172a); }
  .sv-btabs-links { margin: 0 0 4px; padding-left: 18px; font-size: 13px; color: var(--sg-muted, #64748b); }
  .sv-btabs-foot { display: flex; justify-content: flex-end; gap: 8px; width: 100%; }
  .sv-btabs-btn {
    height: 32px; padding: 0 14px; font: inherit; font-size: 13px; cursor: pointer; border-radius: var(--sg-radius, 6px);
    background: transparent; color: var(--sg-fg, #0f172a); border: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-btabs-btn.is-danger { background: var(--sg-danger, #dc2626); border-color: var(--sg-danger, #dc2626); color: #fff; }
</style>
