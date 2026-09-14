/**
 * The grid's chart panel and chart builder, localized. Every string the panel
 * chrome renders (the head and its actions, the export menu, the AI row, the
 * pickers with their type / reducer / bucket / palette / indicator names and
 * the "why this type cannot draw yet" sentences, the builder's tabs and
 * Format fields, the saved-charts popover) is a key here with its English
 * default. Pass any subset through `localization.text` on `<SvGrid>`; unset
 * keys stay English.
 *
 * A module of its own rather than more keys in grid-messages.ts because that
 * file's defaults are base-bundle code that every grid pays for, charting or
 * not. This one loads with the panel, which is already a lazy chunk. The
 * type joins `GridMessages` so `localization.text` accepts the keys.
 *
 * The chart's OWN strings (toolbar, context menu, what it says to assistive
 * technology) are a different surface: `ChartMessages` in chart-messages.ts,
 * passed as `localeText` on the chart or `charting.localeText` on the grid.
 */
import { resolveMessages } from './editor-contract'

/** Every localizable chart panel and builder string. */
export type GridChartPanelMessages = {
  // Panel head and actions
  chartPanelTitle: string
  chartClearFilter: string
  chartExport: string
  chartExportLabel: string
  chartExportPng: string
  chartExportSvg: string
  chartExportPdf: string
  chartExportCsv: string
  chartExportCopy: string
  chartExportPrint: string
  chartExportDescribe: string
  chartAi: string
  chartAiLabel: string
  chartAiPlaceholder: string
  chartAiRun: string
  chartAiThinking: string
  chartAiExplain: string
  chartAiExplainTitle: string
  chartAiNoChart: string
  chartAiNoExplanation: string
  chartAiFailed: string
  chartBuild: string
  chartBuildLabel: string
  chartBuildTitle: string
  chartLinkBack: string
  chartUnlink: string
  chartLinkedTitle: string
  chartUnlinkedTitle: string
  chartAdd: string
  chartSave: string
  chartSaveLabel: string
  chartSavedTitle: string
  chartSaveName: string
  chartSaveNamePlaceholder: string
  chartSaveApply: string
  /** The pickers' note in pivot mode, where the pivot on screen is the chart. */
  chartPivotHint: string
  chartSaveRemove: string
  chartSavedEmpty: string
  chartMaximize: string
  chartRestore: string
  chartDock: string
  chartDockLabel: string
  chartPopOut: string
  chartPopOutLabel: string
  chartClose: string
  chartResize: string
  chartResizeWindow: string
  chartTabs: string
  chartRemoveTab: string
  chartRemove: string
  chartEmptyColumns: string
  chartEmptyData: string
  // Pickers
  chartType: string
  chartDate: string
  chartGroupBy: string
  chartFrom: string
  chartColumns: string
  chartSplitBy: string
  chartTo: string
  chartRows: string
  chartNone: string
  chartValue: string
  chartX: string
  chartY: string
  chartLow: string
  chartHigh: string
  chartOpen: string
  chartClosePrice: string
  chartVolume: string
  chartMetric: string
  chartTarget: string
  chartAggregate: string
  chartReduceSum: string
  chartReduceAvg: string
  chartReduceCount: string
  chartReduceMin: string
  chartReduceMax: string
  chartReduceMedian: string
  chartReduceP90: string
  chartReduceFirst: string
  chartReduceLast: string
  chartReduceCountDistinct: string
  chartBins: string
  chartBinsTitle: string
  chartShape: string
  chartShapeFunnel: string
  chartShapePyramid: string
  chartShapeCone: string
  chartCandles: string
  chartCandlesClassic: string
  chartCandlesHollow: string
  chartCandlesHeikinAshi: string
  chartIndicators: string
  chartIndVolume: string
  chartIndVolumeTitle: string
  chartIndRsi: string
  chartIndRsiTitle: string
  chartIndMacd: string
  chartIndMacdTitle: string
  chartIndStochastic: string
  chartIndStochasticTitle: string
  chartIndAtr: string
  chartIndAtrTitle: string
  chartIndObv: string
  chartIndObvTitle: string
  chartIndSma: string
  chartIndSmaTitle: string
  chartIndEma: string
  chartIndEmaTitle: string
  chartIndBb: string
  chartIndBbTitle: string
  chartIndVwap: string
  chartIndVwapTitle: string
  chartFormat: string
  chartFormatNumber: string
  chartFormatCurrency: string
  chartFormatPercent: string
  chartStacked: string
  chartStacked100: string
  chartStacked100Title: string
  chartHorizontal: string
  chartHorizontalTitle: string
  chartDonut: string
  chartColours: string
  chartPaletteTheme: string
  chartPaletteOcean: string
  chartPaletteSunset: string
  chartPaletteForest: string
  chartPaletteSlate: string
  chartLabels: string
  chartLogScale: string
  chartLogScaleTitle: string
  chartBucket: string
  chartBucketTitle: string
  chartBucketExact: string
  chartBucketDay: string
  chartBucketWeek: string
  chartBucketMonth: string
  chartBucketQuarter: string
  chartBucketYear: string
  chartDateAxis: string
  chartDateAxisTitle: string
  // Type names and their groups
  chartGroupCompare: string
  chartGroupPartOfWhole: string
  chartGroupFlow: string
  chartGroupDistribution: string
  chartGroupSingleValue: string
  chartGroupOverTime: string
  chartTypeBar: string
  chartTypeLine: string
  chartTypeArea: string
  chartTypeLollipop: string
  chartTypePareto: string
  chartTypeRangeBar: string
  chartTypeRangeArea: string
  chartTypeDumbbell: string
  chartTypeRadialColumn: string
  chartTypeRadialBar: string
  chartTypeNightingale: string
  chartTypePie: string
  chartTypeTreemap: string
  chartTypeSunburst: string
  chartTypeFunnel: string
  chartTypeWaterfall: string
  chartTypeSankey: string
  chartTypeChord: string
  chartTypeRadar: string
  chartTypeHeatmap: string
  chartTypeScatter: string
  chartTypeBoxplot: string
  chartTypeHistogram: string
  chartTypeGauge: string
  chartTypeBullet: string
  chartTypeCalendar: string
  chartTypeStream: string
  chartTypeCandlestick: string
  chartTypeOhlc: string
  // Why the chosen type cannot draw yet
  chartIssueHeatmap: string
  chartIssueSankey: string
  chartIssueRadar: string
  chartIssueFunnel: string
  chartIssueChord: string
  chartIssueStream: string
  chartIssueSecondMeasure: string
  chartIssueOhlcDate: string
  chartIssueOhlcColumns: string
  // Builder
  chartBuilderTitle: string
  chartBuilderTabType: string
  chartBuilderTabData: string
  chartBuilderTabFormat: string
  chartBuilderLinked: string
  chartBuilderFrozenAt: string
  chartBuilderFollows: string
  chartBuilderTitleField: string
  chartBuilderSubtitle: string
  chartBuilderCaption: string
  chartBuilderLegend: string
  chartLegendBottom: string
  chartLegendTop: string
  chartLegendLeft: string
  chartLegendRight: string
  chartLegendHidden: string
  chartBuilderDataLabels: string
  chartBuilderPanelSetting: string
  chartLabelsTop: string
  chartLabelsOutside: string
  chartLabelsInside: string
  chartLabelsCenter: string
  chartLabelsHidden: string
  chartBuilderSeriesLabels: string
  chartBuilderCrosshairLabels: string
  chartBuilderCompactBelow: string
  chartBuilderCompactBelowTitle: string
  chartBuilderValueAxis: string
  chartBuilderRightAxis: string
  chartBuilderCategoryAxis: string
  chartBuilderMin: string
  chartBuilderMax: string
  chartBuilderAuto: string
  chartBuilderOff: string
  chartBuilderGridLines: string
  chartBuilderAxisLabels: string
  chartBuilderLabelsAuto: string
  chartBuilderLabelsHorizontal: string
  chartBuilderLabelsTilted: string
  chartBuilderLabelsVertical: string
  chartBuilderSeries: string
  chartBuilderColor: string
  chartBuilderSeriesType: string
  chartBuilderAxis: string
  chartBuilderMarker: string
  chartBuilderWidth: string
  chartBuilderStack: string
  chartBuilderStackPlaceholder: string
  chartBuilderSeriesColorLabel: string
  chartBuilderSeriesTypeLabel: string
  chartBuilderSeriesAxisLabel: string
  chartBuilderSeriesMarkerLabel: string
  chartBuilderSeriesWidthLabel: string
  chartBuilderSeriesStackLabel: string
  chartBuilderChartType: string
  chartBuilderBar: string
  chartBuilderLine: string
  chartBuilderArea: string
  chartBuilderLeft: string
  chartBuilderRight: string
  chartBuilderStyle: string
  chartBuilderFontSize: string
  chartBuilderFontFamily: string
  chartBuilderBackground: string
  chartBuilderTextColor: string
  chartBuilderResetFormat: string
}

