/**
 * scan-overlay - does a finished master carry the Vite error overlay?
 *
 *   node tools/tutorials/scan-overlay.mjs tutorials-out/<id>/<id>.youtube.mp4 [...]
 *
 * The dev server pushes its red error overlay to every connected page when any
 * module fails to transform, and one take shipped with it covering the second
 * half. The recorder now removes the element on sight; this is the check that
 * it stayed away: one frame every 2 s as raw RGB at 320x180, counting near-red
 * pixels in the top 40 rows, where the overlay's red bar sits.
 */
import { spawnSync } from 'node:child_process'
import { requireFfmpeg } from './lib/ffmpeg.mjs'

const FF = requireFfmpeg().ffmpeg
const W = 320
const H = 180
for (const file of process.argv.slice(2)) {
  const r = spawnSync(FF, ['-hide_banner', '-loglevel', 'error', '-i', file, '-vf', `fps=1/2,scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 30 })
  const buf = r.stdout
  const frameBytes = W * H * 3
  const frames = Math.floor(buf.length / frameBytes)
  const hits = []
  for (let f = 0; f < frames; f += 1) {
    let red = 0
    const base = f * frameBytes
    for (let y = 0; y < 40; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = base + (y * W + x) * 3
        const [rr, g, b] = [buf[i], buf[i + 1], buf[i + 2]]
        if (rr > 200 && g < 120 && b < 120 && Math.abs(g - b) < 40) red += 1
      }
    }
    if (red > 120) hits.push(f * 2)
  }
  console.log(`${file}: ${frames} frames, ${hits.length ? 'RED BAR at ' + hits.join(', ') + ' s' : 'clean'}`)
  if (hits.length) process.exitCode = 1
}
