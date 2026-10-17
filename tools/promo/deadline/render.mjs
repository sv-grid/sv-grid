#!/usr/bin/env node
/**
 * Render the "Deadline" cartoon promo to MP4.
 *
 *   node tools/promo/deadline/render.mjs [--preview 1,9,19]
 *
 * 1. Captures the real grid for the last scene: the runnable doc snippet
 *    getting-started-4-features--1, mounted by the recording stage in the demo
 *    gallery (started on :5174 if it is not running). The <SvGrid> the cartoon
 *    types is that snippet's own call.
 * 2. Steps scene.html through every frame with window.__seek(t), so timing is
 *    exact however slow the screenshots are.
 * 3. Synthesizes the sound track in code (ticks, heartbeat, drone, errors,
 *    typing, chime) - no audio assets, no licences to track.
 * 4. Encodes H.264 + AAC with ffmpeg.
 *
 * --preview t1,t2,... writes only those frames as PNGs, for a quick look.
 *
 * Out: marketing/videos/deadline/deadline.mp4, poster.jpg, caption.txt.
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'deadline')
const FPS = 30
const DURATION = 27
const SNIPPET = 'getting-started-4-features--1'

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()

/* --------------------------------------------------------------- gallery */
async function reachable(url) {
  try { return (await fetch(url)).status < 500 } catch { return false }
}
async function ensureGallery() {
  if (await reachable('http://localhost:5174/stage.html')) return null
  const vite = join(ROOT, 'examples', 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [vite, '--port', '5174', '--strictPort'], { cwd: join(ROOT, 'examples'), stdio: 'ignore', windowsHide: true })
  for (let i = 0; i < 180; i++) {
    if (await reachable('http://localhost:5174/stage.html')) return child
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('the gallery did not start on :5174')
}
function killTree(child) {
  if (!child?.pid) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

/** The snippet's grid, rendered for real, sized to the cartoon laptop's screen. */
async function captureGrid(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2, colorScheme: 'dark' })
  await ctx.addInitScript(() => { try { localStorage.setItem('sg-theme', 'dark'); localStorage.setItem('sg-preset', 'ember') } catch {} })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5174/stage.html', { waitUntil: 'load', timeout: 180_000 })
  await page.waitForFunction(() => !!window.__stage, null, { timeout: 60_000 })
  await page.evaluate(async (id) => {
    await window.__stage.show('browser')
    await window.__stage.browser.snippet(id, { loadMs: 50 })
  }, SNIPPET)
  await page.addStyleTag({ content: `.br-page-snippet { flex: 0 0 auto !important; width: 900px; padding: 0 !important; }
    .br-page-snippet .sv-grid-root { width: 900px; }` })
  await page.waitForSelector('.br-page-snippet [data-svgrid-row]', { timeout: 60_000 })
  const rows = await page.evaluate(() => new Set([...document.querySelectorAll('.br-page-snippet [data-svgrid-row]')].map((e) => e.getAttribute('data-svgrid-row'))).size)
  if (rows < 5) throw new Error(`the snippet rendered ${rows} rows, expected its 5`)
  await page.waitForTimeout(500)
  const png = await page.locator('.br-page-snippet .sv-grid-root').screenshot({ animations: 'disabled' })
  await ctx.close()
  return `data:image/png;base64,${png.toString('base64')}`
}

/* ----------------------------------------------------------------- sound */
const RATE = 44100
function synthesize() {
  const n = Math.ceil(DURATION * RATE)
  const out = new Float32Array(n)
  const add = (at, len, fn) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) out[s0 + i] += fn(i / RATE)
  }
  // Deterministic noise, so a re-render is byte-identical.
  let seed = 7
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)

  const tick = (at, f) => add(at, 0.05, (t) => 0.45 * sin(f, t) * Math.exp(-t * 90))
  const thump = (at, a = 0.9) => add(at, 0.3, (t) => a * sin(52, t) * Math.exp(-t * 16))
  const boom = (at) => add(at, 1.0, (t) => 0.95 * sin(42, t) * Math.exp(-t * 5) + 0.35 * noise() * Math.exp(-t * 25))
  const whoosh = (at) => add(at, 0.4, (t) => 0.22 * noise() * Math.sin((Math.PI * t) / 0.4))
  const buzz = (at) => add(at, 0.45, (t) => 0.28 * Math.sign(sin(140, t)) * Math.exp(-t * 3.5))
  const key = (at) => add(at, 0.03, (t) => 0.22 * noise() * Math.exp(-t * 160))
  const step = (at) => add(at, 0.12, (t) => 0.35 * sin(90, t) * Math.exp(-t * 30) + 0.08 * noise() * Math.exp(-t * 60))
  const chime = (at, base = 1046.5, a = 0.32) =>
    add(at, 1.6, (t) => a * (sin(base, t) + 0.6 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2.6))
  const pop = (at) => add(at, 0.12, (t) => 0.3 * sin(660 + 900 * t, t) * Math.exp(-t * 30))

  // Tension drone under the first half, cut dead at the switch.
  add(0, 14.6, (t) => 0.12 * sin(55, t) * (0.7 + 0.3 * sin(0.8, t)) * Math.min(1, t * 2) + 0.05 * sin(82.5, t))
  boom(0.73)
  // Clock: steady, then faster once the AI starts.
  for (let t = 0, i = 0; t < 8.2; t += 0.5, i++) tick(t, i % 2 ? 1800 : 2400)
  for (let t = 8.2, i = 0; t < 14.6; t += 0.31, i++) tick(t, i % 2 ? 1800 : 2400)
  for (let t = 3.2; t < 8.2; t += 0.275) step(t)
  for (let t = 8.4; t < 14.6; t += 0.62) { thump(t); thump(t + 0.17, 0.6) }
  whoosh(3.2); whoosh(8.2)
  buzz(12.55); buzz(13.75)
  // The switch: silence, then typing.
  whoosh(14.6)
  const typeKeys = (t0, t1, cps) => { for (let t = t0, i = 0; t < t1; t += 1 / cps, i++) key(t + ((i * 37) % 11) / 400) }
  typeKeys(14.8, 15.6, 30)
  typeKeys(16.0, 17.2, 22)
  chime(18.3)
  pop(18.9); pop(20.1)
  chime(22.9, 523.25, 0.28)

  // 16-bit mono WAV, gently limited.
  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.tanh(out[i]) * 32000), i * 2)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/* ---------------------------------------------------------------- render */
mkdirSync(OUT, { recursive: true })
const gallery = await ensureGallery()
const browser = await chromium.launch()
try {
  const grid = await captureGrid(browser)
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate((src) => window.__setGrid(src), grid)

  if (previewAt) {
    for (const t of previewAt) {
      await page.evaluate((x) => window.__seek(x), t)
      await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const frames = join(tmpdir(), 'svgrid-deadline-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = DURATION * FPS
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 90 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate(() => window.__seek(19.6))
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const wav = join(frames, 'track.wav')
    writeFileSync(wav, synthesize())
    const mp4 = join(OUT, 'deadline.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), '-i', wav,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
      '-c:a', 'aac', '-b:a', '192k', '-shortest', mp4], { stdio: 'inherit' })
    writeFileSync(join(OUT, 'caption.txt'),
      "4:52 PM. The grid is due at 5. Don't generate a data grid, install one: npm install @svgrid/grid. Sorting, filtering, editing, grouping and paging are props on one Svelte 5 component.\n\n#svelte #sveltejs #webdev #programming #developer #coding #deadline #javascript\n")
    rmSync(frames, { recursive: true, force: true })
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  killTree(gallery)
}
