#!/usr/bin/env node
/**
 * Render "The Live Demo" promo to MP4.
 *
 *   node --env-file=.env tools/promo/live-demo/render.mjs [--preview 1,5,8,...] [--remix]
 *
 * 1. Synthesizes (or reuses from cache) the voice track: narrator, CEO and
 *    developer, performed with ElevenLabs eleven_v3 audio tags (voice.mjs).
 * 2. Builds the cut around the takes: every shot is as long as its line needs
 *    (voice.timeline), and the scene, the score and the payoff recording all
 *    read that one timeline.
 * 3. Records the payoff for real: demo 06-large-dataset at 100,000 rows x 100
 *    columns, scrolled and then sorted frame by frame. Every frame's DOM row
 *    count is measured and the video prints it. The recording fails if the
 *    demo is not at 100,000 rows, the sort did not apply, or the DOM ever
 *    holds more than 200 rows.
 * 4. Steps scene.html through every frame with window.__seek(t).
 * 5. Synthesizes the score, ducks it under the voices, encodes H.264 + AAC.
 *
 * --preview t1,t2,... writes stills only. --remix keeps the rendered picture
 * and rebuilds only the sound (valid while the takes, and so the cut, are
 * unchanged; it refuses otherwise).
 *
 * Out: marketing/videos/live-demo/live-demo.mp4, poster.jpg, caption.txt.
 */
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { mixArgs, placeVoices, prepareVoices, timeline } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'live-demo')
const VOICE_CACHE = join(OUT, '.voice-cache')
const FPS = 30
const ROW_PX = 32 // demo 06's rowHeight

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()

/* --------------------------------------------------------------- gallery */
async function reachable(url) {
  try { return (await fetch(url)).status < 500 } catch { return false }
}
async function ensureGallery() {
  if (await reachable('http://localhost:5174/')) return null
  const vite = join(ROOT, 'examples', 'node_modules', 'vite', 'bin', 'vite.js')
  const child = spawn(process.execPath, [vite, '--port', '5174', '--strictPort'], { cwd: join(ROOT, 'examples'), stdio: 'ignore', windowsHide: true })
  for (let i = 0; i < 180; i++) {
    if (await reachable('http://localhost:5174/')) return child
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('the gallery did not start on :5174')
}
function killTree(child) {
  if (!child?.pid) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2)
const seg = (t, a, b) => Math.max(0, Math.min(1, (t - a) / (b - a)))

/**
 * The payoff, recorded over `len` seconds: a fling down to row ~62,000 in the
 * first 3 s, a click on the first Revenue header at 3.3 s that sorts 100,000
 * rows, then a slower scroll down and sideways through the sorted data. One
 * screenshot and one DOM count per video frame.
 */
async function recordPayoff(browser, frameCount, len) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, deviceScaleFactor: 1, colorScheme: 'dark' })
  await ctx.addInitScript(() => { try { localStorage.setItem('sg-theme', 'dark'); localStorage.setItem('sg-preset', 'ember') } catch {} })
  const page = await ctx.newPage()
  await page.goto('http://localhost:5174/#/06-large-dataset', { waitUntil: 'load', timeout: 180_000 })
  await page.addStyleTag({ content: `.demo-sidebar, .demo-backdrop, .demo-hamburger { display: none !important; }
    .demo-page > main > header { display: none !important; } vite-error-overlay { display: none !important; }` })
  await page.waitForSelector('[data-svgrid-row]', { timeout: 120_000 })
  await page.getByRole('button', { name: '100k × 100' }).click()
  await page.waitForFunction(() => /^100,000 rows · 100 columns/.test(document.querySelector('.ds-meta')?.textContent?.trim() ?? ''), null, { timeout: 180_000 })
  await page.waitForSelector('[data-svgrid-row]', { timeout: 60_000 })
  await page.waitForTimeout(800)

  const frames = []
  const dom = []
  let sorted = false
  for (let f = 0; f < frameCount; f++) {
    const t = f / FPS
    if (!sorted && t >= 3.3) {
      await page.evaluate(() => { document.querySelector('.sv-grid-container').scrollTop = 0 })
      const header = page.locator('[role="columnheader"]', { hasText: 'Revenue' }).first()
      await header.click()
      await page.waitForTimeout(300)
      const sortState = await header.getAttribute('aria-sort')
      if (!sortState || sortState === 'none') throw new Error(`clicking the Revenue header did not sort (aria-sort=${sortState})`)
      sorted = true
    }
    let row, left
    if (t < 3.3) { row = 62_000 * ease(seg(t, 0.15, 3.0)); left = 0 }
    else { row = 26_000 * ease(seg(t, 3.9, len - 0.4)); left = 2_400 * ease(seg(t, 4.4, len - 0.6)) }
    await page.evaluate(([top, x]) => {
      const c = document.querySelector('.sv-grid-container')
      c.scrollTop = top
      c.scrollLeft = x
    }, [Math.round(row * ROW_PX), Math.round(left)])
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const n = await page.evaluate(() => new Set([...document.querySelectorAll('[data-svgrid-row]')].map((e) => e.getAttribute('data-svgrid-row'))).size)
    if (n < 10 || n > 200) throw new Error(`frame ${f}: ${n} rows in the DOM`)
    const meta = await page.evaluate(() => document.querySelector('.ds-meta')?.textContent?.trim() ?? '')
    if (!meta.startsWith('100,000 rows')) throw new Error(`frame ${f}: the demo says "${meta}"`)
    dom.push(n)
    const jpg = await page.locator('.demo-page > main').screenshot({ type: 'jpeg', quality: 86, animations: 'disabled' })
    frames.push(`data:image/jpeg;base64,${jpg.toString('base64')}`)
  }
  await ctx.close()
  return { frames, dom, fps: FPS }
}

