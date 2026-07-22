<script lang="ts" module>
  // Public types now live with the headless core and are re-exported here so the
  // component's module entry point (and @svgrid/grid) keeps the same surface.
  export type { CalendarValue, CalendarPreset, CalendarAnimation, DisplayMode } from './createCalendar.svelte'
</script>

<script lang="ts">
  /**
   * SvCalendar - a themeable, accessible month/year/decade calendar. It is a thin
   * styled renderer over the headless `createCalendar` core (the same split as
   * `createSvGrid` / <SvGrid>): the core owns the reactive state + interaction +
   * ARIA (built on the framework-free ./datetime engine), while this component
   * keeps the render-only concerns - the WAAPI view-change animation, mouse-wheel
   * navigation, and DOM refs. All visuals come from the grid's `--sg-*` tokens.
   *
   * Parity target: Smart `smart-calendar` (selectionModes, min/max, restricted /
   * important dates, week numbers, firstDayOfWeek, drill navigation, keyboard).
   */
  import { untrack, type Snippet } from 'svelte'
  import { resolveMessages, type EditorDir } from './editor-contract'
  import {
    createCalendar,
    type CalendarValue,
    type CalendarPreset,
    type CalendarAnimation,
    type CalendarDayState,
    type DisplayMode,
  } from './createCalendar.svelte'
  import type { SelectionMode } from './datetime/date-selection'
  import type { RestrictOptions } from './datetime/date-restrict'
  import type { DateLike } from './datetime/date-core'
  import type { RecurrenceRule } from './recurrence'

  type NameFormat = 'narrow' | 'short' | 'long'

  /** User-facing strings (localizable via `messages`). */
  type CalendarMessages = { label: string; shortcuts: string; today: string; clear: string; prev: string; next: string }
  const DEFAULT_MESSAGES: CalendarMessages = {
    label: 'Calendar', shortcuts: 'Shortcuts', today: 'Today', clear: 'Clear', prev: 'Previous', next: 'Next',
  }

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
    /** Text direction (rtl mirrors layout + flips the nav arrows; auto inherits). */
    dir?: EditorDir
    /** Override the built-in strings (group/shortcut labels, footer buttons). */
    messages?: Partial<CalendarMessages>
    /** Repeat pattern(s): matching days get an indicator + `recurring` day-state. */
    recurrence?: RecurrenceRule | ReadonlyArray<RecurrenceRule> | null
    /** Render rich content inside each day cell (events, dots, badges). Receives
     *  the date + its day-state. Switches the month grid to a taller,
     *  top-aligned layout so there's room for the content. */
    day?: Snippet<[Date, CalendarDayState]>
  }

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
    dir,
    messages,
    recurrence = null,
    day,
  }: Props = $props()

  const M = $derived(resolveMessages(DEFAULT_MESSAGES, messages))
  const resolvedDir = $derived(dir === 'ltr' || dir === 'rtl' ? dir : undefined)
  // With several month panels side by side, leading/trailing days of adjacent
  // months overlap visually, so hide them by default when months > 1.
  const hideOther = $derived(hideOtherMonthDays || months > 1)

  // The headless core owns all reactive state, selection, navigation, keyboard
  // and ARIA. Reactive inputs are passed as getters; callbacks as closures.
  const cal = createCalendar({
    value: () => value,
    onChange: (d) => onChange?.(d),
    onNavigate: (v, m) => onNavigate?.(v, m),
    selectionMode: () => selectionMode,
    min: () => min,
    max: () => max,
    restrictedDates: () => restrictedDates,
    importantDates: () => importantDates,
    firstDayOfWeek: () => firstDayOfWeek,
    weeks: () => weeks,
    months: () => months,
    displayMode: () => displayMode,
    disabled: () => disabled,
    readonly: () => readonly,
    locale: () => locale,
    dayNameFormat: () => dayNameFormat,
    monthNameFormat: () => monthNameFormat,
    dateTooltip: () => dateTooltip,
    recurrence: () => recurrence,
  })

  // --- View-change animation (framework-native Web Animations API) -----------
  // A render concern kept out of the core: we animate a wrapper element instead
  // of re-keying the grid, so day cells stay mounted (keyboard focus +
  // interactivity are preserved). The core exposes `navToken` (bumps on each
  // navigation) + `navDir` (why it changed); an effect replays a short keyframe
  // on the new content.
  const animKind = $derived<CalendarAnimation>(animate === true ? 'slide' : animate || 'none')
  let animEl = $state<HTMLElement | undefined>()
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
    const navDir = cal.navDir
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
    cal.navToken // re-run after each navigation's DOM update
    if (!animPrimed) { animPrimed = true; return }
    untrack(playAnim)
  })

  // Mouse-wheel navigation (opt-in). Non-passive so we can prevent page scroll.
  function wheelNav(node: HTMLElement) {
    const onWheel = (e: WheelEvent) => {
      if (!wheelNavigation || disabled) return
      e.preventDefault()
      cal.step(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1)
    }
    node.addEventListener('wheel', onWheel, { passive: false })
    return { destroy: () => node.removeEventListener('wheel', onWheel) }
  }
