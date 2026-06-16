// Minimal globalThis.Smart shim so the vendored smart.export.js IIFE can
// register Smart.Utilities.DataExporter without dragging in the rest of the
// Smart UI runtime. DataExporter calls into Smart.Utilities.{Assign, Core.toDash}
// at registration; the other namespaces (DateTime, NumberRenderer, Draw,
// BigNumber, Complex) are guarded by `if (!Smart.Utilities.X) return e;` paths
// inside the exporter and degrade gracefully when missing.
//
// We export a function instead of relying on import-side-effects so callers
// can deterministically install the shim before the smart.export.js module
// runs its IIFE.

type SmartGlobal = {
  Utilities: {
    Assign(name: string, cls: unknown): void
    Core: {
      toDash(input: string): string
    }
    DataExporter?: new (
      options: Record<string, unknown>,
      groupBy?: ReadonlyArray<string>,
      filterBy?: Record<string, unknown>,
      conditionalFormatting?: unknown,
    ) => SmartDataExporterInstance
    [key: string]: unknown
  }
}

/**
 * Shape of the image object Smart's xlsx writer expects from
 * `addImageToCell(...).image`. `base64` may be a full data URL; the
 * exporter strips the prefix.
 */
export type SmartImageDescriptor = {
  id: string
  base64: string
  imageType: string
  width: number
  height: number
}

export type SmartDataExporterInstance = {
  /**
   * Smart looks for these on the INSTANCE (not the constructor opts) at
   * exportData() time. The wrapper sets them after `new DataExporter(...)`.
   */
  headerContent?: Array<{
    cells: Record<string, unknown>
    style?: Record<string, unknown>
  }>
  footerContent?: Array<{
    cells: Record<string, unknown>
    style?: Record<string, unknown>
  }>
  addImageToCell?: (
    rowIndex: number,
    dataField: string,
    value: unknown,
    rawValue: unknown,
    row: Record<string, unknown>,
    arrIndex: number,
  ) => { image: SmartImageDescriptor; value?: unknown } | null
  spreadsheets?: ReadonlyArray<{
    label: string
    dataSource: ReadonlyArray<Record<string, unknown>>
    columns: ReadonlyArray<{ dataField: string; label: string }>
    dataFields: ReadonlyArray<string>
    style?: unknown
  }>
  exportData(
    data: ReadonlyArray<Record<string, unknown>>,
    format: string,
    filename?: string,
    callback?: (result: unknown) => void,
  ): unknown
}

declare global {
  interface Window {
    Smart?: SmartGlobal
  }
}

let installed = false

export function installSmartShim(): void {
  if (installed) return
  if (typeof window === 'undefined') {
    throw new Error('@svgrid/enterprise: installSmartShim() requires a browser environment')
  }
  const existing = window.Smart
  const shim: SmartGlobal = existing ?? ({ Utilities: {} as SmartGlobal['Utilities'] })
  shim.Utilities = shim.Utilities ?? ({} as SmartGlobal['Utilities'])
  if (typeof shim.Utilities.Assign !== 'function') {
    shim.Utilities.Assign = (name: string, cls: unknown) => {
      ;(shim.Utilities as Record<string, unknown>)[name] = cls
    }
  }
  if (!shim.Utilities.Core || typeof shim.Utilities.Core.toDash !== 'function') {
    shim.Utilities.Core = {
      toDash: (s: string) => s.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase()),
    }
  }
  window.Smart = shim
  installed = true
}
