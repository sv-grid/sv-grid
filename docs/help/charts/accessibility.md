# Chart accessibility and localization

What the chart says to assistive technology and does on its own: the image and its data table, names on every mark, the keyboard model, the live region, reduced motion, forced colors, the axe audit, and `localeText` for every string it renders.

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, SvGridChart } from '@svgrid/grid'
</script>
```

## Accessibility

What the chart says to assistive technology, and what it does on its own:

- **The image and its data.** The SVG is a labelled group (`"bar chart"`)
  described by a visually hidden `<table>` with the same numbers, capped at
  1,000 rows with a caption that says so. A chart with `interactive={false}`
  (a thumbnail) is a single image instead.
- **A sentence about it.** `aria-description` and the table's caption carry
  `chartSummary`'s reading of the chart ("Revenue rises 42% from 1.2k in Jan
  to 1.7k in Dec, peaking at 2.0k in Aug"), the same sentence the context
  menu copies under Describe chart and the AI explains from.
  `describe={false}` leaves it out.
- **Every mark has a name.** Category hit zones read "category: series value,
  series value"; slices, cells, arcs, nodes, links, dots and drawings each
  carry their label and value; a slice that drills says so. Marks are
  `button`s where a click does something (`onSelect`, `selectable`,
  `drillable`) and images otherwise, and every focusable mark has a visible
  focus ring.
- **Keyboard.** The model above: one Tab stop per chart, arrows inside it,
  Enter / Space to act, `+` / `-` / `0` and the brush for zoom, Escape to
  back out of a series, a drawing or a tool, Delete for a selected drawing,
  Shift + F10 for the menu. The toolbar is a `toolbar` of buttons with
  `aria-pressed` on the toggles, the legend chips are pressed buttons, the
  presets and drawing tools are labelled groups, the breadcrumb is a
  navigation with `aria-current`, the brush is a `slider` whose value text
  is the window's ends.
- **Live region.** A polite region announces the focused point while
  stepping through series (`announce`).
- **Motion.** Enter effects and the data-update tween are skipped under
  `prefers-reduced-motion`.
- **Forced colors** (Windows High Contrast). Colour carries the data, so the
  marks keep their own colours; everything that is chrome takes the system
  palette instead: text, gridlines, the crosshair and its pills, focus rings,
  the legend's swatches, the tooltip. Pattern fills (`patternFallback`)
  remain the answer for colour blindness.
- **Localization.** Every string the chart renders on its own is a
  `localeText` key; see below.
- **Audited.** `tests/e2e/chart-a11y.spec.ts` runs axe-core (WCAG 2.1 AA
  plus best practices) against the rendered chart on three demos that draw
  every family, and drives the keyboard model in a real browser.

## Localization

`localeText` translates the chart's own strings: toolbar buttons and their
titles, the context menu, the legend's hints and overflow toggle, the empty
state, the donut's Total, and what it says to assistive technology (the image
label, the data table caption, the live region, the dense chart's hint). It is
a partial map over `ChartMessages`; unset keys stay English. Placeholders in
braces are filled in: `{type}` in the image label, `{series}` / `{value}` /
`{category}` in the live region, `{n}` in the overflow toggle.
`resolveChartMessages` and `chartMessage` are exported for a host that draws
its own chrome, and `charting.localeText` hands the same map to every chart
the grid panel draws.

```svelte {runnable}
<script lang="ts">
  import { SvChart, type ChartSpec } from '@svgrid/grid'

  const spec: ChartSpec = {
    type: 'bar',
    categories: ['Q1', 'Q2', 'Q3', 'Q4'],
    series: [{ label: 'Umsatz', values: [120, 140, 90, 180] }, { label: 'Kosten', values: [80, 95, 70, 110] }],
    title: 'Umsatz und Kosten',
  }
</script>

