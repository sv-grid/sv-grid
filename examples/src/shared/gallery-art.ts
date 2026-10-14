/**
 * Pictures for the gallery demos, drawn as SVG so the demos need no image
 * host: studio product shots, houses, portraits, editorial artwork and
 * ceramics. Each returns a `data:image/svg+xml` URL; the same inputs always
 * give the same picture.
 */

const url = (svg: string) => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** A small deterministic generator, so a picture depends only on its seed. */
function rand(seed: number) {
  let s = (seed * 9301 + 49297) % 233280
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}
const pick = <T>(r: () => number, list: readonly T[]): T => list[Math.floor(r() * list.length)]!

// ---- Products on a studio backdrop -----------------------------------------

export type ProductKind = 'chair' | 'lamp' | 'mug' | 'clock' | 'plant' | 'speaker'

const STUDIO = `<defs>
  <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f3ee"/><stop offset="1" stop-color="#e9e3da"/></linearGradient>
  <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2dbd0"/><stop offset="1" stop-color="#d5ccbf"/></linearGradient>
  <radialGradient id="light" cx=".35" cy=".25" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
</defs>
<rect width="400" height="300" fill="url(#wall)"/>
<rect y="214" width="400" height="86" fill="url(#floor)"/>
<rect width="400" height="300" fill="url(#light)"/>`

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + amount * 255)))
  const r = ch((n >> 16) & 255)
  const g = ch((n >> 8) & 255)
  const b = ch(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

/** A product photographed on a warm studio backdrop, with a soft floor shadow. */
export function productShot(kind: ProductKind, color: string): string {
  const dark = shade(color, -0.16)
  const light = shade(color, 0.12)
  const wood = '#a5764c'
  const parts: Record<ProductKind, string> = {
    chair: `<ellipse cx="200" cy="246" rx="92" ry="12" fill="#000" opacity=".22" filter="url(#soft)"/>
      <path d="M150 230l6-70h8l-4 70zM250 230l-6-70h-8l4 70zM168 236l4-62h8l-2 62zM232 236l-4-62h-8l2 62z" fill="${wood}"/>
      <rect x="138" y="70" width="124" height="104" rx="26" fill="url(#c)"/>
      <rect x="128" y="150" width="144" height="34" rx="14" fill="${dark}"/>
      <rect x="132" y="146" width="136" height="26" rx="12" fill="${light}"/>`,
    lamp: `<ellipse cx="200" cy="250" rx="58" ry="9" fill="#000" opacity=".22" filter="url(#soft)"/>
      <rect x="196" y="112" width="8" height="128" fill="url(#brass)"/>
      <ellipse cx="200" cy="244" rx="44" ry="8" fill="url(#brass)"/>
      <path d="M146 112l20-62h68l20 62z" fill="url(#c)"/>
      <ellipse cx="200" cy="112" rx="54" ry="7" fill="${dark}"/>
      <ellipse cx="200" cy="128" rx="70" ry="20" fill="#fff6d8" opacity=".35" filter="url(#soft)"/>`,
    mug: `<ellipse cx="200" cy="232" rx="70" ry="10" fill="#000" opacity=".22" filter="url(#soft)"/>
      <path d="M252 140h18a30 30 0 0 1 0 60h-18v-14h16a16 16 0 0 0 0-32h-16z" fill="${dark}"/>
      <path d="M146 112h108v98a22 22 0 0 1-22 22h-64a22 22 0 0 1-22-22z" fill="url(#c)"/>
      <ellipse cx="200" cy="112" rx="54" ry="10" fill="${dark}"/>
      <ellipse cx="200" cy="112" rx="48" ry="7" fill="#3b2a20"/>
      <rect x="160" y="128" width="8" height="84" rx="4" fill="#fff" opacity=".28"/>`,
    clock: `<ellipse cx="200" cy="246" rx="70" ry="9" fill="#000" opacity=".2" filter="url(#soft)"/>
      <circle cx="200" cy="140" r="86" fill="url(#c)"/>
      <circle cx="200" cy="140" r="72" fill="#fbfaf7"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="198" y="74" width="4" height="${i % 3 ? 7 : 12}" fill="#2b2b2b" transform="rotate(${i * 30} 200 140)"/>`).join('')}
      <rect x="197" y="96" width="6" height="48" rx="3" fill="#2b2b2b"/>
      <rect x="198" y="137" width="40" height="5" rx="2.5" fill="#2b2b2b" transform="rotate(35 200 140)"/>
      <circle cx="200" cy="140" r="6" fill="${dark}"/>`,
    plant: `<ellipse cx="200" cy="250" rx="64" ry="10" fill="#000" opacity=".22" filter="url(#soft)"/>
      ${[-58, -34, -12, 10, 32, 56].map((a, i) => `<path d="M200 168c-14-40-6-80 0-104 6 24 14 64 0 104z" fill="${['#3f7d4f', '#4f9160', '#356b43', '#5ea36d', '#467f55', '#3a7348'][i]}" transform="rotate(${a} 200 168)"/>`).join('')}
      <path d="M160 168h80l-10 76a8 8 0 0 1-8 7h-44a8 8 0 0 1-8-7z" fill="url(#c)"/>
      <rect x="156" y="162" width="88" height="14" rx="4" fill="${dark}"/>`,
    speaker: `<ellipse cx="200" cy="248" rx="66" ry="9" fill="#000" opacity=".24" filter="url(#soft)"/>
      <rect x="150" y="56" width="100" height="190" rx="14" fill="url(#c)"/>
      <rect x="150" y="56" width="100" height="22" rx="10" fill="${wood}"/>
      <circle cx="200" cy="114" r="20" fill="${dark}"/><circle cx="200" cy="114" r="9" fill="${shade(color, -0.3)}"/>
      <circle cx="200" cy="186" r="38" fill="${dark}"/><circle cx="200" cy="186" r="18" fill="${shade(color, -0.3)}"/>`,
  }
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">${STUDIO}<defs>
    <linearGradient id="c" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a6a2a"/><stop offset=".5" stop-color="#e0bf6e"/><stop offset="1" stop-color="#8a6a2a"/></linearGradient>
  </defs>${parts[kind]}</svg>`)
}

