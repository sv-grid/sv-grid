/**
 * Narration audio for a beat.
 *
 * Provider is ElevenLabs over bare `fetch` (the repo convention: no SDKs, see
 * tools/twitter/compose.mjs for the Anthropic call in the same style). Every
 * synthesized clip is cached on disk by a hash of provider + voice + model +
 * settings + normalized text, so re-recording a tutorial whose narration did
 * not change costs no credits, and a wording change re-synthesizes only the
 * beats it touched.
 *
 * Env:
 *   ELEVENLABS_API_KEY    required for the elevenlabs provider
 *   ELEVENLABS_VOICE_ID   default: a documented ElevenLabs stock voice
 *   ELEVENLABS_MODEL_ID   default: eleven_multilingual_v2
 *   TTS_PROVIDER          elevenlabs (default when a key is set) | silence
 *
 * `silence` writes a silent mp3 of roughly the spoken length (2.5 words/s),
 * so the whole record -> mux -> embed path can be exercised without a key.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { normalizeNarration } from '../../lib/tutorial-media.mjs'
import { silentMp3 } from './ffmpeg.mjs'
import { CACHE_DIR } from './manifest.mjs'

// "George", one of ElevenLabs' premade voices: a calm, clear narration voice.
const DEFAULT_VOICE = 'JBFqnCBsd6RMkjVDRZzb'
const DEFAULT_MODEL = 'eleven_multilingual_v2'

export function ttsConfig(env = process.env) {
  const key = env.ELEVENLABS_API_KEY || ''
  const provider = env.TTS_PROVIDER || (key ? 'elevenlabs' : 'silence')
  return {
    provider,
    key,
    voiceId: env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE,
    modelId: env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL,
    stability: 0.5,
    similarity: 0.75,
  }
}

export function hasTtsKey(env = process.env) {
  return Boolean(env.ELEVENLABS_API_KEY)
}

async function elevenlabs(text, cfg) {
  if (!cfg.key) throw new Error('ELEVENLABS_API_KEY is not set (or use TTS_PROVIDER=silence)')
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${cfg.voiceId}?output_format=mp3_44100_128`
  const body = JSON.stringify({
    text,
    model_id: cfg.modelId,
    voice_settings: { stability: cfg.stability, similarity_boost: cfg.similarity, style: 0, use_speaker_boost: true },
  })
  let last
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': cfg.key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body,
    })
    if (res.ok) return Buffer.from(await res.arrayBuffer())
    last = new Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0, 300)}`)
    if (res.status !== 429 && res.status < 500) break
    await new Promise((r) => setTimeout(r, 2000))
  }
  throw last
}

/** Words / 2.5 per second, floored at a second, for the silent provider. */
export function estimateSeconds(text) {
  const words = normalizeNarration(text).split(' ').filter(Boolean).length
  return Math.max(1, Math.round((words / 2.5) * 10) / 10)
}

/**
 * The mp3 for one narration line, from cache when possible.
 * @returns {Promise<{ path: string, cached: boolean }>}
 */
export async function cachedSynthesize(text, cfg = ttsConfig(), cacheDir = join(CACHE_DIR, 'tts')) {
  const clean = normalizeNarration(text)
  const key = createHash('sha1')
    .update([cfg.provider, cfg.voiceId, cfg.modelId, cfg.stability, cfg.similarity, clean].join('|'))
    .digest('hex')
  mkdirSync(cacheDir, { recursive: true })
  const path = join(cacheDir, `${key}.mp3`)
  if (existsSync(path)) return { path, cached: true }
  if (cfg.provider === 'silence') {
    await silentMp3(path, estimateSeconds(clean))
  } else if (cfg.provider === 'elevenlabs') {
    writeFileSync(path, await elevenlabs(clean, cfg))
  } else {
    throw new Error(`unknown TTS_PROVIDER "${cfg.provider}"`)
  }
  return { path, cached: false }
}
