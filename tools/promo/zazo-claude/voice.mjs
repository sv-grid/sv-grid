/**
 * The voice track for "You're absolutely right": Zazo asks Claude for a
 * table and gets a framework. ElevenLabs eleven_v3 with audio tags, cached by
 * voice + model + text. Zazo is Liam, as in every Zazo cartoon; Claude is a
 * cartoon character here and gets a voice of its own (George, a stock voice),
 * an over-eager, very polite one.
 *
 * The check beat is what happened making this video: the first
 * svgrid_check_code run on the orders component flagged `type` ("Use
 * cellDataType"), and the corrected 13-line file came back clean.
 *
 * The takes set the pacing: timeline() builds every beat around its line.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VOICES = {
  narrator: { id: 'nPczCjzI2devNBz1zQrb', settings: { stability: 0.4, similarity_boost: 0.8, style: 0.5 } }, // Brian
  zazo: { id: 'TX3LPaxmHKxFdv7VOQHJ', settings: { stability: 0.3, similarity_boost: 0.8, style: 0.6 } }, // Liam
  claude: { id: 'JBFqnCBsd6RMkjVDRZzb', settings: { stability: 0.3, similarity_boost: 0.8, style: 0.75 } }, // George
}
const MODEL = 'eleven_v3'

/** The script, in story order. When each line plays comes from timeline(). */
export const LINES = [
  { id: 'intro', who: 'narrator', text: '[upbeat] Zazo needs a table. So he asks Claude.' },
  { id: 'ask', who: 'zazo', text: 'Claude, I just need a simple orders table.' },
  { id: 'gen', who: 'claude', text: "[delighted] Absolutely! What a wonderful idea! I've built you a comprehensive, enterprise-grade table framework!" },
  { id: 'lines', who: 'zazo', text: "[deadpan] ...It's two thousand lines." },
  { id: 'extra', who: 'claude', text: '[proudly] Two thousand and forty! I also added a plugin system, a state machine, and a small design system.' },
  { id: 'nosort', who: 'zazo', text: "[flat] It doesn't sort." },
  { id: 'sorry', who: 'claude', text: "[gasps] You're absolutely right! I sincerely apologize. Let me rewrite all of it." },
  { id: 'stop', who: 'zazo', text: '[firm] No, no, no. Use the SvGrid MCP.' },
  { id: 'docs', who: 'claude', text: '[sheepish] Oh. There are... docs.' },
  { id: 'check', who: 'claude', text: '[cheerful] I checked my code, and it caught my mistake! [beat] Fixed. Thirteen lines.' },
  { id: 'payoff', who: 'narrator', text: '[impressed] Thirteen lines. Sorted, filtered, paged.' },
  { id: 'sus', who: 'zazo', text: '[suspicious] You actually checked it?' },
  { id: 'joke', who: 'claude', text: "[cheerful] You're absolutely right to ask! [beat] ...I did, though." },
  { id: 'outro', who: 'narrator', text: 'SvGrid. Give your AI the docs.' },
]

/** The cut, built around the takes. Returns the beat windows and line starts. */
export function timeline(d) {
  const T = {}
  const at = {}
  let t = 0.5
  const beat = (id, lead, tail) => { T[id] = [t, t + lead + d[id] + tail]; at[id] = t + lead; t = T[id][1] }
  beat('intro', 0.1, 0.35)
  beat('ask', 0.1, 0.3)
  beat('gen', 0.1, 1.0) // the code pours out past the line
  beat('lines', 0.1, 0.3)
  beat('extra', 0.05, 0.4)
  beat('nosort', 0.6, 0.6) // a header click that does nothing, then the line
  beat('sorry', 0.05, 0.9) // the counter resets and starts again
  beat('stop', 0.05, 0.3)
  beat('docs', 0.2, 1.4) // tool calls land
  beat('check', 0.1, 1.2) // the check fails, then passes; the 13 lines
  beat('payoff', 0.4, 3.0) // real footage
  beat('sus', 0.2, 0.25)
  beat('joke', 0.1, 0.6)
  beat('outro', 0.3, 2.2) // end card
  T.end = t
  return { T, at }
}

async function synth(who, text, key) {
  const v = VOICES[who]
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${v.id}?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { ...v.settings, use_speaker_boost: true } }),
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
    const v = VOICES[line.who]
    const hash = createHash('sha256').update(`${v.id}|${MODEL}|${JSON.stringify(v.settings)}|${line.text}`).digest('hex').slice(0, 16)
    const file = join(cacheDir, `${line.id}-${hash}.mp3`)
    if (!existsSync(file)) {
      console.log(`  tts ${line.who}: ${line.text}`)
      writeFileSync(file, await synth(line.who, line.text, key))
    }
    out.push({ ...line, file, dur: duration(file) })
  }
  return out
}

/**
 * Each speaker's loudness per video frame (0..1), so the mouths move with
 * the voice. Returns { zazo: number[], claude: number[], narrator: number[] }.
 */
export function mouthTracks(voices, at, end, fps) {
  const n = Math.ceil(end * fps)
  const tracks = { zazo: new Array(n).fill(0), claude: new Array(n).fill(0), narrator: new Array(n).fill(0) }
  for (const v of voices) {
    const pcm = execFileSync('ffmpeg', ['-v', 'error', '-i', v.file, '-ac', '1', '-ar', '16000', '-f', 's16le', '-'], { maxBuffer: 1 << 28 })
    const samples = new Int16Array(pcm.buffer, pcm.byteOffset, Math.floor(pcm.length / 2))
    const per = 16000 / fps
    const start = Math.round(at[v.id] * fps)
    for (let f = 0; f * per < samples.length; f++) {
      let sum = 0
      const a = Math.floor(f * per), b = Math.min(samples.length, Math.floor((f + 1) * per))
      for (let i = a; i < b; i++) sum += (samples[i] / 32768) ** 2
      if (start + f < n) tracks[v.who][start + f] = Math.round(Math.min(1, Math.sqrt(sum / Math.max(1, b - a)) * 5.5) * 100) / 100
    }
  }
  return tracks
}

/** ffmpeg inputs and filter graph: the score ducked under the voices, normalized for Shorts. */
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
    `[ducked][vox]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=disabled,loudnorm=I=-14:TP=-1.5:LRA=7,alimiter=limit=0.82:level=disabled,aresample=48000[aout]`,
  ].join(';')
  return { inputs, graph }
}
