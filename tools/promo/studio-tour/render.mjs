#!/usr/bin/env node
/**
 * Render "SvGrid Studio, a tour" to a 1920 x 1080 MP4, music only.
 *
 *   node tools/promo/studio-tour/render.mjs [--preview t1,t2,...] [--no-footage] [--only clip1,clip2]
 *
 * scene.html owns the shot list; this reads it, records each footage clip at
 * its shot's length from the Studio on svgrid.com (footage.mjs, STUDIO_URL to
 * point elsewhere), then seeks the scene frame by frame. The score is
 * synthesized here, cued to the shot list, so nothing is licensed.
 *
 * Out: marketing/videos/studio-tour/studio-tour.mp4, poster.jpg.
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { recordClip } from './footage.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'studio-tour')
const FPS = 30

const arg = (name) => { const i = process.argv.indexOf(name); return i >= 0 ? process.argv[i + 1] : null }
const previewAt = arg('--preview')?.split(',').map(Number) ?? null
const only = arg('--only')?.split(',') ?? null
const noFootage = process.argv.includes('--no-footage')
if ((noFootage || only) && !previewAt) throw new Error('--no-footage and --only are for previews')

/* ----------------------------------------------------------------- score */
const RATE = 44100
function synthesize(plan, end) {
  const n = Math.ceil(end * RATE)
  const L = new Float32Array(n), R = new Float32Array(n)
  const add = (at, len, fn, pan = 0) => {
    const s0 = Math.floor(at * RATE)
    const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) { const v = fn(i / RATE); L[s0 + i] += v * gl; R[s0 + i] += v * gr }
  }
  let seed = 7
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BPM = 112, BEAT = 60 / BPM, BAR = BEAT * 4, SIX = BEAT / 4
  const kick = (at, a) => add(at, 0.32, (t) => a * Math.sin(2 * Math.PI * (48 + 90 * Math.exp(-t * 28)) * t) * Math.exp(-t * 9))
  const clap = (at, a) => add(at, 0.18, (t) => a * noise() * Math.exp(-t * 22) * (t < 0.012 ? 0.6 : 1), 0.1)
  const hat = (at, a, pan) => add(at, 0.04, () => a * noise(), pan)
  const pluck = (at, f, a, pan) => add(at, 0.5, (t) => a * (sin(f, t) + 0.3 * sin(f * 2, t) + 0.1 * sin(f * 3, t)) * Math.exp(-t * 7), pan)
  const bass = (at, f, len, a) => add(at, len, (t) => a * (sin(f, t) + 0.35 * sin(f * 2, t)) * Math.min(1, t * 40) * Math.exp(-t * 1.6))
  const pad = (at, len, chord, a) => add(at, len, (t) => a * chord.reduce((s, f) => s + sin(f, t) + 0.6 * sin(f * 1.004, t) + 0.3 * sin(f * 0.997, t), 0) * Math.min(1, t * 1.2) * Math.min(1, (len - t) * 1.5))
  const chime = (at, f, a) => add(at, 2.4, (t) => a * (sin(f, t) + 0.5 * sin(f * 2.01, t) + 0.25 * sin(f * 3, t)) * Math.exp(-t * 2.2), 0.2)
  const swoosh = (at, a) => add(at - 0.35, 0.5, (t) => { const k = t / 0.5; return a * noise() * Math.sin(Math.PI * k) * (0.3 + k) })

  // I - V - vi - IV in C, voiced bright.
  const CH = [[261.63, 329.63, 392, 523.25], [196, 246.94, 293.66, 392], [220, 261.63, 329.63, 440], [174.61, 220, 261.63, 349.23]]
  const ROOTS = [65.41, 49, 55, 43.65]
  const at = (id) => plan.find((s) => s.id === id)
  const groove = at('sources').start        // drums in once the promise is made
  const breakdown = [at('checks').start, at('value').end] // lighter under the list + value line
  const outro = at('outro').start
  for (let bar = 0, t0 = 0; t0 < end; bar++, t0 += BAR) {
    const c = bar % 4
    const quiet = t0 >= breakdown[0] && t0 < breakdown[1]
    const tail = t0 >= outro
    pad(t0, BAR + 0.05, CH[c], tail ? 0.02 : 0.016)
    if (tail) continue
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * BEAT
      if (t0 >= groove && !quiet) kick(tb, b % 2 === 0 ? 0.5 : 0.32)
      if (t0 >= groove && b % 2 === 1) clap(tb, quiet ? 0.08 : 0.16)
      bass(tb, ROOTS[c], BEAT * 0.9, t0 >= groove ? 0.16 : 0.08)
    }
    for (let s = 0; s < 16; s++) {
      const ts = t0 + s * SIX
      if (t0 >= groove) hat(ts, s % 2 ? 0.03 : 0.05, s % 4 < 2 ? -0.4 : 0.4)
      const arp = [0, 2, 1, 3, 2, 1, 3, 2][s % 8]
      if (s % 2 === 0 || t0 >= groove) pluck(ts, CH[c][arp] * 2, quiet ? 0.035 : 0.05, arp % 2 ? 0.35 : -0.35)
    }
  }
  for (const s of plan) {
    if (s.kind === 'title') { chime(s.start + 0.05, 1046.5, 0.12); swoosh(s.start, 0.05) }
    if (s.kind === 'cta') chime(s.start + 0.05, 1318.5, 0.1)
  }
  chime(0.15, 523.25, 0.14)
  chime(outro + 0.1, 523.25, 0.16)

  const data = Buffer.alloc(n * 4)
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, (end - i / RATE) / 1.6)
    data.writeInt16LE(Math.round(Math.tanh(L[i] * 0.9) * 30000 * fade), i * 4)
    data.writeInt16LE(Math.round(Math.tanh(R[i] * 0.9) * 30000 * fade), i * 4 + 2)
  }
  const h = Buffer.alloc(44)
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVE', 8)
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22)
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34)
  h.write('data', 36); h.writeUInt32LE(data.length, 40)
  return Buffer.concat([h, data])
}

