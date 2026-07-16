<script lang="ts" module>
  export type CalendarValue = Date | number | string | ReadonlyArray<Date | number | string> | null

  /** A one-click shortcut shown in the presets rail. `value` is a single date
   *  (or an [start, end] range for range mode); pass a function for "today"-
   *  relative shortcuts that resolve at click time. */
  export type CalendarPreset = {
    label: string
    value:
      | Date | number | string
      | readonly [Date | number | string, Date | number | string]
      | (() => Date | number | string | readonly [Date | number | string, Date | number | string])
  }

  /** How the calendar animates a navigation / drill. */
  export type CalendarAnimation = 'slide' | 'fade' | 'none'
</script>

<script lang="ts">
  /**
   * SvCalendar - a themeable, accessible month/year/decade calendar built on the
   * framework-free date engine in ./datetime. It works standalone AND is the
   * date cell editor for SvGrid (rich-by-default). All visuals come from the
   * grid's `--sg-*` theme tokens, so every preset theme styles it for free.
   *
   * Parity target: Smart `smart-calendar` (selectionModes, min/max, restricted /
   * important dates, week numbers, firstDayOfWeek, drill navigation, keyboard).
   */
  import {
    addDays,
    addMonths,
    addYears,
    monthMatrix,
    weekdayOrder,
    startOfDay,
    isSameDay,
    isSameMonth,
    toDate,
    decadeRange,
    type DateLike,
  } from './datetime/date-core'
  import {
    selectDate,
    isSelected,
    rangeDays,
    emptySelection,
    type SelectionMode,
    type SelectionState,
  } from './datetime/date-selection'
  import { isDisabledDay, isImportant, type RestrictOptions } from './datetime/date-restrict'
  import { untrack } from 'svelte'

  type NameFormat = 'narrow' | 'short' | 'long'

  type Props = {
    /** Selected value(s). Single Date for one/zeroOrOne, array for multi modes. */
    value?: CalendarValue
    /** Fires with the full selected-day list on every change. */
    onChange?: (dates: Date[]) => void
    /** Fires when the visible month/year/decade page changes. */
    onNavigate?: (viewDate: Date, displayMode: DisplayMode) => void
    selectionMode?: SelectionMode
    min?: DateLike | null
    max?: DateLike | null
    /** Non-selectable dates (list or predicate). */
    restrictedDates?: RestrictOptions['restrictedDates']
    /** Highlighted (but still selectable) dates. */
    importantDates?: ReadonlyArray<DateLike> | ((d: Date) => boolean) | null
    /** 0 = Sunday .. 6 = Saturday. */
    firstDayOfWeek?: number
    weeks?: number
    weekNumbers?: boolean
    /** Number of month panels side by side. */
    months?: number
    hideDayNames?: boolean
    hideOtherMonthDays?: boolean
    dayNameFormat?: NameFormat
    monthNameFormat?: NameFormat
    /** Show the Today / Clear footer. */
    footer?: boolean
    disabled?: boolean
    readonly?: boolean
    locale?: string
    name?: string
    /** Which drill level to open on. */
    displayMode?: DisplayMode
    /** Animate month/year navigation + drill (opt-in). `true` = 'slide'. This is
     *  an explicit opt-in, so it plays regardless of the OS "reduce motion"
     *  setting - pass 'none' (or gate it yourself) to suppress it. */
    animate?: boolean | CalendarAnimation
    /** Change the visible month/year/decade with the mouse wheel over the grid. */
    wheelNavigation?: boolean
    /** Per-day tooltip text (shown as the native title on the day button). */
    dateTooltip?: (date: Date) => string | null | undefined
    /** One-click shortcuts (e.g. Today, Last 7 days) shown in a side rail. */
    presets?: ReadonlyArray<CalendarPreset>
  }

  type DisplayMode = 'month' | 'year' | 'decade'

  let {
    value = null,
    onChange,
    onNavigate,
    selectionMode = 'one',
    min = null,
    max = null,
    restrictedDates = null,
    importantDates = null,
    firstDayOfWeek = 0,
    weeks = 6,
    weekNumbers = false,
    months = 1,
    hideDayNames = false,
    hideOtherMonthDays = false,
    dayNameFormat = 'short',
    monthNameFormat = 'long',
    footer = false,
    disabled = false,
    readonly = false,
    locale = typeof navigator !== 'undefined' ? navigator.language : 'en-US',
    name,
    displayMode = 'month',
    animate = false,
    wheelNavigation = false,
    dateTooltip,
    presets,
  }: Props = $props()

  // --- View-change animation (framework-native Web Animations API) -----------
  // We animate a wrapper element instead of re-keying the grid, so day cells stay
  // mounted (keyboard focus + interactivity are preserved). `navDir` records why
  // the view changed; an effect replays a short keyframe on the new content.
  const animKind = $derived<CalendarAnimation>(animate === true ? 'slide' : animate || 'none')
  let animEl = $state<HTMLElement | undefined>()
  let animToken = $state(0)
  let navDir: 'next' | 'prev' | 'drillDown' | 'drillUp' | 'fade' = 'fade'
  let animPrimed = false // skip the very first (mount) run
  // Note: `animate` is an explicit opt-in, so we honor it even under the OS
  // "reduce motion" setting. Pass animate="none" (or gate it yourself on
  // prefers-reduced-motion) if you want it suppressed for that audience.
  function playAnim() {
    if (animKind === 'none' || !animEl || typeof animEl.animate !== 'function') return
    const slide = animKind === 'slide'
    // A month grid barely changes shape between months, so the movement has to be
    // pronounced to read as a transition. Slide the new content a clear distance +
    // fade; drills zoom. A mid-keyframe holds the offset briefly for legibility.
    const D = 34
    const from =
      !slide ? { opacity: 0, transform: 'scale(0.98)' }
      : navDir === 'next' ? { transform: `translateX(${D}px)`, opacity: 0 }
      : navDir === 'prev' ? { transform: `translateX(-${D}px)`, opacity: 0 }
      : navDir === 'drillDown' ? { transform: 'scale(0.85)', opacity: 0 }
      : navDir === 'drillUp' ? { transform: 'scale(1.14)', opacity: 0 }
      : { opacity: 0 }
    animEl.animate([from, { transform: 'none', opacity: 1 }], {
      duration: slide && (navDir === 'next' || navDir === 'prev') ? 300 : 220,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
    })
  }
  $effect(() => {
    animToken // re-run after each navigation's DOM update
    if (!animPrimed) { animPrimed = true; return }
    untrack(playAnim)
  })

  const restrict = $derived<RestrictOptions>({ min, max, restrictedDates })

  /** Normalize the incoming value to an ordered day list. */
  function normalizeValue(v: CalendarValue): Date[] {
    if (v == null) return []
    const list = Array.isArray(v) ? v : [v]
    const out: Date[] = []
    for (const item of list) {
      const d = toDate(item as DateLike)
      if (d) out.push(startOfDay(d))
    }
    return out
  }

  // Internal selection state. Seeded from `value`; range mode also tracks a
  // pending rangeStart between the two clicks, which `value` alone cannot hold.
  let sel = $state<SelectionState>(emptySelection())
  // The month currently shown (first panel) + the drill level.
  let view = $state<Date>(startOfDay(new Date()))
  let mode = $state<DisplayMode>('month')
  // Roving focus + range hover preview.
  let focusDate = $state<Date>(startOfDay(new Date()))
  let hoverDate = $state<Date | null>(null)

  let lastSyncedKey = '￿' // sentinel so the first sync always fires (incl. null value)
  let seeded = false
  $effect(() => {
    const dates = normalizeValue(value)
    const key = dates.map((d) => d.getTime()).join(',')
    if (key !== lastSyncedKey) {
      lastSyncedKey = key
      sel = { dates, anchor: dates[dates.length - 1] ?? null, rangeStart: null }
      // Seed the visible page + roving focus once, from the initial value.
      if (!seeded) {
        seeded = true
        const first = dates[0] ?? startOfDay(new Date())
        view = startOfDay(first)
        focusDate = startOfDay(first)
        mode = displayMode
      }
    }
  })

  const isInteractive = $derived(!disabled && !readonly)

  // --- Intl-driven labels (cached by the browser) ---
  const weekdayFmt = $derived(new Intl.DateTimeFormat(locale, { weekday: dayNameFormat }))
  const monthTitleFmt = $derived(new Intl.DateTimeFormat(locale, { month: monthNameFormat, year: 'numeric' }))
  const monthShortFmt = $derived(new Intl.DateTimeFormat(locale, { month: 'short' }))
  const fullDateFmt = $derived(new Intl.DateTimeFormat(locale, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))

  const weekdayHeaders = $derived(
    weekdayOrder(firstDayOfWeek).map((wd) => {
      // 2021-08-01 is a Sunday; offset to the requested weekday.
      const d = new Date(2021, 7, 1 + wd)
      return { label: weekdayFmt.format(d), weekday: wd }
    }),
  )

  /** The month grids to render (1..months panels). */
  const panels = $derived(
    Array.from({ length: Math.max(1, months) }, (_, i) => {
      const panelMonth = addMonths(view, i)
      return { month: panelMonth, matrix: monthMatrix(panelMonth, firstDayOfWeek, weeks) }
    }),
  )

  // Range preview: while a range is pending (or being hovered), show the band.
  const previewRange = $derived.by(() => {
    if (selectionMode !== 'range') return null
    const start = sel.rangeStart
    if (!start || !hoverDate) return null
    return rangeDays(start, hoverDate)
  })

  function inPreview(d: Date): boolean {
    return !!previewRange && previewRange.some((p) => isSameDay(p, d))
  }

  function dayState(d: Date, panelMonth: Date) {
    const disabledDay = isDisabledDay(d, restrict)
    return {
      disabled: disabledDay,
      selected: isSelected(sel.dates, d),
      important: isImportant(d, importantDates),
      today: isSameDay(d, new Date()),
      outside: !isSameMonth(d, panelMonth),
      focused: isSameDay(d, focusDate),
      preview: inPreview(d),
    }
  }

  // --- Actions ---
  function commit(next: SelectionState) {
    sel = next
    lastSyncedKey = next.dates.map((x) => x.getTime()).join(',')
    onChange?.(next.dates.map((x) => new Date(x.getTime())))
  }

  function pickDay(d: Date, e?: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean }) {
    if (!isInteractive || isDisabledDay(d, restrict)) return
    focusDate = startOfDay(d)
    commit(
      selectDate(sel, d, selectionMode, { ctrl: e?.ctrlKey || e?.metaKey, shift: e?.shiftKey }, firstDayOfWeek),
    )
  }

  function setView(next: Date, nextMode: DisplayMode = mode) {
    view = startOfDay(next)
    mode = nextMode
    animToken++ // fire the view-change animation on the updated DOM
    onNavigate?.(view, mode)
  }

  function drillUp() {
    navDir = 'drillUp'
    if (mode === 'month') setView(view, 'year')
    else if (mode === 'year') setView(view, 'decade')
  }

  function step(dir: -1 | 1) {
    navDir = dir === 1 ? 'next' : 'prev'
    if (mode === 'month') setView(addMonths(view, dir))
    else if (mode === 'year') setView(addYears(view, dir))
    else setView(addYears(view, dir * 10))
  }

  function pickMonth(monthIndex: number) {
    navDir = 'drillDown'
    setView(new Date(view.getFullYear(), monthIndex, 1), 'month')
    focusDate = new Date(view.getFullYear(), monthIndex, Math.min(focusDate.getDate(), 28))
  }

  function pickYear(year: number) {
    navDir = 'drillDown'
    setView(new Date(year, view.getMonth(), 1), 'year')
  }

  function goToday() {
    navDir = 'fade'
    const t = new Date()
    setView(t, 'month')
    focusDate = startOfDay(t)
    if (isInteractive) pickDay(t)
  }

  // Mouse-wheel navigation (opt-in). Non-passive so we can prevent page scroll.
  function wheelNav(node: HTMLElement) {
    const onWheel = (e: WheelEvent) => {
      if (!wheelNavigation || disabled) return
      e.preventDefault()
      step(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return { destroy: () => node.removeEventListener('wheel', onWheel) }
  }

  // --- Presets (Today / Last 7 days / ...) -----------------------------------
  function applyPreset(p: CalendarPreset) {
    if (!isInteractive) return
    const resolved = typeof p.value === 'function' ? p.value() : p.value
    const isRange = Array.isArray(resolved)
    const pair = (isRange ? resolved : [resolved, resolved]) as ReadonlyArray<DateLike>
    const start = toDate(pair[0] as DateLike)
    const end = toDate(pair[1] as DateLike)
    if (!start) return
    focusDate = startOfDay(start)
    navDir = 'fade'
    view = startOfMonthSafe(start)
    animToken++
    if (isRange && end) {
      commit({ dates: rangeDays(start, end), anchor: startOfDay(end), rangeStart: null })
    } else {
      commit({ dates: [startOfDay(start)], anchor: startOfDay(start), rangeStart: null })
    }
  }
  const startOfMonthSafe = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)

  function clearSelection() {
    if (!isInteractive) return
    commit(emptySelection())
  }

  // --- Keyboard (month grid) ---
  function onGridKeydown(e: KeyboardEvent) {
    if (mode !== 'month') return onNonMonthKeydown(e)
    let next: Date | null = null
    switch (e.key) {
      case 'ArrowLeft': next = addDays(focusDate, -1); break
      case 'ArrowRight': next = addDays(focusDate, 1); break
      case 'ArrowUp': next = addDays(focusDate, -7); break
      case 'ArrowDown': next = addDays(focusDate, 7); break
      case 'Home': next = addDays(focusDate, -((focusDate.getDay() - firstDayOfWeek + 7) % 7)); break
      case 'End': next = addDays(focusDate, 6 - ((focusDate.getDay() - firstDayOfWeek + 7) % 7)); break
      case 'PageUp': next = e.shiftKey ? addYears(focusDate, -1) : addMonths(focusDate, -1); break
      case 'PageDown': next = e.shiftKey ? addYears(focusDate, 1) : addMonths(focusDate, 1); break
      case 'Enter':
      case ' ':
        e.preventDefault()
        pickDay(focusDate, e)
        return
      default:
        return
    }
    if (next) {
      e.preventDefault()
      focusDate = startOfDay(next)
      if (!isSameMonth(focusDate, view)) setView(focusDate, 'month')
    }
  }

  function onNonMonthKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (mode === 'year') pickMonth(focusDate.getMonth())
      else pickYear(focusDate.getFullYear())
    }
  }

  const title = $derived(
    mode === 'month'
      ? monthTitleFmt.format(view)
      : mode === 'year'
        ? String(view.getFullYear())
        : (() => {
            const { start, end } = decadeRange(view.getFullYear())
            return `${start} - ${end}`
          })(),
  )

  // Year-mode cells (12 months) and decade-mode cells (10 years + 2 padding).
  const yearCells = $derived(
    Array.from({ length: 12 }, (_, m) => ({
      index: m,
      label: monthShortFmt.format(new Date(view.getFullYear(), m, 1)),
      current: m === new Date().getMonth() && view.getFullYear() === new Date().getFullYear(),
    })),
  )
  const decadeCells = $derived.by(() => {
    const { start } = decadeRange(view.getFullYear())
    return Array.from({ length: 12 }, (_, i) => {
      const year = start - 1 + i
      return { year, outside: i === 0 || i === 11, current: year === new Date().getFullYear() }
    })
  })

  const canClear = $derived(
    selectionMode === 'zeroOrOne' || selectionMode === 'zeroOrMany' || selectionMode === 'none',
  )
