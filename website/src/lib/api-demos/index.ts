// Registry of interactive demos shown on the API reference page. The key
// matches `ApiSection.demo` in ../api-reference.ts; the Api route looks the
// component up and renders it as a live, runnable grid.
import type { Component } from 'svelte'

import SvGridComponentDemo from './SvGridComponentDemo.svelte'
import EventsDemo from './EventsDemo.svelte'
import ColumnDefDemo from './ColumnDefDemo.svelte'
import CellFormatDemo from './CellFormatDemo.svelte'
import ImperativeApiDemo from './ImperativeApiDemo.svelte'
import TableFeaturesDemo from './TableFeaturesDemo.svelte'
import PivotDemo from './PivotDemo.svelte'
import StagedEditingDemo from './StagedEditingDemo.svelte'
import ExportDemo from './ExportDemo.svelte'

export const apiDemos: Record<string, Component<any>> = {
  'svgrid-component': SvGridComponentDemo,
  events: EventsDemo,
  columndef: ColumnDefDemo,
  'cell-format': CellFormatDemo,
  'imperative-api': ImperativeApiDemo,
  tablefeatures: TableFeaturesDemo,
  'pro-export': ExportDemo,
  'pro-pivot': PivotDemo,
  'pro-staged-editing': StagedEditingDemo,
}

export function getApiDemo(id: string | undefined): Component<any> | null {
  if (!id) return null
  return apiDemos[id] ?? null
}
