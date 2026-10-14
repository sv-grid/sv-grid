<script lang="ts">
  /**
   * The one editor of the number field, in every format (registered as
   * 'fieldNumber'; older currency and percent columns use it too). The box
   * shows the plain number with the field's decimal character, with the
   * currency symbol or percent sign right beside it, aligned as the column
   * aligns its values. A value it cannot take shows why under the cell.
   *
   * It reads what people type the way the field writes it: its own thousands
   * and decimal characters, a pasted symbol or percent sign, "2.5k", "3M",
   * "(5)" for -5. On commit the value is rounded to the field's precision (an
   * integer field to whole numbers); a percent field keeps fractions unless
   * its values are 0 to 100. A value that is not a number, or a negative one
   * where the field allows none, is refused and the box stays open.
   */
  import { portalToBody } from '@svgrid/grid'
  import { onMount } from 'svelte'
  import { fieldPropsOf } from './registry.svelte'
  import { formatDuration, numberEditText, numberFieldShape, numberFromText, numberKind, parseDuration, parseNumberText, roundTo, toNumber, type DurationFormat, type NumberFieldProps } from './format'

  let {
    value,
    typed = false,
    columnDef,
    onCommit,
    onCancel,
    onCommitAndMove,
    onCommitAndMoveDown,
  }: {
    value: unknown
    typed?: boolean
    columnDef?: Record<string, unknown>
    onCommit: (v?: unknown) => void
    onCancel: () => void
    onCommitAndMove?: (v: unknown, direction: 1 | -1) => void
    onCommitAndMoveDown?: (v: unknown, up?: boolean) => void
  } = $props()

  const def = $derived((columnDef ?? {}) as { fieldType?: unknown; fieldProps?: Record<string, unknown>; formatter?: unknown })
  const p = $derived(fieldPropsOf(def) as NumberFieldProps)
  const kind = $derived(numberKind(def.fieldType, p))
  const symbol = $derived(kind === 'currency' ? (p.symbol ?? '$') : '')
  const symbolAfter = $derived(p.symbolPosition === 'after')
  // A percent field stores fractions (0.75) unless its values are 0 to 100;
  // the box always shows percent points (75).
  const scale = $derived(numberFieldShape(kind, p).scale)
  // A duration field: seconds, shown and typed as "1:30" (or "1h 30m").
  const isDuration = $derived(def.fieldType === 'duration')
  const durationFormat = $derived(((p as { durationFormat?: unknown }).durationFormat ?? 'h:mm') as DurationFormat)

  // svelte-ignore state_referenced_locally
  // Typed on the cell: the value is that text, not the cell's number.
  const seeded = typed
  // svelte-ignore state_referenced_locally
  let text = $state(seeded ? keepNumberChars(String(value ?? '')) : initialText(value))

  function initialText(v: unknown): string {
    const n = toNumber(v)
    if (n == null) return ''
    return def.fieldType === 'duration' ? formatDuration(n, durationFormat) : numberEditText(n * scale, p)
  }
  /** What a typed key may add: digits, separators, a sign, K / M / B, the symbol; for a duration also : h m s. */
  function keepNumberChars(s: string): string {
    return [...s].filter((c) => /[\d.,\s+\-−()%kmbKMB]/.test(c) || (isDuration && /[:hsHS]/.test(c)) || (!!p.symbol && p.symbol.includes(c))).join('')
  }

  const result = $derived(!text.trim() ? null : isDuration ? parseDuration(text) : numberFromText(text, kind, p))
  const error = $derived(
    text.trim() && result == null
      ? isDuration ? 'Not a duration (1:30, 1h 30m)' : 'Not a number'
      : result != null && result < 0 && p.allowNegative === false
        ? 'Negative numbers are not allowed'
        : null,
  )
  // ---- the spinner: up / down buttons and the Up / Down keys
  // A duration steps a minute (a second when the format shows seconds).
  const step = $derived(
    Number((p as { step?: unknown }).step) > 0 ? Number((p as { step?: unknown }).step) : isDuration ? (durationFormat === 'h:mm' ? 60 : 1) : 1,
  )
  /** Add `dir` steps (ten with Shift) to the number in the box, in the box's own units. */
  function bump(dir: 1 | -1, big = false) {
    if (isDuration) {
      const secs = text.trim() ? parseDuration(text) : 0
      if (secs == null) return
      text = formatDuration(Math.max(0, secs + dir * step * (big ? 10 : 1)), durationFormat)
      return
    }
    const now = text.trim() ? parseNumberText(text, p) : 0
    if (now == null) return
    let next = roundTo(now + dir * step * (big ? 10 : 1), numberFieldShape(kind, p).places)
    if (next < 0 && p.allowNegative === false) next = 0
    text = numberEditText(next, p)
  }
  // Holding a button repeats, after a pause, as a native spinner does.
  let hold: ReturnType<typeof setTimeout> | null = null
  function press(dir: 1 | -1, e: PointerEvent) {
    // mousedown is cancelled too (on the button): that, not this, keeps the
    // focus in the box, so the keys still go to the editor.
    e.preventDefault()
    input?.focus({ preventScroll: true })
    bump(dir, e.shiftKey)
    stopHold()
    const repeat = () => {
      bump(dir, e.shiftKey)
      hold = setTimeout(repeat, 60)
    }
    hold = setTimeout(repeat, 400)
  }
  function stopHold() {
    if (hold) clearTimeout(hold)
    hold = null
  }

  // The number and its symbol sit together where the column puts values.
  const justify = $derived(
    (def as { align?: string }).align === 'left' ? 'flex-start' : (def as { align?: string }).align === 'center' ? 'center' : 'flex-end',
  )

  // ---- why a value is refused, under the cell, in the body so the cell
  // cannot clip it
  let box = $state<HTMLElement | null>(null)
  let input = $state<HTMLInputElement | null>(null)
  let errorAt = $state<{ top: number; left: number } | null>(null)
  let shake = $state(false)
  function place() {
    const cell = box?.closest('td') ?? box
    if (!cell) return
    const r = cell.getBoundingClientRect()
    errorAt = { top: r.bottom + 2, left: r.left }
  }
  function takeFocus() {
    if (!input || document.activeElement === input) return
    input.focus({ preventScroll: true })
    if (!seeded) input.select()
    else input.setSelectionRange(text.length, text.length)
  }
  onMount(() => {
    place()
    takeFocus()
    // The double-click that opened the editor can still hand focus back to
    // the grid; take it once more on the next frame.
    const frame = requestAnimationFrame(takeFocus)
    // A press anywhere else ends the edit: a number is kept, text that is
    // not one is dropped rather than leave the cell stuck open. Not on blur:
    // focus also leaves when the window does, and the grid can move it.
    const onDown = (e: PointerEvent) => {
      if (finished || box?.contains(e.target as Node)) return
      if (error) {
        finished = true
        onCancel()
      } else finish('commit')
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    document.addEventListener('pointerdown', onDown, true)
    return () => {
      stopHold()
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
      document.removeEventListener('pointerdown', onDown, true)
    }
  })

  let finished = false
  function finish(how: 'commit' | 'next' | 'prev' | 'down' | 'up'): boolean {
    if (finished) return true
    if (error) {
      shake = false
      queueMicrotask(() => (shake = true))
      return false
    }
    finished = true
    // Enter moves a row down, as in a text cell; Tab a column across.
    if ((how === 'down' || how === 'up') && onCommitAndMoveDown) onCommitAndMoveDown(result, how === 'up')
    else if ((how === 'next' || how === 'prev') && onCommitAndMove) onCommitAndMove(result, how === 'next' ? 1 : -1)
    else onCommit(result)
    return true
  }
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') finish(e.shiftKey ? 'up' : 'down')
    else if (e.key === 'Tab') finish(e.shiftKey ? 'prev' : 'next')
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') bump(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey)
    else if (e.key === 'Escape') {
      finished = true
      onCancel()
    } else {
      // Caret keys move in the box, not between cells.
      e.stopPropagation()
      return
    }
    e.preventDefault()
    e.stopPropagation()
  }
  function onBeforeInput(e: InputEvent) {
    // Typed letters that cannot be part of a number never reach the box;
    // a paste is read as a whole on commit.
    if (e.inputType === 'insertText' && e.data && keepNumberChars(e.data) !== e.data) e.preventDefault()
  }
  const inputValue = (e: Event) => (e.currentTarget as HTMLInputElement).value
