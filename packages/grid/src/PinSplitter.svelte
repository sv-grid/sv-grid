<script lang="ts">
  /**
   * `pinSplitter`: a divider at the edge of the left-pinned columns. Dragging
   * it right pins the columns it passes, dragging it left unpins them; it
   * snaps to column edges. The arrow keys move it one column at a time. The
   * grid loads it only when the prop is on.
   */
  import { orderKeepingScreen, pinCountAt, pinEdges } from './pin-splitter'
  import { getGridExtension } from './grid-extension.svelte'

  let { ctrl }: { ctrl: any } = $props()

  // Room left for the columns that scroll, so the grid never pins itself shut.
  const SCROLL_ROOM = 120

  const right = $derived(new Set<string>(ctrl.effectivePinning.right))
  /** Shown columns in screen order, without the right-pinned ones. */
  const cols = $derived((ctrl.allColumns as Array<{ id: string }>).filter((c) => !right.has(c.id)))
  const pinned = $derived(new Set<string>(ctrl.effectivePinning.left))
  const count = $derived(cols.filter((c) => pinned.has(c.id)).length)
  const edges = $derived(pinEdges(ctrl.systemColumnsWidth ?? 0, cols.map((c) => ctrl.getColumnWidth(c.id) as number)))
  const edge = $derived(edges[count] ?? 0)
  const bottom = $derived(ctrl.hasHorizontalOverflow ? 16 : 0)
  // Leading columns an extension locks (a table's primary field) stay pinned.
  const minCount = $derived.by(() => {
    const locked = getGridExtension()?.lockColumn
    let n = 0
    if (locked) {
      for (const c of cols) {
        if (!pinned.has(c.id) || !locked(ctrl, c.id)) break
        n += 1
      }
    }
    return n
  })
  const messages = $derived(ctrl.messages)

  /** While dragging: the pointer's x in the grid and the count it snaps to. */
  let drag = $state<{ x: number; count: number } | null>(null)

  function limit(): number {
    const box = ctrl.scrollContainer as HTMLElement | null
    // Not laid out (no width yet): no limit.
    if (!box?.clientWidth) return Infinity
    let rightWidth = 0
    for (const id of right) rightWidth += ctrl.getColumnWidth(id) ?? 0
    return box.clientWidth - rightWidth - SCROLL_ROOM
  }

  function xIn(e: PointerEvent): number {
    const box = ctrl.scrollContainer as HTMLElement | null
    return box ? e.clientX - box.getBoundingClientRect().left : e.clientX
  }

  function apply(next: number) {
    if (next === count) return
    const ids = cols.map((c) => c.id)
    const shown = new Set(ids)
    // A pinned column that is hidden stays pinned.
    const left = [...(ctrl.columnPinning.left as string[]).filter((id) => !shown.has(id)), ...ids.slice(0, next)]
    // The order becomes what is on screen, so the columns that change sides
    // stay where they were drawn.
    const all: string[] = ctrl.grid.getAllColumns().map((c: { id: string }) => c.id)
    const user: string[] = ctrl.userColumnOrder ?? []
    const base = user.length ? [...user, ...all.filter((id) => !user.includes(id))] : all
    const order = orderKeepingScreen(base, (ctrl.allColumns as Array<{ id: string }>).map((c) => c.id))
    if (order.some((id, i) => id !== base[i])) ctrl.setColumnOrderInternal(order)
    ctrl.columnPinning = { left, right: [...ctrl.columnPinning.right] }
  }

  function ondown(e: PointerEvent) {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    // Edges are measured from the start of the columns, so show them there.
    const box = ctrl.scrollContainer as HTMLElement | null
    if (box) box.scrollLeft = 0
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag = { x: edge, count }
  }

  // Escape drops a drag; the divider is not focused by the mouse, so listen on the window.
  $effect(() => {
    if (!drag) return
    const onkey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      drag = null
    }
    window.addEventListener('keydown', onkey, true)
    return () => window.removeEventListener('keydown', onkey, true)
  })

  function onmove(e: PointerEvent) {
    if (!drag) return
    const x = xIn(e)
    drag = { x, count: Math.max(minCount, pinCountAt(edges, x, cols.length - 1, limit())) }
  }

  function onup() {
    if (!drag) return
    const next = drag.count
    drag = null
    apply(next)
  }

  function onkeydown(e: KeyboardEvent) {
    let next = count
    if (e.key === 'ArrowRight') next = count + 1
    else if (e.key === 'ArrowLeft') next = count - 1
    else if (e.key === 'Home') next = minCount
    else return
    e.preventDefault()
    e.stopPropagation()
    if (next < minCount || next > cols.length - 1) return
    if (next > count && (edges[next] ?? Infinity) > limit()) return
    apply(next)
  }

  const shownCount = $derived(drag ? drag.count : count)
  const lineX = $derived(drag ? (edges[drag.count] ?? edge) : edge)
  const label = $derived(
    shownCount === 0
      ? messages.pinSplitterNone
      : shownCount === 1
        ? messages.pinSplitterOne
        : messages.pinSplitterMany.replace('{count}', String(shownCount)),
  )
