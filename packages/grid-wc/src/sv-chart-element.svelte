<svelte:options
  customElement={{
    tag: 'sv-chart',
    shadow: 'none',
    props: {
      /* BEGIN generated props - see scripts/generate-surface.mjs */
      spec: { type: 'Object' },
      legend: { type: 'String', attribute: 'legend' },
      interactive: { type: 'Boolean', attribute: 'interactive' },
      dataLabels: { type: 'Boolean', attribute: 'data-labels' },
      formatValue: { type: 'Object' },
      tooltipFormat: { type: 'Object' },
      tooltipMode: { type: 'String', attribute: 'tooltip-mode' },
      tooltipPosition: { type: 'String', attribute: 'tooltip-position' },
      tooltipSticky: { type: 'Boolean', attribute: 'tooltip-sticky' },
      zoomable: { type: 'Boolean', attribute: 'zoomable' },
      zoom: { type: 'Object' },
      rangePresets: { type: 'Boolean', attribute: 'range-presets' },
      syncGroup: { type: 'String', attribute: 'sync-group' },
      contextMenu: { type: 'Boolean', attribute: 'context-menu' },
      animate: { type: 'Boolean', attribute: 'animate' },
      live: { type: 'Boolean', attribute: 'live' },
      drillable: { type: 'Boolean', attribute: 'drillable' },
      drillPath: { type: 'Array' },
      selectable: { type: 'String', attribute: 'selectable' },
      selected: { type: 'Array' },
      hoverHighlight: { type: 'Boolean', attribute: 'hover-highlight' },
      announce: { type: 'Boolean', attribute: 'announce' },
      describe: { type: 'Boolean', attribute: 'describe' },
      localeText: { type: 'Object' },
      crosshairLabels: { type: 'Boolean', attribute: 'crosshair-labels' },
      brush: { type: 'Boolean', attribute: 'brush' },
      brushHeight: { type: 'Number', attribute: 'brush-height' },
      toolbar: { type: 'Boolean', attribute: 'toolbar' },
      width: { type: 'Number', attribute: 'width' },
      height: { type: 'Number', attribute: 'height' },
      autosize: { type: 'Boolean', attribute: 'autosize' },
      annotatable: { type: 'Boolean', attribute: 'annotatable' },
      drawable: { type: 'Boolean', attribute: 'drawable' },
      /* END generated props */
    },
  }}
/>

<script>
  import ChartBody from './ChartBody.svelte'

  let props = $props()

  // Re-emit chart callbacks as DOM CustomEvents so non-Svelte hosts can listen
  // with addEventListener(...). $host() is the <sv-chart> element itself.
  function emit(name, detail) {
    $host().dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
  }
</script>

<ChartBody {...props} {emit} host={$host()} />
