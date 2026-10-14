/**
 * gallery (view) - registers the Enterprise gallery renderer with the grid so
 * `<SvGrid gallery={...}>` renders its rows as cards instead of the table.
 * The grid ships the `gallery` prop and its config type for free; the
 * *renderer* (SvGridGallery) is Pro and plugs in through the grid's
 * `registerGalleryView` seam.
 *
 * Like the rest of Enterprise it runs without a license key during the
 * evaluation; the grid shows the watermark and a one-time console notice.
 *
 * ```ts
 * import { setLicenseKey, enableGalleryView } from '@svgrid/enterprise'
 * setLicenseKey('YOUR-KEY')
 * enableGalleryView()
 * // then: <SvGrid {data} {columns} gallery={{ coverField: 'photo' }} />
 * ```
 */
import { registerGalleryView } from '@svgrid/grid'
import { hasValidLicense } from './license'
import { emitUnlicensedNudge } from './watermark'
import SvGridGallery from './SvGridGallery.svelte'

let enabled = false

/**
 * Register the Enterprise gallery view. Idempotent - safe to call from every
 * component that uses `gallery`, or once at app start. Also invoked by
 * {@link installEnterprise} so wiring the Pro API turns the view on too.
 */
export function enableGalleryView(): void {
  if (enabled) return
  enabled = true
  registerGalleryView(SvGridGallery as never)
  if (!hasValidLicense()) emitUnlicensedNudge()
}

export { default as SvGridGallery } from './SvGridGallery.svelte'
