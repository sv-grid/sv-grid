#!/usr/bin/env node
/**
 * Render "An AI agent and your team, one table" to a 1920 x 1080 MP4.
 *
 *   node --env-file=.env tools/promo/agent-base/render.mjs [--reuse] [--preview t1,t2,...]
 *
 * Needs the base-supa app's production preview on :4402 (npm run build &&
 * npm run preview in tutorials-out/app/base-supa) and the tickets table
 * (setup.sql). Records a real agent run and a review take (record.mjs), unless
 * --reuse finds the last take's footage.json; then lays them out in scene.html
 * with Zazo's voice.
 *
 * Out: marketing/videos/agent-base/agent-base.mp4, poster.jpg.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'
import { LINES, mixArgs, mouthTrack, prepareVoices, timeline } from './voice.mjs'
import { BASE, PROMPT, record } from './record.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const OUT = join(ROOT, 'marketing', 'videos', 'agent-base')
const FOOTAGE = join(tmpdir(), 'svgrid-agent-base', 'footage.json')
const FPS = 30

const previewAt = (() => {
  const i = process.argv.indexOf('--preview')
  return i >= 0 ? process.argv[i + 1].split(',').map(Number) : null
})()
const reuse = process.argv.includes('--reuse')

/* ----------------------------------------------------------------- score */
const RATE = 44100
function synthesize(seg, end) {
  const n = Math.ceil(end * RATE)
  const L = new Float32Array(n)
  const add = (at, len, fn) => {
    const s0 = Math.floor(at * RATE)
    for (let i = 0; i < len * RATE && s0 + i < n; i++) L[s0 + i] += fn(i / RATE)
  }
  let seed = 23
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
  const sin = (f, t) => Math.sin(2 * Math.PI * f * t)
  const BEAT = 60 / 100, EIGHTH = BEAT / 2
  const kick = (at, a) => add(at, 0.3, (t) => a * Math.sin(2 * Math.PI * (50 + 80 * Math.exp(-t * 30)) * t) * Math.exp(-t * 10))
  const hat = (at, a) => add(at, 0.03, () => a * noise())
  const pluck = (at, f, a) => add(at, 0.7, (t) => a * (sin(f, t) + 0.25 * sin(f * 2, t)) * Math.exp(-t * 5))
  const chime = (at, base, a) => add(at, 2.2, (t) => a * (sin(base, t) + 0.5 * sin(base * 1.5, t) + 0.3 * sin(base * 2, t)) * Math.exp(-t * 2))
  const pad = (at, len, chord, a) => add(at, len, (t) => a * chord.reduce((s, f) => s + sin(f, t) + sin(f * 1.003, t), 0) * Math.min(1, t * 1.5) * Math.min(1, (len - t) * 2))
  const CH = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [261.63, 329.63, 392]]
  const lift = seg.setup[0]
  for (let bar = 0, t0 = 0.4; t0 < end - 1; bar++, t0 += BEAT * 4) {
    const chord = CH[bar % 4]
    const bright = t0 >= lift ? 1 : 0.6
    pad(t0, BEAT * 4, chord, 0.035 * bright)
    for (let b = 0; b < 4; b++) if (t0 >= lift) kick(t0 + b * BEAT, 0.26)
    for (let e = 0; e < 8; e++) {
      const at = t0 + e * EIGHTH
      if (at >= end - 1) break
      if (e % 2 === 1) hat(at, 0.025 * bright)
      if (e % 3 === 0) pluck(at, chord[e % 3] * 2, 0.06 * bright)
    }
  }
  for (const k of ['hello', 'agent', 'close']) chime(seg[k][0], 880, 0.14)
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
const dur = Object.fromEntries(voices.map((v) => [v.id, v.dur]))
// The review take is timed by its segments, which do not depend on the agent's.
const first = timeline(dur)
const frames = Object.fromEntries(['review', 'correct', 'approve'].map((k) => [k, Math.ceil((first.seg[k][1] - first.seg[k][0]) * FPS)]))