<SvChart
  {spec}
  toolbar
  zoomable
  localeText={{
    chartLabel: '{type}-Diagramm',
    dataTable: 'Daten des {type}-Diagramms',
    png: 'PNG', downloadPng: 'Als PNG herunterladen',
    svg: 'SVG', downloadSvg: 'Als SVG herunterladen',
    pdf: 'PDF', downloadPdf: 'Als PDF herunterladen',
    print: 'Drucken', printTitle: 'Diagramm drucken',
    copy: 'Kopieren', copied: '✓ Kopiert', copyTitle: 'Als Bild kopieren',
    resetZoom: 'Zoom zurücksetzen', resetZoomTitle: 'Zoom zurücksetzen (oder Doppelklick)',
    hideSeries: 'Ausblenden', showSeries: 'Einblenden', isolateHint: 'Doppelklick isoliert',
    seriesAtCategory: '{series}: {value} bei {category}',
  }}
/>
```

### The grid panel's strings

The panel and the builder are grid chrome, so their strings live on the
grid's own map, `localization.text` (a `Partial<GridMessages>`), next to the
pager and the filter operators. The chart panel keys all start with `chart`
and load with the panel, not with every grid:

| Keys | What they label |
| --- | --- |
| `chartPanelTitle`, `chartClearFilter`, `chartExport*`, `chartAdd`, `chartSave*`, `chartMaximize`, `chartRestore`, `chartDock*`, `chartPopOut*`, `chartClose`, `chartResize*`, `chartTabs`, `chartRemove*`, `chartEmpty*` | The head, its buttons, the export menu, the tab strip, the empty states |
| `chartAi*` | The AI row: button, placeholder, Chart it, Explain, its errors |
| `chartBuild*`, `chartLinkBack`, `chartUnlink`, `chartLinkedTitle`, `chartUnlinkedTitle` | The Build button and the link toggle |
| `chartType`, `chartDate`, `chartGroupBy`, `chartSplitBy`, `chartValue`, `chartX`, `chartY`, `chartLow`, `chartHigh`, `chartOpen`, `chartClosePrice`, `chartVolume`, `chartMetric`, `chartTarget`, `chartAggregate`, `chartFormat*`, `chartBins*`, `chartShape*`, `chartCandles*`, `chartBucket*`, `chartColours`, `chartNone` | The pickers and their options |
| `chartReduce*`, `chartPalette*`, `chartInd*`, `chartType<Name>`, `chartGroup<Name>` | Aggregates, palettes, indicator chips (label and title), the thirty type names and their six groups |
| `chartStacked`, `chartStacked100`, `chartHorizontal`, `chartDonut`, `chartLabels`, `chartLogScale`, `chartDateAxis` (and their `*Title` hints) | The switches |
| `chartIssue*` | Why the chosen type cannot draw yet |
| `chartBuilder*`, `chartLegend*`, `chartLabels<Placement>` | The builder: its title and tabs, every Format field, the series table, the style fieldset |

`{title}`, `{time}` and `{series}` placeholders are filled in where a
message has them. `resolveChartPanelMessages` and `chartPanelMessage` are
exported, and `defaultChartPanelMessages` is the full English map to copy
from. The [grid panel page](./from-the-grid.md#localizing-the-panel) has a
German panel to try.

## More examples

### Color-blind-safe pattern fills

patternFallback: true layers a texture (stripe / crosshatch / dots / diagonal) on every series so two series with similar hues still read as distinct in grayscale or for readers with color-vision deficiency. Works on bars and area stacks.

<div data-docs-demo="156-chart-patterns" data-height="560"></div>


### Axes, titles and styling

<div data-docs-demo="434-chart-axes-styling" data-height="700"></div>

### Every chart type

<div data-docs-demo="435-chart-type-gallery" data-height="640"></div>

## See also

- [Keyboard, series navigation and selection](./interaction.md#keyboard-series-navigation-and-selection)
- [Grid accessibility](../accessibility.md)
- [Localization and RTL](../i18n-rtl.md)
