<svelte:options
  customElement={{
    tag: 'sv-sheet',
    shadow: 'none',
    props: {
      /* BEGIN generated props - see scripts/generate-sheet-surface.mjs */
      document: { type: 'Object' },
      workbook: { type: 'Object' },
      data: { type: 'Array' },
      rows: { type: 'Number', attribute: 'rows' },
      columns: { type: 'Number', attribute: 'columns' },
      height: { type: 'String', attribute: 'height' },
      columnWidth: { type: 'Number', attribute: 'column-width' },
      rowHeight: { type: 'Number', attribute: 'row-height' },
      look: { type: 'String', attribute: 'look' },
      columnWidths: { type: 'Object' },
      formats: { type: 'Object' },
      extras: { type: 'Array' },
      localization: { type: 'Object' },
      commentAuthor: { type: 'String', attribute: 'comment-author' },
      showRibbon: { type: 'Boolean', attribute: 'show-ribbon' },
      showFormulaBar: { type: 'Boolean', attribute: 'show-formula-bar' },
      showTabs: { type: 'Boolean', attribute: 'show-tabs' },
      showStatusBar: { type: 'Boolean', attribute: 'show-status-bar' },
      presence: { type: 'Array' },
      /* END generated props */
    },
  }}
/>

<script>
  import SheetBody from './SheetBody.svelte'

  let props = $props()

  // The sheet's callbacks re-emitted as DOM CustomEvents so a host with no
  // Svelte in it can listen with addEventListener. `action` is cancelable:
  // preventDefault() takes the action over, as returning true from
  // `onAction` does. $host() is the <sv-sheet> element itself.
  function emit(name, detail, cancelable = false) {
    const event = new CustomEvent(name, { detail, bubbles: true, composed: true, cancelable })
    $host().dispatchEvent(event)
    return event.defaultPrevented
  }
</script>

<SheetBody {...props} {emit} host={$host()} />
