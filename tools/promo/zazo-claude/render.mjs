#!/usr/bin/env node
/**
 * Render "You're absolutely right" (Zazo, Claude and SvGrid) to a 1080 x 1920 MP4.
 *
 *   node --env-file=.env tools/promo/zazo-claude/render.mjs [--preview t1,t2,...] [--no-payoff]
 *
 * 1. Synthesizes (or reuses) the voices (voice.mjs) and cuts around them.
 * 2. Records the payoff for real: tutorials-out/app/claude-orders, a Vite +
 *    Svelte 5 app whose 13-line App.svelte is the file the video shows,
 *    on the published @svgrid/grid. A drawn cursor sorts by Total, filters
 *    Customer to one company, and pages forward, one screenshot per frame.
 *    The recording fails if the file is not 13 lines, the totals are not
 *    sorted descending, a row of another customer survives the filter, or
 *    the pager did not move.
 * 3. Steps scene.html frame by frame, mixes the voices over the score, encodes.
 *
 * Out: marketing/videos/zazo-claude/zazo-claude.mp4, poster.jpg, caption.txt.
 */
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { mixArgs, mouthTracks, prepareVoices, timeline } from './voice.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'zazo-claude')
const APP = join(ROOT, 'tutorials-out', 'app', 'claude-orders')
const WORK = join(tmpdir(), `svgrid-zazo-claude-${process.pid}`)
const PORT = 4397
const FPS = 30
const CUSTOMER = 'Kestrel Labs'

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const noPayoff = process.argv.includes('--no-payoff')
if (noPayoff && !previewAt) throw new Error('--no-payoff is for previews only')

/* ------------------------------------------------------------- the app */
const appLines = readFileSync(join(APP, 'src', 'App.svelte'), 'utf8').replace(/\r?\n$/, '').split(/\r?\n/).length
if (appLines !== 13) throw new Error(`App.svelte is ${appLines} lines; the video says 13`)
const gridVersion = JSON.parse(readFileSync(join(APP, 'node_modules', '@svgrid', 'grid', 'package.json'), 'utf8')).version

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

