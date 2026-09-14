<!--
  The chart behind <sv-chart>.

  Everything the element exposes is generated from `SvChart`'s own props type
  (scripts/generate-surface.mjs), the same way <sv-grid> is generated from
  `<SvGrid>`'s. The body is what turns the element's flat surface back into
  the component: callbacks become CustomEvents, the bindable props (zoom,
  selected, drillPath) are written back onto the host so a listener can read
  them after the event, and the string attributes that also mean a boolean
  ("" / "true" / "false") are coerced.
-->
<script>
  import { SvChart } from '@svgrid/grid'
  import { ELEMENT_EVENTS, ELEMENT_PROPS } from './surface-chart.generated.js'

  let { emit, host, ...rest } = $props()

  /**
   * Props whose attribute is a String but whose prop also takes a boolean:
   * `legend="right"` has to arrive as the string, `legend` (bare) as true and
   * `legend="false"` as false. The generator marks them String so the value
   * survives; this puts the booleans back.
   */
  const MIXED = new Set(
    ELEMENT_PROPS.filter((p) => p.type === 'String' && /\bboolean\b/.test(p.ts)).map((p) => p.name),
  )
  const coerce = (value) => {
    if (typeof value !== 'string') return value
    if (value === '' || value === 'true') return true
    if (value === 'false') return false
    return value
  }
  // Only the mixed props are rebuilt, and each is read by NAME. Rebuilding the
  // whole of `rest` from Object.entries would drop every prop that was
  // undefined at mount (a key never enumerated is never tracked), which is the
  // trap GridBody documents; the spread below keeps the rest live.
  const mixed = $derived(Object.fromEntries([...MIXED].map((name) => [name, coerce(rest[name])])))

  /**
   * Every callback re-emitted as a DOM CustomEvent. `detail` is the callback's
   * single argument. The bindable props (`zoom`, `selected`, `drillPath`) are
   * mirrored onto the host by `onZoom` / `onSelectionChange` / the drill click
   * so `el.zoom` reads the current window after a `zoom` event.
   */
  const callbacks = $derived.by(function callbacks() {
    const out = {}
    for (const { callback, event, params } of ELEMENT_EVENTS) {
      out[callback] = (...args) => {
        if (host) {
          if (callback === 'onZoom') host.zoom = args[0]
          if (callback === 'onSelectionChange') host.selected = args[0]
          if (callback === 'onDrawingsChange') host.drawings = args[0]
        }
        emit(event, args.length > 1 ? Object.fromEntries(params.map((p, i) => [p, args[i]])) : args[0])
      }
    }
    return out
  })
</script>

<!--
  `spec` is defaulted because an element can render BEFORE a consumer assigns
  it (React and Angular set properties in an effect, after the first render),
  and an empty spec draws an empty frame rather than throwing.
-->
<div style="display: block; min-width: 0;">
  <SvChart
    {...rest}
    {...mixed}
    spec={rest.spec ?? { type: 'bar', categories: [], series: [] }}
    {...callbacks}
  />
</div>
