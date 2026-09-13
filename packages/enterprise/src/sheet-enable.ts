/**
 * Excel keyboard commands (Pro). `enableSheet()` registers the sheet keymap
 * with the grid, so Ctrl+Arrow jumps to the edge of a data region, Ctrl+D and
 * Ctrl+R fill, Ctrl+A selects the current region, and the rest of the Excel
 * muscle memory works on any `<SvGrid>` with cell selection on.
 *
 * The grid ships the `registerGridShortcuts` seam for free and interprets a key
 * itself only when nothing claims it; the commands are here. Soft-gated like
 * the rest of Enterprise: it works without a license key but the grid shows the
 * unlicensed watermark and a one-time console nudge.
 *
 * ```ts
 * import { setLicenseKey, enableSheet } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableSheet()
 * // then: <SvGrid {data} {columns} enableCellSelection />
 * ```
 */
// The Svelte-free subpath: importing the barrel would drag SvGrid.svelte into
// this module's chunk, and into any unit test that touches it.
import { registerGridShortcuts } from '@svgrid/grid/shortcuts'
import { isLicenseKeySet } from './license'
import { emitUnlicensedNudge } from './watermark'
import { handleSheetKey } from './sheet/shortcuts'

let enabled = false

/**
 * Register the Excel keymap. Idempotent - safe to call from every component
 * that wants it, or once at app start. Also invoked by {@link installEnterprise}
 * so wiring the Pro API turns the shortcuts on too.
 */
export function enableSheet(): void {
  if (enabled) return
  enabled = true
  // Priority 100 so the sheet keymap sits above anything an app registers of
  // its own without asking for a priority.
  registerGridShortcuts(handleSheetKey, { id: 'svgrid-sheet', priority: 100 })
  if (!isLicenseKeySet()) emitUnlicensedNudge()
}