/* ---------------------------------------------------------------- render */
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  const plan = await page.evaluate(() => window.__plan())
  const end = plan.at(-1).end
  for (const s of plan) console.log(`  ${s.start.toFixed(1).padStart(6)}-${s.end.toFixed(1).padEnd(6)} ${s.kind.padEnd(6)} ${s.id}`)
  console.log(`cut: ${end.toFixed(2)} s`)

  const clips = {}
  if (!noFootage) {
    for (const s of plan.filter((x) => x.kind === 'clip')) {
      if (only && !only.includes(s.id)) continue
      if (previewAt && !only && !previewAt.some((t) => t >= s.start && t < s.end)) continue
      const frames = Math.ceil(s.dur * FPS)
      console.log(`recording ${s.id} (${frames} frames) ...`)
      const r = await recordClip(browser, s.id, frames)
      clips[s.id] = r.frames
      if (Object.keys(r.info).length) console.log(`  ${JSON.stringify(r.info)}`)
    }
  }
  await page.evaluate((c) => window.__setClips(c), clips)
  const settle = () => page.evaluate(() => window.__ready())

  if (previewAt) {
    for (const t of previewAt) {
      await page.evaluate((x) => window.__seek(x), t)
      await settle()
      await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const frames = join(tmpdir(), 'svgrid-studio-tour-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 300 === 0) console.log(`  frame ${f}/${total}`)
    }
    const poster = plan.find((s) => s.id === 'overview')
    await page.evaluate((x) => window.__seek(x), poster.start + poster.dur * 0.3)
    await settle()
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })
    const tmp = join(tmpdir(), 'svgrid-studio-tour-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(plan, end))
    const mp4 = join(OUT, 'studio-tour.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), '-i', wav,
      '-filter_complex', '[1:a]loudnorm=I=-16:TP=-1.5:LRA=9[aout]', '-map', '0:v', '-map', '[aout]',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-t', end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(frames, { recursive: true, force: true })
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
}
