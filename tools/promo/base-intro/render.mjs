#!/usr/bin/env node
/**
 * Render "Meet SvGrid Base" (Zazo presents SvGrid Base) to a 1920 x 1080 MP4.
 *
 *   node --env-file=.env tools/promo/base-intro/render.mjs [--preview t1,t2,...] [--no-footage]
 *
 * Needs the gallery running (pnpm dev, :5174): the footage is the Base demos
 * from the workspace source, recorded frame by frame (footage.mjs). With a
 * Supabase recorder present (supabase.mjs), the "bind" and "sync" segments are
 * real footage of a real project; without it they are slides.
 *
 * Out: marketing/videos/base-intro/base-intro.mp4, poster.jpg.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { mixArgs, mouthTrack, prepareVoices, timeline } from './voice.mjs'
import { GALLERY, recordClip } from './footage.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'base-intro')
const FPS = 30

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const noFootage = process.argv.includes('--no-footage')
if (noFootage && !previewAt) throw new Error('--no-footage is for previews only')

/* ----------------------------------------------------------------- score */
const RATE = 44100
function synthesize(seg, end) {
  const n = Math.ceil(end * RATE)
  const L = new Float32Array(n)
  const add = (at, len, fn) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += fn(i / RATE)
  }
  let seed = 19
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 96, EIGHTH = BEAT / 2
  const kick = (at, a) => add(at, 0.3, (t) => a * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 10))
  const hat = (at, a) => add(at, 0.03, () => a * noise())
  const pluck = (at, f, a) => add(at, 0.7, (t) => a * (sin(f, t) + 0.25 * sin(f * 2, t)) * Math.exp(-t * 5))
  const chime = (at, base, a) => add(at, 2.2, (t) => a * (sin(base, t) + 0.5 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2))
  const pad = (at, len, chord, a) => add(at, len, (t) => a * chord.reduce((s, f) => s + sin(f, t) + sin(f * 1.003, t), 0) * Math.min(1, t * 1.5) * Math.min(1, (len - t) * 2))
  // A warm, light bed: four chords, soft pulse, brighter from the intro on.
  const CH = [[261.63, 329.63, 392], [220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66]]
  const lift = seg.intro[0]
  for (let bar = 0, t0 = 0.4; t0 < end - 1; bar++, t0 += BEAT * 4) {
    const chord = CH[bar % 4]
    const bright = t0 >= lift ? 1 : 0.6
    pad(t0, BEAT * 4, chord, 0.035 * bright)
    for (let b = 0; b < 4; b++) if (t0 >= lift) kick(t0 + b * BEAT, 0.28)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= end - 1) break
      if (e % 2 === 1) hat(at, 0.025 * bright)
      if (e % 3 === 0) pluck(at, chord[e % 3] * 2, 0.06 * bright)
    }
  }
  for (const k of ['intro', 'bind', 'close']) chime(seg[k][0], 880, 0.14)
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
const voices = await prepareVoices(join(OUT, '.voice-cache'))
const { seg, at, end } = timeline(Object.fromEntries(voices.map((v) => [v.id, v.dur])))
for (const v of voices) console.log(`  ${seg[v.id][0].toFixed(1)}-${seg[v.id][1].toFixed(1)}s  ${v.id.padEnd(12)} ${v.text}`)
console.log(`cut: ${end.toFixed(2)} s`)
const mouth = mouthTrack(voices, at, end, FPS)

const browser = await chromium.launch()
try {
  const clips = {}
  let sql = ''
  if (!noFootage) {
    try { await fetch(GALLERY) } catch { throw new Error(`the gallery is not running on ${GALLERY} (pnpm dev)`) }
    const want = ['fields', 'views', 'records', 'databases', 'sql', 'automations']
    for (const name of want) {
      const frames = Math.ceil((seg[name][1] - seg[name][0]) * FPS)
      if (previewAt && !previewAt.some((t) => t >= seg[name][0] && t < seg[name][1])) continue
      // Whole clips, previews too: a clip's steps are timed to its full length.
      const n = frames
      console.log(`recording ${name} (${n} frames) ...`)
      const r = await recordClip(browser, name, Math.max(n, name === 'sql' ? 80 : 1))
      clips[name] = r.frames
      if (name === 'sql') sql = readFileSync(r.info.sqlFile, 'utf8')
      if (name === 'databases' && !/^Read \d+ tables/.test(r.info.read)) throw new Error(`databases: the app was not made (${r.info.read})`)
      if (name === 'records' && !r.info.expanded) throw new Error('records: the record did not open')
      if (name === 'automations' && !r.info.dialogs) throw new Error('automations: the panel did not open')
      if (name === 'views' && r.info.lastView !== 'Request a task') throw new Error(`views: ended on ${r.info.lastView}`)
    }
    // The real Supabase segments, once a recorder for them exists.
    const supa = join(HERE, 'supabase.mjs')
    if (existsSync(supa)) {
      const { recordSupabase } = await import(pathToFileURL(supa).href)
      // Live sync needs Realtime on the tables and a policy that lets the key
      // write; without them the sync segment stays a diagram.
      for (const name of process.env.BASE_SUPABASE_SYNC ? ['bind', 'sync'] : ['bind']) {
        if (previewAt && !previewAt.some((t) => t >= seg[name][0] && t < seg[name][1])) continue
        console.log(`recording ${name} on Supabase ...`)
        clips[name] = (await recordSupabase(browser, name, Math.ceil((seg[name][1] - seg[name][0]) * FPS))).frames
      }
    }
  }

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(([s, e]) => window.__setTimeline(s, e), [seg, end])
  await page.evaluate((m) => window.__setMouth(m), mouth)
  await page.evaluate((c) => window.__setClips(c), clips)
  await page.evaluate((s) => window.__setSql(s), sql)
  const settle = () => page.evaluate(() => new Promise((r) => { const img = document.getElementById('clip'); if (!img.src || img.complete || img.style.display === 'none') r(); else img.onload = r }))

  if (previewAt) {
    for (const t of previewAt) {
      await page.evaluate((x) => window.__seek(x), t)
      await settle()
      await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const frames = join(tmpdir(), 'svgrid-base-intro-frames')
    rmSync(frames, { recursive: true, force: true })
    mkdirSync(frames, { recursive: true })
    const total = Math.ceil(end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(frames, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 300 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), seg.intro[0] + 3)
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })
    const tmp = join(tmpdir(), 'svgrid-base-intro-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(seg, end))
    const { inputs, graph } = mixArgs(wav, voices, at, 2)
    const mp4 = join(OUT, 'base-intro.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(frames, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(frames, { recursive: true, force: true })
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
}
