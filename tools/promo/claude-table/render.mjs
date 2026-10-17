#!/usr/bin/env node
/**
 * Render "A thousand lines of table" (Claude, an HR tree table, SvGrid) to MP4.
 *
 *   node --env-file=.env tools/promo/claude-table/render.mjs [--preview t1,t2,...] [--no-payoff]
 *
 * 1. Synthesizes (or reuses) the voice track (voice.mjs) and cuts around it.
 * 2. Records the payoff for real: tutorials-out/app/hr-app, a SvelteKit 3 app
 *    made with `sv create`, whose 41-line +page.svelte renders 77 employees
 *    as a tree by manager on the published @svgrid/grid. A drawn cursor opens
 *    three levels with the chevrons, double-clicks a salary, types a new one
 *    and presses Enter, one screenshot per video frame. The recording fails
 *    if the page is not 41 lines, the tree does not reach level 4, the edit
 *    lands on any row but the one edited, or the page does not count it.
 * 3. Steps scene.html frame by frame, mixes the voices over the score, encodes.
 *
 * Out: marketing/videos/claude-table/claude-table.mp4, poster.jpg, caption.txt.
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
const OUT = join(ROOT, 'marketing', 'videos', 'claude-table')
const VOICE_CACHE = join(OUT, '.voice-cache')
const APP = join(ROOT, 'tutorials-out', 'app', 'hr-app')
const PORT = 4398
const FPS = 30
const NEW_SALARY = '99500'

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const noPayoff = process.argv.includes('--no-payoff')
if (noPayoff && !previewAt) throw new Error('--no-payoff is for previews only')

/* ------------------------------------------------------------- the app */
const pageLines = readFileSync(join(APP, 'src', 'routes', '+page.svelte'), 'utf8').replace(/\n$/, '').split('\n').length
if (pageLines !== 41) throw new Error(`+page.svelte is ${pageLines} lines; the video says 41`)
const gridVersion = JSON.parse(readFileSync(join(APP, 'node_modules', '@svgrid', 'grid', 'package.json'), 'utf8')).version
const kitVersion = JSON.parse(readFileSync(join(APP, 'node_modules', '@sveltejs', 'kit', 'package.json'), 'utf8')).version
if (!kitVersion.startsWith('3.')) throw new Error(`the app runs SvelteKit ${kitVersion}, not 3`)

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
  // The monitor's aspect; small enough that the text survives the phone frame.
  const ctx = await browser.newContext({ viewport: { width: 900, height: 506 }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${base}/`, { waitUntil: 'networkidle' })
  await page.waitForSelector('[data-svgrid-row]', { timeout: 60_000 })
  const level = (n) => page.locator(`[role="row"][aria-level="${n}"]`)
  const cell = (row, i) => row.locator('[role="gridcell"]').nth(i)
  const editor = page.locator('[role="treegrid"] tbody input:not([type="checkbox"])')
  const header = () => page.locator('h1').innerText()

  // The editor is a lazy chunk: load it once off camera, then cancel.
  await cell(level(1).first(), 1).dblclick()
  await editor.first().waitFor({ timeout: 10_000 })
  await page.keyboard.press('Escape')
  await page.mouse.click(880, 490)
  if (!/0 edits saved/.test(await header())) throw new Error(`warm-up changed data: ${await header()}`)

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

  let leafName = null, salaryBefore = null
  const center = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('target not on screen'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const MOVE = 12
  // Timed to the narration: "A tree, three levels deep. Edit a salary... it sticks."
  const steps = [
    { f: 22, aim: () => level(1).first().locator('.sv-grid-tree-toggle'), act: (p) => page.mouse.click(p.x, p.y) },
    { f: 44, aim: () => level(2).first().locator('.sv-grid-tree-toggle'), act: (p) => page.mouse.click(p.x, p.y) },
    { f: 66, aim: () => level(3).first().locator('.sv-grid-tree-toggle'), act: (p) => page.mouse.click(p.x, p.y) },
    {
      f: 112,
      aim: async () => {
        const leaf = level(4).first()
        leafName = (await cell(leaf, 0).innerText()).trim()
        salaryBefore = (await cell(leaf, 3).innerText()).trim()
        return cell(leaf, 3)
      },
      act: async (p) => { await page.mouse.dblclick(p.x, p.y); await editor.first().waitFor({ timeout: 5000 }) },
    },
    { f: 124, act: () => page.keyboard.press('Control+A') },
    ...[...NEW_SALARY].map((ch, i) => ({ f: 128 + i * 4, act: () => page.keyboard.type(ch) })),
    { f: 162, act: () => page.keyboard.press('Enter') },
    // Then out of the way, so the new salary shows.
    { f: 182, aim: () => page.locator('h1'), act: () => {} },
  ]
  const moves = new Map()
  for (const s of steps) if (s.aim) moves.set(s, null)

  const dir = join(tmpdir(), 'svgrid-claude-table-payoff')
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
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 })
    frames.push(pathToFileURL(file).href)
  }

  if (frameCount > 170) {
    if (!(await level(4).count())) throw new Error('the tree never reached level 4')
    const row = page.locator('[role="row"]', { hasText: leafName }).first()
    const after = (await cell(row, 3).innerText()).trim()
    if (after !== '$99,500') throw new Error(`${leafName}'s salary reads ${after} after the edit`)
    if (after === salaryBefore) throw new Error('the salary did not change')
    const holders = await page.evaluate(() => [...document.querySelectorAll('[role="row"][aria-level]')].filter((r) => r.textContent.includes('99,500')).length)
    if (holders !== 1) throw new Error(`${holders} rows show the new salary`)
    if (!/1 edits saved/.test(await header())) throw new Error(`the page did not count the edit: ${await header()}`)
    console.log(`  edited ${leafName}: ${salaryBefore} -> ${after}; header "${await header()}"`)
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
  const add = (at, len, fn, gain = 1) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += gain * fn(i / RATE)
  }
  let seed = 53
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 96, EIGHTH = BEAT / 2
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

  // Act 1: a late-night lo-fi loop under the desk and the first table.
  const LOFI = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]]
  for (let bar = 0, t0 = 0.3; t0 < T.s3[0]; bar++, t0 += BEAT * 4) {
    const chord = LOFI[bar % 4]
    pad(t0, Math.min(BEAT * 4, T.s3[0] - t0), chord)
    for (let b = 0; b < 4; b++) { if (b % 2 === 0) kick(t0 + b * BEAT, 0.45); hat(t0 + b * BEAT + EIGHTH, 0.05) }
    for (let e = 0; e < 8; e += 3) pluck(t0 + e * EIGHTH, chord[e % 3] * 2, 0.08)
  }
  // The prompt typed, then the code pouring out.
  for (let t = T.s2[0] + 0.1, i = 0; t < T.s2[0] + 1.0; t += 0.06, i++) key(t + ((i * 31) % 7) / 700)
  for (let t = T.s2[0] + 1.0, i = 0; t < T.s2[1] - 0.4; t += 0.035, i++) key(t, 0.09)
  // The CEO: one low hit.
  kick(T.s3[0], 0.8); add(T.s3[0], 2.5, (t) => 0.12 * sin(55, t) * Math.exp(-t * 1.2))
  // More code: the loop again, tenser, faster keys.
  for (let t = T.s4[0], i = 0; t < T.s4[1]; t += EIGHTH, i++) { bass(t, i % 8 === 6 ? 58.27 : 55, 0.32); hat(t + EIGHTH / 2) }
  for (let t = T.s4[0] + 0.1, i = 0; t < T.s4[0] + 0.9; t += 0.06, i++) key(t + ((i * 31) % 7) / 700)
  for (let t = T.s4[0] + 0.9; t < T.s4[1] - 0.2; t += 0.03) key(t, 0.08)
  // The test: the pulse stutters, a crash per failure.
  for (let t = T.s5[0]; t < T.s5[1]; t += EIGHTH * 2) bass(t, 52, 0.26)
  crash(T.wrong); crash(T.lost)
  // The developer asks: a falling sigh.
  add(T.s6[0], T.s6[1] - T.s6[0], (t) => 0.1 * sin(330 - 120 * t, t) * Math.exp(-t * 0.8))
  // Claude answers: a chime as the reply lands, a riser into the install.
  chime(T.s7[0] + 0.3, 660, 0.18)
  pad(T.s7[0] + 0.3, T.s7[1] - T.s7[0] - 0.3, [261.63, 329.63, 392], 0.035)
  riser(T.s7[1] - 1.2, 1.2, 0.18)
  // Install, then the 41 lines.
  whoosh(T.s8[0], 0.4, 0.28)
  for (let t = T.s8[0] + 0.1, i = 0; t < T.s8[0] + 0.7; t += 0.05, i++) key(t + ((i * 31) % 7) / 600)
  // The payoff: the drop, a bright loop.
  kick(T.s9[0], 1)
  const LIFT = [[261.63, 329.63, 392], [220, 277.18, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  for (let bar = 0, t0 = T.s9[0]; t0 < T.s10[1]; bar++, t0 += BEAT * 4) {
    const chord = LIFT[bar % 4]
    pad(t0, BEAT * 4, chord, 0.05)
    for (let b = 0; b < 4; b++) kick(t0 + b * BEAT, 0.55)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= T.s10[1]) break
      pluck(at, chord[e % 3] * 2, 0.12)
      hat(at + EIGHTH / 2, 0.05)
      bass(at, chord[0] / 2, 0.26)
    }
  }
  chime(T.s10[0] + 0.3, 784, 0.2)
  // End card.
  chime(T.s11[0], 880, 0.22)
  const len11 = T.s11[1] - T.s11[0]
  add(T.s11[0], len11, (t) => 0.05 * [261.63, 329.63, 392, 523.25].reduce((s, f) => s + sin(f, t), 0) * Math.min(1, t * 2) * Math.max(0, 1 - t / len11))

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
console.log(`cut: ${T.end.toFixed(2)} s; payoff ${T.s9[0].toFixed(2)}-${T.s9[1].toFixed(2)} s; @svgrid/grid ${gridVersion}, SvelteKit ${kitVersion}`)

