/**
 * The voice track for "The Live Demo": three characters, performed with
 * ElevenLabs eleven_v3 audio tags ([whispers], [nervous], ...), cached on
 * disk by voice + model + text so a re-render costs no credits.
 *
 * The takes set the pacing: timeline() builds the shots around how long each
 * line actually runs, so a slower, more dramatic read is never sped up.
 *
 * mixVoices() lays the lines over the synthesized score and ducks the score
 * under them (sidechain compression), so the dialogue sits on top.
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
  { id: 'intro', who: 'narrator', text: '[dramatic, low] Live demo. Two hundred people.' },
  { id: 'ask', who: 'ceo', text: '[cold, commanding] Show them all one hundred thousand orders.' },
  { id: 'loading', who: 'dev', text: '[nervous whisper] Come on... come on.' },
  { id: 'freezes', who: 'narrator', text: '[dramatic pause] And the tab... freezes.' },
  { id: 'think', who: 'dev', text: '[panicked whisper] Think. Think!' },
  { id: 'swap', who: 'dev', text: '[determined] Swap the table. One component.' },
  { id: 'payoff', who: 'narrator', text: '[impressed] A hundred thousand rows. Scroll. Sort. No freeze.' },
  { id: 'dom', who: 'narrator', text: 'It renders what is on screen. Not all hundred thousand.' },
  { id: 'ship', who: 'ceo', text: '[pleased, slowly] ...Ship it.' },
  { id: 'outro', who: 'narrator', text: 'SvGrid. A hundred thousand rows. One Svelte component.' },
]

/**
 * The cut, built around the takes: each shot is as long as its line plus
 * room to breathe, so a slower, more dramatic read lengthens the shot instead
 * of being sped up. Returns the scene timeline (see T in scene.html) and the
 * start time of every line.
 */
export function timeline(d) {
  const s1 = [0, 0.45 + d.intro + 0.35]
  const s2 = [s1[1], s1[1] + 0.15 + d.ask + 0.35]
  const freeze = s2[1] + 0.5 + d.loading + 0.5
  const s3 = [s2[1], freeze + 0.25 + d.freezes + 0.45]
  const s4 = [s3[1], s3[1] + 0.2 + d.think + 0.45]
  const s5 = [s4[1], s4[1] + 0.15 + d.swap + 0.5]
  const split = s5[1] + 0.25 + d.payoff + 0.25
  const s6 = [s5[1], split + d.dom + 0.5]
  const clap = s6[1] + 0.5
  const shipIt = clap + 0.6
  const s7 = [s6[1], shipIt + d.ship + 1.0]
  const s8 = [s7[1], s7[1] + 0.25 + d.outro + 1.5]
  const T = { s1, s2, s3, s4, s5, s6, s7, s8, freeze, split, ceoAsk: s2[0] + 0.15, decide: s4[1] - 0.55, clap, shipIt, end: s8[1] }
  const at = {
    intro: 0.45, ask: s2[0] + 0.15, loading: s2[1] + 0.5, freezes: freeze + 0.25, think: s4[0] + 0.2,
    swap: s5[0] + 0.15, payoff: s5[1] + 0.25, dom: split, ship: shipIt, outro: s8[0] + 0.25,
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
 * ducks the score; then voice and ducked score are summed and limited.
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
    `[ducked][vox]amix=inputs=2:normalize=0,alimiter=limit=0.84:level=disabled[aout]`,
  ].join(';')
  return { inputs, graph }
}
