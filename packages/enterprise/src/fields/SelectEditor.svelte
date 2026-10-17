<script lang="ts">
  /**
   * The select and user fields' editor (registered as 'fieldSelect'): the
   * cell grows into a panel over itself, with the chosen items on top (each
   * with a remove button), a search box, and the items drawn as the cells
   * draw them: options as colored pills, people as avatar and name.
   *
   * Typing filters the options; one that does not exist yet is offered as
   * "Add option", which adds it to the field (onColumnChange) and picks it
   * (not for people: they come from setFieldUsers; not with `addOptions`
   * false, as in a form, where only the field's options can be picked).
   * Up / Down move, Enter picks. A single select commits on the pick; a
   * multiple select keeps the dropdown open, Backspace in the empty search box
   * removes the last pill, and Enter on nothing, Escape, Tab or a click
   * outside keep what is chosen. Escape on a single select leaves the cell as
   * it was.
   */
  import { createDismissableLayer, portalToBody } from '@svgrid/grid'
  import { onMount } from 'svelte'
  import { fieldPropsOf } from './registry.svelte'
  import { addSelectOptions } from './field-ops'
  import { OPTION_CYCLE, textOn } from './palette'
  import { getFieldUsers, type FieldUser } from './sources.svelte'
  import UserFace from './UserFace.svelte'

  type Option = { value: string; label?: string; color?: string; user?: FieldUser }
  let {
    value,
    typed = false,
    row,
    columnDef,
    columnId,
    grid,
    onChange,
    onCommit,
    onCancel,
    onCommitAndMove,
    addOptions = true,
  }: {
    value: unknown
    typed?: boolean
    row?: unknown
    columnDef?: Record<string, unknown>
    columnId: string
    grid?: unknown
    onChange?: (v: unknown) => void
    onCommit: (v?: unknown) => void
    onCancel: () => void
    onCommitAndMove?: (v: unknown, direction: 1 | -1) => void
    /** False: no "Add option", only the field's own options (a form). */
    addOptions?: boolean
  } = $props()

  const def = $derived((columnDef ?? {}) as { fieldType?: unknown; fieldProps?: Record<string, unknown> })
  // A user field picks people: from setFieldUsers, one or (with `multiple`) several.
  const isUser = $derived(def.fieldType === 'user')
  const multiple = $derived(isUser ? !!fieldPropsOf(def).multiple : def.fieldType === 'multiSelect')
  // svelte-ignore state_referenced_locally
  const declared: Option[] =
    def.fieldType === 'user'
      ? getFieldUsers().map((u) => ({ value: u.id, label: u.name, user: u }))
      : ((fieldPropsOf(def).options as Array<{ value: unknown; label?: string; color?: string }> | undefined) ?? []).map(
          (o): Option => ({ value: String(o.value), ...(o.label ? { label: o.label } : {}), ...(o.color ? { color: o.color } : {}) }),
        )
  // New options show here at once; they reach the field when the edit ends.
  let added = $state<Option[]>([])
  const options = $derived([...declared, ...added])
  // Typed on the cell: the text searches the options, and the choices
  // already made are the row's.
  // svelte-ignore state_referenced_locally
  const start = typed ? (row as Record<string, unknown> | undefined)?.[String(columnDef?.field ?? '')] : value
  // svelte-ignore state_referenced_locally
  let picked = $state<string[]>((Array.isArray(start) ? start : start == null || start === '' ? [] : [start]).map(String))
  // svelte-ignore state_referenced_locally
  let search = $state(typed ? String(value ?? '') : '')
  let active = $state(0)
  let finished = false

  const labelOf = (o: Option) => o.label ?? o.value
  const byValue = $derived(new Map(options.map((o) => [o.value, o])))
  const shown = $derived.by(() => {
    const q = search.trim().toLowerCase()
    return options.filter((o) => (!multiple || !picked.includes(o.value)) && (!q || labelOf(o).toLowerCase().includes(q)))
  })
  const newValue = $derived.by(() => {
    const t = search.trim()
    return t && addOptions && !isUser && !options.some((o) => labelOf(o).toLowerCase() === t.toLowerCase() || o.value.toLowerCase() === t.toLowerCase()) ? t : null
  })
  const count = $derived(shown.length + (newValue ? 1 : 0))
  $effect(() => {
    if (active >= count) active = Math.max(0, count - 1)
  })

  // ---- the panel: the cell grown in place, over the cell and down from it;
  // in the body, so the cell cannot clip it
  let anchor = $state<HTMLElement | null>(null)
  let input = $state<HTMLInputElement | null>(null)
  let list = $state<HTMLElement | null>(null)
  let panel = $state<HTMLElement | null>(null)
  let rect = $state<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  const PANEL_HEIGHT = 340
  function place() {
    const cell = anchor?.closest('td') ?? anchor
    if (!cell) return
    const r = cell.getBoundingClientRect()
    const width = Math.min(Math.max(r.width + 2, 260), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left - 1, window.innerWidth - width - 8))
    // Near the bottom of the window the panel moves up rather than shrink.
    const top = Math.max(8, Math.min(r.top - 1, window.innerHeight - PANEL_HEIGHT - 8))
    rect = { top, left, width, maxHeight: window.innerHeight - top - 8 }
  }
  onMount(() => {
    // A single select opens on its current choice.
    if (!multiple && picked.length) active = Math.max(0, shown.findIndex((o) => o.value === picked[0]))
    place()
    // The search box (caret after any typed text); once more on the next
    // frame, as the double-click that opened the editor can take focus back.
    const takeFocus = () => {
      if (!input || document.activeElement === input) return
      input.focus({ preventScroll: true })
      input.setSelectionRange(search.length, search.length)
    }
    queueMicrotask(takeFocus)
    const frame = requestAnimationFrame(takeFocus)
    const onScroll = (e: Event) => {
      if (!panel?.contains(e.target as Node)) place()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (panel?.contains(t) || anchor?.contains(t)) return
      keep()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('pointerdown', onDown, true)
    // The panel is drawn at the end of the page, outside any dialog the editor
    // sits in (the record view). As the top layer it keeps that dialog from
    // reading a click on an option as a click outside and closing: the editor
    // handles outside clicks and Escape itself.
    const layer = createDismissableLayer({ element: () => [panel ?? null, anchor ?? null], onDismiss: () => {}, closeOnEscape: false, closeOnOutside: false })
    layer.activate()
    return () => {
      layer.release()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  })

  // ---- picking
  const current = (): unknown => (multiple ? [...picked] : (picked[0] ?? null))
  function finish(how: 'commit' | 'cancel' | 'next' | 'prev') {
    if (finished) return
    finished = true
    if (how === 'cancel') return onCancel()
    // Read everything first: committing ends the edit and unmounts this
    // editor, and its props are gone after that.
    const v = current()
    const g = grid
    const id = columnId
    const used = added.filter((o) => picked.includes(o.value))
    if (how === 'commit') onCommit(v)
    else if (onCommitAndMove) onCommitAndMove(v, how === 'next' ? 1 : -1)
    else onCommit(v)
    // New options reach the field after the value, so the grid is not
    // refilling the column while the edit is still open.
    if (used.length && g) addSelectOptions(g as never, id, used)
  }
  const keep = () => finish('commit')
  function choose(i: number) {
    let v: string
    if (i < shown.length) v = shown[i]!.value
    else if (newValue) {
      v = newValue
      added = [...added, { value: v, color: OPTION_CYCLE[options.length % OPTION_CYCLE.length] }]
    } else return
    search = ''
    if (!multiple) {
      picked = [v]
      return keep()
    }
    picked = [...picked, v]
    onChange?.(current())
    active = 0
  }
  function remove(v: string) {
    picked = picked.filter((x) => x !== v)
    onChange?.(current())
    input?.focus()
  }
  function move(by: number) {
    if (!count) return
    active = (active + by + count) % count
    queueMicrotask(() => list?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }))
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') move(1)
    else if (e.key === 'ArrowUp') move(-1)
    else if (e.key === 'Enter') count ? choose(active) : keep()
    else if (e.key === 'Escape') multiple ? keep() : finish('cancel')
    else if (e.key === 'Tab') finish(e.shiftKey ? 'prev' : 'next')
    else if (e.key === 'Backspace' && !search && multiple && picked.length) remove(picked[picked.length - 1]!)
    else {
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value
  const listId = `sv-fse-${Math.random().toString(36).slice(2, 8)}`
</script>

<!-- One chosen or offered item, drawn as its cell draws it. -->
{#snippet item(v: string, removable: boolean)}
  {@const o = byValue.get(v)}
  {@const label = o ? labelOf(o) : v}
  {#if isUser}
    <span class="sv-fse-user" class:is-chip={removable}>
      <UserFace user={o?.user ?? { id: v, name: v }} />
      <span class="sv-fse-user-name">{label}</span>
      {#if removable}{@render removeButton(v, label)}{/if}
    </span>
  {:else}
    <span class="sv-fse-pill" class:is-plain={!o?.color} style:background={o?.color} style:color={o?.color ? textOn(o.color) : undefined}>
      {label}
      {#if removable}{@render removeButton(v, label)}{/if}
    </span>
  {/if}
{/snippet}
{#snippet removeButton(v: string, label: string)}
  <button type="button" class="sv-fse-x" aria-label={`Remove ${label}`} onmousedown={(e) => e.preventDefault()} onclick={() => remove(v)}>
    <svg viewBox="0 0 24 24" width="10" height="10" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
  </button>
{/snippet}

<span class="sv-fse-cell" bind:this={anchor}>
  {#each picked as v (v)}
    {@render item(v, false)}
  {/each}
</span>

{#if rect}
  <div
    class="sv-fse-panel"
    bind:this={panel}
    use:portalToBody
    style:top={`${rect.top}px`}
    style:left={`${rect.left}px`}
    style:width={`${rect.width}px`}
    style:max-height={`${rect.maxHeight}px`}
  >
    {#if picked.length}
      <div class="sv-fse-chosen">
        {#each picked as v (v)}
          {@render item(v, true)}
        {/each}
      </div>
    {/if}
    <input
      bind:this={input}
      class="sv-fse-search"
      placeholder={isUser ? 'Find a person' : 'Find an option'}
      role="combobox"
      aria-expanded="true"
      aria-controls={listId}
      aria-activedescendant={count ? `${listId}-${active}` : undefined}
      aria-label={isUser ? (multiple ? 'Add a person' : 'Choose a person') : multiple ? 'Add an option' : 'Choose an option'}
      value={search}
      oninput={(e) => {
        search = inputValue(e)
        active = 0
      }}
      onkeydown={onKey}
    />
    <ul class="sv-fse-list" id={listId} role="listbox" bind:this={list}>
      {#each shown as o, i (o.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <li
          id={`${listId}-${i}`}
          data-i={i}
          role="option"
          aria-selected={picked.includes(o.value)}
          class="sv-fse-option"
          class:is-active={i === active}
          onpointermove={() => (active = i)}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(i)}
        >
          {@render item(o.value, false)}
          {#if !multiple && picked[0] === o.value}
            <svg class="sv-fse-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M5 12l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" /></svg>
          {/if}
        </li>
      {/each}
      {#if newValue}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_interactive_supports_focus -->
        <li
          id={`${listId}-${shown.length}`}
          data-i={shown.length}
          role="option"
          aria-selected="false"
          class="sv-fse-option sv-fse-add"
          class:is-active={active === shown.length}
          onpointermove={() => (active = shown.length)}
          onmousedown={(e) => e.preventDefault()}
          onclick={() => choose(shown.length)}
        >
          <span class="sv-fse-add-label">Add option</span>
          <span class="sv-fse-pill" style:background={OPTION_CYCLE[options.length % OPTION_CYCLE.length]} style:color={textOn(OPTION_CYCLE[options.length % OPTION_CYCLE.length])}>{newValue}</span>
        </li>
      {/if}
      {#if !count}
        <li class="sv-fse-empty">
          {#if isUser}{multiple && options.length && !search ? 'Everyone is chosen' : options.length ? 'Nobody matches' : 'No people (setFieldUsers)'}
          {:else}{multiple && options.length && !search ? 'Every option is chosen' : search && options.length ? 'No option matches' : 'No options'}{/if}
        </li>
      {/if}
    </ul>
  </div>
{/if}

<style>
  .sv-fse-cell { display: flex; align-items: center; gap: 4px; height: 100%; padding: 0 6px; box-sizing: border-box; overflow: hidden; }
  .sv-fse-chosen { display: flex; flex-wrap: wrap; gap: 4px; padding: 2px 2px 8px; }
  .sv-fse-pill {
    display: inline-flex; align-items: center; gap: 4px; max-width: 100%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
    padding: 0 8px; border-radius: 999px; font-size: 12px; line-height: 20px;
  }
  .sv-fse-pill.is-plain { background: var(--sg-header-bg, #eef0f3); color: var(--sg-fg, #0f172a); border: 1px solid var(--sg-border, #e2e8f0); line-height: 18px; }
  .sv-fse-user { display: inline-flex; align-items: center; gap: 6px; min-width: 0; max-width: 100%; font-size: 13px; }
  .sv-fse-user.is-chip { padding: 2px 6px 2px 2px; border-radius: 999px; background: var(--sg-header-bg, #eef0f3); border: 1px solid var(--sg-border, #e2e8f0); }
  .sv-fse-user-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sv-fse-x { display: inline-flex; padding: 2px; margin-inline-end: -4px; border: 0; border-radius: 999px; background: none; color: inherit; opacity: 0.7; cursor: pointer; }
  .sv-fse-x:hover { opacity: 1; background: color-mix(in srgb, currentColor 18%, transparent); }
  .sv-fse-panel {
    position: fixed; z-index: 2147483646; display: flex; flex-direction: column; box-sizing: border-box; padding: 6px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
    box-shadow: 0 8px 24px rgb(0 0 0 / 0.16); font-size: 13px;
  }
  .sv-fse-search {
    flex: none; height: 30px; padding: 0 8px; font: inherit; box-sizing: border-box; width: 100%;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-fse-search:focus { outline: none; border-color: var(--sg-accent, #2563eb); }
  .sv-fse-list { list-style: none; margin: 6px 0 0; padding: 0; overflow: auto; min-height: 0; }
  .sv-fse-option { display: flex; align-items: center; gap: 8px; min-height: 30px; padding: 0 6px; border-radius: 4px; cursor: pointer; }
  .sv-fse-option.is-active { background: var(--sg-row-hover-bg, #f1f5f9); }
  .sv-fse-check { margin-inline-start: auto; flex: none; }
  .sv-fse-add-label { flex: none; color: var(--sg-muted, #64748b); }
  .sv-fse-empty { padding: 8px 6px; color: var(--sg-muted, #64748b); }
</style>