</script>

<div
  class="sv-cal"
  class:sv-cal--disabled={disabled}
  class:sv-cal--with-presets={presets && presets.length}
  class:sv-cal--band={selectionMode === 'range' || selectionMode === 'week'}
  class:sv-cal--rich={!!day}
  role="group"
  aria-label={M.label}
  aria-disabled={disabled}
  dir={resolvedDir}
>
  {#if presets && presets.length}
    <div class="sv-cal__presets" role="group" aria-label={M.shortcuts}>
      {#each presets as p, i (i)}
        <button class="sv-cal__preset" {...cal.presetProps(p)}>{p.label}</button>
      {/each}
    </div>
  {/if}

  <div class="sv-cal__main" use:wheelNav>
  <div class="sv-cal__header">
    <button class="sv-cal__nav" {...cal.navProps(-1)}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <button class="sv-cal__title" {...cal.titleProps()}>{cal.title}</button>
    <button class="sv-cal__nav" {...cal.navProps(1)}>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6" /></svg>
    </button>
  </div>

  <div class="sv-cal__view" bind:this={animEl}>
  {#if cal.mode === 'month'}
    <div class="sv-cal__panels" {...cal.gridProps()}>
      {#each cal.panels as panel (panel.month.getTime())}
        <div class="sv-cal__panel">
          {#if months > 1}<div class="sv-cal__panel-title">{panel.title}</div>{/if}
          {#if !hideDayNames}
            <div class="sv-cal__weekdays" role="row">
              {#if weekNumbers}<span class="sv-cal__wk-head" aria-hidden="true">#</span>{/if}
              {#each cal.weekdayHeaders as wh (wh.weekday)}
                <span class="sv-cal__weekday" role="columnheader">{wh.label}</span>
              {/each}
            </div>
          {/if}
          {#each panel.matrix as week, wi (wi)}
            <div class="sv-cal__week" role="row">
              {#if weekNumbers}<span class="sv-cal__wk" aria-hidden="true">{week[0]?.week}</span>{/if}
              {#each week as cell (cell.date.getTime())}
                {@const st = cal.dayState(cell.date, panel.month)}
                {#if st.outside && hideOther}
                  <span class="sv-cal__day sv-cal__day--empty" role="gridcell" aria-hidden="true"></span>
                {:else}
                  <button
                    class="sv-cal__day"
                    class:is-selected={st.selected}
                    class:is-today={st.today}
                    class:is-outside={st.outside}
                    class:is-important={st.important}
                    class:is-preview={st.preview}
                    class:is-focused={st.focused}
                    class:is-recurring={st.recurring}
                    {...cal.dayProps(cell, panel.month)}
                  ><span class="sv-cal__daynum">{cell.date.getDate()}</span>{#if day}<span class="sv-cal__daybody">{@render day(cell.date, st)}</span>{/if}</button>
                {/if}
              {/each}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {:else if cal.mode === 'year'}
    <div class="sv-cal__grid-mode" {...cal.gridProps()}>
      {#each cal.yearCells as yc (yc.index)}
        <button
          class="sv-cal__cell"
          class:is-today={yc.current}
          class:is-selected={yc.selected}
          {...cal.monthCellProps(yc.index)}
        >{yc.label}</button>
      {/each}
    </div>
  {:else}
    <div class="sv-cal__grid-mode" {...cal.gridProps()}>
      {#each cal.decadeCells as dc (dc.year)}
        <button
          class="sv-cal__cell"
          class:is-outside={dc.outside}
          class:is-today={dc.current}
          class:is-selected={dc.selected}
          {...cal.yearCellProps(dc.year)}
        >{dc.year}</button>
      {/each}
    </div>
  {/if}
  </div>

  {#if footer}
    <div class="sv-cal__footer">
      <button type="button" class="sv-cal__foot-btn" onclick={cal.goToday} disabled={disabled}>{M.today}</button>
      {#if cal.canClear}
        <button type="button" class="sv-cal__foot-btn" onclick={cal.clearSelection} disabled={disabled}>{M.clear}</button>
      {/if}
    </div>
  {/if}
  </div>

  {#if name}<input type="hidden" {name} value={cal.selectedDates.map((d) => d.toISOString()).join(',')} />{/if}
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
    padding-inline-end: 10px; border-inline-end: 1px solid var(--_border);
    min-width: 118px; align-self: stretch;
  }
  .sv-cal__preset {
    text-align: start; padding: 6px 10px; font: inherit; font-size: 12px; font-weight: 550;
    background: none; border: 0; border-radius: var(--_radius); color: inherit; cursor: pointer; white-space: nowrap;
  }
  /* Under RTL the prev/next chevron glyphs must point the other way. */
  .sv-cal[dir='rtl'] .sv-cal__nav svg { transform: scaleX(-1); }
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
  /* Repeat-pattern indicator: a small ring in the top-inline-end corner
     (distinct from the is-important bottom dot). */
  .sv-cal__day.is-recurring::before {
    content: ''; position: absolute; top: 4px; inset-inline-end: 4px;
    width: 5px; height: 5px; border-radius: 50%; pointer-events: none;
    border: 1.5px solid color-mix(in srgb, var(--_accent) 75%, transparent);
  }
  .sv-cal:not(.sv-cal--rich) .sv-cal__day.is-selected.is-recurring::before { border-color: var(--sg-on-accent, #fff); }

  /* --- Rich month grid: enabled by a `day` snippet. Cells fill the column width
     and become taller / top-aligned so the snippet content (events, badges) has
     room - turning the picker into an event-calendar surface. --- */
  .sv-cal--rich .sv-cal__weekdays, .sv-cal--rich .sv-cal__week { grid-template-columns: repeat(7, minmax(0, 1fr)); }
  .sv-cal--rich .sv-cal__weekdays:has(.sv-cal__wk-head), .sv-cal--rich .sv-cal__week:has(.sv-cal__wk) { grid-template-columns: 26px repeat(7, minmax(0, 1fr)); }
  .sv-cal--rich .sv-cal__weekday { justify-items: start; padding-inline-start: 6px; }
  .sv-cal--rich .sv-cal__day {
    width: auto; height: auto; min-height: 90px; display: flex; flex-direction: column;
    align-items: stretch; gap: 3px; padding: 4px 5px 6px; text-align: start; border-radius: 8px;
  }
  .sv-cal--rich .sv-cal__day.is-today { box-shadow: none; }
  .sv-cal--rich .sv-cal__day.is-selected { background: color-mix(in srgb, var(--_accent) 9%, transparent); color: inherit; }
  .sv-cal--rich .sv-cal__daynum {
    align-self: flex-start; flex: none; width: 24px; height: 24px; display: grid; place-items: center;
    border-radius: 50%; font-size: 12.5px; font-weight: 600;
  }
  .sv-cal--rich .sv-cal__day.is-today .sv-cal__daynum { background: var(--_accent); color: var(--sg-on-accent, #fff); }
  .sv-cal--rich .sv-cal__daybody { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; overflow: hidden; }
  .sv-cal--rich .sv-cal__day.is-important::after { display: none; }
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