/** The payoff, one screenshot per video frame, a drawn cursor driven between them. */
async function recordPayoff(browser, base, frameCount) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 506 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-svgrid-row]', { timeout: 60_000 })
  const header = (name) => page.locator('[role="columnheader"]', { hasText: name }).first()
  const column = (i) => page.locator('tbody [role="row"]').evaluateAll((rows, j) => rows.map((r) => r.querySelectorAll('[role="gridcell"]')[j]?.textContent?.trim() ?? ''), i)
  const range = () => page.getByText(/\d+ to \d+ of \d+/).first().innerText()

  await page.evaluate(() => {
    const d = document.createElement('div')
    d.id = '__cursor'
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.4))'
    d.innerHTML = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.8 21 L11.3 14 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'
    document.body.appendChild(d)
  })
  let cur = { x: 640, y: 420 }
  const putCursor = (p) => page.evaluate(({ x, y }) => { document.getElementById('__cursor').style.transform = `translate(${x - 4}px, ${y - 3}px)` }, p)
  await putCursor(cur)
  const center = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('payoff: target not on screen'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const click = (p) => page.mouse.click(p.x, p.y)
  const n = frameCount
  const f = (k) => Math.round(n * k)
  // Sort by Total (twice: descending), filter Customer to one company, page on.
  const steps = [
    { f: f(0.08), aim: () => header('Total').locator('.sv-grid-header-sort'), act: click },
    { f: f(0.17), aim: () => header('Total').locator('.sv-grid-header-sort'), act: click },
    // The filter and column-menu buttons share a spot once the header is
    // hovered, so the click goes to the filter button itself, not to a point.
    { f: f(0.3), aim: async () => { await header('Customer').hover(); return header('Customer').locator('button[aria-label^="Filter"]') }, act: () => header('Customer').locator('button[aria-label^="Filter"]').click() },
    { f: f(0.42), aim: () => page.getByPlaceholder('Filter value...'), act: click },
    ...[...'Kestrel'].map((ch, i) => ({ f: f(0.45) + i * 2, act: () => page.keyboard.type(ch) })),
    // The menu is taller than the 506px frame and its Done button sits under
    // the edge; the filter applies as you type, and Escape closes the menu.
    { f: f(0.62), act: () => page.keyboard.press('Escape') },
    { f: f(0.78), aim: () => page.getByRole('button', { name: /next page/i }).first(), act: click },
    { f: f(0.93), aim: () => ({ x: 860, y: 470 }), act: () => {} },
  ]
  const moves = new Map()
  const MOVE = 10
  const dir = join(WORK, 'payoff')
  mkdirSync(dir, { recursive: true })
  const frames = []
  for (let i = 0; i < n; i++) {
    for (const s of steps) {
      if (s.aim && i >= s.f - MOVE && i <= s.f) {
        if (!moves.has(s)) { const tgt = await s.aim(); moves.set(s, { from: cur, to: 'x' in tgt ? tgt : await center(tgt) }) }
        const m = moves.get(s)
        const k = Math.min(1, (i - (s.f - MOVE)) / MOVE)
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        cur = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e }
        await putCursor(cur)
      }
      if (i === s.f) { await s.act(moves.get(s)?.to ?? cur); await page.waitForTimeout(120) }
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `${String(i).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 })
    frames.push(pathToFileURL(file).href)
  }

  // The last frame, kept beside the output: the first thing to look at when a check below fails.
  await page.screenshot({ path: join(OUT, 'payoff-last.png') })
  if (n > 150) {
    const customers = await column(1)
    console.log(`  payoff rows: ${(await page.locator('tbody [role="row"]').count())}, customers: ${[...new Set(customers)].join(', ')}`)
    if (!customers.length || customers.some((c) => c !== CUSTOMER)) throw new Error(`the filter left other customers: ${[...new Set(customers)].join(', ')}`)
    const totals = (await column(3)).map((s) => Number(s.replace(/[^0-9.]/g, '')))
    if (totals.some((v, i) => i && v > totals[i - 1])) throw new Error(`totals are not descending: ${totals.join(', ')}`)
    const r = await range()
    if (!/^9 to/.test(r)) throw new Error(`the pager did not move: ${r}`)
    console.log(`  payoff: ${CUSTOMER} only, totals descending (${totals[0]} ...), pager "${r}"`)
  }
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return { frames, fps: FPS, version: gridVersion }
}

/* ----------------------------------------------------------------- score */
const RATE = 44100
function synthesize(T) {
  const n = Math.ceil(T.end * RATE)
  const L = new Float32Array(n)
  const add = (at, len, fn) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += fn(i / RATE)
  }
  let seed = 31
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 118, EIGHTH = BEAT / 2
  const kick = (at, a = 0.6) => add(at, 0.3, (t) => a * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 10))
  const snap = (at, a = 0.12) => add(at, 0.06, (t) => a * noise() * Math.exp(-t * 60))
  const pizz = (at, f, a = 0.12) => add(at, 0.3, (t) => a * (sin(f, t) + 0.4 * sin(f * 2, t)) * Math.exp(-t * 14))
  const tuba = (at, f, len, a = 0.22) => add(at, len, (t) => a * Math.sign(sin(f, t)) * 0.5 * Math.min(1, t * 30) * Math.exp(-t * 3))
  const chime = (at, f, a = 0.18) => add(at, 1.6, (t) => a * (sin(f, t) + 0.5 * sin(f * 2.01, t)) * Math.exp(-t * 2.6))
  const key = (at, a = 0.08) => add(at, 0.03, (t) => a * noise() * Math.exp(-t * 170))
  const slide = (at, f0, f1, len, a = 0.18) => add(at, len, (t) => { const f = f0 + (f1 - f0) * (t / len); return a * Math.sign(sin(f, t)) * 0.4 * Math.min(1, (len - t) * 8) })

  // A bouncy, slightly silly groove: pizzicato over an oom-pah.
  const PROG = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  const quiet = [T.nosort[0], T.nosort[1]]
  for (let bar = 0, t0 = 0.4; t0 < T.outro[0]; bar++, t0 += BEAT * 4) {
    const ch = PROG[bar % 4]
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * BEAT
      if (tb >= quiet[0] && tb < quiet[1]) continue
      if (b % 2 === 0) { kick(tb, 0.45); tuba(tb, ch[0] / 2, BEAT * 0.8, 0.12) } else snap(tb)
    }
    for (let e = 0; e < 8; e++) {
      const te = t0 + e * EIGHTH
      if (te >= quiet[0] && te < quiet[1]) continue
      if (e % 2 === 0 || bar % 2) pizz(te, ch[e % 3] * 2, 0.07)
    }
  }
  // Claude's framework pours out: fast keys.
  for (let t = T.gen[0] + 0.3; t < T.gen[1] - 0.2; t += 0.03) key(t, 0.06)
  // "It doesn't sort": a wah-wah.
  slide(AT.nosort - 0.05, 330, 311, 0.35); slide(AT.nosort + 0.32, 311, 294, 0.35); slide(AT.nosort + 0.7, 294, 220, 0.8)
  // The rewrite: keys again.
  for (let t = T.sorry[0] + 1.4; t < T.sorry[1]; t += 0.035) key(t, 0.05)
  // The tool calls and the clean check: chimes.
  chime(T.docs[0] + 0.35, 880); chime(T.docs[0] + 1.55, 988)
  chime(T.check[0] + 1.55, 1318.5, 0.22)
  // Payoff and end card.
  kick(T.payoff[0], 0.9); chime(T.payoff[0] + 0.05, 1046.5, 0.16)
  chime(T.outro[0] + 0.1, 784, 0.2)
  const lenEnd = T.end - T.outro[0]
  add(T.outro[0], lenEnd, (t) => 0.05 * [261.63, 329.63, 392, 523.25].reduce((s, f) => s + sin(f, t), 0) * Math.min(1, t * 2) * Math.max(0, 1 - t / lenEnd))

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
mkdirSync(WORK, { recursive: true })
const voices = await prepareVoices(join(OUT, '.voice-cache'))
const { T, at: AT } = timeline(Object.fromEntries(voices.map((v) => [v.id, v.dur])))
for (const v of voices) console.log(`  ${AT[v.id].toFixed(2)}s  ${v.who.padEnd(8)} ${v.dur.toFixed(2)}s  ${v.text}`)
console.log(`cut: ${T.end.toFixed(2)} s; payoff ${T.payoff[0].toFixed(2)}-${T.payoff[1].toFixed(2)} s; @svgrid/grid ${gridVersion}`)
const mouth = mouthTracks(voices, AT, T.end, FPS)

const browser = await chromium.launch()
let app = null
try {
  let payoff = null
  if (!noPayoff) {
    app = await serveApp()
    const len = T.payoff[1] - T.payoff[0]
    console.log(`recording the payoff (${Math.ceil(len * FPS)} frames) ...`)
    payoff = await recordPayoff(browser, app.base, Math.ceil(len * FPS))
  }

  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(([t, a]) => window.__setTimeline(t, a), [T, AT])
  await page.evaluate((m) => window.__setMouth(m), mouth)
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
    const frames = join(WORK, 'frames')
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 300 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), AT.sorry + 0.6)
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const wav = join(WORK, 'score.wav')
    writeFileSync(wav, synthesize(T))
    const { inputs, graph } = mixArgs(wav, voices, AT, 2)
    const partial = join(WORK, 'zazo-claude.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', partial], { stdio: 'inherit' })
    copyFileSync(partial, join(OUT, 'zazo-claude.mp4'))
    writeFileSync(join(OUT, 'caption.txt'),
      `Zazo asked Claude for a simple orders table and got a 2,040-line framework with a plugin system. "You're absolutely right!" Then he gave it the SvGrid MCP server: it read the docs, checked its own code (the check caught a real mistake), and wrote 13 lines that sort, filter and page. The footage is that file running on @svgrid/grid ${gridVersion}. claude mcp add svgrid -- npx -y @svgrid/mcp\n\n#claude #claudecode #svelte #sveltejs #mcp #aicoding #programming #devhumor #webdev\n`)
    console.log(`done: ${join(OUT, 'zazo-claude.mp4')}`)
  }
} finally {
  await browser.close()
  killTree(app?.child)
  rmSync(WORK, { recursive: true, force: true })
}
