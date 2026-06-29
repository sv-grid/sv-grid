// Build the website favicon: the SvGrid data-table mark, simplified to stay
// legible at 16-24px (a header row + 2 body rows, with the right "active /
// sorted" column solid brand-orange top-to-bottom). Prints the inline data URI
// to paste into website/index.html's <link rel="icon">, and writes a standalone
// SVG to website/public/brand/svgrid-favicon.svg.
//
//   node tools/render-favicon.mjs
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ACCENT = '#ff5a1f' // matches website/public/brand/svgrid-logo-icon-1200.svg
const INK = '#e7edf5'

// 24-unit grid. 3 columns (wide label + 2 value cols); the right column is the
// orange "active" column. 1 header band + 2 body bands, sized tall with wide
// gaps so the rows don't merge into a smudge at favicon sizes.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><rect x=".5" y=".5" width="23" height="23" rx="5" fill="#111a2e"/><rect x=".5" y=".5" width="23" height="23" rx="5" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="1"/><rect x="4.5" y="4.5" width="6" height="3.6" rx="1.2" fill="${INK}" opacity=".95"/><rect x="11.5" y="4.5" width="3.2" height="3.6" rx="1.2" fill="${INK}" opacity=".95"/><rect x="15.7" y="4.5" width="3.8" height="3.6" rx="1.2" fill="${ACCENT}"/><rect x="4.5" y="10.2" width="6" height="3.6" rx="1" fill="${INK}" opacity=".32"/><rect x="11.5" y="10.2" width="3.2" height="3.6" rx="1" fill="${INK}" opacity=".32"/><rect x="15.7" y="10.2" width="3.8" height="3.6" rx="1" fill="${ACCENT}"/><rect x="4.5" y="15.9" width="6" height="3.6" rx="1" fill="${INK}" opacity=".32"/><rect x="11.5" y="15.9" width="3.2" height="3.6" rx="1" fill="${INK}" opacity=".32"/><rect x="15.7" y="15.9" width="3.8" height="3.6" rx="1" fill="${ACCENT}"/></svg>`

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
writeFileSync(resolve(ROOT, 'website/public/brand/svgrid-favicon.svg'), svg + '\n')

const dataUri = 'data:image/svg+xml,' + encodeURIComponent(svg)
console.log('Wrote website/public/brand/svgrid-favicon.svg\n')
console.log('Paste this into website/index.html <link rel="icon" href="...">:\n')
console.log(dataUri)
