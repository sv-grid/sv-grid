# `<sv-chart>` reference

Every property, attribute and event of the chart custom element.

**This page is generated** from `SvChart`'s own props type by
`packages/grid-wc/scripts/generate-surface.mjs`, the same way the
[`<sv-grid>` reference](sv-grid.md) is, and CI fails if it drifts.

## Loading it

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@svgrid/grid-wc/dist/chart/sv-chart-element.js"></script>

<sv-chart id="chart" legend="right" zoomable range-presets></sv-chart>
<script type="module">
  const chart = document.getElementById('chart')
  chart.spec = {                                  // property: an object
    type: 'line',
    categories: ['2026-01-01', '2026-01-02', '2026-01-03'],
    series: [{ label: 'Close', values: [10, 12, 11] }],
    xType: 'ordinal-time',
  }
  chart.addEventListener('select', (e) => console.log(e.detail))   // { category, series, value }
  chart.addEventListener('zoom', (e) => console.log(e.detail))     // { i0, i1 } or null
</script>
```

From npm, `import '@svgrid/grid-wc/chart'` registers the element; the React
and Vue wrappers are `@svgrid/grid-wc/react/chart` and
`@svgrid/grid-wc/vue/chart`, and the Angular package exports `SvChartComponent`
next to `SvGridComponent`.

## Attributes vs properties

The [same rule as the grid element](sv-grid.md#attributes-vs-properties):
primitives are attributes, arrays / objects / functions are properties.
`spec` is always a property. A prop that takes a boolean OR a string, like
`legend` (`true`, or a side), keeps a string attribute: `legend` alone means
true, `legend="right"` puts the legend on the right, `legend="false"` hides it.

The bindable props (`zoom`, `selected`, `drill-path`, and the drawings) are
written back onto the element after their event, so `chart.zoom` reads the
current window inside or after a `zoom` listener.

<!-- BEGIN generated reference - packages/grid-wc/scripts/generate-surface.mjs -->

### Attributes (26)

Primitives, so they work in plain HTML as well as through a property.

| Attribute | Property | Type |
| --- | --- | --- |
| `legend` | `legend` | `boolean \| ChartLegendPosition` |
| `interactive` | `interactive` | `boolean` |
| `data-labels` | `dataLabels` | `boolean \| ChartDataLabelConfig` |
| `tooltip-mode` | `tooltipMode` | `'shared' \| 'single'` |
| `tooltip-position` | `tooltipPosition` | `'follow' \| 'top-left' \| 'top-right' \| 'bottom-left' \| 'bottom-right'` |
| `tooltip-sticky` | `tooltipSticky` | `boolean` |
| `zoomable` | `zoomable` | `boolean \| ChartZoomConfig` |
| `range-presets` | `rangePresets` | `boolean \| ChartRangePreset[]` |
| `sync-group` | `syncGroup` | `string` |
| `context-menu` | `contextMenu` | `boolean \| MenuItem[] \| ((target: ChartContextTarget) => MenuItem[])` |
| `animate` | `animate` | `boolean \| ChartAnimateConfig` |
| `live` | `live` | `boolean` |
| `drillable` | `drillable` | `boolean` |
| `selectable` | `selectable` | `boolean \| 'single' \| 'multi'` |
| `hover-highlight` | `hoverHighlight` | `boolean` |
| `announce` | `announce` | `boolean` |
| `describe` | `describe` | `boolean` |
| `crosshair-labels` | `crosshairLabels` | `boolean` |
| `brush` | `brush` | `boolean` |
| `brush-height` | `brushHeight` | `number` |
| `toolbar` | `toolbar` | `boolean` |
| `width` | `width` | `number` |
| `height` | `height` | `number` |
| `autosize` | `autosize` | `boolean` |
| `annotatable` | `annotatable` | `boolean` |
| `drawable` | `drawable` | `boolean \| ChartDrawingKind[]` |

### Properties only (7)

Arrays, objects and functions. An HTML attribute is a string, so these can
only be assigned in script: `el.columns = [...]`.

| Property | Type |
| --- | --- |
| `spec` | `ChartSpec` |
| `formatValue` | `(value: number) => string` |
| `tooltipFormat` | `(ctx: ChartTooltipContext) => { ... }` |
| `zoom` | `ChartZoomWindow \| null` |
| `drillPath` | `string[]` |
| `selected` | `ChartPointRef[]` |
| `localeText` | `Partial<ChartMessages>` |

### Events (8)

`detail` is the callback's argument. The one callback that takes two carries
an object keyed by its parameter names.

| Event | From | `detail` |
| --- | --- | --- |
| `select` | `onSelect` | `selection` |
| `drill` | `onDrill` | `selection` |
| `zoom` | `onZoom` | `window` |
| `selectionchange` | `onSelectionChange` | `selected` |
| `hover` | `onHover` | `point` |
| `annotate` | `onAnnotate` | `void` |
| `annotationremove` | `onAnnotationRemove` | `index` |
| `drawingschange` | `onDrawingsChange` | `drawings` |

### Not exposed (4)

| Prop | Why |
| --- | --- |
| `legendItem` | Svelte snippet - cannot cross the custom-element boundary |
| `tooltip` | Svelte snippet - cannot cross the custom-element boundary; use `tooltipFormat` |
| `underlay` | Svelte snippet - cannot cross the custom-element boundary |
| `overlay` | Svelte snippet - cannot cross the custom-element boundary |

<!-- END generated reference -->

## What it renders

The element is the Svelte chart component with a DOM surface, so everything
the component draws, the element draws from the same spec: every chart type,
synchronized charts with the zoom gestures and the context menu, and the
financial toolkit with its indicator panes and drawing tools. These three
demos are that component; give `<sv-chart>` their specs and the picture is
the same.

<div data-docs-demo="435-chart-type-gallery" data-height="600"></div>

<div data-docs-demo="436-chart-sync-zoom" data-height="700"></div>

<div data-docs-demo="437-chart-financial-workbench" data-height="700"></div>

## Where the spec comes from

The element takes the same `ChartSpec` the Svelte component does. Build it by
hand, or with the helpers exported from `@svgrid/grid`: `rowsToChartSpec`
for a grouped chart from rows, `rowsToOhlcSpec` for candlesticks,
`indicatorPane` for an RSI / MACD / volume pane. The
[charts guide](../charts.md) covers every field.
