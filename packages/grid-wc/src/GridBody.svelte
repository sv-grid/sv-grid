<!--
  The grid itself, shared by <sv-grid> and <sv-grid-shadow>.

  `customElement.shadow` is a COMPILE-TIME option in Svelte, so there is no
  attribute that can switch one element between light and shadow DOM - they have
  to be two elements, and this holds the part that is identical between them.

  Everything the elements expose is generated from `<SvGrid>`'s own Props type
  (scripts/generate-surface.mjs). Before that, the elements declared seven props
  and two events by hand, so grouping, pagination, pinning, tree data and every
  enterprise feature were unreachable from a non-Svelte host.
-->
<script>
  import { SvGrid, rowSelectionFeature } from '@svgrid/grid'
  import { ELEMENT_EVENTS, LEGACY_EVENTS } from './surface.generated.js'

  let { emit, host, ...rest } = $props()

  /**
   * `selectable` means something DIFFERENT here than it does on <SvGrid>.
   *
   * `<sv-grid selectable>` shipped in 2.6.2 meaning row-selection checkboxes.
   * `<SvGrid selectable>` is an alias of `enableCellSelection` - a different
   * feature entirely. Forwarding the attribute straight through would silently
   * repoint it, so the element keeps its published meaning and cell selection
   * stays reachable under its real name, `enable-cell-selection`.
   *
   * Row selection also needs its feature injected: <SvGrid> auto-injects for
   * `sortable` / `filterable` / `groupable` (see features.ts), but there is no
   * shortcut for row selection.
   */
  const features = $derived(
    rest.selectable ? { ...(rest.features ?? {}), rowSelectionFeature } : rest.features,
  )

  /**
   * Every callback re-emitted as a DOM CustomEvent.
   *
   * `detail` is the callback's single argument, or - for the one callback that
   * takes two - an object keyed by its parameter names, so a host reads
   * `e.detail.selection` rather than counting positions.
   */
  const callbacks = $derived.by(function callbacks() {
    const out = {}
    for (const { callback, event, params } of ELEMENT_EVENTS) {
      out[callback] = (...args) => {
        // onApiReady hands over the imperative handle. Park it on the element
        // as well as emitting it: an event fires once, and a host that binds a
        // listener later would otherwise never reach the api at all.
        if (callback === 'onApiReady' && host) host.api = args[0]

        // Events published before the generic rule existed keep the exact
        // `detail` their consumers already read.
        const legacies = LEGACY_EVENTS.filter((l) => l.callback === callback)

        // When a legacy event has the SAME NAME as the generated one - which
        // `rowclick` does - the legacy payload wins and the generic must not
        // also fire. Emitting both sent two events per click carrying different
        // details, and whichever a listener saw first was luck.
        if (!legacies.some((l) => l.event === event))
          emit(event, args.length > 1 ? Object.fromEntries(params.map((p, i) => [p, args[i]])) : args[0])

        for (const legacy of legacies) {
          const i = params.indexOf(legacy.pick)
          emit(legacy.event, i >= 0 && args.length > 1 ? args[i] : args[0]?.[legacy.pick])
        }
      }
    }
    return out
  })
</script>

<!--
  `data` and `columns` are defaulted because an element can render BEFORE a
  consumer assigns them. React and Angular both set properties in an effect,
  which runs after the element has already mounted and rendered once - and the
  grid throws on undefined columns. The elements used to default them in their
  own destructuring; generating the props replaced that with a bare $props(),
  and only a framework wrapper was late enough to notice.

  `{...rest}` is spread DIRECTLY, not rebuilt into a filtered object first.
  Rebuilding it - `Object.entries(rest)` into a fresh `$derived` - drops every
  prop that was undefined when the element mounted, which is most of them: a
  host sets `el.showRowNumbers = true` later and nothing happens, because the
  key was never enumerated and so was never tracked. `rowHeight` appeared to
  work only because it is also passed explicitly below.

  `selectable` is then neutralised with an explicit `undefined`, because it is
  this element's own prop and means something else on <SvGrid>. Order matters:
  the explicit attributes below must follow the spread to win.
-->
<div style="height: 100%; min-height: 320px;">
  <SvGrid
    {...rest}
    selectable={undefined}
    {features}
    data={rest.data ?? []}
    columns={rest.columns ?? []}
    showRowSelection={rest.showRowSelection ?? rest.selectable}
    sortable={rest.sortable ?? true}
    filterable={rest.filterable ?? true}
    filterMode={rest.filterMode ?? 'menu'}
    selectionMode={rest.selectionMode ?? 'row'}
    rowHeight={rest.rowHeight ?? 36}
    containerHeight={rest.containerHeight ?? '100%'}
    fitColumns={rest.fitColumns ?? true}
    {...callbacks}
  />
</div>