</script>

{#if !ctrl.isNarrowResponsive && cols.length > 1}
  <div class="sv-pin-split" class:is-dragging={!!drag} class:is-editing={!!ctrl.editingCell} style:--x={`${lineX}px`} style:bottom={`${bottom}px`}>
    {#if drag}
      <div class="sv-pin-split-ghost" style:left={`${drag.x}px`} aria-hidden="true"></div>
      <div class="sv-pin-split-tip" aria-hidden="true">{label}</div>
    {/if}
    <div class="sv-pin-split-line" aria-hidden="true"></div>
    <div
      class="sv-pin-split-hit"
      style:top={`${ctrl.headerHeight ?? 0}px`}
      role="separator"
      aria-orientation="vertical"
      aria-label={messages.pinSplitterLabel}
      aria-valuemin={minCount}
      aria-valuemax={cols.length - 1}
      aria-valuenow={shownCount}
      aria-valuetext={label}
      title={messages.pinSplitterHint}
      tabindex="0"
      onpointerdown={ondown}
      onpointermove={onmove}
      onpointerup={onup}
      onpointercancel={() => (drag = null)}
      onlostpointercapture={onup}
      {onkeydown}
    ></div>
  </div>
{/if}

<style>
  /* Above the sticky header and pinned cells (up to 42), under the scrollbars (900). */
  .sv-pin-split { position: absolute; top: 0; left: 0; width: 0; z-index: 50; pointer-events: none; }
  /* An open editor's panel can cross the line. */
  .sv-pin-split.is-editing { display: none; }
  .sv-pin-split-line {
    position: absolute; top: 0; bottom: 0; left: calc(var(--x) - 1px); width: 2px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 18%, transparent); transition: background-color 0.12s;
  }
  .sv-pin-split-hit {
    position: absolute; bottom: 0; left: max(0px, calc(var(--x) - 4px)); width: 8px;
    cursor: col-resize; pointer-events: auto; outline: none; touch-action: none;
  }
  .sv-pin-split:has(.sv-pin-split-hit:hover) .sv-pin-split-line,
  .sv-pin-split:has(.sv-pin-split-hit:focus-visible) .sv-pin-split-line,
  .sv-pin-split.is-dragging .sv-pin-split-line { background: var(--sg-accent, #2563eb); }
  .sv-pin-split.is-dragging .sv-pin-split-line { width: 3px; left: calc(var(--x) - 1.5px); }
  /* The pointer's own line while the divider snaps between column edges. */
  .sv-pin-split-ghost {
    position: absolute; top: 0; bottom: 0; width: 0;
    border-left: 2px dashed color-mix(in srgb, var(--sg-accent, #2563eb) 50%, transparent);
  }
  .sv-pin-split-tip {
    position: absolute; top: 6px; left: calc(var(--x) + 8px); padding: 3px 8px; border-radius: 6px;
    background: var(--sg-fg, #0f172a); color: var(--sg-bg, #fff); font-size: 12px; white-space: nowrap;
  }
</style>
