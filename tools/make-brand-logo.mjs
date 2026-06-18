// Generate ad-ready SvGrid logo assets (SVG + PNG) from the real Logo.svelte
// geometry. Outputs to website/public/brand/. PNG via @resvg/resvg-js.
//
//   node tools/make-brand-logo.mjs
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const OUT = join(process.cwd(), 'website', 'public', 'brand')

const BG = '#0e1525'
const INK = '#e7edf5'
const ACCENT = '#ff5a1f' // brand orange (matches --site-brand / the "Sv" wordmark)
const FONT = 'Inter, system-ui, Arial, sans-serif'

// The mark on a 24-unit grid (verbatim geometry from Logo.svelte): segmented
// header row, a sort caret + highlighted "active" column in brand orange,
// three body rows. Returned as inner SVG to be wrapped in a transform.
function mark() {
  const cols = [{ x: 4, w: 6 }, { x: 11, w: 4 }, { x: 16, w: 4 }]
  const rows = [9, 13, 17]
  const A = cols[2] // active (sorted) column
  const cx = A.x + A.w / 2
  let s = ''
  for (const c of cols) s += `<rect x="${c.x}" y="4" width="${c.w}" height="4" rx="1.2" fill="${INK}" opacity="0.95"/>`
  s += `<path d="M${cx - 1.1} 5.4 L${cx + 1.1} 5.4 L${cx} 6.9 Z" fill="${ACCENT}"/>`
  for (const y of rows)
    for (const c of cols) {
      const active = c === A
      s += `<rect x="${c.x}" y="${y}" width="${c.w}" height="3" rx="0.9" fill="${active ? ACCENT : INK}" opacity="${active ? 1 : 0.32}"/>`
    }
  return s
}

function wordmark(x, y, size, anchor = 'start') {
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-weight="800" font-size="${size}" letter-spacing="${(-size * 0.03).toFixed(1)}" text-anchor="${anchor}"><tspan fill="${ACCENT}">Sv</tspan><tspan fill="${INK}">Grid</tspan></text>`
}

// 1) Icon only, square 1:1 (best for the circular "logo" slot)
function iconSquare() {
  const S = 1200, m = 700, t = (S - m) / 2, sc = m / 24
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="220" fill="${BG}"/>
  <g transform="translate(${t} ${t}) scale(${sc})">${mark()}</g>
</svg>`
}

// 2) Icon + wordmark stacked, square 1:1
function square() {
  const S = 1200, m = 520, t = (S - m) / 2, sc = m / 24
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" fill="${BG}"/>
  <g transform="translate(${t} 230) scale(${sc})">${mark()}</g>
  ${wordmark(S / 2, 1010, 168, 'middle')}
</svg>`
}

// 3) Horizontal lockup 4:1 (1200x300) - icon left, wordmark right
function landscape() {
  const W = 1200, H = 300, m = 200, sc = m / 24
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <g transform="translate(120 ${(H - m) / 2}) scale(${sc})">${mark()}</g>
  ${wordmark(380, 195, 130)}
</svg>`
}

function getResvg() {
  const req = createRequire(new URL('../website/package.json', import.meta.url))
  return req('@resvg/resvg-js').Resvg
}

async function main() {
  await mkdir(OUT, { recursive: true })
  const Resvg = getResvg()
  const assets = [
    ['svgrid-logo-icon-1200', iconSquare()],
    ['svgrid-logo-square-1200', square()],
    ['svgrid-logo-landscape-1200x300', landscape()],
  ]
  for (const [name, svg] of assets) {
    await writeFile(join(OUT, `${name}.svg`), svg, 'utf-8')
    const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'Arial' } })
      .render().asPng()
    await writeFile(join(OUT, `${name}.png`), png)
    process.stdout.write(`  ${name}.svg + .png\n`)
  }
  process.stdout.write(`brand logos -> website/public/brand/\n`)
}
main()