</script>

<!-- Presses inside the editor (the spinner, placing the caret) stay here: the
     cell's own handlers would move focus to the grid and end the typing. -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<span
  class="sv-fne"
  class:is-invalid={!!error}
  class:is-shake={shake}
  style:justify-content={justify}
  bind:this={box}
  onanimationend={() => (shake = false)}
  onpointerdown={(e) => e.stopPropagation()}
  onmousedown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  ondblclick={(e) => e.stopPropagation()}
>
  {#if symbol && !symbolAfter}<span class="sv-fne-affix" aria-hidden="true">{symbol}</span>{/if}
  <!-- The input takes the width of its text (a hidden copy sizes it), so
       the symbol sits right against the number. -->
  <span class="sv-fne-sizer" data-text={text}>
  <input
    bind:this={input}
    class="sv-fne-input"
    size="1"
    inputmode="decimal"
    autocomplete="off"
    spellcheck="false"
    aria-label={isDuration ? `Duration (${durationFormat})` : kind === 'currency' ? `Amount in ${symbol || 'money'}` : kind === 'percent' ? 'Percent' : 'Number'}
    aria-invalid={error ? 'true' : undefined}
    value={text}
    oninput={(e) => (text = inputValue(e))}
    onbeforeinput={onBeforeInput}
    onkeydown={onKey}
  />
  </span>
  {#if symbol && symbolAfter}<span class="sv-fne-affix" aria-hidden="true">{symbol}</span>{/if}
  {#if kind === 'percent'}<span class="sv-fne-affix" aria-hidden="true">%</span>{/if}
  <!-- Pointer only: Up / Down do the same from the keyboard, and focus stays
       in the box. -->
  <span class="sv-fne-spin">
    <button type="button" tabindex="-1" aria-label={`Increase by ${step}`} onmousedown={(e) => e.preventDefault()} onpointerdown={(e) => press(1, e)} onpointerup={stopHold} onpointerleave={stopHold}>
      <svg viewBox="0 0 10 6" width="8" height="5" aria-hidden="true"><path d="M1 5l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
    <button type="button" tabindex="-1" aria-label={`Decrease by ${step}`} onmousedown={(e) => e.preventDefault()} onpointerdown={(e) => press(-1, e)} onpointerup={stopHold} onpointerleave={stopHold}>
      <svg viewBox="0 0 10 6" width="8" height="5" aria-hidden="true"><path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </button>
  </span>
</span>

{#if errorAt && error}
  <div
    class="sv-fne-error"
    role="alert"
    use:portalToBody
    style:top={`${errorAt.top}px`}
    style:left={`${errorAt.left}px`}
  >
    <svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M12 3 2 20h20L12 3zM12 10v4M12 17v.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
    {error}
  </div>
{/if}

<style>
  /* The whole cell, edge to edge, with the input only as wide as its text,
     so the symbol stays beside the number: an input's default width (about
     20 characters) is wider than a number column. The cell's own gutter
     (--sg-cell-px) on the left, the spinner at the right edge with the
     number right-aligned against it. Accent outline while focused, as the
     built-in editors have; red when invalid. */
  .sv-fne {
    position: absolute; inset: 0; z-index: 1;
    display: flex; align-items: center; gap: 1px; padding: 0 22px 0 var(--sg-cell-px, 7px); box-sizing: border-box; overflow: hidden;
    background: var(--sg-input-bg, var(--sg-bg, #fff));
  }
  .sv-fne:focus-within { box-shadow: inset 0 0 0 2px var(--sg-accent, #2563eb); }
  .sv-fne.is-invalid { box-shadow: inset 0 0 0 2px var(--sg-danger, #dc2626); }
  .sv-fne.is-shake { animation: sv-fne-shake 0.24s; }
  @keyframes sv-fne-shake { 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
  @media (prefers-reduced-motion: reduce) { .sv-fne.is-shake { animation: none; } }
  .sv-fne-affix { flex: none; color: var(--sg-fg, #0f172a); font-variant-numeric: tabular-nums; }
  /* Only the hidden copy of the text (plus a pixel for the caret) sets the
     width; the input lies over it. An input's own minimum width (even at
     size=1) would leave a gap after the symbol. */
  .sv-fne-sizer { position: relative; flex: 0 1 auto; min-width: 1ch; max-width: 100%; height: 100%; display: flex; align-items: center; }
  .sv-fne-sizer::after {
    content: attr(data-text); padding-inline-start: 1px; visibility: hidden; white-space: pre; overflow: hidden;
    font: inherit; font-variant-numeric: tabular-nums;
  }
  .sv-fne-input {
    position: absolute; inset: 0; width: 100%; min-width: 0; height: 100%; padding: 0; margin: 0; border: 0; outline: none;
    background: none; box-shadow: none; color: var(--sg-fg, #0f172a); font: inherit; text-align: end; font-variant-numeric: tabular-nums;
  }
  .sv-fne-spin {
    position: absolute; top: 0; bottom: 0; inset-inline-end: 3px;
    display: flex; flex-direction: column; justify-content: center; gap: 1px;
  }
  .sv-fne-spin button {
    display: flex; align-items: center; justify-content: center; width: 16px; height: 11px; padding: 0; border: 0;
    border-radius: 3px; background: none; color: var(--sg-muted, #64748b); cursor: pointer;
  }
  .sv-fne-spin button:hover { background: var(--sg-row-hover-bg, #f1f5f9); color: var(--sg-fg, #0f172a); }
  .sv-fne-error {
    position: fixed; z-index: 2147483646; display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px;
    border-radius: var(--sg-radius, 6px); background: var(--sg-danger, #dc2626); color: #fff;
    font-size: 12px; white-space: nowrap; pointer-events: none;
  }
</style>
