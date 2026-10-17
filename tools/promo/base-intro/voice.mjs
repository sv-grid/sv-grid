/**
 * The voice track for "Meet SvGrid Base": Zazo presenting, in the voice and
 * settings of the cartoon shorts (ElevenLabs eleven_v3, Liam). Cached by
 * voice + model + text.
 *
 * Every claim is in the code (packages/enterprise/src/fields): 28 field
 * types (builtin-types.ts), grid / Kanban / calendar / gallery / form views
 * (view-model.ts), comments on the expanded record, baseFromSupabase reading
 * the schema with links from foreign keys and Realtime (base-connect.ts,
 * base-sync.ts), baseFromDatabase dialects postgres, mysql, sqlite, mssql and
 * a REST source, "Download as SQL" (base-sql.ts), automations with webhook
 * and email actions (automations.svelte.ts).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VOICE = 'TX3LPaxmHKxFdv7VOQHJ' // Liam: Zazo
const MODEL = 'eleven_v3'

/** The script, in order. Each line is one segment of the video. */
export const LINES = [
  { id: 'hello', text: "[cheerful] Hi, I'm Zazo. Let me show you what we've been building." },
  { id: 'hook', text: 'Your team runs on tables. Projects, customers, hiring, inventory. Maybe you keep them in Airtable.' },
  { id: 'problem', text: 'That works. But the data sits in someone else\'s cloud, and your team works next to your app, not inside it.' },
  { id: 'intro', text: '[excited] So meet SvGrid Base. An Airtable alternative that runs inside your Svelte app, on your own database.' },
  { id: 'fields', text: 'Tables with more than twenty field types. Selects, people, dates, files, links, lookups, rollups and formulas.' },
  { id: 'views', text: 'And every table can be a grid, a Kanban board, a calendar, a gallery, or a form.' },
  { id: 'records', text: 'Filter, group, sort and color any view. Open a record to see all of it, with comments.' },
  { id: 'bind', text: '[excited] Now the best part. Point Base at your Supabase project, and it builds the app for you. Every table, its fields, its records, and views to work in. Automatically.' },
  { id: 'sync', text: 'And it stays in sync. Every edit is written straight to your database. When a colleague changes a record, you see it live, through Supabase Realtime.' },
  { id: 'databases', text: 'Not on Supabase? Point it at Postgres, MySQL, SQLite, SQL Server, or your own API.' },
  { id: 'sql', text: 'Starting from scratch? Design your base in the page, then download it as SQL, and that creates the tables.' },
  { id: 'automations', text: 'Add automations, too. When a record changes, update another one, call a webhook, or send an email.' },
  { id: 'close', text: '[warm] SvGrid Base. Your tables, your database, your app. It is part of SvGrid Suite, and you can try it free.' },
]

/** Segment timing around the takes: a short lead-in and a breath after each line. */
export function timeline(d) {
  const seg = {}
  let t = 0.6
  for (const { id } of LINES) {
    const lead = 0.25
    const tail = id === 'intro' || id === 'bind' ? 0.9 : id === 'close' ? 3.2 : 0.55
    seg[id] = [t, t + lead + d[id] + tail]
    t = seg[id][1]
  }
  const at = Object.fromEntries(LINES.map(({ id }) => [id, seg[id][0] + 0.25]))
  return { seg, at, end: t }
}

async function synth(text, key) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true } }),
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

/** Synthesize (or reuse) every line. Returns [{ ...line, file, dur }]. */
export async function prepareVoices(cacheDir) {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set (run with node --env-file=.env)')
  mkdirSync(cacheDir, { recursive: true })
  const out = []
  for (const line of LINES) {
    const hash = createHash('sha256').update(`${VOICE}|${MODEL}|${line.text}`).digest('hex').slice(0, 16)
    const file = join(cacheDir, `zazo-${hash}.mp3`)
    if (!existsSync(file)) {
      console.log(`  tts: ${line.text}`)
      writeFileSync(file, await synth(line.text, key))
    }
    out.push({ ...line, file, dur: duration(file) })
  }
  return out
}

/**
 * How loud each take is, per video frame: Zazo's mouth opens with it.
 * Returns one number per frame of the whole video, 0..1.
 */
export function mouthTrack(voices, at, end, fps) {
  const track = new Float32Array(Math.ceil(end * fps))
  for (const v of voices) {
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', v.file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 })
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2))
    const per = 16000 / fps
    const start = Math.round(at[v.id] * fps)
    for (let f = 0; f * per < samples.length; f++) {
      let sum = 0
      const a = Math.floor(f * per), b = Math.min(samples.length, Math.floor((f + 1) * per))
      for (let i = a; i < b; i++) sum += (samples[i] / 32768) ** 2
      const rms = Math.sqrt(sum / Math.max(1, b - a))
      if (start + f < track.length) track[start + f] = Math.min(1, rms * 5.5)
    }
  }
  return Array.from(track, (x) => Math.round(x * 100) / 100)
}

/** ffmpeg inputs and filter graph: score ducked under the voice, normalized. */
export function mixArgs(scoreWav, voices, at, firstVoiceInput) {
  const inputs = ['-i', scoreWav]
  for (const v of voices) inputs.push('-i', v.file)
  const parts = voices.map((v, i) => {
    const ms = Math.round(at[v.id] * 1000)
    return `[${firstVoiceInput + i}:a]aformat=sample_rates=44100:channel_layouts=mono,volume=1.35,adelay=${ms}|${ms}[v${i}]`
  })
  const labels = voices.map((_, i) => `[v${i}]`).join('')
  const graph = [
    ...parts,
    `${labels}amix=inputs=${voices.length}:normalize=0,asplit=2[vox][key]`,
    `[${firstVoiceInput - 1}:a]aformat=sample_rates=44100:channel_layouts=mono[score]`,
    `[score][key]sidechaincompress=threshold=0.02:ratio=8:attack=15:release=350:makeup=1[ducked]`,
    `[ducked][vox]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=7,aresample=44100[aout]`,
  ].join(';')
  return { inputs, graph }
}