// ---- Houses -----------------------------------------------------------------

const SIDING = ['#f4f1ea', '#d9dfe3', '#e8dcc6', '#c9d3c0', '#b9c6d2', '#efe3d3', '#8d9aa6']
const ROOF = ['#3d4249', '#5a4b42', '#2f3a45', '#6b5446']
const TRIM = ['#ffffff', '#f7f3ea']
const SKIES: ReadonlyArray<[string, string]> = [
  ['#9cc7ea', '#e6f1fa'],
  ['#f2b98a', '#fbe7cf'],
  ['#b9c3cc', '#e7ebee'],
  ['#86b6e3', '#d9ecfa'],
]

/** A house on its lot: sky, hills, lawn, trees, a driveway; one or two floors. */
export function housePhoto(seed: number, floors: 1 | 2): string {
  const r = rand(seed + 7)
  const [sky1, sky2] = pick(r, SKIES)
  const siding = pick(r, SIDING)
  const roof = pick(r, ROOF)
  const trim = pick(r, TRIM)
  const w = 170 + Math.floor(r() * 50)
  const x = 200 - w / 2 + (r() - 0.5) * 30
  const h = floors === 2 ? 118 : 74
  const ground = 236
  const top = ground - h
  const windows: string[] = []
  const rowsY = floors === 2 ? [top + 18, top + 64] : [top + 20]
  for (const y of rowsY) {
    for (const fx of [0.16, 0.66]) {
      const wx = x + w * fx
      windows.push(`<rect x="${wx}" y="${y}" width="30" height="30" fill="${trim}"/><rect x="${wx + 3}" y="${y + 3}" width="24" height="24" fill="url(#glass)"/><rect x="${wx + 14}" y="${y + 3}" width="2" height="24" fill="${trim}"/>`)
    }
  }
  const tree = (tx: number, s: number) =>
    `<rect x="${tx - 3}" y="${ground - 34 * s}" width="6" height="${34 * s}" fill="#6b4f36"/><circle cx="${tx}" cy="${ground - 48 * s}" r="${26 * s}" fill="url(#leaf)"/><circle cx="${tx - 14 * s}" cy="${ground - 38 * s}" r="${18 * s}" fill="url(#leaf)"/><circle cx="${tx + 14 * s}" cy="${ground - 36 * s}" r="${17 * s}" fill="url(#leaf)"/>`
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>
    <linearGradient id="lawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fa65a"/><stop offset="1" stop-color="#5f8a45"/></linearGradient>
    <linearGradient id="glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#cfe4f2"/><stop offset=".55" stop-color="#7d9fb8"/><stop offset="1" stop-color="#4c6a82"/></linearGradient>
    <linearGradient id="roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(roof, 0.08)}"/><stop offset="1" stop-color="${shade(roof, -0.08)}"/></linearGradient>
    <radialGradient id="leaf" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#7fae5c"/><stop offset="1" stop-color="#3f6b35"/></radialGradient>
    <filter id="soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <rect width="400" height="300" fill="url(#sky)"/>
  <path d="M0 200c60-30 120-34 200-18s140 4 200-16v70H0z" fill="#a7b89a" opacity=".55"/>
  <rect y="${ground}" width="400" height="${300 - ground}" fill="url(#lawn)"/>
  <ellipse cx="${x + w / 2}" cy="${ground + 4}" rx="${w / 2 + 16}" ry="8" fill="#000" opacity=".2" filter="url(#soft)"/>
  <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${siding}"/>
  <rect x="${x}" y="${top}" width="${w}" height="${h}" fill="#000" opacity=".04"/>
  <path d="M${x - 14} ${top + 2}L${x + w / 2} ${top - 52}L${x + w + 14} ${top + 2}z" fill="url(#roof)"/>
  ${windows.join('')}
  <rect x="${x + w / 2 - 15}" y="${ground - 46}" width="30" height="46" fill="${shade(roof, 0.05)}"/>
  <circle cx="${x + w / 2 + 9}" cy="${ground - 22}" r="2" fill="#d8b46a"/>
  <path d="M${x + w / 2 - 15} ${ground}L${x + w / 2 - 40} 300h70L${x + w / 2 + 15} ${ground}z" fill="#d9d2c6"/>
  ${tree(x - 34, 0.9 + r() * 0.3)}${tree(x + w + 38, 0.8 + r() * 0.4)}
  </svg>`)
}

// ---- Portraits --------------------------------------------------------------

const SKIN = ['#f3d2b8', '#e6b896', '#c98f6b', '#a86b4b', '#7a4a32', '#f1c9a5']
const HAIR = ['#2b201a', '#4a3226', '#7a5236', '#c79a5b', '#1d1d1f', '#8c8c8c', '#a0522d']
const SHIRT = ['#3b5b8a', '#6a8f6b', '#b5654a', '#4a4a58', '#c79a3a', '#7b5ea7', '#2f7f86', '#d9d4c7']
const BACKDROP: ReadonlyArray<[string, string]> = [
  ['#e8eef7', '#cfdcee'],
  ['#f4ece4', '#e6d6c6'],
  ['#e9f2ec', '#cfe2d5'],
  ['#f3e9f1', '#e2cfe0'],
  ['#efeee9', '#dcdad1'],
]

/** A head-and-shoulders portrait: skin, hair, shirt and backdrop picked from the seed. */
export function portrait(seed: number): string {
  const r = rand(seed * 3 + 1)
  const skin = pick(r, SKIN)
  const hair = pick(r, HAIR)
  const shirt = pick(r, SHIRT)
  const [b1, b2] = pick(r, BACKDROP)
  const style = Math.floor(r() * 4)
  const hairShape = [
    // short
    `<path d="M62 70c0-26 16-40 38-40s38 14 38 40c-6-12-18-18-38-18s-32 6-38 18z" fill="${hair}"/>`,
    // long
    `<path d="M56 74c0-30 18-46 44-46s44 16 44 46v58c-8 6-16 8-22 8V82c-8-10-36-12-44 0v58c-6 0-14-2-22-8z" fill="${hair}"/>`,
    // bun
    `<circle cx="100" cy="26" r="16" fill="${hair}"/><path d="M62 72c0-26 16-42 38-42s38 16 38 42c-8-14-20-20-38-20s-30 6-38 20z" fill="${hair}"/>`,
    // curly
    `${[[70, 52], [86, 40], [104, 36], [122, 42], [134, 56], [64, 68], [138, 70]].map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="15" fill="${hair}"/>`).join('')}`,
  ][style]
  const glasses = r() < 0.3 ? `<g fill="none" stroke="#2a2a2a" stroke-width="2.5"><circle cx="86" cy="82" r="10"/><circle cx="114" cy="82" r="10"/><path d="M96 82h8"/></g>` : ''
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>
    <linearGradient id="shirt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(shirt, 0.06)}"/><stop offset="1" stop-color="${shade(shirt, -0.08)}"/></linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#bg)"/>
  <path d="M30 200c4-42 34-62 70-62s66 20 70 62z" fill="url(#shirt)"/>
  <rect x="88" y="112" width="24" height="30" rx="10" fill="${shade(skin, -0.06)}"/>
  <ellipse cx="100" cy="82" rx="36" ry="42" fill="${skin}"/>
  ${hairShape}
  ${glasses}
  <path d="M90 104c6 5 14 5 20 0" fill="none" stroke="${shade(skin, -0.25)}" stroke-width="2.5" stroke-linecap="round"/>
  <circle cx="86" cy="84" r="3" fill="#2a2420"/><circle cx="114" cy="84" r="3" fill="#2a2420"/>
  </svg>`)
}

// ---- Editorial artwork --------------------------------------------------------

const PALETTES: ReadonlyArray<readonly string[]> = [
  ['#1f3b4d', '#e8c07d', '#d9694a', '#f3ece1'],
  ['#2d2a32', '#ddd5c7', '#a3b18a', '#f2efe8'],
  ['#3c2f4a', '#f2a65a', '#f6d8ae', '#efe9e1'],
  ['#20403a', '#c8553d', '#f2d0a4', '#f1ede4'],
  ['#2b3a67', '#f4b6c2', '#8ec5c2', '#f5f0e8'],
  ['#4a3b32', '#d4a373', '#ccd5ae', '#faf6ee'],
]

/** Abstract editorial art (arches, a sun, a horizon) in a muted palette. */
export function editorialArt(seed: number): string {
  const r = rand(seed * 5 + 2)
  const [ink, accent, soft, paper] = pick(r, PALETTES) as [string, string, string, string]
  const sunX = 90 + r() * 220
  const arches = Array.from({ length: 3 }, (_, i) => {
    const ax = 40 + i * 120 + r() * 30
    const aw = 70 + r() * 30
    const ah = 120 + r() * 60
    return `<path d="M${ax} 300v-${ah - aw / 2}a${aw / 2} ${aw / 2} 0 0 1 ${aw} 0v${ah - aw / 2}z" fill="${[ink, soft, accent][i]}" opacity="${[0.92, 0.85, 0.9][i]}"/>`
  }).join('')
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
  <rect width="400" height="300" fill="${paper}"/>
  <circle cx="${sunX}" cy="${80 + r() * 40}" r="${46 + r() * 20}" fill="${accent}" opacity=".85"/>
  ${arches}
  <rect y="262" width="400" height="38" fill="${ink}" opacity=".9"/>
  <path d="M0 262h400" stroke="${paper}" stroke-width="2" opacity=".5"/>
  </svg>`)
}

