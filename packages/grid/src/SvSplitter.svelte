<script lang="ts" module>
  export type { SplitterOrientation } from './createSplitter.svelte'
</script>

<script lang="ts">
  /**
   * SvSplitter - two resizable panes with a draggable separator (WAI-ARIA
   * `separator`), pointer drag + keyboard resize. Parity: Smart `smart-splitter`.
   * Controlled via `fraction` (0..1 of the first pane) + `onChange`; the two panes
   * are the `start` and `end` snippets.
   *
   * Behavior (clamp, keyboard, ARIA, RTL) lives in the headless `createSplitter`
   * core; this component owns only the container measurement for pointer drags.
   */
  import type { Snippet } from 'svelte'
  import { type EditorDir } from './editor-contract'
  import { createSplitter, type SplitterOrientation } from './createSplitter.svelte'

  type Props = {
    /** Size of the first pane as a fraction of the container (0..1). */
    fraction?: number
    onChange?: (fraction: number) => void
    /** 'horizontal' = left/right panes (default); 'vertical' = top/bottom. */
    orientation?: SplitterOrientation
    min?: number
    max?: number
    /** Keyboard resize step as a fraction (default 0.02 = 2%). */
    step?: number
    disabled?: boolean
    dir?: EditorDir
    ariaLabel?: string
    start?: Snippet
    end?: Snippet
  }

  let {
    fraction = $bindable(0.5),
    onChange,
    orientation = 'horizontal',
    min = 0.1,
    max = 0.9,
    step = 0.02,
    disabled = false,
    dir,
    ariaLabel,
    start,
    end,
  }: Props = $props()

  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)

  const sp = createSplitter({
    fraction: () => fraction,
    onChange: (f) => { fraction = f; onChange?.(f) },
    orientation: () => orientation,
    min: () => min,
    max: () => max,
    step: () => step,
    disabled: () => disabled,
    dir: () => dir,
    ariaLabel: () => ariaLabel,
  })

  // The container rect is measured here (a DOM concern) and passed INTO the core.
  let rootEl: HTMLDivElement | null = null
  let sepEl: HTMLDivElement | null = null

  function onSepDown(e: PointerEvent) {
    if (disabled) return
    sp.pointerDown()
    sepEl?.setPointerCapture(e.pointerId)
  }
  function onMove(e: PointerEvent) {
    if (!sp.dragging || !rootEl) return
    sp.setFromPointer({ x: e.clientX, y: e.clientY }, rootEl.getBoundingClientRect())
  }
  function onUp(e: PointerEvent) {
    if (!sp.dragging) return
    sp.endDrag()
    sepEl?.releasePointerCapture(e.pointerId)
  }
</script>

<div
  bind:this={rootEl}
  class="sv-split sv-split--{orientation}"
  class:is-disabled={disabled}
  class:is-dragging={sp.dragging}
  dir={resolvedDir}
>
  <div class="sv-split__pane" style:flex-basis={`${sp.percent}%`}>
    {#if start}{@render start()}{/if}
  </div>
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    bind:this={sepEl}
    class="sv-split__sep"
    {...sp.separatorProps()}
    onpointerdown={onSepDown}
    onpointermove={onMove}
    onpointerup={onUp}
    onpointercancel={onUp}
  ><span class="sv-split__grip" aria-hidden="true"></span></div>
  <div class="sv-split__pane sv-split__pane--end">
    {#if end}{@render end()}{/if}
  </div>
</div>

<style>
  .sv-split {
    --_accent: var(--sg-accent, #2563eb);
    --_border: var(--sg-border, #e2e8f0);
    display: flex; width: 100%; height: 100%; min-height: 0; overflow: hidden;
  }
  .sv-split--vertical { flex-direction: column; }
  .sv-split.is-disabled { opacity: 0.7; }
  .sv-split__pane { flex-grow: 0; flex-shrink: 0; min-width: 0; min-height: 0; overflow: auto; }
  .sv-split__pane--end { flex: 1 1 0; }
  /* The gutter is a solid divider-toned bar (--sg-border is the one token that
     reliably contrasts against panes in BOTH light and dark themes - it draws the
     visible card outline too). It turns accent on hover / drag. */
  .sv-split__sep {
    flex: 0 0 auto; position: relative; background: var(--sg-border, #cbd5e1);
    display: grid; place-items: center; touch-action: none; transition: background 0.12s;
  }
  /* Orientation rules MUST target the splitter's OWN separator only (direct
     child). With a descendant combinator a nested splitter of the opposite
     orientation inherits the wrong sizing - e.g. a vertical split inside a
     horizontal one would get width:8px and collapse its horizontal bar. */
  .sv-split--horizontal > .sv-split__sep { width: 8px; min-width: 8px; cursor: col-resize; }
  .sv-split--vertical > .sv-split__sep { height: 8px; min-height: 8px; cursor: row-resize; }
  .sv-split__sep:hover, .sv-split.is-dragging > .sv-split__sep { background: var(--_accent); }
  .sv-split__sep:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 1px; z-index: 1; }
  /* Grip dots: the pane background color, so they read as notches cut into the bar. */
  .sv-split__grip { background: var(--sg-bg, #fff); border-radius: 3px; opacity: 0.9; transition: background 0.12s; }
  .sv-split--horizontal > .sv-split__sep > .sv-split__grip { width: 2px; height: 24px; }
  .sv-split--vertical > .sv-split__sep > .sv-split__grip { width: 24px; height: 2px; }
</style>
