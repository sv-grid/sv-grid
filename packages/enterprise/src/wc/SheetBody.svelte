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

  const callbacks = $derived.by(function callbacks() {
    const out = {}
    for (const { callback, event, params } of ELEMENT_EVENTS) {
      out[callback] = (...args) => {
        const detail = args.length > 1 ? Object.fromEntries(params.map((p, i) => [p, args[i]])) : args[0]
        if (callback === 'onReady' && host) {
          host.api = args[0]
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
  const data = $derived(rest.data ?? (rest.workbook || rest.document ? undefined : [{ name: 'Sheet1', cells: [] }]))
  const height = $derived(typeof rest.height === 'string' && /^\d+(\.\d+)?$/.test(rest.height) ? Number(rest.height) : rest.height)

  // The component's methods on the element. Bound once the component is
  // mounted, and read through the binding each call so a remount is followed.
  $effect(() => {
    if (!host || !sheet) return
    for (const name of ELEMENT_METHODS) host[name] = (...args) => sheet?.[name]?.(...args)
  })
</script>

<!--
  `{...rest}` is spread directly, not rebuilt into a filtered object: a prop
  that was undefined at mount must still be tracked when the host sets it
  later. `data` is defaulted so an element rendered before its host assigns
  a document opens on an empty sheet rather than throwing.
-->
<div style="display: block; min-width: 0;">
  <SvSheet bind:this={sheet} {...rest} data={data} height={height} {...callbacks} />
</div>
