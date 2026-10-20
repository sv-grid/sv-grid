/**
 * Shared helpers for the post-publish checks. Everything here works on what is
 * on the npm registry, never on the workspace: the point is to catch what a
 * user gets, which CI (testing the source tree) cannot see. The 3.0.5 Base
 * template that pinned an unpublished enterprise passed CI.
 */
import { spawn } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { createServer } from 'node:net'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** The public packages, in the order they depend on each other. */
export const PACKAGES = ['grid', 'enterprise', 'grid-wc', 'mcp', 'studio', 'ui', 'create', 'create-studio', 'migrate', 'sv']

const IS_WIN = process.platform === 'win32'

/**
 * Run a command; resolves with { code, out, ms } and never rejects, so a check
 * decides what a non-zero exit means. `out` is stdout + stderr interleaved.
 */
export function sh(cmd, { cwd, timeout = 10 * 60_000, env = {}, input } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now()
    const child = spawnShell(cmd, { cwd, env })
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    if (input !== undefined) child.stdin.end(input)
    else child.stdin.end()
    const timer = setTimeout(() => {
      out += `\n[post-publish] timed out after ${timeout} ms`
      kill(child)
    }, timeout)
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve({ code: code ?? 1, out, ms: Date.now() - t0 })
    })
  })
}

/**
 * Spawn a shell command. On macOS and Linux it gets its own process group, so
 * `kill` can take down what the shell started (npx -> vite preview); killing
 * only the `sh -c` left the server running and holding its port.
 */
export function spawnShell(cmd, { cwd, env = {} } = {}) {
  return spawn(cmd, { cwd, shell: true, env: { ...process.env, ...env }, detached: !IS_WIN })
}

/** Kill a process and its whole tree (npm/npx spawn children). */
export function kill(child) {
  if (!child || child.exitCode !== null) return
  if (IS_WIN) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    return
  }
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    child.kill('SIGTERM')
  }
}

/**
 * A plain HTTP request to a local test server, shaped like fetch's response
 * ({ status, text() }). Not fetch: on macOS, Node 24.21's undici threw
 * `setTypeOfService EINVAL` from inside a socket callback, which no try/catch
 * reaches, and the whole run died. node:http has no such path.
 */
export function request(url, { method = 'GET', headers = {}, body, timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    const req = httpRequest(url, { method, headers, timeout }, (res) => {
      let data = ''
      res.setEncoding('utf8')
      res.on('data', (d) => (data += d))
      res.on('end', () => resolve({ status: res.statusCode ?? 0, text: async () => data }))
    })
    req.on('timeout', () => req.destroy(new Error(`${method} ${url} timed out after ${timeout} ms`)))
    req.on('error', reject)
    req.end(body)
  })
}

/** A free TCP port. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address()
      srv.close(() => resolve(port))
    })
  })
}

/**
 * Start a long-running command (a preview or dev server) and wait until `url`
 * answers. Returns { url, stop, log() }.
 */
export async function serve(cmd, { cwd, url, timeout = 120_000, env = {} }) {
  const child = spawnShell(cmd, { cwd, env })
  let log = ''
  child.stdout.on('data', (d) => (log += d))
  child.stderr.on('data', (d) => (log += d))
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (child.exitCode !== null) throw new Error(`server exited (${child.exitCode}) before ${url} answered:\n${tail(log)}`)
    try {
      // Any HTTP answer means it is up; whether the page is right is the check's job.
      await request(url, { timeout: 2000 })
      return { url, stop: () => kill(child), log: () => log }
    } catch {
      // not up yet
    }
    await sleep(500)
  }
  kill(child)
  throw new Error(`${url} did not answer within ${timeout} ms:\n${tail(log)}`)
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** The last lines of a long output, for an error message. */
export function tail(text, lines = 25) {
  return String(text).trim().split('\n').slice(-lines).join('\n')
}

/** Registry metadata for a package, uncached (the registry lags after a publish). */
const docs = new Map()
export async function registryDoc(name) {
  if (!docs.has(name)) {
    const r = await fetch(`https://registry.npmjs.org/${name.replace('/', '%2F')}?t=${Date.now()}`)
    docs.set(name, r.ok ? await r.json() : null)
  }
  return docs.get(name)
}

/** Headless Chromium from the repo's Playwright install. */
let browserPromise
export async function browser() {
  browserPromise ??= import(pathToFileURL(join(REPO, 'node_modules', 'playwright', 'index.mjs')).href).then((pw) =>
    pw.chromium.launch(),
  )
  return browserPromise
}
export async function closeBrowser() {
  if (browserPromise) (await browserPromise).close()
  browserPromise = undefined
}

/**
 * Load a page and report what a user would notice: console errors, uncaught
 * errors, failed requests, the HTTP status, and a screenshot path.
 */
export async function loadPage(url, { screenshot, waitFor, settle = 1500 } = {}) {
  const b = await browser()
  const page = await b.newPage({ viewport: { width: 1280, height: 800 } })
  const consoleErrors = []
  const pageErrors = []
  const failed = []
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()))
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText ?? 'failed'} ${r.url()}`))
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 60_000 }).catch((e) => ({ status: () => 0, error: e }))
  if (waitFor) await page.waitForSelector(waitFor, { timeout: 20_000 }).catch(() => {})
  await sleep(settle)
  if (screenshot) await page.screenshot({ path: screenshot, fullPage: false })
  return { page, status: res?.status?.() ?? 0, consoleErrors, pageErrors, failed }
}

/** semver from the work dir (installed by the runner; the repo root has none). */
export function semverFrom(workDir) {
  return createRequire(join(workDir, 'package.json'))('semver')
}

export function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'))
}

export function freshDir(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  return dir
}

export { existsSync, join, readFileSync, writeFileSync }
