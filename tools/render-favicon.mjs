// Build the full favicon set from the SvGrid data-table mark.
//
//   node tools/render-favicon.mjs
//
// Emits to website/public/:
//   - brand/svgrid-favicon.svg   the source SVG (also inlined in index.html)
//   - favicon.ico                16/32/48 multi-resolution (PNG-compressed)
//   - favicon-16.png, favicon-32.png
//   - apple-touch-icon.png       180x180, full-bleed (iOS rounds it itself)
// and prints the inline data URI to paste into index.html's SVG <link rel=icon>.
//
// The glyph is simplified to stay legible at 16px (header row + 2 body rows,
// right "active" column solid orange). PNGs are rasterized with @resvg/resvg-js
// (a website devDependency, same as the blog cards); if it can't be resolved
// the SVG + data URI are still written and the raster set is skipped.
import { writeFile, mkdir } from 'node:fs/promises'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = resolve(ROOT, 'website/public')

const ACCENT = '#ff5a1f' // matches website/public/brand/svgrid-logo-icon-1200.svg
const INK = '#e7edf5'
const PLATE = '#111a2e'

// The data-table glyph rects (shared by every variant). 24-unit grid.
const GLYPH = `
  <rect x="4.5" y="4.5" width="6" height="3.6" rx="1.2" fill="${INK}" opacity=".95"/>
  <rect x="11.5" y="4.5" width="3.2" height="3.6" rx="1.2" fill="${INK}" opacity=".95"/>
  <rect x="15.7" y="4.5" width="3.8" height="3.6" rx="1.2" fill="${ACCENT}"/>
  <rect x="4.5" y="10.2" width="6" height="3.6" rx="1" fill="${INK}" opacity=".32"/>
  <rect x="11.5" y="10.2" width="3.2" height="3.6" rx="1" fill="${INK}" opacity=".32"/>
  <rect x="15.7" y="10.2" width="3.8" height="3.6" rx="1" fill="${ACCENT}"/>
  <rect x="4.5" y="15.9" width="6" height="3.6" rx="1" fill="${INK}" opacity=".32"/>
  <rect x="11.5" y="15.9" width="3.2" height="3.6" rx="1" fill="${INK}" opacity=".32"/>
  <rect x="15.7" y="15.9" width="3.8" height="3.6" rx="1" fill="${ACCENT}"/>`

// Rounded plate + hairline border - for the tab favicon (SVG + .ico + pngs).
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><rect x=".5" y=".5" width="23" height="23" rx="5" fill="${PLATE}"/><rect x=".5" y=".5" width="23" height="23" rx="5" fill="none" stroke="rgba(148,163,184,0.28)" stroke-width="1"/>${GLYPH}</svg>`

// Full-bleed square (no rounded corners / border) - iOS masks + rounds the
// apple-touch icon itself, and wants an opaque square.
const appleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="180" height="180"><rect width="24" height="24" fill="${PLATE}"/>${GLYPH}</svg>`

function getResvg() {
  try {
    const req = createRequire(new URL('../website/package.json', import.meta.url))
    return req('@resvg/resvg-js').Resvg
  } catch {
    return null
  }
}

function pngFromSvg(Resvg, svg, size) {
  const r = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  return Buffer.from(r.render().asPng())
}

// Minimal ICO encoder wrapping PNG buffers (modern .ico supports PNG entries).
function buildIco(entries /* [{size, png}] */) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)
  const dir = Buffer.alloc(16 * entries.length)
  let offset = 6 + dir.length
  entries.forEach((e, i) => {
    const o = i * 16
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 0) // width
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, o + 1) // height
    dir.writeUInt8(0, o + 2) // palette
    dir.writeUInt8(0, o + 3) // reserved
    dir.writeUInt16LE(1, o + 4) // color planes
    dir.writeUInt16LE(32, o + 6) // bits per pixel
    dir.writeUInt32LE(e.png.length, o + 8)
    dir.writeUInt32LE(offset, o + 12)
    offset += e.png.length
  })
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)])
}

async function main() {
  await mkdir(resolve(PUBLIC, 'brand'), { recursive: true })
  await writeFile(resolve(PUBLIC, 'brand/svgrid-favicon.svg'), faviconSvg + '\n')

  const dataUri = 'data:image/svg+xml,' + encodeURIComponent(faviconSvg)
  console.log('Wrote website/public/brand/svgrid-favicon.svg')

  const Resvg = getResvg()
  if (!Resvg) {
    console.warn('[render-favicon] @resvg/resvg-js not resolved - skipped PNG/ICO set.')
  } else {
    const png16 = pngFromSvg(Resvg, faviconSvg, 16)
    const png32 = pngFromSvg(Resvg, faviconSvg, 32)
    const png48 = pngFromSvg(Resvg, faviconSvg, 48)
    const apple = pngFromSvg(Resvg, appleSvg, 180)
    await writeFile(resolve(PUBLIC, 'favicon-16.png'), png16)
    await writeFile(resolve(PUBLIC, 'favicon-32.png'), png32)
    await writeFile(resolve(PUBLIC, 'apple-touch-icon.png'), apple)
    await writeFile(
      resolve(PUBLIC, 'favicon.ico'),
      buildIco([
        { size: 16, png: png16 },
        { size: 32, png: png32 },
        { size: 48, png: png48 },
      ]),
    )
    console.log('Wrote favicon.ico (16/32/48), favicon-16.png, favicon-32.png, apple-touch-icon.png')
  }

  console.log('\nInline SVG data URI for index.html <link rel="icon" type="image/svg+xml">:\n')
  console.log(dataUri)
}

main()
