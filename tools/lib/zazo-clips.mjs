/**
 * What Zazo says out loud, as clip name -> text: every line in
 * examples/src/zazo/zazo-lines.ts, every demo title (gallery registry, website
 * registry, community demos) and every tip in zazo-tips.json. Shared by the
 * renderer (tools/zazo-voice.mjs) and its coverage test
 * (tools/zazo-voice.test.ts), so the two can never disagree on the list.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { LINES, lineClip, spokenTitle, titleClip } from '../../examples/src/zazo/zazo-lines.ts'

export const VOICE = 'TX3LPaxmHKxFdv7VOQHJ' // Liam: the developer in the cartoons
export const MODEL = 'eleven_v3'
// The cartoons' rate (44.1 kHz) at half their bitrate: the gallery ships ~500
// clips, and speech loses nothing audible at 64 kbps.
export const FORMAT = 'mp3_44100_64'
// Exactly the cartoons' settings (tools/promo/*/voice.mjs), so he sounds like
// the developer in the shorts.
export const SETTINGS = { stability: 0.3, similarity_boost: 0.8, style: 0.6, use_speaker_boost: true }
// Recorded with every clip: change the voice and every clip re-renders.
export const SOUND = `${VOICE}|${MODEL}|${FORMAT}|${JSON.stringify(SETTINGS)}`

export const voiceDir = (root) => join(root, 'examples', 'src', 'zazo', 'voice')

const DEMO_CALL = /\bdemo\(\s*(['"`])([^'"`]+)\1\s*,\s*(['"`])((?:(?!\3)[^\\]|\\.)*)\3/g

/** Every demo title a visitor can meet, in either app. */
export function demoTitles(root) {
  const titles = new Set()
  for (const file of ['examples/src/shared/registry.ts', 'website/src/lib/demos.ts']) {
    const path = join(root, file)
    if (!existsSync(path)) continue // the website is a private submodule
    for (const m of readFileSync(path, 'utf8').matchAll(DEMO_CALL)) titles.add(m[4].replace(/\\(.)/g, '$1'))
  }
  const community = join(root, 'examples', 'src', 'demos', 'community')
  for (const f of readdirSync(community).filter((f) => f.endsWith('.svelte'))) {
    const t = readFileSync(join(community, f), 'utf8').match(/^\s*title\s*:\s*(.+?)\s*$/m)
    if (t) titles.add(t[1])
  }
  return titles
}

/** clip name -> the text that clip says. */
export function wantedClips(root) {
  const want = new Map()
  for (const [key, text] of Object.entries(LINES)) want.set(lineClip(key), text)
  for (const title of demoTitles(root)) want.set(titleClip(title), spokenTitle(title))
  const tips = JSON.parse(readFileSync(join(root, 'examples', 'src', 'zazo', 'zazo-tips.json'), 'utf8'))
  for (const [id, tip] of Object.entries(tips)) want.set(`tip-${id}`, tip.text)
  return want
}
