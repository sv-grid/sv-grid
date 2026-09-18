/**
 * `@svgrid/enterprise/wc`: importing it registers `<sv-sheet>`, the
 * spreadsheet shell as a custom element for a page or a host with no Svelte
 * in its build. The element's surface is generated from `<SvSheet>`'s own
 * props (`scripts/generate-sheet-surface.mjs`); see
 * docs/help/web-components/sv-sheet.md.
 */
import './sv-sheet-element.svelte'

export type { SvSheetElement, SvSheetEventMap } from './types/sv-sheet-element'
export { ELEMENT_PROPS, ELEMENT_EVENTS, ELEMENT_METHODS } from './surface-sheet.generated.js'