/* ----------------------------------------------------------------- score */
const RATE = 44100
/** The music and room sound, cued off the timeline T (no voice; see voice.mjs). */
function synthesize(T) {
  const n = Math.ceil(T.end * RATE)
  const L = new Float32Array(n)
  const add = (at, len, fn, gain = 1) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += gain * fn(i / RATE)
  }
  let seed = 11
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 116, EIGHTH = BEAT / 2
  const kick = (at, a = 0.9) => add(at, 0.35, (t) => a * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9))
  const bass = (at, f, a = 0.35, len = EIGHTH * 0.9) => add(at, len, (t) => a * (sin(f, t) + 0.35 * sin(f * 2, t)) * Math.min(1, t * 200) * Math.exp(-t * 4))
  const hat = (at, a = 0.08) => add(at, 0.04, () => a * noise())
  const pluck = (at, f, a = 0.16) => add(at, 0.5, (t) => a * (sin(f, t) + 0.3 * sin(f * 2, t)) * Math.exp(-t * 7))
  const thump = (at, a = 0.85) => add(at, 0.3, (t) => a * sin(50, t) * Math.exp(-t * 15))
  const key = (at) => add(at, 0.03, (t) => 0.2 * noise() * Math.exp(-t * 170))
  const whoosh = (at, len = 0.45, a = 0.25) => add(at, len, (t) => a * noise() * Math.sin((Math.PI * t) / len))
  const riser = (at, len, a = 0.18) => add(at, len, (t) => a * (t / len) * (0.6 * noise() + sin(200 + 900 * (t / len) * (t / len), t)))
  const sting = (at) => add(at, 1.2, (t) => 0.22 * (Math.sign(sin(233, t)) + Math.sign(sin(247.5, t)) + 0.6 * sin(116, t)) * Math.exp(-t * 2.6))
  const chime = (at, base, a = 0.25) => add(at, 2, (t) => a * (sin(base, t) + 0.6 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2.2))

  // Crowd murmur: low-passed noise, loud while the tab is frozen.
  {
    let lp = 0
    for (let i = 0; i < n; i++) {
      const t = i / RATE
      lp += 0.035 * (noise() - lp)
      const level = t < 0.35 ? 0 : t < T.freeze ? 0.05 : t < T.s5[0] ? 0.05 + 0.13 * Math.min(1, (t - T.freeze) * 3) : t < T.s6[0] ? 0.04 : 0
      L[i] += level * lp * 4 * (0.75 + 0.25 * Math.sin(t * 3.1) * Math.sin(t * 1.7))
    }
  }
  // Act 1: the tense pulse, from the spotlight to the freeze.
  kick(0.35, 1)
  for (let t = 0.35; t < T.freeze; t += EIGHTH) {
    const step = Math.round((t - 0.35) / EIGHTH)
    bass(t, step % 8 === 6 ? 58.27 : 55, t > T.s3[0] ? 0.42 : 0.32)
    if (t > T.s3[0]) hat(t + EIGHTH / 2, 0.07)
    if (step % 4 === 0 && t > T.s2[0]) kick(t, 0.5)
  }
  riser(T.freeze - 1.7, 1.7, 0.2)
  // The freeze: everything stops but the room.
  sting(T.freeze); kick(T.freeze, 1)
  for (let t = T.freeze + 0.3; t < T.s5[0]; t += 0.62) { thump(t); thump(t + 0.17, 0.55) }
  whoosh(T.s4[0], 0.35)
  riser(T.decide, T.s4[1] - T.decide, 0.16)
  // The swap: a white flash, typing, the pulse back under it, a riser into the drop.
  whoosh(T.s5[0], 0.4, 0.3)
  const len5 = T.s5[1] - T.s5[0]
  for (let t = T.s5[0] + 0.3, i = 0; t < T.s5[0] + 0.42 * len5; t += 0.045, i++) key(t + ((i * 31) % 7) / 600)
  for (let t = T.s5[0] + 0.62 * len5, i = 0; t < T.s5[0] + 0.78 * len5; t += 0.05, i++) key(t + ((i * 31) % 7) / 600)
  for (let t = T.s5[0]; t < T.s6[0]; t += EIGHTH) bass(t, 55, 0.22)
  riser(T.s6[0] - 1.0, 1.0, 0.24)
  // The drop: the payoff, in A major, through the CEO's applause.
  kick(T.s6[0], 1)
  const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  for (let bar = 0, t0 = T.s6[0]; t0 < T.s7[1]; bar++, t0 += BEAT * 4) {
    const chord = chords[bar % 4]
    add(t0, BEAT * 4, (t) => 0.05 * chord.reduce((s, f) => s + sin(f, t) + sin(f * 1.003, t), 0) * Math.min(1, t * 3) * Math.min(1, (BEAT * 4 - t) * 4))
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.6)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= T.s7[1]) break
      pluck(at, chord[e % 3] * 2, 0.13)
      hat(at + EIGHTH / 2, 0.05)
      bass(at, chord[0] / 2, 0.28)
    }
  }
  whoosh(T.s7[0], 0.4, 0.2)
  // Applause from the CEO's first clap, swelling, dying into the end card.
  for (let t = T.clap; t < T.s7[1] + 1; t += 0.004) {
    const density = Math.min(1, (t - T.clap) * 1.2) * Math.max(0, 1 - Math.max(0, t - (T.s7[1] - 0.4)) / 1.4)
    if ((noise() + 1) / 2 < density * 0.55) add(t, 0.018, (x) => 0.16 * noise() * Math.exp(-x * 260))
  }
  // End card.
  chime(T.s8[0], 880, 0.22)
  const len8 = T.s8[1] - T.s8[0]
  add(T.s8[0], len8, (t) => 0.05 * [220, 277.18, 329.63, 440].reduce((s, f) => s + sin(f, t), 0) * Math.min(1, t * 2) * Math.max(0, 1 - t / len8))

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
console.log(`cut: ${T.end.toFixed(2)} s; freeze at ${T.freeze.toFixed(2)} s; payoff ${T.s6[0].toFixed(2)}-${T.s6[1].toFixed(2)} s`)