// ---- Ceramics -----------------------------------------------------------------

const GLAZE = ['#c9b8a6', '#9fb4a8', '#d8c3a5', '#8e9aaf', '#c48b6c', '#e7dfd2', '#6f7d6e', '#b7a1b9', '#d5b26c', '#7f9fb0']
const SILHOUETTE = [
  'M176 80h48c-4 20-2 28 10 48 22 36 22 78-8 104h-52c-30-26-30-68-8-104 12-20 14-28 10-48z', // vase
  'M120 168h160c-4 44-36 68-80 68s-76-24-80-68z', // bowl
  'M160 96h80v16c20 10 26 32 26 60 0 38-18 64-66 64s-66-26-66-64c0-28 6-50 26-60z', // jar
  'M188 64h24v40c28 14 40 46 40 80 0 30-16 52-52 52s-52-22-52-52c0-34 12-66 40-80z', // bottle
]

/** A ceramic piece (vase, bowl, jar, bottle) in a glaze, on a soft backdrop. */
export function ceramic(seed: number): string {
  const glaze = GLAZE[seed % GLAZE.length]!
  const shape = SILHOUETTE[Math.floor(seed / GLAZE.length) % SILHOUETTE.length]!
  return url(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"><defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(glaze, 0.3)}"/><stop offset="1" stop-color="${shade(glaze, 0.18)}"/></linearGradient>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${shade(glaze, -0.14)}"/><stop offset=".45" stop-color="${shade(glaze, 0.08)}"/><stop offset="1" stop-color="${shade(glaze, -0.2)}"/></linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="400" height="300" fill="url(#bg)"/>
  <ellipse cx="200" cy="240" rx="96" ry="11" fill="#000" opacity=".18" filter="url(#soft)"/>
  <path d="${shape}" fill="url(#g)" transform="translate(200 236) scale(1.3) translate(-200 -236)"/>
  </svg>`)
}
