<script lang="ts">
  /**
   * The long text field's editor (registered as 'fieldLongText'): the cell
   * grows into a panel over itself with room for paragraphs. Enter starts a
   * new line, as in any document; Ctrl+Enter (Cmd+Enter), Tab or a click
   * outside saves, and Escape leaves the cell as it was. With rich text on,
   * the footer names the markup the cell draws.
   */
  import { createDismissableLayer, portalToBody } from '@svgrid/grid'
  import { onMount } from 'svelte'
  import { fieldPropsOf } from './registry.svelte'

  let {
    value,
    typed = false,
    columnDef,
    onCommit,
    onCancel,
    onCommitAndMove,
  }: {
    value: unknown
    typed?: boolean
    columnDef?: Record<string, unknown>
    onCommit: (v?: unknown) => void
    onCancel: () => void
    onCommitAndMove?: (v: unknown, direction: 1 | -1) => void
  } = $props()

  const rich = $derived(!!fieldPropsOf((columnDef ?? {}) as { fieldType?: unknown; fieldProps?: Record<string, unknown> }).richText)
  // svelte-ignore state_referenced_locally
  let text = $state(value == null ? '' : String(value))
  let finished = false

  let anchor = $state<HTMLElement | null>(null)
  let panel = $state<HTMLElement | null>(null)
  let area = $state<HTMLTextAreaElement | null>(null)
  let rect = $state<{ top: number; left: number; width: number; maxHeight: number } | null>(null)
  function place() {
    const cell = anchor?.closest('td') ?? anchor
    if (!cell) return
    const r = cell.getBoundingClientRect()
    const width = Math.min(Math.max(r.width + 2, 340), window.innerWidth - 16)
    const left = Math.max(8, Math.min(r.left - 1, window.innerWidth - width - 8))
    const top = Math.max(8, Math.min(r.top - 1, window.innerHeight - 220))
    rect = { top, left, width, maxHeight: window.innerHeight - top - 8 }
  }
  /** The box grows with its lines, up to the panel's room. */
  function fit() {
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight + 2, Math.max(120, (rect?.maxHeight ?? 400) - 48))}px`
  }

  onMount(() => {
    place()
    const takeFocus = () => {
      if (!area || document.activeElement === area) return
      area.focus({ preventScroll: true })
      // A typed key continues after itself; opening an existing text puts
      // the caret at its end, where more usually goes.
      area.setSelectionRange(text.length, text.length)
      fit()
    }
    queueMicrotask(takeFocus)
    const frame = requestAnimationFrame(takeFocus)
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (finished || panel?.contains(t) || anchor?.contains(t)) return
      finish('commit')
    }
    const onScroll = (e: Event) => {
      if (!panel?.contains(e.target as Node)) place()
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('pointerdown', onDown, true)
    // Drawn at the end of the page, outside the record view's dialog: as the
    // top layer it keeps a click in the panel from closing that dialog.
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

  function finish(how: 'commit' | 'cancel' | 'next' | 'prev') {
    if (finished) return
    finished = true
    if (how === 'cancel') return onCancel()
    const v = text === '' ? null : text
    if ((how === 'next' || how === 'prev') && onCommitAndMove) onCommitAndMove(v, how === 'next' ? 1 : -1)
    else onCommit(v)
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) finish('commit')
    else if (e.key === 'Escape') finish('cancel')
    else if (e.key === 'Tab') finish(e.shiftKey ? 'prev' : 'next')
    else {
      // Enter, arrows and the rest are the text box's own.
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }
  const areaValue = (e: Event) => (e.currentTarget as HTMLTextAreaElement).value
  const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? 'Cmd' : 'Ctrl'
</script>

<span class="sv-flt-cell" bind:this={anchor}>{text.split('\n')[0]}</span>

{#if rect}
  <div
    class="sv-flt-panel"
    bind:this={panel}
    use:portalToBody
    style:top={`${rect.top}px`}
    style:left={`${rect.left}px`}
    style:width={`${rect.width}px`}
    style:max-height={`${rect.maxHeight}px`}
  >
    <textarea
      bind:this={area}
      class="sv-flt-area"
      aria-label={String((columnDef as { header?: unknown } | undefined)?.header ?? 'Long text')}
      value={text}
      oninput={(e) => {
        text = areaValue(e)
        fit()
      }}
      onkeydown={onKey}
    ></textarea>
    <div class="sv-flt-foot">
      {#if rich}<span class="sv-flt-markup">**bold** *italic* `code` [link](https://...) - list</span>{/if}
      <span class="sv-flt-keys"><kbd>{mod}+Enter</kbd> save <kbd>Esc</kbd> cancel</span>
    </div>
  </div>
{/if}

<style>
  .sv-flt-cell { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; padding: 0 8px; }
  .sv-flt-panel {
    position: fixed; z-index: 2147483646; display: flex; flex-direction: column; gap: 6px; box-sizing: border-box; padding: 6px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); box-shadow: 0 8px 24px rgb(0 0 0 / 0.16);
  }
  .sv-flt-area {
    display: block; box-sizing: border-box; width: 100%; min-height: 120px; resize: none; overflow: auto;
    padding: 8px 10px; font: inherit; font-size: 14px; line-height: 1.5;
    border: 1px solid var(--sg-input-border, var(--sg-border, #e2e8f0)); border-radius: var(--sg-radius, 6px);
    background: var(--sg-input-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .sv-flt-area:focus { outline: none; border-color: var(--sg-accent, #2563eb); }
  .sv-flt-foot { display: flex; align-items: center; gap: 12px; padding: 0 2px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-flt-markup { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, monospace; }
  .sv-flt-keys { margin-inline-start: auto; flex: none; }
  .sv-flt-keys kbd { padding: 0 4px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 3px; font: inherit; font-size: 11px; }
</style>
