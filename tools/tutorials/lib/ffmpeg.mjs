/**
 * ffmpeg / ffprobe as the recorder uses them. No wrapper package: the repo
 * keeps its tooling at zero runtime deps, and every call here is one
 * documented command line.
 *
 * Binary lookup order: FFMPEG_PATH (a directory or the ffmpeg binary), then
 * PATH, then the winget install location on Windows, because `winget install
 * Gyan.FFmpeg` updates the user PATH in the registry and a shell that was
 * already open never sees it.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

let resolved = null

function candidates(name) {
  const exe = process.platform === 'win32' ? `${name}.exe` : name
  const out = []
  const hint = process.env.FFMPEG_PATH
  if (hint) {
    if (existsSync(hint) && statSync(hint).isDirectory()) out.push(join(hint, exe))
    else out.push(hint.replace(/ffmpeg(\.exe)?$/i, exe))
  }
  out.push(name)
  if (process.platform === 'win32' && process.env.LOCALAPPDATA) {
    const pkgs = join(process.env.LOCALAPPDATA, 'Microsoft', 'WinGet', 'Packages')
    if (existsSync(pkgs)) {
      for (const dir of readdirSync(pkgs)) {
        if (!/^Gyan\.FFmpeg/i.test(dir)) continue
        const root = join(pkgs, dir)
        for (const sub of readdirSync(root)) {
          const bin = join(root, sub, 'bin', exe)
          if (existsSync(bin)) out.push(bin)
        }
      }
    }
  }
  return out
}

function works(bin) {
  const r = spawnSync(bin, ['-version'], { stdio: 'ignore', windowsHide: true })
  return r.status === 0
}

/** Locate ffmpeg + ffprobe once; throws with an install hint when absent. */
export function requireFfmpeg() {
  if (resolved) return resolved
  const ffmpeg = candidates('ffmpeg').find(works)
  const ffprobe = candidates('ffprobe').find(works)
  if (!ffmpeg || !ffprobe) {
    throw new Error(
      'ffmpeg/ffprobe not found. Install it and re-run:\n' +
        '  Windows:  winget install Gyan.FFmpeg   (then open a new terminal, or set FFMPEG_PATH)\n' +
        '  Ubuntu:   sudo apt-get install -y ffmpeg\n' +
        '  macOS:    brew install ffmpeg',
    )
  }
  resolved = { ffmpeg, ffprobe }
  return resolved
}

/**
 * Run ffmpeg with the given args. Resolves with stderr (ffmpeg logs there),
 * rejects with the tail of stderr on a non-zero exit.
 * @param {string[]} args
 * @param {{ tool?: 'ffmpeg' | 'ffprobe', loglevel?: string, cwd?: string }} opts
 */
export function run(args, { tool = 'ffmpeg', loglevel = 'error', cwd } = {}) {
  const bin = requireFfmpeg()[tool]
  const full = tool === 'ffmpeg' ? ['-hide_banner', '-loglevel', loglevel, '-nostdin', ...args] : args
  return new Promise((resolve, reject) => {
    const child = spawn(bin, full, { cwd, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout: out, stderr: err })
      else reject(new Error(`${tool} exited ${code}: ${full.join(' ')}\n${err.trim().split('\n').slice(-12).join('\n')}`))
    })
  })
}

/** Media duration in seconds. */
export async function ffprobeDuration(file) {
  const { stdout } = await run(['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { tool: 'ffprobe' })
  const n = Number(stdout.trim())
  if (!Number.isFinite(n)) throw new Error(`ffprobe: no duration for ${file}`)
  return n
}

/** Width/height/fps/codec of the first video stream. */
export async function ffprobeVideo(file) {
  const { stdout } = await run(
    ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate,codec_name,pix_fmt', '-of', 'json', file],
    { tool: 'ffprobe' },
  )
  const s = JSON.parse(stdout).streams?.[0] ?? {}
  const [a, b] = String(s.r_frame_rate ?? '0/1').split('/').map(Number)
  return { width: s.width, height: s.height, fps: b ? a / b : 0, codec: s.codec_name, pixFmt: s.pix_fmt }
}

/**
 * Black intervals in a video, as [{ start, end, duration }]. Used to find the
 * sync flash the recorder paints right before the intro hold. `pixTh` is the
 * per-pixel luma threshold (0-1) below which a pixel counts as black, so a
 * dark theme (grid background well above 0.10) does not register.
 */
export async function blackDetect(file, { minDuration = 0.05, pixTh = 0.1, picTh = 0.98 } = {}) {
  const { stderr } = await run(
    ['-i', file, '-vf', `blackdetect=d=${minDuration}:pix_th=${pixTh}:pic_th=${picTh}`, '-an', '-f', 'null', '-'],
    { loglevel: 'info' },
  )
  const out = []
  for (const m of stderr.matchAll(/black_start:([\d.]+)\s+black_end:([\d.]+)\s+black_duration:([\d.]+)/g)) {
    out.push({ start: Number(m[1]), end: Number(m[2]), duration: Number(m[3]) })
  }
  return out
}

/** Silent mp3 of `seconds` for the no-key TTS provider. */
export async function silentMp3(out, seconds) {
  await run(['-y', '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=mono', '-t', String(seconds), '-q:a', '9', out])
  return out
}