</script>

<div
  class="sv-cal"
  class:sv-cal--disabled={disabled}
  class:sv-cal--with-presets={presets && presets.length}
  class:sv-cal--band={selectionMode === 'range' || selectionMode === 'week'}
  role="group"
  aria-label="Calendar"
  aria-disabled={disabled}
>
  {#if presets && presets.length}
    <div class="sv-cal__presets" role="group" aria-label="Shortcuts">
      {#each presets as p, i (i)}
        <button type="button" class="sv-cal__preset" onclick={() => applyPreset(p)} disabled={!isInteractive}>{p.label}</button>
      {/each}
    </div>
  {/if}

  <div class="sv-cal__main" use:wheelNav>
  <div class="sv-cal__header">
    <button type="button" class="sv-cal__nav" onclick={() => step(-1)} disabled={disabled} aria-label="Previous">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <button
      type="button"
      class="sv-cal__title"
      onclick={drillUp}
      disabled={disabled || mode === 'decade'}
      aria-live="polite"
    >{title}</button>
    <button type="button" class="sv-cal__nav" onclick={() => step(1)} disabled={disabled} aria-label="Next">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  </div>

  <div class="sv-cal__view" bind:this={animEl}>
  {#if mode === 'month'}
    <div class="sv-cal__panels" onkeydown={onGridKeydown} role="grid" aria-label={title} tabindex="-1">
      {#each panels as panel (panel.month.getTime())}
        <div class="sv-cal__panel">
          {#if months > 1}<div class="sv-cal__panel-title">{monthTitleFmt.format(panel.month)}</div>{/if}
          {#if !hideDayNames}
            <div class="sv-cal__weekdays" role="row">
              {#if weekNumbers}<span class="sv-cal__wk-head" aria-hidden="true">#</span>{/if}
              {#each weekdayHeaders as wh (wh.weekday)}
                <span class="sv-cal__weekday" role="columnheader">{wh.label}</span>
              {/each}
            </div>
          {/if}
          {#each panel.matrix as week, wi (wi)}
            <div class="sv-cal__week" role="row">
              {#if weekNumbers}<span class="sv-cal__wk" aria-hidden="true">{week[0]?.week}</span>{/if}
              {#each week as cell (cell.date.getTime())}
                {@const st = dayState(cell.date, panel.month)}
                {#if st.outside && hideOtherMonthDays}
                  <span class="sv-cal__day sv-cal__day--empty" role="gridcell" aria-hidden="true"></span>
                {:else}
                  <button
                    type="button"
                    role="gridcell"
                    class="sv-cal__day"
                    class:is-selected={st.selected}
                    class:is-today={st.today}
                    class:is-outside={st.outside}
                    class:is-important={st.important}
                    class:is-preview={st.preview}
                    class:is-focused={st.focused}
                    aria-selected={st.selected}
                    aria-disabled={st.disabled}
                    aria-current={st.today ? 'date' : undefined}
                    aria-label={fullDateFmt.format(cell.date)}
                    title={dateTooltip?.(cell.date) ?? undefined}
                    tabindex={st.focused ? 0 : -1}
                    disabled={st.disabled || disabled}
                    onclick={(e) => pickDay(cell.date, e)}
                    onpointerenter={() => (hoverDate = cell.date)}
                    onpointerleave={() => (hoverDate = null)}
                  >{cell.date.getDate()}</button>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else if mode === 'year'}
    <div class="sv-cal__grid-mode" onkeydown={onNonMonthKeydown} role="grid" aria-label={title} tabindex="-1">
      {#each yearCells as yc (yc.index)}
        <button
          type="button"
          class="sv-cal__cell"
          class:is-today={yc.current}
          class:is-selected={sel.dates.some((d) => d.getMonth() === yc.index && d.getFullYear() === view.getFullYear())}
          onclick={() => pickMonth(yc.index)}
          disabled={disabled}
        >{yc.label}</button>
      {/each}
    </div>
  {:else}
    <div class="sv-cal__grid-mode" onkeydown={onNonMonthKeydown} role="grid" aria-label={title} tabindex="-1">
      {#each decadeCells as dc (dc.year)}
        <button
          type="button"
          class="sv-cal__cell"
          class:is-outside={dc.outside}
          class:is-today={dc.current}
          class:is-selected={sel.dates.some((d) => d.getFullYear() === dc.year)}
          onclick={() => pickYear(dc.year)}
          disabled={disabled}
        >{dc.year}</button>
      {/each}
    </div>
  {/if}
  </div>

  {#if footer}
    <div class="sv-cal__footer">
      <button type="button" class="sv-cal__foot-btn" onclick={goToday} disabled={disabled}>Today</button>
      {#if canClear}
        <button type="button" class="sv-cal__foot-btn" onclick={clearSelection} disabled={disabled}>Clear</button>
      {/if}
    </div>
  {/if}
  </div>

  {#if name}<input type="hidden" {name} value={sel.dates.map((d) => d.toISOString()).join(',')} />{/if}
</div>

<style>
  .sv-cal {
    --_accent: var(--sg-accent, #2563eb);
    --_bg: var(--sg-bg, #fff);
    --_fg: var(--sg-fg, #0f172a);
    --_muted: var(--sg-muted, #64748b);
    --_border: var(--sg-border, #e2e8f0);
    --_hover: var(--sg-row-hover-bg, rgba(37, 99, 235, 0.08));
    --_radius: var(--sg-radius, 8px);
    display: inline-flex;
    gap: 10px;
    padding: 10px;
    width: max-content;
    background: var(--_bg);
    color: var(--_fg);
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) + 4px);
    font-size: 13px;
    user-select: none;
  }
  .sv-cal--disabled { opacity: 0.55; pointer-events: none; }
  .sv-cal__main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  /* Clip so animated content slides in from the edge (not past the border). Day
     focus outlines use outline-offset:-2px, so they stay inside and aren't clipped. */
  .sv-cal__view { display: block; overflow: hidden; }
  /* Quick-shortcut rail (Today / Last 7 days / ...) shown when `presets` is set. */
  .sv-cal__presets {
    display: flex; flex-direction: column; gap: 2px;
    padding-right: 10px; border-right: 1px solid var(--_border);
    min-width: 118px; align-self: stretch;
  }
  .sv-cal__preset {
    text-align: left; padding: 6px 10px; font: inherit; font-size: 12px; font-weight: 550;
    background: none; border: 0; border-radius: var(--_radius); color: inherit; cursor: pointer; white-space: nowrap;
  }
  .sv-cal__preset:hover:not(:disabled) { background: var(--_hover); color: var(--_accent); }
  .sv-cal__preset:disabled { opacity: 0.5; cursor: default; }

  .sv-cal__header { display: flex; align-items: center; gap: 4px; }
  .sv-cal__title {
    flex: 1; text-align: center; font-weight: 650; font-size: 13.5px;
    background: none; border: 0; color: inherit; cursor: pointer;
    padding: 6px 8px; border-radius: var(--_radius);
  }
  .sv-cal__title:hover:not(:disabled) { background: var(--_hover); }
  .sv-cal__title:disabled { cursor: default; }
  .sv-cal__nav {
    display: grid; place-items: center; width: 30px; height: 30px;
    background: none; border: 0; color: var(--_muted); cursor: pointer; border-radius: var(--_radius);
  }
  .sv-cal__nav:hover:not(:disabled) { background: var(--_hover); color: var(--_fg); }
  .sv-cal__nav:disabled { opacity: 0.4; cursor: default; }

  .sv-cal__panels { display: flex; gap: 14px; }
  .sv-cal__panel-title { text-align: center; font-weight: 600; font-size: 12.5px; margin-bottom: 4px; color: var(--_muted); }
  .sv-cal__weekdays, .sv-cal__week {
    display: grid;
    grid-template-columns: repeat(7, 34px);
  }
  .sv-cal__weekdays:has(.sv-cal__wk-head), .sv-cal__week:has(.sv-cal__wk) {
    grid-template-columns: 26px repeat(7, 34px);
  }
  .sv-cal__weekday, .sv-cal__wk-head {
    display: grid; place-items: center; height: 28px;
    font-size: 11px; font-weight: 600; color: var(--_muted); text-transform: uppercase; letter-spacing: 0.02em;
  }
  .sv-cal__wk {
    display: grid; place-items: center; height: 34px;
    font-size: 10.5px; color: var(--_muted); opacity: 0.7;
  }
  .sv-cal__day {
    display: grid; place-items: center; width: 34px; height: 34px; box-sizing: border-box;
    background: none; border: 0; color: inherit; cursor: pointer;
    border-radius: var(--_radius); font-size: 12.5px; position: relative;
  }
  .sv-cal__day--empty { visibility: hidden; }
  /* Hover only NON-selected days with the neutral hover fill; hovering a selected
     day keeps the accent (a bare :hover would swap in the neutral bg while the
     text stays --sg-on-accent -> invisible on themes like shadcn). */
  .sv-cal__day:hover:not(:disabled):not(.is-selected) { background: var(--_hover); }
  .sv-cal__day.is-selected:hover:not(:disabled) { background: color-mix(in srgb, var(--_accent) 86%, var(--_fg)); }
  .sv-cal__day.is-outside { color: var(--_muted); opacity: 0.55; }
  .sv-cal__day.is-today { font-weight: 750; box-shadow: inset 0 0 0 1px var(--_accent); }
  .sv-cal__day.is-important::after {
    content: ''; position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%);
    width: 4px; height: 4px; border-radius: 50%; background: var(--sg-danger, #dc2626);
  }
  .sv-cal__day.is-preview { background: color-mix(in srgb, var(--_accent) 16%, transparent); border-radius: 0; }
  .sv-cal__day.is-selected {
    background: var(--_accent); color: var(--sg-on-accent, #fff); font-weight: 650;
  }
  /* Discrete selection (single / many / ...): inset each selected pill so adjacent
     picked days keep a visible gap. Range / week modes stay a connected band. */
  .sv-cal:not(.sv-cal--band) .sv-cal__day.is-selected { background-clip: content-box; padding: 2px; }
  .sv-cal__day.is-selected.is-important::after { background: var(--sg-on-accent, #fff); }
  .sv-cal__day:disabled { color: var(--_muted); opacity: 0.35; cursor: default; text-decoration: line-through; }
  .sv-cal__day.is-focused:focus-visible,
  .sv-cal__day:focus-visible,
  .sv-cal__cell:focus-visible {
    outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: -2px;
  }

  .sv-cal__grid-mode {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px;
    min-width: 252px;
  }
  .sv-cal__cell {
    height: 44px; display: grid; place-items: center;
    background: none; border: 0; color: inherit; cursor: pointer;
    border-radius: var(--_radius); font-size: 12.5px;
  }
  .sv-cal__cell:hover:not(:disabled):not(.is-selected) { background: var(--_hover); }
  .sv-cal__cell.is-selected:hover:not(:disabled) { background: color-mix(in srgb, var(--_accent) 86%, var(--_fg)); }
  .sv-cal__cell.is-outside { color: var(--_muted); opacity: 0.5; }
  .sv-cal__cell.is-today { box-shadow: inset 0 0 0 1px var(--_accent); font-weight: 700; }
  .sv-cal__cell.is-selected { background: var(--_accent); color: var(--sg-on-accent, #fff); font-weight: 650; }

  .sv-cal__footer { display: flex; justify-content: center; gap: 8px; border-top: 1px solid var(--_border); padding-top: 8px; margin-top: 2px; }
  .sv-cal__foot-btn {
    padding: 5px 12px; font: inherit; font-size: 12px; font-weight: 600;
    background: none; border: 1px solid var(--_border); border-radius: var(--_radius);
    color: var(--_accent); cursor: pointer;
  }
  .sv-cal__foot-btn:hover:not(:disabled) { background: var(--_hover); }
</style>
