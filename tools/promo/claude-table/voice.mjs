/**
 * The voice track for "A thousand lines of table": the same cast as the other
 * cartoons (narrator, CEO, developer), performed with ElevenLabs eleven_v3
 * audio tags and cached by voice + model + text. Claude is never voiced: its
 * replies are text in the chat window, and the developer reads the last one.
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
  dev: 'TX3LPaxmHKxFdv7VOQHJ', // Liam: young, under pressure
}
const MODEL = 'eleven_v3'

/** The script, in story order. When each line plays comes from timeline(). */
export const LINES = [
  { id: 'intro', who: 'narrator', text: '[upbeat] A fresh SvelteKit three app. [beat] Now it needs a table.' },
  { id: 'ask1', who: 'narrator', text: '[wry] So he asks Claude. [beat] A thousand lines later... a table.' },
  { id: 'ceo', who: 'ceo', text: '[firm] HR wants it as a tree. Managers and their teams. And editable.' },
  { id: 'more', who: 'narrator', text: '[tense] More prompts. More code.' },
  { id: 'broken', who: 'dev', text: "[panicked] Open one team, another one closes... and the edits don't stick." },
  { id: 'ask2', who: 'dev', text: '[defeated] Claude... what do I do?' },
  { id: 'answer', who: 'dev', text: '[reading, relieved] "Use a grid that already does this." [beat] SvGrid.' },
  { id: 'payoff', who: 'narrator', text: '[impressed] Forty-one lines. A tree, three levels deep. Edit a salary... it sticks.' },
  { id: 'verdict', who: 'ceo', text: '[pleased] ...Perfect.' },
  { id: 'outro', who: 'narrator', text: "SvGrid. Don't generate a grid. Install one." },
]

/** The cut, built around the takes. Returns the scene timeline and line starts. */
export function timeline(d) {
  const s1 = [0, 0.5 + d.intro + 0.4] // the desk; sv create on the monitor
  const s2 = [s1[1], s1[1] + 0.2 + d.ask1 + 0.6] // Claude writes the table
  const s3 = [s2[1], s2[1] + 0.2 + d.ceo + 0.45] // the CEO
  const s4 = [s3[1], s3[1] + 0.2 + d.more + 1.2] // more code
  const s5 = [s4[1], s4[1] + 0.3 + d.broken + 0.5] // the test: broken
  const s6 = [s5[1], s5[1] + 0.15 + d.ask2 + 0.3] // the developer asks
  const s7 = [s6[1], s6[1] + 1.6 + d.answer + 0.4] // Claude answers; the developer reads it
  const s8 = [s7[1], s7[1] + 3.6] // npm install, the 41 lines
  const s9 = [s8[1], s8[1] + 0.3 + d.payoff + 2.4] // real footage
  const s10 = [s9[1], s9[1] + 0.3 + d.verdict + 0.8] // the CEO
  const s11 = [s10[1], s10[1] + 0.25 + d.outro + 1.6] // end card
  const T = {
    s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11,
    // In the broken test: the wrong branch collapses, then the edit snaps back.
    wrong: s5[0] + 0.3 + d.broken * 0.3, lost: s5[0] + 0.3 + d.broken * 0.72,
    end: s11[1],
  }
  const at = {
    intro: 0.5, ask1: s2[0] + 0.2, ceo: s3[0] + 0.2, more: s4[0] + 0.2, broken: s5[0] + 0.3,
    ask2: s6[0] + 0.15, answer: s7[0] + 1.6, payoff: s9[0] + 0.3, verdict: s10[0] + 0.3, outro: s11[0] + 0.25,
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
