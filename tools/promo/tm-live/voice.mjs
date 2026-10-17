/**
 * The voice track for "300,000 rows, live": the same cast as "The Live Demo"
 * (narrator, CEO, developer), performed with ElevenLabs eleven_v3 audio tags
 * and cached on disk by voice + model + text.
 *
 * The takes set the pacing: timeline() builds every shot around how long its
 * line runs, so a slower, more dramatic read is never sped up.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const VOICES = {
  narrator: 'nPczCjzI2devNBz1zQrb', // Brian: deep, trailer read
  ceo: 'Xb7hH8MSUJpSbSDYk0k2', // Alice: cool, commanding
  dev: 'TX3LPaxmHKxFdv7VOQHJ', // Liam: young, under pressure
}
const MODEL = 'eleven_v3'

/** The script, in story order. When each line plays comes from timeline(). */
export const LINES = [
  { id: 'intro', who: 'narrator', text: '[dramatic, low] A test and measurement company. A jQWidgets customer for years.' },
  { id: 'ask', who: 'ceo', text: "[firm] We're moving to Svelte. Three hundred thousand test records, live, grouped by station." },
  { id: 'spec', who: 'narrator', text: '[tense] Every second: six hundred in. Six hundred out. Three thousand updates.' },
  { id: 'tried', who: 'narrator', text: '[grim] They tried grid after grid. [beat] One froze. One lost the groups. One crashed the tab.' },
  { id: 'try', who: 'dev', text: "[determined] Let's try SvGrid." },
  { id: 'payoff', who: 'narrator', text: '[impressed] Three hundred thousand rows. Grouped. Updating every second. [beat] Still smooth.' },
  { id: 'verdict', who: 'ceo', text: "[impressed, slowly] ...That's our grid." },
  { id: 'outro', who: 'narrator', text: 'SvGrid. The Svelte data grid, from jQWidgets.' },
]

/**
 * The cut, built around the takes. The failed-grid montage splits the
 * "tried" line in three; the payoff runs past its line so the batches can be
 * seen land. Returns the scene timeline (T in scene.html) and line starts.
 */
export function timeline(d) {
  const s1 = [0, 0.5 + d.intro + 0.4] // the lab
  const s2 = [s1[1], s1[1] + 0.2 + d.ask + 0.45] // the CEO
  const s3 = [s2[1], s2[1] + 0.2 + d.spec + 0.5] // the requirement, counting
  const s4 = [s3[1], s3[1] + 0.2 + d.tried + 0.6] // grid A, B, C fail
  const s5 = [s4[1], s4[1] + 0.15 + d.try + 0.45] // the developer
  const s6 = [s5[1], s5[1] + 3.4] // the code
  const s7 = [s6[1], s6[1] + 0.3 + d.payoff + 3.0] // real footage
  const s8 = [s7[1], s7[1] + 0.3 + d.verdict + 0.9] // the CEO
  const s9 = [s8[1], s8[1] + 0.25 + d.outro + 1.6] // end card
  const triedAt = s4[0] + 0.2
  const T = {
    s1, s2, s3, s4, s5, s6, s7, s8, s9,
    // The montage panels follow the beats of the "tried" line.
    failA: triedAt + d.tried * 0.38, failB: triedAt + d.tried * 0.62, failC: triedAt + d.tried * 0.82,
    end: s9[1],
  }
  const at = {
    intro: 0.5, ask: s2[0] + 0.2, spec: s3[0] + 0.2, tried: triedAt, try: s5[0] + 0.15,
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

/**
 * ffmpeg inputs and filter graph: score on input 0, one input per line.
 * Lines are delayed to their slot, summed, and used as the sidechain that
 * ducks the score; then voice and ducked score are summed, limited and
 * normalized to about -16 LUFS.
 */
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
