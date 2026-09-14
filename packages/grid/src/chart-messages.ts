/**
 * Chart chrome localization. Every string `SvChart` renders on its own -
 * toolbar buttons and their titles, the context menu, the legend's overflow
 * and hint text, the empty state, and everything it says to assistive
 * technology (the image label, the data table caption, the live region, the
 * marks' labels) - lives here as a flat map with English defaults. Pass
 * `localeText` on `<SvChart>` to override any subset; unset keys fall back
 * to English, so omitting it is a no-op. The same `resolveMessages` idiom as
 * the grid's `localeText` (grid-messages.ts) and the editors'.
 *
 * Placeholders in braces (`{type}`, `{n}`) are filled by {@link chartMessage}.
 */
import { resolveMessages } from './editor-contract'

/** Every localizable chart string, grouped by area in the comments. */
export type ChartMessages = {
  // The image and its data table
  /** The SVG's accessible name. `{type}` is the chart type. */
  chartLabel: string
  /** The hidden data table's caption. `{type}` is the chart type. */
  dataTable: string
  /** Appended to the caption when the table is capped. `{shown}` / `{total}`. */
  dataTableCapped: string
  noData: string
  /** A point with no value, in labels and the live region. */
  noValue: string
  // What the live region and the marks say
  /** The live region while stepping through series: `{series}`, `{value}`, `{category}`. */
  seriesAtCategory: string
  /** A dense chart's single hit zone: `{count}`, `{from}`, `{to}`. */
  densePoints: string
  /** Appended to a slice or cell label that drills further. */
  drillIn: string
  /** A sankey node's label: `{label}`, `{in}`, `{out}`. */
  sankeyNode: string
  /** The donut's centre caption under the total. */
  total: string
  /** A regression overlay's goodness of fit in the tooltip. `{value}` is 0..1. */
  rSquared: string
  /** The context menu item that copies the chart's plain-language summary. */
  describeChart: string
  /** The live region after the summary was copied. */
  describeCopied: string
  // Toolbar
  drillPath: string
  drillRoot: string
  dateRange: string
  /** A preset button's title. `{preset}` is its label. */
  showLast: string
  pan: string
  panTitle: string
  resetZoom: string
  resetZoomTitle: string
  annotate: string
  annotateOnTitle: string
  annotateOffTitle: string
  drawingTools: string
  /** A drawing tool button's title. `{tool}` is the tool's label. */
  draw: string
  toolTrend: string
  toolRay: string
  toolFib: string
  toolRect: string
  toolArrow: string
  toolText: string
  /** A drawing's accessible name. `{tool}` is the tool's label. */
  drawing: string
  deleteDrawing: string
  deleteDrawingTitle: string
  clearDrawings: string
  clearDrawingsTitle: string
  noteText: string
  /** A note marker's name while annotating. `{label}` is the note. */
  removeNote: string
  png: string
  downloadPng: string
  svg: string
  downloadSvg: string
  pdf: string
  downloadPdf: string
  downloadCsv: string
  print: string
  printTitle: string
  copy: string
  copied: string
  copyTitle: string
  copyAsImage: string
  // Context menu
  range: string
  series: string
  // Legend
  showSeries: string
  hideSeries: string
  isolateHint: string
  /** The overflow toggle. `{n}` is how many chips are folded away. */
  showMore: string
  showLess: string
  // Brush
  rangeBrush: string
  /** The brush's value text. `{from}` / `{to}` are the window's ends. */
  brushRange: string
}

/** The English defaults. */
export const defaultChartMessages: ChartMessages = {
  chartLabel: '{type} chart',
  dataTable: '{type} chart data',
  dataTableCapped: ', first {shown} of {total} rows',
  noData: 'No data',
  noValue: 'no value',
  seriesAtCategory: '{series}: {value} at {category}',
  densePoints: '{count} points, {from} to {to}. Arrow keys step through values.',
  drillIn: ', drill in',
  sankeyNode: '{label}: in {in}, out {out}',
  total: 'Total',
  rSquared: 'R\u00b2 {value}',
  describeChart: 'Describe chart',
  describeCopied: 'Description copied',
  drillPath: 'Drilldown path',
  drillRoot: 'All',
  dateRange: 'Date range',
  showLast: 'Show the last {preset}',
  pan: 'Pan',
  panTitle: 'Drag the plot to pan the zoomed window',
  resetZoom: 'Reset zoom',
  resetZoomTitle: 'Reset zoom (or double-click the plot)',
  annotate: 'Annotate',
  annotateOnTitle: 'Click the plot to pin a note, or a marker to remove it',
  annotateOffTitle: 'Pin notes on the chart',
  drawingTools: 'Drawing tools',
  draw: 'Draw: {tool}',
  toolTrend: 'Trend',
  toolRay: 'Ray',
  toolFib: 'Fib',
  toolRect: 'Rect',
  toolArrow: 'Arrow',
  toolText: 'Text',
  drawing: '{tool} drawing',
  deleteDrawing: 'Delete',
  deleteDrawingTitle: 'Remove the selected drawing (Delete)',
  clearDrawings: 'Clear',
  clearDrawingsTitle: 'Remove every drawing',
  noteText: 'Note text',
  removeNote: 'Remove note: {label}',
  png: 'PNG',
  downloadPng: 'Download PNG',
  svg: 'SVG',
  downloadSvg: 'Download SVG',
  pdf: 'PDF',
  downloadPdf: 'Download PDF',
  downloadCsv: 'Download CSV',
  print: 'Print',
  printTitle: 'Print the chart',
  copy: 'Copy',
  copied: '✓ Copied',
  copyTitle: 'Copy chart as image',
  copyAsImage: 'Copy as image',
  range: 'Range',
  series: 'Series',
  showSeries: 'Show',
  hideSeries: 'Hide',
  isolateHint: 'double-click to isolate',
  showMore: '+{n} more',
  showLess: 'Show less',
  rangeBrush: 'Range brush',
  brushRange: '{from} to {to}',
}

/**
 * Merge a consumer's `localeText` over the English defaults. Undefined or
 * empty values fall back to the default, so a partial map only replaces the
 * keys it sets.
 */
export function resolveChartMessages(overrides?: Partial<ChartMessages> | null): ChartMessages {
  return resolveMessages(defaultChartMessages, overrides)
}

/**
 * Fill a message's `{name}` placeholders. Unknown placeholders are left as
 * they are, so a translation that drops one loses nothing.
 */
export function chartMessage(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m))
}
