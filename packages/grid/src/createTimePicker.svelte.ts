/**
 * createTimePicker - the HEADLESS core behind <SvTimePicker>: a runes-based
 * state machine for an analog clock-dial time picker (12/24-hour, minute
 * snapping, hour->minute auto-switch, keyboard) plus the pure dial geometry
 * (tick coordinates + hand endpoint) and **prop-getters** you spread onto YOUR
 * OWN markup. The DOM-bound pieces - pointer capture + `getBoundingClientRect`
 * hit-testing - stay in the styled component; this core exposes `SIZE`/`C` and a
 * pure `pointerSelect(angle, dist)` so the component only has to convert an event
 * into an angle.
 *
 * ```svelte
 * <script lang="ts">
 *   import { createTimePicker } from '@svgrid/grid'
 *   let value = $state<Date | null>(new Date())
 *   const tp = createTimePicker({ value: () => value, onChange: (d) => (value = d) })
 * </script>
 * <button {...tp.segProps('hour')}>{tp.displayHour}</button>:<button {...tp.segProps('minute')}>{tp.mm}</button>
 * ```
 */
export type TimeValue = Date | string | number | null

export type TimeSelection = 'hour' | 'minute'
export type TimeFormat = '12-hour' | '24-hour'

/** A clock-face number and its computed position on the dial. */
export type DialTick = { label: string; x: number; y: number; value: number; ring: 'outer' | 'inner' }

/** Reactive inputs are getters; callbacks are closures. */
export type TimePickerConfig = {
  /** Date, "HH:MM[:SS]" string, or epoch ms. */
  value: () => TimeValue
  /** Fires with a Date (today's date carrying the picked time). */
  onChange?: (value: Date) => void
  format?: () => TimeFormat
  minuteInterval?: () => number
  /** After picking an hour, jump the dial to minutes. Default true. */
  autoSwitchToMinutes?: () => boolean
  disabled?: () => boolean
  readonly?: () => boolean
  /** Which dial opens first. */
  selection?: () => TimeSelection
}

// --- Dial geometry (pure) -----------------------------------------------------
const SIZE = 240
const C = SIZE / 2
const OUTER = C - 22
const INNER = C - 58

function pointAt(angleDeg: number, r: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
}

/** Parse a time value to { h, m }, falling back to "now" (pure). */
export function parseTimeValue(v: TimeValue): { h: number; m: number } {
  if (v == null) { const n = new Date(); return { h: n.getHours(), m: n.getMinutes() } }
  if (typeof v === 'string') {
    const mt = v.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/)
    if (mt) return { h: Math.min(23, +mt[1]!), m: Math.min(59, +mt[2]!) }
    const d = new Date(v)
    if (!isNaN(d.getTime())) return { h: d.getHours(), m: d.getMinutes() }
    const n = new Date(); return { h: n.getHours(), m: n.getMinutes() }
  }
  const d = new Date(v)
  return { h: d.getHours(), m: d.getMinutes() }
}

