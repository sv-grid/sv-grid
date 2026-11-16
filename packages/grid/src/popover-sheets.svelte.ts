/**
 * Popovers as bottom sheets on a phone, for the whole page.
 *
 * `setPopoverSheets('phone')` makes every click-opened `SvPopover` (the view
 * bar's menus, the filter, a table's menu...) open as a sheet from the bottom
 * of the screen when the window is 600px wide or less: the screen's width,
 * a dimmed page behind it, a handle to drag it away, and rows a finger can
 * hit. Hover popovers stay popovers. `'off'` (the default) leaves them all
 * anchored, as on a desktop. A popover's own `sheet` prop wins.
 */
export type PopoverSheetMode = 'off' | 'phone'

/** The width (px) at or under which `'phone'` turns a popover into a sheet. */
export const SHEET_MAX_WIDTH = 600

let mode = $state<PopoverSheetMode>('off')

export function setPopoverSheets(next: PopoverSheetMode): void {
  mode = next
}

export function popoverSheets(): PopoverSheetMode {
  return mode
}
