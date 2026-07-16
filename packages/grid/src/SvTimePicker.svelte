<script lang="ts" module>
  export type TimeValue = Date | string | number | null
</script>

<script lang="ts">
  /**
   * SvTimePicker - an analog clock-dial time picker (parity: Smart
   * `smart-time-picker`). 12/24-hour, minute snapping, hour->minute auto-switch,
   * pointer-drag + keyboard. Works standalone and as the SvGrid `time` editor.
   * All visuals come from `--sg-*` tokens so every theme applies for free.
   */
  type Props = {
    /** Date, "HH:MM[:SS]" string, or epoch ms. */
    value?: TimeValue
    /** Fires with a Date (today's date carrying the picked time). */
    onChange?: (value: Date) => void
    format?: '12-hour' | '24-hour'
    minuteInterval?: number
    /** After picking an hour, jump the dial to minutes. Default true. */
    autoSwitchToMinutes?: boolean
    /** Show the Now footer button. */
    footer?: boolean
    disabled?: boolean
    readonly?: boolean
    name?: string
    /** Which dial opens first. */
    selection?: 'hour' | 'minute'
  }

  let {
    value = null,
    onChange,
    format = '24-hour',
    minuteInterval = 1,
    autoSwitchToMinutes = true,
    footer = false,
    disabled = false,
    readonly = false,
    name,
    selection = 'hour',
  }: Props = $props()

  const is12 = $derived(format === '12-hour')
  const isInteractive = $derived(!disabled && !readonly)

  function parseValue(v: TimeValue): { h: number; m: number } {
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

  let hours = $state(0)
  let minutes = $state(0)
  let sel = $state<'hour' | 'minute'>('hour')
  let seeded = false
  let lastKey = '￿'
  $effect(() => {
    const { h, m } = parseValue(value)
    const key = `${h}:${m}`
    if (key !== lastKey) {
      lastKey = key
      hours = h
      minutes = m
      if (!seeded) { seeded = true; sel = selection }
    }
  })

  const displayHour = $derived(is12 ? (hours % 12 === 0 ? 12 : hours % 12) : hours)
  const isPm = $derived(hours >= 12)
  const mm = $derived(String(minutes).padStart(2, '0'))

  // --- Dial geometry ---
  const SIZE = 240
  const C = SIZE / 2
  const OUTER = C - 22
  const INNER = C - 58

  function pointAt(angleDeg: number, r: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180
    return { x: C + r * Math.cos(rad), y: C + r * Math.sin(rad) }
  }

  type Tick = { label: string; x: number; y: number; value: number; ring: 'outer' | 'inner' }

  const hourTicks = $derived.by<Tick[]>(() => {
    const ticks: Tick[] = []
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

  const minuteTicks = $derived.by<Tick[]>(() =>
    Array.from({ length: 12 }, (_, i) => {
      const v = i * 5
      const p = pointAt(i * 30, OUTER)
      return { label: String(v).padStart(2, '0'), x: p.x, y: p.y, value: v, ring: 'outer' as const }
    }),
  )

  // Hand endpoint for the current selection.
  const handAngle = $derived(
    sel === 'hour'
      ? (is12 ? (displayHour % 12) * 30 : (hours % 12) * 30)
      : minutes * 6,
  )
  const handRadius = $derived(sel === 'hour' && !is12 && hours % 12 === hours && hours < 12 ? INNER : OUTER)
  const handEnd = $derived(pointAt(handAngle, handRadius))

  // --- Emit ---
  function emit() {
    const d = new Date()
    d.setHours(hours, minutes, 0, 0)
    onChange?.(d)
  }

  function setHourFromDisplay(h12OrH: number, ring: 'outer' | 'inner') {
    if (is12) {
      // Preserve AM/PM.
      const base = h12OrH % 12
      hours = isPm ? base + 12 : base
    } else {
      hours = ring === 'inner' ? h12OrH : h12OrH
    }
    lastKey = `${hours}:${minutes}`
    emit()
    if (autoSwitchToMinutes) sel = 'minute'
  }

  function snap(m: number) {
    const step = Math.max(1, Math.floor(minuteInterval))
    return (Math.round(m / step) * step) % 60
  }

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

  // --- Pointer drag on the dial ---
  let dialEl: SVGSVGElement | null = null
  let dragging = false

  function angleFromEvent(e: PointerEvent): { angle: number; dist: number } {
    const rect = dialEl!.getBoundingClientRect()
    const scale = SIZE / rect.width
    const x = (e.clientX - rect.left) * scale - C
    const y = (e.clientY - rect.top) * scale - C
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90
    if (deg < 0) deg += 360
    return { angle: deg, dist: Math.hypot(x, y) }
  }

  function applyPointer(e: PointerEvent) {
    if (!isInteractive) return
    const { angle, dist } = angleFromEvent(e)
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

  function onDialPointerDown(e: PointerEvent) {
    if (!isInteractive) return
    dragging = true
    dialEl?.setPointerCapture(e.pointerId)
    applyPointer(e)
  }
  function onDialPointerMove(e: PointerEvent) {
    if (dragging) applyPointer(e)
  }
  function onDialPointerUp(e: PointerEvent) {
    if (!dragging) return
    dragging = false
    dialEl?.releasePointerCapture(e.pointerId)
    if (sel === 'hour' && autoSwitchToMinutes) sel = 'minute'
  }

  function onKeydown(e: KeyboardEvent) {
    if (!isInteractive) return
    const step = sel === 'minute' ? Math.max(1, Math.floor(minuteInterval)) : 1
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

  function isActiveHour(t: Tick): boolean {
    if (is12) return t.value === displayHour
    return t.value === hours
  }
</script>

<div class="sv-tp" class:sv-tp--disabled={disabled} role="group" aria-label="Time picker">
  <div class="sv-tp__head">
    <button type="button" class="sv-tp__seg" class:is-active={sel === 'hour'} onclick={() => (sel = 'hour')} disabled={disabled}>
      {String(displayHour).padStart(2, '0')}
    </button>
    <span class="sv-tp__colon">:</span>
    <button type="button" class="sv-tp__seg" class:is-active={sel === 'minute'} onclick={() => (sel = 'minute')} disabled={disabled}>
      {mm}
    </button>
    {#if is12}
      <div class="sv-tp__ampm">
        <button type="button" class:is-active={!isPm} onclick={() => setAmPm(false)} disabled={disabled}>AM</button>
        <button type="button" class:is-active={isPm} onclick={() => setAmPm(true)} disabled={disabled}>PM</button>
      </div>
    {/if}
  </div>

  <svg
    bind:this={dialEl}
    class="sv-tp__dial"
    viewBox={`0 0 ${SIZE} ${SIZE}`}
    width="100%"
    role="slider"
    tabindex={disabled ? -1 : 0}
    aria-label={sel === 'hour' ? 'Hour' : 'Minute'}
    aria-valuenow={sel === 'hour' ? hours : minutes}
    aria-valuemin="0"
    aria-valuemax={sel === 'hour' ? 23 : 59}
    onpointerdown={onDialPointerDown}
    onpointermove={onDialPointerMove}
    onpointerup={onDialPointerUp}
    onpointercancel={onDialPointerUp}
    onkeydown={onKeydown}
  >
    <circle class="sv-tp__face" cx={C} cy={C} r={C - 4} />
    <!-- hand -->
    <line class="sv-tp__hand" x1={C} y1={C} x2={handEnd.x} y2={handEnd.y} />
    <circle class="sv-tp__hub" cx={C} cy={C} r="3" />
    <circle class="sv-tp__knob" cx={handEnd.x} cy={handEnd.y} r="15" />
    {#if sel === 'hour'}
      {#each hourTicks as t (t.ring + '-' + t.value)}
        <text class="sv-tp__num" class:is-active={isActiveHour(t)} class:is-inner={t.ring === 'inner'} x={t.x} y={t.y} dominant-baseline="central" text-anchor="middle">{t.label}</text>
      {/each}
    {:else}
      {#each minuteTicks as t (t.value)}
        <text class="sv-tp__num" class:is-active={t.value === minutes} x={t.x} y={t.y} dominant-baseline="central" text-anchor="middle">{t.label}</text>
      {/each}
    {/if}
  </svg>

  {#if footer}
    <div class="sv-tp__footer">
      <button type="button" class="sv-tp__now" onclick={now} disabled={disabled}>Now</button>
    </div>
  {/if}

  {#if name}<input type="hidden" {name} value={`${String(hours).padStart(2, '0')}:${mm}`} />{/if}
</div>

<style>
  .sv-tp {
    --_accent: var(--sg-accent, #2563eb);
    --_bg: var(--sg-bg, #fff);
    --_fg: var(--sg-fg, #0f172a);
    --_muted: var(--sg-muted, #64748b);
    --_border: var(--sg-border, #e2e8f0);
    --_face: var(--sg-header-bg, #f1f5f9);
    --_radius: var(--sg-radius, 8px);
    display: inline-flex; flex-direction: column; gap: 10px; align-items: center;
    width: 260px; padding: 12px;
    background: var(--_bg); color: var(--_fg);
    border: 1px solid var(--_border); border-radius: calc(var(--_radius) + 4px);
    user-select: none;
  }
  .sv-tp--disabled { opacity: 0.55; pointer-events: none; }

  .sv-tp__head { display: flex; align-items: center; gap: 2px; font-variant-numeric: tabular-nums; }
  .sv-tp__seg {
    font-size: 30px; font-weight: 700; line-height: 1;
    background: none; border: 0; color: var(--_muted); cursor: pointer;
    padding: 2px 6px; border-radius: var(--_radius);
  }
  .sv-tp__seg.is-active { color: var(--_accent); background: color-mix(in srgb, var(--_accent) 12%, transparent); }
  .sv-tp__colon { font-size: 28px; font-weight: 700; color: var(--_muted); }
  .sv-tp__ampm { display: flex; flex-direction: column; margin-left: 8px; gap: 2px; }
  .sv-tp__ampm button {
    font-size: 11px; font-weight: 700; padding: 3px 8px;
    background: none; border: 1px solid var(--_border); border-radius: 6px; color: var(--_muted); cursor: pointer;
  }
  .sv-tp__ampm button.is-active { background: var(--_accent); color: var(--sg-on-accent, #fff); border-color: var(--_accent); }

  .sv-tp__dial { touch-action: none; cursor: pointer; outline: none; display: block; width: 100%; height: auto; aspect-ratio: 1; }
  .sv-tp__dial:focus-visible { outline: 2px solid var(--sg-focus-ring, var(--_accent)); outline-offset: 2px; border-radius: 50%; }
  .sv-tp__face { fill: var(--_face); }
  .sv-tp__hand { stroke: var(--_accent); stroke-width: 2; }
  .sv-tp__hub { fill: var(--_accent); }
  .sv-tp__knob { fill: var(--_accent); opacity: 0.9; }
  .sv-tp__num {
    font-size: 13px; fill: var(--_fg); pointer-events: none;
    font-family: inherit;
  }
  .sv-tp__num.is-inner { font-size: 11px; fill: var(--_muted); }
  .sv-tp__num.is-active { fill: var(--sg-on-accent, #fff); font-weight: 700; }

  .sv-tp__footer { width: 100%; display: flex; justify-content: center; border-top: 1px solid var(--_border); padding-top: 8px; }
  .sv-tp__now {
    padding: 5px 14px; font: inherit; font-size: 12px; font-weight: 600;
    background: none; border: 1px solid var(--_border); border-radius: var(--_radius);
    color: var(--_accent); cursor: pointer;
  }
  .sv-tp__now:hover { background: color-mix(in srgb, var(--_accent) 10%, transparent); }
</style>
