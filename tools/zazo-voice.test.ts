/**
 * Zazo's voice covers everything he can say. A new demo, a reworded title or
 * line, a new tip, or a change to the voice settings, without a re-render,
 * would leave him silent on that one (or speaking stale words), and nothing
 * else would notice. Fix: `node --env-file=.env tools/zazo-voice.mjs`.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SOUND, voiceDir, wantedClips } from './lib/zazo-clips.mjs'

const ROOT = resolve(__dirname, '..')
const TIPS: Record<string, unknown> = JSON.parse(readFileSync(join(ROOT, 'examples', 'src', 'zazo', 'zazo-tips.json'), 'utf8'))
const DIR = voiceDir(ROOT)
const manifest: Record<string, { text: string; sound: string }> = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'))
const want = wantedClips(ROOT) as Map<string, string>

describe('Zazo voice clips', () => {
  it('every clip he can play exists', () => {
    const missing = [...want.keys()].filter((clip) => !existsSync(join(DIR, `${clip}.mp3`)))
    expect(missing, 'run: node --env-file=.env tools/zazo-voice.mjs').toEqual([])
  })

  it('every clip says the current words, in the current voice', () => {
    const stale = [...want].filter(([clip, text]) => manifest[clip]?.text !== text || manifest[clip]?.sound !== SOUND).map(([clip]) => clip)
    expect(stale, 'run: node --env-file=.env tools/zazo-voice.mjs').toEqual([])
  })

  it('every gallery demo has a tip', () => {
    // A new demo gets one too: something on its page to try, and the element
    // it is about (see examples/src/zazo/zazo-tips.ts for the target format).
    const registry = readFileSync(join(ROOT, 'examples', 'src', 'shared', 'registry.ts'), 'utf8')
    const ids = [...registry.matchAll(/\bdemo\(\s*'([^']+)'/g)].map((m) => m[1]!)
    expect(ids.filter((id) => !TIPS[id]), 'add a tip to examples/src/zazo/zazo-tips.json').toEqual([])
  })

  it('every tip is for a demo that exists', () => {
    const demos = new Set(readdirSync(join(ROOT, 'examples', 'src', 'demos')).filter((f) => f.endsWith('.svelte')).map((f) => f.slice(0, -7)))
    expect(Object.keys(TIPS).filter((id) => !demos.has(id))).toEqual([])
  })
})