export function createTimePicker(config: TimePickerConfig) {
  const format = () => config.format?.() ?? '24-hour'
  const minuteInterval = () => config.minuteInterval?.() ?? 1
  const autoSwitchToMinutes = () => config.autoSwitchToMinutes?.() ?? true
  const isDisabled = () => config.disabled?.() ?? false
  const isReadonly = () => config.readonly?.() ?? false

  const is12 = $derived(format() === '12-hour')
  const isInteractive = $derived(!isDisabled() && !isReadonly())

  let hours = $state(0)
  let minutes = $state(0)
  let sel = $state<TimeSelection>('hour')
  let seeded = false
  let lastKey = '￿'
  $effect(() => {
    const { h, m } = parseTimeValue(config.value())
    const key = `${h}:${m}`
    if (key !== lastKey) {
      lastKey = key
      hours = h
      minutes = m
      if (!seeded) { seeded = true; sel = config.selection?.() ?? 'hour' }
    }
  })

  const displayHour = $derived(is12 ? (hours % 12 === 0 ? 12 : hours % 12) : hours)
  const isPm = $derived(hours >= 12)
  const mm = $derived(String(minutes).padStart(2, '0'))

  const hourTicks = $derived.by<DialTick[]>(() => {
    const ticks: DialTick[] = []
    if (is12) {
      for (let i = 0; i < 12; i++) {
        const h = i === 0 ? 12 : i
        const p = pointAt(i * 30, OUTER)
        ticks.push({ label: String(h), x: p.x, y: p.y, value: h, ring: 'outer' })
      }
    } else {
      for (let i = 0; i < 12; i++) {
        const outer = pointAt(i * 30, OUTER) // 12..23
        const inner = pointAt(i * 30, INNER) // 00..11
        const ho = i + 12
        const hi = i
        ticks.push({ label: String(ho).padStart(2, '0'), x: outer.x, y: outer.y, value: ho, ring: 'outer' })
        ticks.push({ label: hi === 0 ? '00' : String(hi).padStart(2, '0'), x: inner.x, y: inner.y, value: hi, ring: 'inner' })
      }
    }
    return ticks
  })

  const minuteTicks = $derived.by<DialTick[]>(() =>
    Array.from({ length: 12 }, (_, i) => {
      const v = i * 5
      const p = pointAt(i * 30, OUTER)
      return { label: String(v).padStart(2, '0'), x: p.x, y: p.y, value: v, ring: 'outer' as const }
    }),
  )

  // Hand endpoint for the current selection.
  const handAngle = $derived(
    sel === 'hour' ? (is12 ? (displayHour % 12) * 30 : (hours % 12) * 30) : minutes * 6,
  )
  const handRadius = $derived(sel === 'hour' && !is12 && hours % 12 === hours && hours < 12 ? INNER : OUTER)
  const handEnd = $derived(pointAt(handAngle, handRadius))

  // --- Emit + mutators -------------------------------------------------------
  function emit() {
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    config.onChange?.(d)
  }

  const snap = (m: number) => {
    const step = Math.max(1, Math.floor(minuteInterval()))
    return (Math.round(m / step) * step) % 60
  }

  function setSelection(s: TimeSelection) { sel = s }

  function setMinute(m: number) {
    minutes = snap(m)
    lastKey = `${hours}:${minutes}`
    emit()
  }

  function setAmPm(pm: boolean) {
    if (pm === isPm) return
    hours = pm ? (hours % 12) + 12 : hours % 12
    lastKey = `${hours}:${minutes}`
    emit()
  }

  /** Apply a dial angle (0..360, 12 o'clock = 0) + distance from center. The
   *  styled component converts a pointer event into these via the DOM rect. */
  function pointerSelect(angle: number, dist: number) {
    if (!isInteractive) return
    if (sel === 'hour') {
      const idx = Math.round(angle / 30) % 12
      if (is12) {
        const h = idx === 0 ? 12 : idx
        const base = h % 12
        hours = isPm ? base + 12 : base
      } else {
        const inner = dist < (OUTER + INNER) / 2
        hours = inner ? idx : idx + 12
      }
      lastKey = `${hours}:${minutes}`
      emit()
    } else {
      const m = Math.round(angle / 6) % 60
      setMinute(m)
    }
  }

  /** Called on pointer-up: auto-advance hour -> minute when configured. */
  function endPointer() {
    if (sel === 'hour' && autoSwitchToMinutes()) sel = 'minute'
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isInteractive) return
    const step = sel === 'minute' ? Math.max(1, Math.floor(minuteInterval())) : 1
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (sel === 'hour') { hours = (hours + 1) % 24 } else { minutes = (minutes + step) % 60 }
      lastKey = `${hours}:${minutes}`; emit()
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      if (sel === 'hour') { hours = (hours + 23) % 24 } else { minutes = (minutes - step + 60) % 60 }
      lastKey = `${hours}:${minutes}`; emit()
    } else if (e.key === 'Tab' && !e.shiftKey && sel === 'hour') {
      sel = 'minute'
    }
  }

  function now() {
    const n = new Date()
    hours = n.getHours(); minutes = n.getMinutes()
    lastKey = `${hours}:${minutes}`
    emit()
  }

  function isActiveHour(t: DialTick): boolean {
    if (is12) return t.value === displayHour
    return t.value === hours
  }

  return {
    // Dial geometry constants (the component needs these to map a pointer event
    // to an angle without re-deriving the layout).
    SIZE,
    C,

    // --- Reactive state -------------------------------------------------------
    get hours() { return hours },
    get minutes() { return minutes },
    get selection() { return sel },
    get is12() { return is12 },
    get isInteractive() { return isInteractive },
    get displayHour() { return displayHour },
    get isPm() { return isPm },
    get mm() { return mm },
    get hourTicks() { return hourTicks },
    get minuteTicks() { return minuteTicks },
    get handEnd() { return handEnd },

    // --- Derived helpers ------------------------------------------------------
    isActiveHour,

    // --- Actions --------------------------------------------------------------
    setSelection,
    setMinute,
    setAmPm,
    pointerSelect,
    endPointer,
    onKeydown,
    now,

    // --- Prop-getters ---------------------------------------------------------
    /** The hour / minute segment button in the header. */
    segProps(which: TimeSelection) {
      return {
        type: 'button' as const,
        disabled: isDisabled(),
        onclick: () => setSelection(which),
      }
    },
    /** An AM / PM toggle button (12-hour mode). */
    ampmProps(pm: boolean) {
      return {
        type: 'button' as const,
        disabled: isDisabled(),
        onclick: () => setAmPm(pm),
      }
    },
    /** The clock dial: ARIA slider semantics + keyboard. Pointer capture stays in
     *  the component (it needs the DOM element). */
    dialProps() {
      return {
        role: 'slider' as const,
        tabindex: isDisabled() ? -1 : 0,
        'aria-label': sel === 'hour' ? 'Hour' : 'Minute',
        'aria-valuenow': sel === 'hour' ? hours : minutes,
        'aria-valuemin': 0,
        'aria-valuemax': sel === 'hour' ? 23 : 59,
        onkeydown: onKeydown,
      }
    },
    /** The Now footer button. */
    nowProps() {
      return {
        type: 'button' as const,
        disabled: isDisabled(),
        onclick: now,
      }
    },
  }
}

export type TimePicker = ReturnType<typeof createTimePicker>
