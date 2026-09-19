<!--
  The spreadsheet shell behind <sv-sheet>.

  Everything the element exposes is generated from `<SvSheet>`'s own Props
  type (scripts/generate-sheet-surface.mjs). This is what turns the
  element's flat surface back into the component: the callbacks become
  CustomEvents, `ready` parks the api and the document on the host so a
  listener bound later still reaches them, and the component's methods are
  mirrored onto the host, so `el.getState()` and `el.act('sort-asc')` work
  from any host.
-->
<script>
  import SvSheet from '../SvSheet.svelte'
  import { ELEMENT_EVENTS, ELEMENT_METHODS } from './surface-sheet.generated.js'

  let { emit, host, ...rest } = $props()

  let sheet = $state(null)
  /**
   * The document `ready` parks on the host.
   *
   * `document` is one of the element's props, so parking it there comes
   * straight back in AS a prop: the element would read its own answer as
   * content the host supplied, and a host that assigns `data` afterwards
   * would be ignored for good. The document is marked rather than compared
   * by identity, since what comes back through the element's props is a
   * proxy of the object that went out.
   */
  const PARKED = Symbol.for('svgrid.sheet.parked')
  let parked = $state(0)

  const callbacks = $derived.by(function callbacks() {
    const out = {}
    for (const { callback, event, params } of ELEMENT_EVENTS) {
      out[callback] = (...args) => {
        const detail = args.length > 1 ? Object.fromEntries(params.map((p, i) => [p, args[i]])) : args[0]
        if (callback === 'onReady' && host) {
          host.api = args[0]
          if (args[1]) args[1][PARKED] = true
          parked += 1
          host.document = args[1]
        }
        // The one callback whose answer matters: a listener that called
        // preventDefault() has taken the action over.
        const prevented = emit(event, detail, callback === 'onAction')
        return callback === 'onAction' ? prevented || undefined : undefined
      }
    }
    return out
  })

  // An element can render before its host assigns a document: an empty sheet
  // then, rather than a throw. `height` arrives as a string from an
  // attribute; a number in a string is the number.
  const given = $derived.by(() => {
    void parked
    return rest.document && !rest.document[PARKED] ? rest.document : undefined
  })
  const data = $derived(rest.data ?? (rest.workbook || given ? undefined : [{ name: 'Sheet1', cells: [] }]))
  const height = $derived(typeof rest.height === 'string' && /^\d+(\.\d+)?$/.test(rest.height) ? Number(rest.height) : rest.height)

  // The component's methods on the element. Bound once the component is
  // mounted, and read through the binding each call so a remount is followed.
  $effect(() => {
    if (!host || !sheet) return
    for (const name of ELEMENT_METHODS) host[name] = (...args) => sheet?.[name]?.(...args)
  })

  /**
   * Content that arrives after the element is already on the page.
   *
   * A custom element is upgraded the moment its definition loads, which on
   * a plain page is BEFORE the script that assigns its properties runs: the
   * element tag, then the module that defines it, then the module that says
   * `sheet.data = [...]`, which is the order the quick start in the docs
   * puts them in.
   *
   * The shell has mounted on the empty sheet by then, and the component
   * reads its document once on purpose, so the assignment would show
   * nothing. The shell is remounted on it instead.
   *
   * Only while nothing has been done to it: a host that re-assigns the same
   * prop later (a React render passing a fresh array, a Vue reactive
   * object) must not throw away what someone has typed. After the first
   * cell is written, a later assignment is ignored, which is what reading
   * the document once means everywhere else.
   */
  let mountKey = $state(0)
  let lastInput = rest.document ?? rest.workbook ?? rest.data ?? null

  function untouched() {
    const state = sheet?.getState?.()
    if (!state) return true
    const sheets = state.workbook?.sheets ?? []
    if (sheets.length !== 1) return false
    const only = sheets[0]
    if (only.name !== 'Sheet1') return false
    if ((only.cells ?? []).some((row) => (row ?? []).some((cell) => (cell ?? '') !== ''))) return false
    const entry = state.sheets?.[only.name]
    if (!entry) return true
    const drawn = entry.merges?.length || entry.objects?.length || entry.sparklines?.length
      || entry.pivots?.length || Object.keys(entry.links ?? {}).length || Object.keys(entry.formats ?? {}).length
    return !drawn
  }

  $effect(() => {
    // Both are read before anything returns, so the effect runs again when
    // the shell binds as well as when the prop lands.
    const input = given ?? rest.workbook ?? rest.data ?? null
    const shell = sheet
    console.log('[probe2] parked=' + !!parked + ' same=' + (rest.document === parked) + ' wb=' + (!!parked && rest.document?.workbook === parked?.workbook) + ' dataLen=' + ((rest.data ?? []).length) + ' docType=' + (typeof rest.document))
    if (!shell || input === null || input === lastInput) return
    lastInput = input
    if (!untouched()) return
    mountKey += 1
  })
</script>

<!--
  `{...rest}` is spread directly, not rebuilt into a filtered object: a prop
  that was undefined at mount must still be tracked when the host sets it
  later. `data` is defaulted so an element rendered before its host assigns
  a document opens on an empty sheet rather than throwing.
-->
<div style="display: block; min-width: 0;">
  {#key mountKey}
    <SvSheet bind:this={sheet} {...rest} document={given} data={data} height={height} {...callbacks} />
  {/key}
</div>