const browser = await chromium.launch()
try {
  let footage
  if (reuse && existsSync(FOOTAGE)) {
    footage = JSON.parse(readFileSync(FOOTAGE, 'utf8'))
    console.log(`reusing the take in ${FOOTAGE}`)
  } else {
    try { await fetch(BASE) } catch { throw new Error(`the base-supa app is not running on ${BASE} (npm run build && npm run preview)`) }
    console.log('recording the agent and the review ...')
    footage = await record(browser, frames)
    writeFileSync(FOOTAGE, JSON.stringify(footage))
  }
  const { agent, review, info } = footage
  console.log(`agent: ${agent.duration.toFixed(1)} s real, ${agent.frames.length} frames, ${agent.events.length} events; review: ${info.target} ${info.from} -> ${info.to}`)

  // The agent's run, from its first statement to the last change landing,
  // played inside its segment: sped up to fit, with a beat at the end.
  const firstSql = agent.events.find((e) => e.kind === 'sql' && e.tool === 'mcp__supabase__execute_sql')
  const start = Math.max(0, (firstSql?.t ?? 0) - 1.5)
  const span = agent.duration - start
  const agentLen = Math.max(0.25 + dur.agent + 1.2, 15)
  const speed = Math.max(1, span / (agentLen - 1.2))
  const { seg, at, end } = timeline(dur, { agent: agentLen })
  for (const { id, text } of LINES) console.log(`  ${seg[id][0].toFixed(1)}-${seg[id][1].toFixed(1)}s  ${id.padEnd(9)} ${text}`)
  console.log(`cut: ${end.toFixed(2)} s; agent footage ${span.toFixed(1)} s at ${speed.toFixed(2)}x`)
  const mouth = mouthTrack(voices, at, end, FPS)
  // The cut's timing, for the captions on the docs (docs-media.mjs).
  writeFileSync(join(OUT, 'timeline.json'), `${JSON.stringify({ seg, at, end, speed }, null, 2)}\n`)
  // What the terminal replays: Claude's own messages and its SQL, as it ran them.
  const events = agent.events.filter((e) => e.kind === 'say' || (e.kind === 'sql' && e.tool === 'mcp__supabase__execute_sql'))

  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 })
  await page.goto(pathToFileURL(join(HERE, 'scene.html')).href, { waitUntil: 'networkidle' })
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(([s, e]) => window.__setTimeline(s, e), [seg, end])
  await page.evaluate((m) => window.__setMouth(m), mouth)
  await page.evaluate(([a, r]) => window.__setFootage(a, r), [{ frames: agent.frames, events, start, speed, prompt: PROMPT }, review])
  const settle = () => page.evaluate(() => new Promise((r) => { const img = document.getElementById('clip'); if (!img.src || img.complete || img.style.display === 'none') r(); else img.onload = r }))

  if (previewAt) {
    for (const t of previewAt) {
      await page.evaluate((x) => window.__seek(x), t)
      await settle()
      await page.screenshot({ path: join(OUT, `preview-${String(t).replace('.', '_')}.png`) })
    }
    console.log(`previews in ${OUT}`)
  } else {
    const dir = join(tmpdir(), 'svgrid-agent-base-frames')
    rmSync(dir, { recursive: true, force: true })
    mkdirSync(dir, { recursive: true })
    const total = Math.ceil(end * FPS)
    for (let f = 0; f < total; f++) {
      await page.evaluate((x) => window.__seek(x), f / FPS)
      await settle()
      await page.screenshot({ path: join(dir, `${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
      if (f % 300 === 0) console.log(`  frame ${f}/${total}`)
    }
    await page.evaluate((x) => window.__seek(x), seg.agent[1] - 1)
    await page.screenshot({ path: join(OUT, 'poster.jpg'), type: 'jpeg', quality: 90 })
    const tmp = join(tmpdir(), 'svgrid-agent-base-audio')
    mkdirSync(tmp, { recursive: true })
    const wav = join(tmp, 'score.wav')
    writeFileSync(wav, synthesize(seg, end))
    const { inputs, graph } = mixArgs(wav, voices, at, 2)
    const mp4 = join(OUT, 'agent-base.mp4')
    execFileSync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-framerate', String(FPS), '-i', join(dir, '%05d.jpg'), ...inputs,
      '-filter_complex', graph, '-map', '0:v', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-t', end.toFixed(3), '-movflags', '+faststart', mp4], { stdio: 'inherit' })
    rmSync(tmp, { recursive: true, force: true })
    rmSync(dir, { recursive: true, force: true })
    console.log(`done: ${mp4}`)
  }
} finally {
  await browser.close()
}