const browser = await chromium.launch()
let app = null
try {
  let payoff = null
  if (!noPayoff) {
    app = await serveApp()
    const len = T.s9[1] - T.s9[0]
    const count = previewAt ? Math.max(1, ...previewAt.filter((t) => t >= T.s9[0]).map((t) => Math.ceil((t - T.s9[0]) * FPS) + 1)) : Math.ceil(len * FPS)
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
    const frames = join(tmpdir(), 'svgrid-claude-table-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(T.end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 150 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), T.s9[1] - 1.2)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })

    const tmp = join(tmpdir(), 'svgrid-claude-table-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(T))
    const { inputs, graph } = mixArgs(wav, voices, 2)
    const mp4 = join(OUT, 'claude-table.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', T.end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(frames, { recursive: true, force: true })
    writeFileSync(join(OUT, 'caption.txt'),
      `A new SvelteKit 3 app needs a table, then HR wants it as a tree by manager, with editing. Generating one from scratch means owning every line of it. Installing a grid that already does trees and editing does not. The footage is a real SvelteKit ${kitVersion.split('.')[0]} app on the published @svgrid/grid ${gridVersion}: a 41-line page, 77 employees three levels deep, and a salary edit that sticks. npm install @svgrid/grid\n\n#svelte #sveltekit #sveltejs #datagrid #webdev #javascript #claude #programming\n`)
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
  killTree(app?.child)
}
