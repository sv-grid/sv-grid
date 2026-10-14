#!/usr/bin/env node
/**
 * Render Zazo's voice: every line in examples/src/zazo/zazo-lines.ts, every
 * demo title (gallery registry, website registry, community demos) and every
 * tip in zazo-tips.ts (the list: tools/lib/zazo-clips.mjs) to
 * examples/src/zazo/voice/<clip>.mp3, with the developer's voice from the
 * promo cartoons (ElevenLabs, the same voice and model as
 * tools/promo/claude-table/voice.mjs). The browser cannot hold the API key,
 * so the clips ship as small static files and Zazo plays them.
 *
 *   node --env-file=.env tools/zazo-voice.mjs            render what is missing or changed
 *   node --env-file=.env tools/zazo-voice.mjs --dry      list it and count the characters
 *   node --env-file=.env tools/zazo-voice.mjs --prune    also delete clips nothing uses
 *
 * voice/manifest.json records the text and the voice settings behind every
 * clip, so a reworded line or a changed voice is re-rendered and an unchanged
 * clip never is.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FORMAT, MODEL, SETTINGS, SOUND, VOICE, voiceDir, wantedClips } from './lib/zazo-clips.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = voiceDir(ROOT)
const MANIFEST = join(DIR, 'manifest.json')

const dry = process.argv.includes('--dry')
const prune = process.argv.includes('--prune')

/** clip -> text to synthesize */
const want = wantedClips(ROOT)

mkdirSync(DIR, { recursive: true })
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {}
const current = (clip, text) => manifest[clip]?.text === text && manifest[clip]?.sound === SOUND
const todo = [...want].filter(([clip, text]) => !current(clip, text) || !existsSync(join(DIR, `${clip}.mp3`)))
const chars = todo.reduce((n, [, text]) => n + text.length, 0)
console.log(`${want.size} clips; ${todo.length} to render, ${chars} characters`)

const unused = readdirSync(DIR).filter((f) => f.endsWith('.mp3') && !want.has(f.slice(0, -4)))
if (unused.length) console.log(`${unused.length} clips nothing uses${prune ? ' (deleting)' : ' (--prune deletes them)'}`)
if (dry) {
  for (const [clip, text] of todo.slice(0, 20)) console.log(`  ${clip}: ${text}`)
  process.exit(0)
}

/* ---------------------------------------------------------------- render */
const key = process.env.ELEVENLABS_API_KEY
if (todo.length && !key) throw new Error('ELEVENLABS_API_KEY is not set (run with node --env-file=.env)')

async function synth(text) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: SETTINGS }),
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }))
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const msg = await res.text()
    if (res.status && res.status !== 429 && res.status < 500) throw new Error(`ElevenLabs ${res.status}: ${msg.slice(0, 300)}`)
  }
  throw new Error('ElevenLabs: gave up after 5 attempts')
}

let done = 0
const queue = [...todo]
async function worker() {
  for (let job = queue.shift(); job; job = queue.shift()) {
    const [clip, text] = job
    writeFileSync(join(DIR, `${clip}.mp3`), await synth(text))
    manifest[clip] = { text, sound: SOUND }
    if (++done % 25 === 0 || done === todo.length) {
      console.log(`  ${done}/${todo.length}`)
      // Save as we go: a quota wall keeps everything already rendered.
      writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n')
    }
  }
}
await Promise.all([worker(), worker(), worker()])

if (prune) for (const f of unused) { rmSync(join(DIR, f)); delete manifest[f.slice(0, -4)] }
const sorted = Object.fromEntries(Object.entries(manifest).filter(([c]) => want.has(c) || !prune).sort(([a], [b]) => a.localeCompare(b)))
writeFileSync(MANIFEST, JSON.stringify(sorted, null, 2) + '\n')
console.log('done')