function encodeAudio(videoArgs, out, extra) {
  const tmp = join(tmpdir(), 'svgrid-live-demo-audio')
  mkdirSync(tmp, { recursive: true })
  const wav = join(tmp, 'score.wav')
  writeFileSync(wav, synthesize(T))
  const { inputs, graph } = mixArgs(wav, voices, 2)
  execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', ...videoArgs, ...inputs,
    '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', ...extra,
    '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', out], { stdio: 'inherit' })
  rmSync(tmp, { recursive: true, force: true })
}

if (process.argv.includes('--remix')) {
  const mp4 = join(OUT, 'live-demo.mp4')
  const have = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', mp4], { encoding: 'utf8' }))
  if (Math.abs(have - T.end) > 0.1) throw new Error(`the picture is ${have.toFixed(2)} s but the takes now cut to ${T.end.toFixed(2)} s: render in full instead of --remix`)
  const tmpOut = join(tmpdir(), 'svgrid-live-demo-remix.mp4')
  encodeAudio(['-i', mp4], tmpOut, ['-c:v', 'copy'])
  copyFileSync(tmpOut, mp4)
  rmSync(tmpOut, { force: true })
  console.log(`remixed: ${mp4}`)
  process.exit(0)
}

const gallery = await ensureGallery()
const browser = await chromium.launch()
try {
  const payoffLen = T.s6[1] - T.s6[0]
  const payoffFrames = previewAt
    ? Math.max(1, ...previewAt.filter((t) => t >= T.s6[0]).map((t) => Math.ceil((t - T.s6[0]) * FPS) + 1))
    : Math.ceil(payoffLen * FPS)
  console.log(`recording the payoff (${payoffFrames} frames) ...`)
  const payoff = await recordPayoff(browser, payoffFrames, payoffLen)
  console.log(`  rows in the DOM per frame: ${Math.min(...payoff.dom)}-${Math.max(...payoff.dom)}`)

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate((x) => window.__setTimeline(x), T)
  await page.evaluate((p) => window.__setPayoff(p), payoff)
  const settle = () => page.evaluate(() => new Promise((r) => { const img = document.getElementById('payoffImg'); if (!img.src || img.complete) r(); else img.onload = r }))

  if (previewAt) {
    for (const t of previewAt) {
      await page.evaluate((x) => window.__seek(x), t)
      await settle()
      await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const frames = join(tmpdir(), 'svgrid-live-demo-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 150 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), T.s6[0] + 2.6)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const mp4 = join(OUT, 'live-demo.mp4')
    encodeAudio(['-framerate', String(FPS), '-i', join(frames, '%05d.jpg')], mp4,
      ['-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p'])
    const domRange = `${Math.min(...payoff.dom)} to ${Math.max(...payoff.dom)}`
    writeFileSync(join(OUT, 'caption.txt'),
      `Live demo, 200 people, and the CEO wants all 100,000 orders on screen. A table that renders every row freezes the tab. SvGrid renders the rows you can see: scrolling and sorting 100,000 rows here, with ${domRange} rows in the DOM at any moment. npm install @svgrid/grid\n\n#svelte #sveltejs #webdev #programming #javascript #frontend #performance #developer\n`)
    rmSync(frames, { recursive: true, force: true })
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  killTree(gallery)
}
