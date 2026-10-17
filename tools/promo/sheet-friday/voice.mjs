/**
 * The voice track for "Excel by Friday": the same cast as the other cartoons
 * (narrator, CEO, and Zazo the developer), performed with ElevenLabs
 * eleven_v3 audio tags and cached by voice + model + text.
 *
 * The takes set the pacing: timeline() builds every shot around its line.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VOICES = {
  narrator: 'nPczCjzI2devNBz1zQrb', // Brian: deep, trailer read
  ceo: 'Xb7hH8MSUJpSbSDYk0k2', // Alice: cool, commanding
  dev: 'TX3LPaxmHKxFdv7VOQHJ', // Liam: Zazo
}
const MODEL = 'eleven_v3'

/** The script, in story order. When each line plays comes from timeline(). */
export const LINES = [
  { id: 'intro', who: 'narrator', text: '[upbeat] Every company runs on a spreadsheet.' },
  { id: 'ceo', who: 'ceo', text: '[firm] Finance wants their spreadsheet inside our app. Formulas and all. By Friday.' },
  { id: 'panic', who: 'dev', text: '[panicked] Excel... in the browser? By Friday?' },
  { id: 'tries', who: 'narrator', text: '[wry] So Zazo tried a table. Then a formula parser. [beat] Then the formats broke.' },
  { id: 'idea', who: 'dev', text: '[relieved] Or... one component.' },
  { id: 'payoff', who: 'narrator', text: '[impressed] SvGrid Spreadsheet. Formulas, the ribbon, the Excel keys. One line of Svelte.' },
  { id: 'verdict', who: 'ceo', text: "[surprised] ...That's Excel." },
  { id: 'outro', who: 'narrator', text: 'SvGrid Spreadsheet. Try it free today.' },
]

/** The cut, built around the takes. Returns the scene timeline and line starts. */
export function timeline(d) {
  const s1 = [0, 0.4 + d.intro + 0.5] // the desk, a spreadsheet on the monitor
  const s2 = [s1[1], s1[1] + 0.2 + d.ceo + 0.4] // the CEO
  const s3 = [s2[1], s2[1] + 0.15 + d.panic + 0.3] // Zazo panics
  const s4 = [s3[1], s3[1] + 0.2 + d.tries + 0.5] // three attempts, three stamps
  const s5 = [s4[1], s4[1] + 0.15 + d.idea + 0.35] // Zazo: one component
  const s6 = [s5[1], s5[1] + 3.0] // npm install, <SvSheet />
  const s7 = [s6[1], s6[1] + 0.3 + d.payoff + 1.8] // real footage
  const s8 = [s7[1], s7[1] + 0.3 + d.verdict + 0.7] // the CEO
  const s9 = [s8[1], s8[1] + 0.25 + d.outro + 2.4] // end card
  // In the montage: the three failures land through the narration.
  const t0 = s4[0] + 0.2
  const T = {
    s1, s2, s3, s4, s5, s6, s7, s8, s9,
    fail1: t0 + d.tries * 0.18, fail2: t0 + d.tries * 0.45, fail3: t0 + d.tries * 0.8,
    end: s9[1],
  }
  const at = {
    intro: 0.4, ceo: s2[0] + 0.2, panic: s3[0] + 0.15, tries: s4[0] + 0.2, idea: s5[0] + 0.15,
    payoff: s7[0] + 0.3, verdict: s8[0] + 0.3, outro: s9[0] + 0.25,
  }
  return { T, at }
}

async function synth(voice, text, key) {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt) await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt))
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
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
    const voice = VOICES[line.who]
    const hash = createHash('sha256').update(`${voice}|${MODEL}|${line.text}`).digest('hex').slice(0, 16)
    const file = join(cacheDir, `${line.who}-${hash}.mp3`)
    if (!existsSync(file)) {
      console.log(`  tts: ${line.who}: ${line.text}`)
      writeFileSync(file, await synth(voice, line.text, key))
    }
    out.push({ ...line, file, dur: duration(file) })
  }
  return out
}

/** Place each take at its time in the timeline. */
export function placeVoices(voices, at) {
  return voices.map((v) => ({ ...v, at: at[v.id] }))
}

/** ffmpeg inputs and filter graph: score ducked under the voices, normalized. */
export function mixArgs(scoreWav, voices, firstVoiceInput) {
  const inputs = ['-i', scoreWav]
  for (const v of voices) inputs.push('-i', v.file)
  const parts = voices.map((v, i) => {
    const ms = Math.round(v.at * 1000)
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
