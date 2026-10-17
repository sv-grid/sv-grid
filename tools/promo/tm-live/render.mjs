#!/usr/bin/env node
/**
 * Render "300,000 rows, live" (SvGrid for a test and measurement team) to MP4.
 *
 *   node --env-file=.env tools/promo/tm-live/render.mjs [--preview t1,t2,...] [--no-payoff]
 *
 * 1. Synthesizes (or reuses) the voice track (voice.mjs) and cuts around it.
 * 2. Records the payoff for real: tutorials-out/app/tm-bench, a Vite +
 *    Svelte 5 app on the published @svgrid/grid, holding 300,000 records
 *    grouped by station. In ?manual mode the recorder fires one batch (+600,
 *    -600, 3,000 updates through api.applyTransaction) per second of video,
 *    since screenshots run slower than real time, and reads what the page
 *    measured on every frame. The recording fails if the page ever holds
 *    other than 300,000 rows, a batch takes a second or more to apply and
 *    paint, or the station groups are gone.
 * 3. Steps scene.html frame by frame, mixes the voices over the score, encodes.
 *
 * Out: marketing/videos/tm-live/tm-live.mp4, poster.jpg, caption.txt.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { mixArgs, placeVoices, prepareVoices, timeline } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'tm-live')
const VOICE_CACHE = join(OUT, '.voice-cache')
const APP = join(ROOT, 'tutorials-out', 'app', 'tm-bench')
const PORT = 4396
const FPS = 30

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const noPayoff = process.argv.includes('--no-payoff')
if (noPayoff && !previewAt) throw new Error('--no-payoff is for previews only')

/* ------------------------------------------------------------- the app */
async function reachable(url) {
  try { return (await fetch(url)).status < 500 } catch { return false }
}
async function serveApp() {
  const base = `http://localhost:${PORT}`
  if (await reachable(base + '/')) throw new Error(`something already serves ${base}`)
  execFileSync('npm', ['run', 'build'], { cwd: APP, stdio: 'ignore', shell: true })
  const child = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: APP, stdio: 'ignore', shell: true, windowsHide: true })
  for (let i = 0; i < 120; i++) {
    if (await reachable(base + '/')) return { base, child }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`the bench did not start on ${base}`)
}
function killTree(child) {
  if (!child?.pid) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

/** The payoff, one screenshot per video frame, one batch per video second. */
async function recordPayoff(browser, base, frameCount) {
  // A small window, so the grid's text survives being shown on a monitor in a phone frame.
  const ctx = await browser.newContext({ viewport: { width: 700, height: 645 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/?manual`, { waitUntil: 'load' })
  await page.waitForSelector('[data-svgrid-row]', { timeout: 60_000 })
  const paint = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
  // Two batches before the camera rolls, so the first one on screen is not a cold one.
  for (let i = 0; i < 2; i++) { await page.evaluate(() => window.__tick()); await page.waitForTimeout(400) }
  const dir = join(tmpdir(), 'svgrid-tm-payoff')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const frames = [], bench = []
  for (let f = 0; f < frameCount; f++) {
    // A batch at 0.5 s into every second of the shot.
    if (f % FPS === Math.round(FPS / 2)) { await page.evaluate(() => window.__tick()); await page.waitForTimeout(350) }
    await paint()
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 86 })
    frames.push(pathToFileURL(file).href)
    const b = await page.evaluate(() => window.__bench())
    if (b.held !== 300_000) throw new Error(`frame ${f}: the page holds ${b.held} rows`)
    if (b.lastMs >= 1000) throw new Error(`frame ${f}: a batch took ${b.lastMs} ms, more than its second`)
    bench.push(b)
  }
  const groups = await page.locator('[role="row"]', { hasText: 'Station: Station 01' }).count()
  if (!groups) throw new Error('the station groups are not on screen')
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return { frames, bench, fps: FPS }
}

/* ----------------------------------------------------------------- score */
const RATE = 44100
function synthesize(T) {
  const n = Math.ceil(T.end * RATE)
  const L = new Float32Array(n)
  const add = (at, len, fn, gain = 1) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += gain * fn(i / RATE)
  }
  let seed = 31
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 112, EIGHTH = BEAT / 2
  const kick = (at, a = 0.9) => add(at, 0.35, (t) => a * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9))
  const bass = (at, f, a = 0.35, len = EIGHTH * 0.9) => add(at, len, (t) => a * (sin(f, t) + 0.35 * sin(f * 2, t)) * Math.min(1, t * 200) * Math.exp(-t * 4))
  const hat = (at, a = 0.08) => add(at, 0.04, () => a * noise())
  const pluck = (at, f, a = 0.16) => add(at, 0.5, (t) => a * (sin(f, t) + 0.3 * sin(f * 2, t)) * Math.exp(-t * 7))
  const blip = (at, f = 1800, a = 0.07) => add(at, 0.05, (t) => a * sin(f, t) * Math.exp(-t * 60))
  const key = (at) => add(at, 0.03, (t) => 0.2 * noise() * Math.exp(-t * 170))
  const whoosh = (at, len = 0.45, a = 0.25) => add(at, len, (t) => a * noise() * Math.sin((Math.PI * t) / len))
  const riser = (at, len, a = 0.18) => add(at, len, (t) => a * (t / len) * (0.6 * noise() + sin(200 + 900 * (t / len) * (t / len), t)))
  const crash = (at) => add(at, 0.9, (t) => 0.28 * (0.7 * noise() + Math.sign(sin(110, t))) * Math.exp(-t * 4))
  const chime = (at, base, a = 0.25) => add(at, 2, (t) => a * (sin(base, t) + 0.6 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2.2))

  // The lab hum, and the instruments blipping.
  { let lp = 0; for (let i = 0; i < Math.floor(T.s7[0] * RATE); i++) { lp += 0.02 * (noise() - lp); L[i] += 0.05 * lp * 4 + 0.012 * sin(60, i / RATE) } }
  for (let t = 0.4; t < T.s7[0]; t += 0.37) blip(t, 1400 + ((t * 977) % 900), 0.04)
  // Act 1: a low pulse, tightening with the spec.
  kick(0.3, 0.9)
  for (let t = 0.3; t < T.s4[0]; t += EIGHTH) {
    const step = Math.round((t - 0.3) / EIGHTH)
    bass(t, step % 8 === 6 ? 58.27 : 55, t > T.s3[0] ? 0.42 : 0.3)
    if (t > T.s2[0]) hat(t + EIGHTH / 2, 0.06)
    if (step % 4 === 0 && t > T.s3[0]) kick(t, 0.5)
  }
  // The spec: a tick per second, the feed scrolling.
  for (let t = T.s3[0]; t < T.s4[0]; t += 0.5) blip(t, 2400, 0.12)
  // The failed grids: a crash each, the pulse stuttering in between.
  for (const h of [T.failA, T.failB, T.failC]) crash(h)
  for (let t = T.s4[0]; t < T.s5[0]; t += EIGHTH * 2) bass(t, 52, 0.3)
  riser(T.s5[0] - 0.2, T.s5[1] - T.s5[0] + 0.2, 0.16)
  // The code typed, then the drop.
  whoosh(T.s6[0], 0.4, 0.3)
  for (let t = T.s6[0] + 0.2, i = 0; t < T.s6[1] - 0.5; t += 0.05, i++) if (i % 9 < 6) key(t + ((i * 31) % 7) / 600)
  riser(T.s7[0] - 1.0, 1.0, 0.24)
  kick(T.s7[0], 1)
  const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  for (let bar = 0, t0 = T.s7[0]; t0 < T.s8[1]; bar++, t0 += BEAT * 4) {
    const chord = chords[bar % 4]
    add(t0, BEAT * 4, (t) => 0.05 * chord.reduce((s, f) => s + sin(f, t) + sin(f * 1.003, t), 0) * Math.min(1, t * 3) * Math.min(1, (BEAT * 4 - t) * 4))
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.6)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= T.s8[1]) break
      pluck(at, chord[e % 3] * 2, 0.13)
      hat(at + EIGHTH / 2, 0.05)
      bass(at, chord[0] / 2, 0.28)
    }
  }
  // End card.
  chime(T.s9[0], 880, 0.22)
  const len9 = T.s9[1] - T.s9[0]
  add(T.s9[0], len9, (t) => 0.05 * [220, 277.18, 329.63, 440].reduce((s, f) => s + sin(f, t), 0) * Math.min(1, t * 2) * Math.max(0, 1 - t / len9))

  const data = Buffer.alloc(n * 2)
  for (let i = 0; i < n; i++) data.writeInt16LE(Math.round(Math.tanh(L[i] * 0.95) * 32000), i * 2)
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22)
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/* ---------------------------------------------------------------- render */
mkdirSync(OUT, { recursive: true })
const takes = await prepareVoices(VOICE_CACHE)
const { T, at } = timeline(Object.fromEntries(takes.map((v) => [v.id, v.dur])))
const voices = placeVoices(takes, at)
for (const v of voices) console.log(`  ${v.at.toFixed(2)}s  ${v.who.padEnd(8)} ${v.dur.toFixed(2)}s  ${v.text}`)
console.log(`cut: ${T.end.toFixed(2)} s; payoff ${T.s7[0].toFixed(2)}-${T.s7[1].toFixed(2)} s`)

const browser = await chromium.launch()
let app = null
try {
  let payoff = null
  if (!noPayoff) {
    app = await serveApp()
    const len = T.s7[1] - T.s7[0]
    const count = previewAt ? Math.max(1, ...previewAt.filter((t) => t >= T.s7[0]).map((t) => Math.ceil((t - T.s7[0]) * FPS) + 1)) : Math.ceil(len * FPS)
    console.log(`recording the payoff (${count} frames) ...`)
    payoff = await recordPayoff(browser, app.base, count)
    const ms = payoff.bench.map((b) => b.lastMs)
    console.log(`  batches applied + painted in ${Math.min(...ms)}-${Math.max(...ms)} ms; rows held: ${payoff.bench[0].held}`)
  }

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate((x) => window.__setTimeline(x), T)
  if (payoff) await page.evaluate((p) => window.__setPayoff(p), payoff)
  const settle = () => page.evaluate(() => new Promise((r) => { const img = document.getElementById('payoffImg'); if (!img.src || img.complete) r(); else img.onload = r }))

  if (previewAt) {
    for (const t of previewAt) {
      await page.evaluate((x) => window.__seek(x), t)
      await settle()
      await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const frames = join(tmpdir(), 'svgrid-tm-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 150 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), T.s7[0] + 3)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const tmp = join(tmpdir(), 'svgrid-tm-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(T))
    const { inputs, graph } = mixArgs(wav, voices, 2)
    const mp4 = join(OUT, 'tm-live.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(frames, { recursive: true, force: true })
    const ms = payoff.bench.map((b) => b.lastMs)
    writeFileSync(join(OUT, 'caption.txt'),
      `A test and measurement team needed a Svelte data grid for 300,000 records, grouped by station, with 600 results in, 600 out and 3,000 updates every second. SvGrid holds it: the footage is the published @svgrid/grid in a plain Vite app, each batch applied and painted in ${Math.min(...ms)}-${Math.max(...ms)} ms, measured in the browser. npm install @svgrid/grid\n\n#svelte #sveltejs #datagrid #webdev #javascript #performance #programming\n`)
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  killTree(app?.child)
}
