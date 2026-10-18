/**
 * The narration for "SvGrid Studio, a tour": one line per shot, read by the
 * narrator of the cartoon shorts (ElevenLabs eleven_v3, Brian). Cached by
 * voice + model + text, so re-rendering costs nothing until a line changes.
 *
 * The takes set the cut: a shot lasts at least as long as its line plus a
 * breath (shotDurations), and the footage is recorded at that length.
 *
 * Every claim is something the footage shows or the code has: the data
 * sources in Studio's Add data menu and studio-database-to-app, the 20
 * themes in the picker, ctx in the Code view (PageContext), the generated
 * file list (routes, lib/schemas.test.ts, routes/login, ci.yml, DEPLOY.md),
 * the deploy targets in the Deploy dialog, and the studio_* MCP tools.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VOICE = 'nPczCjzI2devNBz1zQrb' // Brian: the narrator
const MODEL = 'eleven_v3'

/** shot id -> line. Shots without a line (the logo cards) play the score alone. */
export const LINES = {
  hook: 'Every internal tool starts the same way. Tables in a database, and the screens your team needs to work with them.',
  promise: 'SvGrid Studio designs those screens with you, and writes them as a real SvelteKit app.',
  sources: 'Start from the data you already have. Postgres, MySQL, SQL Server, SQLite, Supabase, a REST API, an OpenAPI spec, or a CSV file.',
  proof: 'It comes from the team behind jQWidgets, used by more than five thousand customers.',
  tiles: 'Here is how you get from tables to a running app.',
  't-data': 'One. The data model.',
  adddata: 'Bring in a database, a CSV file, or an API spec.',
  datamodel: 'Studio reads your tables, their fields, and how they relate.',
  't-screens': 'Two. Screens.',
  overview: 'A screen is a set of blocks on a canvas. KPI tiles, gauges and charts, each one bound to your data.',
  pipeline: 'Boards with filters,',
  forecast: 'trend charts and pivot tables,',
  deal360: 'and a record page for every table.',
  't-themes': 'Three. Themes.',
  themes: 'Twenty themes restyle the whole app in one click.',
  dark: 'And every one of them has a dark mode.',
  't-logic': 'Four. Logic.',
  code: 'When you need behavior, write it in TypeScript, with typed access to every grid, chart and tile on the page.',
  't-preview': 'Five. Preview.',
  preview: 'Run the app the way your users will. On a desktop, a tablet, or a phone.',
  't-ship': 'Six. Generate and deploy.',
  generate: 'Studio writes a SvelteKit project. Routes, typed schemas with tests, sign-in, and a CI workflow.',
  deploy: 'Then deploy it to Vercel, Netlify or Cloudflare.',
  samples: 'Or start from a sample app. A CRM, an online store, invoicing, inventory, a help desk, and more.',
  checks: 'You get SvelteKit routes, typed schemas with tests, a CI workflow, and code you can read and edit. Switch on sign-in with roles, or a Drizzle data layer, when you need them. And an MCP server lets AI agents build with you.',
  value: '[warm] Generate the boring parts. Keep the code. Every screen is built from SvGrid components, which we build, maintain and support.',
  cta1: 'Try SvGrid Studio in your browser, at svgrid dot com slash studio.',
  cta2: 'Or start a thirty day free trial, and build your first app this afternoon.',
}

/** Seconds from a shot's start to its line, and the breath kept after it. */
export const LEAD = (kind) => (kind === 'title' ? 0.25 : 0.4)
const TAIL = (kind) => (kind === 'title' ? 0.35 : 0.55)

/** The longer of each shot's designed length and its line plus a breath. */
export function shotDurations(shots, voices) {
  const out = {}
  for (const s of shots) {
    const v = voices.find((x) => x.id === s.id)
    out[s.id] = v ? Math.max(s.dur, LEAD(s.kind) + v.dur + TAIL(s.kind)) : s.dur
  }
  return out
}

async function synth(text, key) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.35, use_speaker_boost: true } }),
      signal: AbortSignal.timeout(120_000),
    }).catch((e) => ({ ok: false, status: 0, text: async () => e.message }))
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    const msg = await res.text()
    if (res.status && res.status !== 429 && res.status < 500) throw new Error(`ElevenLabs ${res.status}: ${msg.slice(0, 300)}`)
  }
  throw new Error('ElevenLabs: gave up after 5 attempts')
}

const duration = (file) =>
  Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' }).trim())

/** Synthesize (or reuse) every line. Returns [{ id, text, file, dur }]. */
export async function prepareVoices(cacheDir) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set (run with node --env-file=.env)')
  mkdirSync(cacheDir, { recursive: true })
  const out = []
  for (const [id, text] of Object.entries(LINES)) {
    const hash = createHash('sha256').update(`${VOICE}|${MODEL}|${text}`).digest('hex').slice(0, 16)
    const file = join(cacheDir, `${id}-${hash}.mp3`)
    if (!existsSync(file)) {
      console.log(`  tts: ${text}`)
      writeFileSync(file, await synth(text, key))
    }
    out.push({ id, text, file, dur: duration(file) })
  }
  return out
}

/** Captions: the lines as spoken, without the delivery tags. */
export function srt(voices, at) {
  const ts = (s) => {
    const ms = Math.round(s * 1000)
    const p = (n, w = 2) => String(n).padStart(w, '0')
    return `${p(Math.floor(ms / 3_600_000))}:${p(Math.floor(ms / 60_000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`
  }
  return voices
    .map((v, i) => `${i + 1}\n${ts(at[v.id])} --> ${ts(at[v.id] + v.dur)}\n${v.text.replace(/\[[^\]]*\]\s*/g, '')}\n`)
    .join('\n')
}

/** ffmpeg inputs and filter graph: the score ducked under the narration, normalized for YouTube. */
export function mixArgs(scoreWav, voices, at, firstVoiceInput) {
  const inputs = ['-i', scoreWav]
  for (const v of voices) inputs.push('-i', v.file)
  const parts = voices.map((v, i) => {
    const ms = Math.round(at[v.id] * 1000)
    return `[${firstVoiceInput + i}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=1.4,adelay=${ms}|${ms}[v${i}]`
  })
  const labels = voices.map((_, i) => `[v${i}]`).join('')
  const graph = [
    ...parts,
    `${labels}amix=inputs=${voices.length}:normalize=0,asplit=2[vox][key]`,
    `[${firstVoiceInput - 1}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=0.8[score]`,
    `[score][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=400:makeup=1[ducked]`,
    `[ducked][vox]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=9,alimiter=limit=0.82:level=disabled:attack=2:release=60,aresample=48000[aout]`,
  ].join(';')
  return { inputs, graph }
}
