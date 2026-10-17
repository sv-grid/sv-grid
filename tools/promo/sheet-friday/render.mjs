#!/usr/bin/env node
/**
 * Render "Excel by Friday" (SvGrid Spreadsheet) to MP4.
 *
 *   node --env-file=.env tools/promo/sheet-friday/render.mjs [--preview t1,t2,...] [--no-payoff]
 *
 * 1. Synthesizes (or reuses) the voice track (voice.mjs) and cuts around it.
 * 2. Records the payoff for real: tutorials-out/app/sheet-app, a Vite +
 *    Svelte 5 app whose page is one <SvSheet> on the published @svgrid/grid
 *    and @svgrid/enterprise, with no license key (as anyone trying it runs it).
 *    The evaluation card is closed first, as a visitor would. A drawn cursor
 *    types =SUM(B2:D2) into an empty total, changes a January figure, and
 *    bolds the Total row with Ctrl+B, one screenshot per video frame. The
 *    recording fails unless the formula computes 7200, the change carries to
 *    the row and grand totals, and the Total row is bold.
 * 3. Steps scene.html frame by frame, mixes the voices over the score, encodes.
 *
 * Out: marketing/videos/sheet-friday/sheet-friday.mp4, poster.jpg, caption.txt.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { mixArgs, placeVoices, prepareVoices, timeline } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'sheet-friday')
const VOICE_CACHE = join(OUT, '.voice-cache')
const APP = join(ROOT, 'tutorials-out', 'app', 'sheet-app')
const PORT = 4399
const FPS = 30

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const noPayoff = process.argv.includes('--no-payoff')
if (noPayoff && !previewAt) throw new Error('--no-payoff is for previews only')

/* ------------------------------------------------------------- the app */
const pkgVersion = (name) => JSON.parse(readFileSync(join(APP, 'node_modules', ...name.split('/'), 'package.json'), 'utf8')).version
const enterpriseVersion = pkgVersion('@svgrid/enterprise')
const gridVersion = pkgVersion('@svgrid/grid')
const page = readFileSync(join(APP, 'src', 'App.svelte'), 'utf8')
const sheetTags = page.split('\n').filter((l) => l.includes('<SvSheet'))
if (sheetTags.length !== 1 || !sheetTags[0].trim().endsWith('/>')) throw new Error('the video says one line of Svelte: App.svelte must hold one single-line <SvSheet ... />')

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
  throw new Error(`the app did not start on ${base}`)
}
function killTree(child) {
  if (!child?.pid) return
  try { execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' }) } catch { child.kill() }
}

/** The payoff, one screenshot per video frame, the cursor driven between them. */
async function recordPayoff(browser, base, frameCount) {
  // The monitor's aspect; small enough that the sheet survives the phone frame.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 506 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('tr[aria-rowindex="6"]', { timeout: 60_000 })
  // Unlicensed, the sheet says so in a card once a session: close it as a visitor would.
  const card = page.locator('[data-svgrid-enterprise-upgrade] button', { hasText: '×' })
  await card.waitFor({ timeout: 15_000 })
  await card.click()
  // The watermark shows for its first seconds; let it have them off camera.
  await page.waitForTimeout(6000)

  const cell = (ref) => page.locator(`tr[aria-rowindex="${ref.slice(1)}"] td.sv-grid-cell:not(.sv-grid-row-number-cell)`).nth(ref.charCodeAt(0) - 65)
  const value = async (ref) => (await cell(ref).innerText()).trim()
  if ((await value('E2')) !== '') throw new Error(`E2 should start empty, reads ${await value('E2')}`)
  if ((await value('E6')) !== '69350') throw new Error(`E6 should start at 69350, reads ${await value('E6')}`)

  await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = '__cursor'
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))'
    d.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.8 21 L11.3 14 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.body.appendChild(d)
  })
  let cur = { x: 760, y: 470 }
  const putCursor = (p) => page.evaluate(({ x, y }) => { document.getElementById('__cursor').style.transform = `translate(${x - 4}px, ${y - 3}px)` }, p)
  await putCursor(cur)
  const center = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('target not on screen'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const MOVE = 10
  const typeAt = (f, text, every = 3) => [...text].map((ch, i) => ({ f: f + i * every, act: () => page.keyboard.type(ch) }))
  // Timed to the narration: "Formulas, the ribbon, the Excel keys. One line of Svelte."
  const steps = [
    { f: 14, aim: () => cell('E2'), act: (p) => page.mouse.click(p.x, p.y) },
    ...typeAt(20, '=SUM(B2:D2)'),
    { f: 56, act: () => page.keyboard.press('Enter') },
    { f: 80, aim: () => cell('B3'), act: (p) => page.mouse.click(p.x, p.y) },
    ...typeAt(86, '25000'),
    { f: 104, act: () => page.keyboard.press('Enter') },
    { f: 132, aim: () => cell('A6'), act: (p) => page.mouse.click(p.x, p.y) },
    { f: 146, aim: () => cell('E6'), act: async (p) => { await page.keyboard.down('Shift'); await page.mouse.click(p.x, p.y); await page.keyboard.up('Shift') } },
    { f: 156, act: () => page.keyboard.press('Control+b') },
    // Then the ribbon: the Formulas tab.
    { f: 184, aim: () => page.getByRole('tab', { name: 'Formulas' }).first(), act: (p) => page.mouse.click(p.x, p.y) },
    { f: 214, aim: () => cell('F9'), act: () => {} },
  ]
  const moves = new Map()
  const checks = {}
  const dir = join(tmpdir(), 'svgrid-sheet-friday-payoff')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const frames = []
  for (let f = 0; f < frameCount; f++) {
    for (const s of steps) {
      if (s.aim && f >= s.f - MOVE && f <= s.f) {
        if (f === s.f - MOVE) moves.set(s, { from: cur, to: await center(await s.aim()) })
        const m = moves.get(s)
        const k = (f - (s.f - MOVE)) / MOVE
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        cur = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e }
        await putCursor(cur)
      }
      if (f === s.f) { await s.act(moves.get(s)?.to); await page.waitForTimeout(120) }
    }
    if (f === 60) checks.formula = { E2: await value('E2'), E6: await value('E6') }
    if (f === 110) checks.recalc = { B3: await value('B3'), E3: await value('E3'), B6: await value('B6'), E6: await value('E6') }
    if (f === 170) checks.bold = await cell('E6').evaluate((td) => [td, ...td.querySelectorAll('*')].some((e) => Number(getComputedStyle(e).fontWeight) >= 700))
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 })
    frames.push(pathToFileURL(file).href)
  }

  if (frameCount > 220) {
    const want = { formula: { E2: '7200', E6: '76550' }, recalc: { B3: '25000', E3: '62700', B6: '31400', E6: '83050' }, bold: true }
    if (JSON.stringify(checks) !== JSON.stringify(want)) throw new Error(`the sheet did not do what the video says: ${JSON.stringify(checks)}`)
    const formulasTab = await page.getByRole('tab', { name: 'Formulas' }).first().getAttribute('aria-selected')
    if (formulasTab !== 'true') throw new Error('the Formulas tab did not open')
    console.log(`  checked: ${JSON.stringify(checks)}; Formulas tab open`)
  }
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return { frames, fps: FPS, version: enterpriseVersion }
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
  let seed = 71
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 100, EIGHTH = BEAT / 2
  const kick = (at, a = 0.9) => add(at, 0.35, (t) => a * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 9))
  const bass = (at, f, a = 0.3, len = EIGHTH * 0.9) => add(at, len, (t) => a * (sin(f, t) + 0.35 * sin(f * 2, t)) * Math.min(1, t * 200) * Math.exp(-t * 4))
  const hat = (at, a = 0.06) => add(at, 0.04, () => a * noise())
  const pluck = (at, f, a = 0.14) => add(at, 0.6, (t) => a * (sin(f, t) + 0.3 * sin(f * 2, t)) * Math.exp(-t * 6))
  const key = (at, a = 0.18) => add(at, 0.03, (t) => a * noise() * Math.exp(-t * 170))
  const whoosh = (at, len = 0.45, a = 0.25) => add(at, len, (t) => a * noise() * Math.sin((Math.PI * t) / len))
  const riser = (at, len, a = 0.18) => add(at, len, (t) => a * (t / len) * (0.6 * noise() + sin(200 + 900 * (t / len) * (t / len), t)))
  const crash = (at) => add(at, 0.9, (t) => 0.28 * (0.7 * noise() + Math.sign(sin(110, t))) * Math.exp(-t * 4))
  const chime = (at, base, a = 0.22) => add(at, 2, (t) => a * (sin(base, t) + 0.6 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2.2))
  const pad = (at, len, chord, a = 0.045) => add(at, len, (t) => a * chord.reduce((s, f) => s + sin(f, t) + sin(f * 1.004, t), 0) * Math.min(1, t * 2) * Math.min(1, (len - t) * 3))

  // The office: a light loop, then the CEO's deadline lands on a low hit.
  const OPEN = [[220, 261.63, 329.63], [196, 246.94, 293.66]]
  for (let bar = 0, t0 = 0.3; t0 < T.s2[0]; bar++, t0 += BEAT * 4) {
    pad(t0, Math.min(BEAT * 4, T.s2[0] - t0), OPEN[bar % 2])
    for (let b = 0; b < 4; b++) { kick(t0 + b * BEAT, 0.4); hat(t0 + b * BEAT + EIGHTH, 0.05) }
  }
  kick(T.s2[0], 0.8); add(T.s2[0], 2.5, (t) => 0.12 * sin(55, t) * Math.exp(-t * 1.2))
  // "By Friday": a ticking clock under the CEO and the panic.
  for (let t = T.s2[0] + 0.5; t < T.s4[0]; t += 0.5) add(t, 0.05, (x) => 0.1 * sin(2000, x) * Math.exp(-x * 80))
  // The attempts: a tense pulse, a crash per failure.
  for (let t = T.s4[0], i = 0; t < T.s4[1]; t += EIGHTH, i++) { bass(t, i % 8 === 6 ? 58.27 : 55, 0.3); hat(t + EIGHTH / 2) }
  for (const h of [T.fail1, T.fail2, T.fail3]) crash(h)
  // The idea: a chime and a light.
  chime(T.s5[0] + 0.1, 880, 0.2)
  riser(T.s6[0] - 0.8, 0.8, 0.16)
  // Install: a whoosh and keys.
  whoosh(T.s6[0], 0.4, 0.28)
  for (let t = T.s6[0] + 0.1, i = 0; t < T.s6[0] + 1.0; t += 0.05, i++) key(t + ((i * 31) % 7) / 600)
  // The payoff: the drop, a bright loop, keys where the cursor types.
  kick(T.s7[0], 1)
  const LIFT = [[261.63, 329.63, 392], [220, 277.18, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  for (let bar = 0, t0 = T.s7[0]; t0 < T.s8[1]; bar++, t0 += BEAT * 4) {
    const chord = LIFT[bar % 4]
    pad(t0, BEAT * 4, chord, 0.05)
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.55)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= T.s8[1]) break
      pluck(at, chord[e % 3] * 2, 0.12)
      hat(at + EIGHTH / 2, 0.05)
      bass(at, chord[0] / 2, 0.26)
    }
  }
  for (const [f0, len] of [[20, 11], [86, 5]]) for (let i = 0; i < len; i++) key(T.s7[0] + (f0 + i * 3) / 30, 0.12)
  chime(T.s8[0] + 0.3, 784, 0.2)
  // End card.
  chime(T.s9[0], 880, 0.22)
  const len9 = T.s9[1] - T.s9[0]
  add(T.s9[0], len9, (t) => 0.05 * [261.63, 329.63, 392, 523.25].reduce((s, f) => s + sin(f, t), 0) * Math.min(1, t * 2) * Math.max(0, 1 - t / len9))

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
console.log(`cut: ${T.end.toFixed(2)} s; payoff ${T.s7[0].toFixed(2)}-${T.s7[1].toFixed(2)} s; @svgrid/enterprise ${enterpriseVersion}, @svgrid/grid ${gridVersion}`)

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
    const frames = join(tmpdir(), 'svgrid-sheet-friday-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 150 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), T.s7[1] - 1.5)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const tmp = join(tmpdir(), 'svgrid-sheet-friday-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(T))
    const { inputs, graph } = mixArgs(wav, voices, 2)
    const mp4 = join(OUT, 'sheet-friday.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(frames, { recursive: true, force: true })
    writeFileSync(join(OUT, 'caption.txt'),
      `Finance wants their spreadsheet inside your app, formulas and all, by Friday. SvGrid Spreadsheet is one Svelte component: the ribbon, the formula bar, the Excel keyboard and real .xlsx. The footage is the published @svgrid/enterprise ${enterpriseVersion} in a plain Vite + Svelte 5 app, unlicensed: every feature runs, with a small watermark until you add a key. Try it free: npm i @svgrid/grid @svgrid/enterprise\n\n#svelte #sveltejs #spreadsheet #excel #webdev #javascript #programming\n`)
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  killTree(app?.child)
}
