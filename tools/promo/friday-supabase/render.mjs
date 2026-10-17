#!/usr/bin/env node
/**
 * Render "Friday, 5:47 PM" (SvGrid Studio + SvelteKit 3 + Supabase) to MP4.
 *
 *   node --env-file=.env tools/promo/friday-supabase/render.mjs [--preview t1,t2,...] [--no-payoff]
 *
 * 1. Synthesizes (or reuses) the voice track (voice.mjs) and cuts around it.
 * 2. Types the real `svgrid-studio init` run onto the monitor: the lines come
 *    from marketing/videos/friday-supabase/terminal.json, captured from that run.
 * 3. Records the payoff for real: the app that run wrote
 *    (tutorials-out/app/st3-supa), built and served, browsing the live Supabase
 *    tables. Every request to *.supabase.co is counted, and the badge shows the
 *    running count per frame. The recording fails if no Supabase request was
 *    made, a page shows no rows, or the rows are not the Northwind data.
 * 4. Steps scene.html frame by frame, mixes the voices over the score, encodes.
 *
 * --no-payoff (previews only) skips the app, for checking the animation.
 * Out: marketing/videos/friday-supabase/friday-supabase.mp4, poster.jpg, caption.txt.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { mixArgs, placeVoices, prepareVoices, timeline } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'friday-supabase')
const VOICE_CACHE = join(OUT, '.voice-cache')
// `init --kit 3 --supabase-url ... --title "Northwind Admin" --dark -y` on the
// published CLI, re-emitted by this repo's codegen: the published 3.1.7 output
// crashes on an empty Supabase URL (no .env, and $env/dynamic/public on Kit 3).
// Post the video only once a release carries the fix.
const APP = join(ROOT, 'tutorials-out', 'app', 'st3-supa-local')
const PORT = 5173 // `npm run dev`, as the terminal on the monitor shows
const FPS = 30

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const noPayoff = process.argv.includes('--no-payoff')
if (noPayoff && !previewAt) throw new Error('--no-payoff is for previews only')

const termFile = join(OUT, 'terminal.json')
const terminal = existsSync(termFile) ? JSON.parse(readFileSync(termFile, 'utf8')) : null
if (!terminal && !previewAt) throw new Error(`${termFile} is missing: capture the real init run first`)

/* ------------------------------------------------------------- the app */
async function reachable(url) {
  try { return (await fetch(url)).status < 500 } catch { return false }
}
async function serveApp() {
  const base = `http://localhost:${PORT}`
  if (await reachable(base + '/')) throw new Error(`something already serves ${base}`)
  const child = spawn('npm', ['run', 'dev', '--', '--port', String(PORT), '--strictPort'], { cwd: APP, stdio: 'ignore', shell: true, windowsHide: true })
  for (let i = 0; i < 120; i++) {
    if (await reachable(base + '/')) return { base, child }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`the app did not start on ${base}`)
}
function killTree(child) {
  if (!child?.pid) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

/**
 * The payoff, one screenshot per video frame: the customers list, a click on
 * a header that re-sorts it (a new Supabase request), then the orders list.
 * Requests to *.supabase.co are counted as they go out.
 */
async function recordPayoff(browser, base, frameCount) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1, colorScheme: 'dark' })
  const page = await ctx.newPage()
  let requests = 0, host = ''
  page.on('request', (r) => {
    const u = new URL(r.url())
    if (u.hostname.endsWith('.supabase.co')) { requests++; host = u.hostname }
  })
  await page.goto(`${base}/customers`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-svgrid-row]', { timeout: 60_000 })
  // The evaluation card a keyless visitor gets has its own dismiss button.
  await page.getByRole('button', { name: 'Dismiss' }).first().click({ timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(400)
  const firstText = (await page.locator('[data-svgrid-row="0"]').allInnerTexts()).join(' ')
  let filtered = null
  const countryCells = () => page.evaluate(() => {
    const byRow = new Map()
    for (const c of document.querySelectorAll('[data-svgrid-row]')) {
      const r = c.getAttribute('data-svgrid-row')
      byRow.set(r, [...(byRow.get(r) ?? []), c.textContent.trim()])
    }
    return [...byRow.values()].map((cells) => cells[cells.length - 1])
  })
  const plan = [
    // The filter panel's fields are company, contact, city, country.
    { at: 1.0, run: () => page.getByPlaceholder('Search…', { exact: true }).nth(3).fill('Germany') },
    { at: 3.0, run: async () => { filtered = await countryCells() } },
    { at: 3.6, run: () => page.locator('[role="columnheader"]', { hasText: 'Company' }).first().click() },
    { at: 5.6, run: () => page.locator('a', { hasText: /^products$/ }).first().click() },
  ]
  const frames = [], counts = []
  const dir = join(tmpdir(), 'svgrid-friday-payoff')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  for (let f = 0; f < frameCount; f++) {
    const t = f / FPS
    while (plan.length && plan[0].at <= t) await plan.shift().run()
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 86 })
    frames.push(pathToFileURL(file).href)
    counts.push(requests)
  }
  await page.waitForSelector('[data-svgrid-row]', { timeout: 30_000 })
  if (!requests) throw new Error('the app made no Supabase request')
  if (!/Alfreds Futterkiste/.test(firstText)) throw new Error(`the customers page is not the Northwind data: ${firstText}`)
  if (filtered && (!filtered.length || filtered.some((c) => c !== 'Germany'))) throw new Error(`the country filter left: ${filtered.join(', ')}`)
  if (frameCount > 6.2 * FPS && !/\/products$/.test(new URL(page.url()).pathname)) throw new Error(`the products page did not open: ${page.url()}`)
  await ctx.close()
  return { frames, requests: counts, host, fps: FPS, firstText }
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
  let seed = 23
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 112, EIGHTH = BEAT / 2
  const kick = (at, a = 0.9) => add(at, 0.35, (t) => a * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9))
  const bass = (at, f, a = 0.35, len = EIGHTH * 0.9) => add(at, len, (t) => a * (sin(f, t) + 0.35 * sin(f * 2, t)) * Math.min(1, t * 200) * Math.exp(-t * 4))
  const hat = (at, a = 0.08) => add(at, 0.04, () => a * noise())
  const pluck = (at, f, a = 0.16) => add(at, 0.5, (t) => a * (sin(f, t) + 0.3 * sin(f * 2, t)) * Math.exp(-t * 7))
  const thump = (at, a = 0.85) => add(at, 0.3, (t) => a * sin(50, t) * Math.exp(-t * 15))
  const tock = (at, a = 0.22) => add(at, 0.05, (t) => a * (sin(1900, t) + 0.5 * noise()) * Math.exp(-t * 90))
  const key = (at) => add(at, 0.03, (t) => 0.2 * noise() * Math.exp(-t * 170))
  const whoosh = (at, len = 0.45, a = 0.25) => add(at, len, (t) => a * noise() * Math.sin((Math.PI * t) / len))
  const riser = (at, len, a = 0.18) => add(at, len, (t) => a * (t / len) * (0.6 * noise() + sin(200 + 900 * (t / len) * (t / len), t)))
  const buzz = (at) => { for (let k = 0; k < 2; k++) add(at + k * 0.42, 0.3, (t) => 0.2 * Math.sign(sin(150, t)) * (0.6 + 0.4 * sin(30, t))) }
  const chime = (at, base, a = 0.25) => add(at, 2, (t) => a * (sin(base, t) + 0.6 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2.2))

  // The wall clock ticks through the whole story, loud while it is "running".
  for (let s = Math.ceil(0.3); s < T.s9[0]; s++) tock(s, s >= T.s4[0] && s < T.s5[0] ? 0.42 : 0.12)
  // Act 1: a low pulse that tightens with the ask and the panic.
  kick(0.3, 0.9)
  for (let t = 0.3; t < T.s5[0]; t += EIGHTH) {
    const step = Math.round((t - 0.3) / EIGHTH)
    bass(t, step % 8 === 6 ? 58.27 : 55, t > T.s3[0] ? 0.4 : 0.3)
    if (t > T.s2[0]) hat(t + EIGHTH / 2, 0.06)
    if (step % 4 === 0 && t > T.s3[0]) kick(t, 0.5)
  }
  buzz(T.buzz)
  for (let t = T.s4[0]; t < T.s5[0]; t += 0.62) { thump(t); thump(t + 0.17, 0.55) }
  riser(T.s4[1] - 1.2, 1.2, 0.18)
  // The decision, then the command typed and the app built.
  whoosh(T.s5[0], 0.35)
  whoosh(T.s6[0], 0.4, 0.3)
  for (let t = T.s6[0] + 0.2, i = 0; t < T.s6[1] - 0.6; t += 0.05, i++) if (i % 9 < 6) key(t + ((i * 31) % 7) / 600)
  for (let t = T.s6[0]; t < T.s7[0]; t += EIGHTH) bass(t, 55, 0.22)
  riser(T.s7[0] - 1.0, 1.0, 0.24)
  // The drop: the payoff in A major, through to the CEO.
  kick(T.s7[0], 1)
  const chords = [[220, 277.18, 329.63], [196, 246.94, 293.66], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  for (let bar = 0, t0 = T.s7[0]; t0 < T.s8[0] + 0.6; bar++, t0 += BEAT * 4) {
    const chord = chords[bar % 4]
    add(t0, BEAT * 4, (t) => 0.05 * chord.reduce((s, f) => s + sin(f, t) + sin(f * 1.003, t), 0) * Math.min(1, t * 3) * Math.min(1, (BEAT * 4 - t) * 4))
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.6)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= T.s8[0] + 0.6) break
      pluck(at, chord[e % 3] * 2, 0.13)
      hat(at + EIGHTH / 2, 0.05)
      bass(at, chord[0] / 2, 0.28)
    }
  }
  // 5:52: the room goes quiet, one warm chord under the CEO.
  chime(T.s8[0] + 0.4, 660, 0.18)
  const len8 = T.s9[0] - T.s8[0]
  add(T.s8[0] + 0.5, len8, (t) => 0.04 * [220, 277.18, 329.63].reduce((s, f) => s + sin(f, t), 0) * Math.min(1, t * 2) * Math.max(0, 1 - t / len8))
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
    console.log(`  ${payoff.requests.at(-1)} Supabase requests to ${payoff.host}; first row: ${payoff.firstText.slice(0, 80)}`)
  }

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate((x) => window.__setTimeline(x), T)
  if (terminal) await page.evaluate((x) => window.__setTerminal(x), terminal)
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
    const frames = join(tmpdir(), 'svgrid-friday-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 150 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), T.s7[0] + 2.5)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const tmp = join(tmpdir(), 'svgrid-friday-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(T))
    const { inputs, graph } = mixArgs(wav, voices, 2)
    const mp4 = join(OUT, 'friday-supabase.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(frames, { recursive: true, force: true })
    writeFileSync(join(OUT, 'caption.txt'),
      `Friday, 5:47 PM, and the CEO wants an admin panel on the company's Supabase data by Monday. One command instead: SvGrid Studio reads the Supabase tables and writes a SvelteKit 3 app, shown here running on the live Supabase data (${payoff.requests.at(-1)} requests to Supabase in this clip). npx @svgrid/studio init --kit 3. SvGrid Studio ships with the SvGrid Enterprise Suite.\n\n#sveltekit #supabase #svelte #webdev #javascript #programming #developer\n`)
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  killTree(app?.child)
}
