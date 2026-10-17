/**
 * The voice track for "An AI agent and your team, one table": Zazo
 * presenting, in the voice and settings of the Base intro (ElevenLabs
 * eleven_v3, Liam). Cached by voice + model + text.
 *
 * What it claims is what the footage shows (record.mjs): Claude Code writes
 * to the tickets table through the Supabase MCP server; the base hears each
 * write through Realtime, tints what changed and names the agent from
 * updated_by (base-sync.ts, activity.svelte.ts); a person opens a record,
 * corrects a field under their own name, and approves in the Needs review
 * view. It does not say the agent made a mistake: the correction is a person
 * disagreeing with one call.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VOICE = 'TX3LPaxmHKxFdv7VOQHJ' // Liam: Zazo
const MODEL = 'eleven_v3'

export const LINES = [
  { id: 'hello', text: "[cheerful] Hi, I'm Zazo. Let me show you something new in SvGrid Base." },
  { id: 'hook', text: 'AI agents now work in the same data as your team. They update records, fill in fields, and draft replies.' },
  { id: 'problem', text: 'But when an agent edits a table, rows just change. What did it touch? And who checks it?' },
  { id: 'setup', text: 'Here is a support inbox in SvGrid Base, on a real Supabase project. Ten new tickets. And Claude Code, connected to the same database through the Supabase MCP server.' },
  { id: 'agent', text: '[excited] One instruction: triage the inbox. Claude writes straight to the database, and the base shows every change as it lands, with the agent\'s name on it.' },
  { id: 'review', text: 'Open a record, and you see exactly what the agent changed, and what each field held before.' },
  { id: 'correct', text: 'Where you disagree, change it. Your edit goes to the same table, under your name.' },
  { id: 'approve', text: 'Then work through the Needs review view, and approve the rest with one click.' },
  { id: 'close', text: '[warm] The agent does the first pass. People make the call. Same table, your database. That is SvGrid Base, part of SvGrid Suite.' },
]

/**
 * Segment timing. `minSeg` holds a lower bound per segment (the agent's
 * footage, sped up, must play out before the next line starts).
 */
export function timeline(d, minSeg = {}) {
  const seg = {}
  let t = 0.6
  for (const { id } of LINES) {
    const lead = 0.25
    const tail = id === 'agent' ? 1.2 : id === 'close' ? 3.2 : id === 'review' || id === 'correct' ? 1.4 : 0.6
    const len = Math.max(lead + d[id] + tail, minSeg[id] ?? 0)
    seg[id] = [t, t + len]
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

export { mouthTrack, mixArgs } from '../base-intro/voice.mjs'