/** English defaults: the literal strings the panel and the builder shipped with. */
export const defaultChartPanelMessages: GridChartPanelMessages = {
  chartPanelTitle: 'Chart',
  chartClearFilter: 'Clear filter',
  chartExport: 'Export',
  chartExportLabel: 'Export chart',
  chartExportPng: 'PNG image',
  chartExportSvg: 'SVG vector',
  chartExportPdf: 'PDF document',
  chartExportCsv: 'CSV data',
  chartExportCopy: 'Copy to clipboard',
  chartExportPrint: 'Print',
  chartExportDescribe: 'Describe chart',
  chartAi: 'AI',
  chartAiLabel: 'Chart with AI',
  chartAiPlaceholder: 'Describe a chart, e.g. revenue by region stacked by product',
  chartAiRun: 'Chart it',
  chartAiThinking: 'Thinking...',
  chartAiExplain: 'Explain',
  chartAiExplainTitle: 'Explain this chart in plain words',
  chartAiNoChart: "Couldn't build a chart from that request.",
  chartAiNoExplanation: "Couldn't explain this chart.",
  chartAiFailed: 'Something went wrong.',
  chartBuild: 'Build',
  chartBuildLabel: 'Open the chart builder',
  chartBuildTitle: 'Chart builder: type gallery, data and format',
  chartLinkBack: 'Link the chart back to the grid',
  chartUnlink: 'Unlink the chart from the grid',
  chartLinkedTitle: "Linked: the chart follows the grid's rows. Click to freeze it.",
  chartUnlinkedTitle: 'Unlinked: the chart keeps the data it has. Click to follow the grid again.',
  chartAdd: 'Add chart',
  chartSave: 'Save',
  chartSaveLabel: 'Saved charts',
  chartSavedTitle: 'Saved charts',
  chartSaveName: 'Save this chart as',
  chartSaveNamePlaceholder: 'Name',
  chartSaveApply: 'Apply',
  chartPivotHint: 'Charting the pivot: its row groups are the categories and its column groups the series.',
  chartSaveRemove: 'Remove',
  chartSavedEmpty: 'No saved charts yet.',
  chartMaximize: 'Maximize',
  chartRestore: 'Restore',
  chartDock: 'Dock',
  chartDockLabel: 'Dock chart',
  chartPopOut: 'Pop out',
  chartPopOutLabel: 'Pop out chart',
  chartClose: 'Close chart',
  chartResize: 'Resize chart panel',
  chartResizeWindow: 'Resize chart window',
  chartTabs: 'Charts',
  chartRemoveTab: 'Remove {title}',
  chartRemove: 'Remove',
  chartEmptyColumns: 'Charting needs at least one text column (to group by) and one numeric column (to measure).',
  chartEmptyData: 'No data to chart.',
  chartType: 'Type',
  chartDate: 'Date',
  chartGroupBy: 'Group by',
  chartFrom: 'From',
  chartColumns: 'Columns',
  chartSplitBy: 'Split by',
  chartTo: 'To',
  chartRows: 'Rows',
  chartNone: '(none)',
  chartValue: 'Value',
  chartX: 'X',
  chartY: 'Y',
  chartLow: 'Low',
  chartHigh: 'High',
  chartOpen: 'Open',
  chartClosePrice: 'Close',
  chartVolume: 'Volume',
  chartMetric: 'Metric',
  chartTarget: 'Target',
  chartAggregate: 'Aggregate',
  chartReduceSum: 'Sum',
  chartReduceAvg: 'Average',
  chartReduceCount: 'Count',
  chartReduceMin: 'Min',
  chartReduceMax: 'Max',
  chartReduceMedian: 'Median',
  chartReduceP90: '90th percentile',
  chartReduceFirst: 'First',
  chartReduceLast: 'Last',
  chartReduceCountDistinct: 'Distinct count',
  chartBins: 'Bins',
  chartBinsTitle: 'How many bins the sample is split into',
  chartShape: 'Shape',
  chartShapeFunnel: 'Funnel',
  chartShapePyramid: 'Pyramid',
  chartShapeCone: 'Cone',
  chartCandles: 'Candles',
  chartCandlesClassic: 'Classic',
  chartCandlesHollow: 'Hollow',
  chartCandlesHeikinAshi: 'Heikin-Ashi',
  chartIndicators: 'Indicators',
  chartIndVolume: 'Volume',
  chartIndVolumeTitle: 'Volume bars under the price',
  chartIndRsi: 'RSI',
  chartIndRsiTitle: 'Relative strength index, 14 bars',
  chartIndMacd: 'MACD',
  chartIndMacdTitle: 'MACD 12 / 26 / 9',
  chartIndStochastic: 'Stoch',
  chartIndStochasticTitle: 'Stochastic oscillator 14 / 3',
  chartIndAtr: 'ATR',
  chartIndAtrTitle: 'Average true range, 14 bars',
  chartIndObv: 'OBV',
  chartIndObvTitle: 'On-balance volume',
  chartIndSma: 'SMA 20',
  chartIndSmaTitle: '20-bar simple moving average on the price',
  chartIndEma: 'EMA 20',
  chartIndEmaTitle: '20-bar exponential moving average on the price',
  chartIndBb: 'Bollinger',
  chartIndBbTitle: 'Bollinger bands 20 / 2 on the price',
  chartIndVwap: 'VWAP',
  chartIndVwapTitle: 'Volume-weighted average price on the price',
  chartFormat: 'Format',
  chartFormatNumber: 'Number',
  chartFormatCurrency: 'Currency',
  chartFormatPercent: 'Percent',
  chartStacked: 'Stacked',
  chartStacked100: '100%',
  chartStacked100Title: 'Normalise each category to 100 percent',
  chartHorizontal: 'Horizontal',
  chartHorizontalTitle: 'Bars grow rightwards - suits long category labels',
  chartDonut: 'Donut',
  chartColours: 'Colours',
  chartPaletteTheme: 'Theme',
  chartPaletteOcean: 'Ocean',
  chartPaletteSunset: 'Sunset',
  chartPaletteForest: 'Forest',
  chartPaletteSlate: 'Slate',
  chartLabels: 'Labels',
  chartLogScale: 'Log scale',
  chartLogScaleTitle: 'Logarithmic value axis - flattens wide-range data',
  chartBucket: 'Bucket',
  chartBucketTitle: 'Group the dates by calendar unit: one bar per month instead of one per day',
  chartBucketExact: 'Exact',
  chartBucketDay: 'Day',
  chartBucketWeek: 'Week',
  chartBucketMonth: 'Month',
  chartBucketQuarter: 'Quarter',
  chartBucketYear: 'Year',
  chartDateAxis: 'Date axis',
  chartDateAxisTitle: 'Space points by actual date - real time ticks and proportional gaps',
  chartGroupCompare: 'Compare',
  chartGroupPartOfWhole: 'Part of a whole',
  chartGroupFlow: 'Flow',
  chartGroupDistribution: 'Distribution',
  chartGroupSingleValue: 'Single value',
  chartGroupOverTime: 'Over time',
  chartTypeBar: 'Bar',
  chartTypeLine: 'Line',
  chartTypeArea: 'Area',
  chartTypeLollipop: 'Lollipop',
  chartTypePareto: 'Pareto',
  chartTypeRangeBar: 'Range bar',
  chartTypeRangeArea: 'Range area',
  chartTypeDumbbell: 'Dumbbell',
  chartTypeRadialColumn: 'Radial column',
  chartTypeRadialBar: 'Radial bar',
  chartTypeNightingale: 'Nightingale',
  chartTypePie: 'Pie',
  chartTypeTreemap: 'Tree map',
  chartTypeSunburst: 'Sunburst',
  chartTypeFunnel: 'Funnel',
  chartTypeWaterfall: 'Waterfall',
  chartTypeSankey: 'Sankey',
  chartTypeChord: 'Chord',
  chartTypeRadar: 'Radar',
  chartTypeHeatmap: 'Heat map',
  chartTypeScatter: 'Scatter',
  chartTypeBoxplot: 'Box plot',
  chartTypeHistogram: 'Histogram',
  chartTypeGauge: 'Gauge',
  chartTypeBullet: 'Bullet',
  chartTypeCalendar: 'Calendar',
  chartTypeStream: 'Stream',
  chartTypeCandlestick: 'Candlestick',
  chartTypeOhlc: 'OHLC bars',
  chartIssueHeatmap: 'Heat map needs a Split by column for its rows.',
  chartIssueSankey: 'Sankey needs a Split by column: Group by is the source, Split by the target.',
  chartIssueRadar: 'Radar needs at least 3 groups.',
  chartIssueFunnel: 'Funnel needs at least 2 stages.',
  chartIssueChord: 'Chord needs a Split by column: Group by and Split by are the two ends of each flow.',
  chartIssueStream: 'Stream needs a Split by column: each split becomes a layer.',
  chartIssueSecondMeasure: 'Pick a second measure for the high end of the range.',
  chartIssueOhlcDate: 'Candlesticks need a date column.',
  chartIssueOhlcColumns: 'Pick the Open, High, Low and Close columns.',
  chartBuilderTitle: 'Chart builder',
  chartBuilderTabType: 'Type',
  chartBuilderTabData: 'Data',
  chartBuilderTabFormat: 'Format',
  chartBuilderLinked: 'Linked to the grid',
  chartBuilderFrozenAt: 'Frozen at {time}; edits, filters and new rows no longer change it.',
  chartBuilderFollows: "The chart follows the grid's rows, filters and edits.",
  chartBuilderTitleField: 'Title',
  chartBuilderSubtitle: 'Subtitle',
  chartBuilderCaption: 'Caption',
  chartBuilderLegend: 'Legend',
  chartLegendBottom: 'Bottom',
  chartLegendTop: 'Top',
  chartLegendLeft: 'Left',
  chartLegendRight: 'Right',
  chartLegendHidden: 'Hidden',
  chartBuilderDataLabels: 'Data labels',
  chartBuilderPanelSetting: 'Panel setting',
  chartLabelsTop: 'Top',
  chartLabelsOutside: 'Outside',
  chartLabelsInside: 'Inside',
  chartLabelsCenter: 'Center',
  chartLabelsHidden: 'Hidden',
  chartBuilderSeriesLabels: 'Series labels',
  chartBuilderCrosshairLabels: 'Crosshair labels',
  chartBuilderCompactBelow: 'Compact under',
  chartBuilderCompactBelowTitle: 'Below this width in px the chart drops its series and data labels, turns the category labels vertical and hides the legend',
  chartBuilderValueAxis: 'Value axis',
  chartBuilderRightAxis: 'Right axis',
  chartBuilderCategoryAxis: 'Category axis',
  chartBuilderMin: 'Min',
  chartBuilderMax: 'Max',
  chartBuilderAuto: 'auto',
  chartBuilderOff: 'off',
  chartBuilderGridLines: 'Grid lines',
  chartBuilderAxisLabels: 'Labels',
  chartBuilderLabelsAuto: 'Auto',
  chartBuilderLabelsHorizontal: 'Horizontal',
  chartBuilderLabelsTilted: 'Tilted',
  chartBuilderLabelsVertical: 'Vertical',
  chartBuilderSeries: 'Series',
  chartBuilderColor: 'Color',
  chartBuilderSeriesType: 'Type',
  chartBuilderAxis: 'Axis',
  chartBuilderMarker: 'Marker',
  chartBuilderWidth: 'Width',
  chartBuilderStack: 'Stack',
  chartBuilderStackPlaceholder: 'own',
  chartBuilderSeriesColorLabel: '{series} colour',
  chartBuilderSeriesTypeLabel: '{series} type',
  chartBuilderSeriesAxisLabel: '{series} axis',
  chartBuilderSeriesMarkerLabel: '{series} marker',
  chartBuilderSeriesWidthLabel: '{series} line width',
  chartBuilderSeriesStackLabel: '{series} stack group',
  chartBuilderChartType: 'Chart',
  chartBuilderBar: 'Bar',
  chartBuilderLine: 'Line',
  chartBuilderArea: 'Area',
  chartBuilderLeft: 'Left',
  chartBuilderRight: 'Right',
  chartBuilderStyle: 'Style',
  chartBuilderFontSize: 'Font size',
  chartBuilderFontFamily: 'Font',
  chartBuilderBackground: 'Background',
  chartBuilderTextColor: 'Text',
  chartBuilderResetFormat: 'Reset format',
}

/**
 * Merge a consumer's `localization.text` over the English defaults. The map
 * usually carries the chrome keys too; only the chart panel keys are read.
 */
export function resolveChartPanelMessages(overrides?: Partial<GridChartPanelMessages> | null): GridChartPanelMessages {
  return resolveMessages(defaultChartPanelMessages, overrides)
}

/** Fill `{name}` placeholders in a message. */
export function chartPanelMessage(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in values ? String(values[k]) : `{${k}}`))
}
