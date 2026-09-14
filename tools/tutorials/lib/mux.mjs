/**
 * Turn a recording (raw.webm + timeline.json + per-beat mp3s) into the
 * published set:
 *
 *   tutorials-out/<id>/<id>.youtube.mp4   H.264 + AAC master with narration
 *   tutorials-out/<id>/<id>.gif           a beat window for README / social
 *   tutorials-out/<id>/<id>.srt           captions for YouTube
 *   tutorials-out/<id>/<id>.thumb.jpg     YouTube thumbnail (no WebP there)
 *   tutorials-out/<id>/transcript.txt
 *   website/public/tutorials/<id>.mp4          muted docs cut, budget-checked
 *   website/public/tutorials/<id>.poster.webp
 *   website/public/tutorials/<id>.vtt
 *
 * All video outputs trim the raw screencast at the sync flash (see
 * recorder.mjs) so 0 s in every file is the first frame of the intro hold.
 */
import { copyFileSync, mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { run, blackDetect, ffprobeVideo } from './ffmpeg.mjs'
import { cuesFromBeats, toSrt, toVtt, normalizeNarration } from '../../lib/tutorial-media.mjs'

export const DOCS_WIDTH = 960
export const DEFAULT_BUDGET_BYTES = 2.5 * 1024 * 1024

/**
 * Find where the recording really starts: the end of the black flash nearest
 * the recorder's estimate. Falls back to the estimate with a warning.
 */
export async function findTrimStart(raw, timeline, log = () => {}) {
  const intervals = await blackDetect(raw)
  const est = timeline.flashEstimate
  const plausible = intervals.filter((b) => b.duration >= 0.06 && b.duration <= 0.6)
  const pick = plausible.sort((a, b) => Math.abs(a.end - est) - Math.abs(b.end - est))[0]
  if (pick && Math.abs(pick.end - est) < 3) {
    log(`sync flash found at ${pick.start.toFixed(3)}-${pick.end.toFixed(3)} s (estimate ${est.toFixed(3)} s)`)
    return pick.end
  }
  log(`WARNING: no sync flash near ${est.toFixed(3)} s (${intervals.length} black interval(s)); trimming by estimate`)
  return est
}

/** @param {number} seconds */
const s = (seconds) => seconds.toFixed(3)

/**
 * @param {{ id: string, outDir: string, siteDir: string, timeline: object, budgetBytes?: number, gif?: boolean, gifBeats?: [number, number], log?: (m: string) => void }} opts
 */
export async function muxTutorial({ id, outDir, siteDir, timeline, budgetBytes = DEFAULT_BUDGET_BYTES, gif = true, gifBeats, log = () => {} }) {
  mkdirSync(siteDir, { recursive: true })
  const raw = join(outDir, timeline.rawVideo)
  const trim = await findTrimStart(raw, timeline, log)
  const duration = timeline.duration
  const info = await ffprobeVideo(raw)
  log(`raw ${info.width}x${info.height} ${info.codec} ${info.fps.toFixed(1)} fps; trim ${s(trim)} s, keep ${s(duration)} s`)

  // ---- YouTube master: video + narration placed at each beat's start ------
  const master = join(outDir, `${id}.youtube.mp4`)
  const voiced = timeline.beats.filter((b) => b.audio)
  const inputs = ['-ss', s(trim), '-t', s(duration), '-i', raw]
  let filter
  if (voiced.length) {
    for (const b of voiced) inputs.push('-i', b.audio)
    const delayed = voiced.map((b, i) => `[${i + 1}:a]adelay=${Math.round(b.start * 1000)}|${Math.round(b.start * 1000)}[a${i}]`)
    const labels = voiced.map((_, i) => `[a${i}]`).join('')
    filter = `${delayed.join(';')};${labels}amix=inputs=${voiced.length}:normalize=0:dropout_transition=0,apad[aout]`
  } else {
    inputs.push('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=stereo')
    filter = '[1:a]apad[aout]'
  }
  await run([
    '-y', ...inputs,
    '-filter_complex', filter,
    '-map', '0:v', '-map', '[aout]', '-shortest',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000',
    '-movflags', '+faststart',
    master,
  ])
  log(`master ${Math.round(statSync(master).size / 1024)} KB`)

  // ---- Docs cut: muted, 960 wide, under budget ---------------------------
  const docsMp4 = join(siteDir, `${id}.mp4`)
  const ladder = [
    { crf: 28, fps: 24 }, { crf: 30, fps: 24 }, { crf: 32, fps: 24 }, { crf: 32, fps: 20 }, { crf: 34, fps: 20 },
  ]
  let docsBytes = 0
  let used = null
  for (const step of ladder) {
    await run([
      '-y', '-ss', s(trim), '-t', s(duration), '-i', raw, '-an',
      '-vf', `scale=${DOCS_WIDTH}:-2:flags=lanczos,fps=${step.fps}`,
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(step.crf), '-tune', 'animation', '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      docsMp4,
    ])
    docsBytes = statSync(docsMp4).size
    used = step
    if (docsBytes <= budgetBytes) break
    log(`docs cut ${Math.round(docsBytes / 1024)} KB at crf ${step.crf}/${step.fps} fps is over budget, trying the next rung`)
  }
  if (docsBytes > budgetBytes) {
    throw new Error(`docs cut is ${Math.round(docsBytes / 1024)} KB after the full ladder (budget ${Math.round(budgetBytes / 1024)} KB): shorten the tutorial or raise --budget-kb`)
  }
  const docsInfo = await ffprobeVideo(docsMp4)
  log(`docs cut ${docsInfo.width}x${docsInfo.height} ${Math.round(docsBytes / 1024)} KB (crf ${used.crf}, ${used.fps} fps)`)

  // ---- Poster (docs) + thumbnail (YouTube) from the intro hold -----------
  const posterAt = trim + timeline.introHold / 2
  const poster = join(siteDir, `${id}.poster.webp`)
  await run(['-y', '-ss', s(posterAt), '-i', raw, '-frames:v', '1', '-vf', `scale=${DOCS_WIDTH}:-2`, '-c:v', 'libwebp', '-quality', '80', poster])
  const thumb = join(outDir, `${id}.thumb.jpg`)
  await run(['-y', '-ss', s(posterAt), '-i', raw, '-frames:v', '1', '-vf', 'scale=1280:-2', '-q:v', '3', thumb])
  const posterBytes = statSync(poster).size

  // ---- GIF: a beat window, else the first 12 s ---------------------------
  let gifPath = null
  if (gif) {
    let from = 0
    let len = Math.min(12, duration)
    if (gifBeats) {
      const [a, b] = gifBeats
      from = timeline.beats[a]?.start ?? 0
      len = Math.max(1, (timeline.beats[b]?.end ?? duration) - from)
    }
    gifPath = join(outDir, `${id}.gif`)
    await run([
      '-y', '-ss', s(trim + from), '-t', s(len), '-i', raw,
      '-vf', 'fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128:stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle',
      '-loop', '0',
      gifPath,
    ])
    log(`gif ${Math.round(statSync(gifPath).size / 1024)} KB (${s(from)} s + ${s(len)} s)`)
  }

  // ---- Captions + transcript ---------------------------------------------
  const cues = cuesFromBeats(timeline.beats)
  writeFileSync(join(outDir, `${id}.srt`), toSrt(cues), 'utf-8')
  writeFileSync(join(siteDir, `${id}.vtt`), toVtt(cues), 'utf-8')
  writeFileSync(join(outDir, 'transcript.txt'), cues.map((c) => normalizeNarration(c.text)).join('\n\n') + '\n', 'utf-8')
  copyFileSync(join(siteDir, `${id}.vtt`), join(outDir, `${id}.vtt`))

  return {
    trim,
    duration,
    master,
    docsMp4,
    docsBytes,
    poster,
    posterBytes,
    thumb,
    gif: gifPath,
    width: docsInfo.width,
    height: docsInfo.height,
    cues,
  }
}
