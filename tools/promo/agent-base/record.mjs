/**
 * The footage of "An AI agent and your team, one table", from a real
 * Supabase project (setup.sql) and a real agent.
 *
 * One browser page, two takes, in order (the base's "changed by" marks live
 * in the page, so a reload would lose them):
 *
 *  agent:  the tickets are reset, then Claude Code runs headless with the
 *          Supabase MCP server (mcp.json, SUPABASE_ACCESS_TOKEN) and the
 *          prompt below. The page is captured as fast as it goes, each frame
 *          with its time, and Claude's stream (stream-json) is logged with
 *          times too, so the video replays both in step. Fails unless every
 *          ticket ends up triaged and credited to the agent.
 *  review: frame by frame with a drawn cursor: open a ticket the agent
 *          re-prioritized, set another priority in the record (written under
 *          Ana's name), then approve two tickets in the Needs review view.
 *          Fails unless the database has both.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..', '..')
const APP = join(ROOT, 'tutorials-out', 'app', 'base-supa')
export const BASE = 'http://localhost:4402'
const W = 1280, H = 720
const CURSOR = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.8 21 L11.3 14 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'

/** The instruction, as the terminal in the video shows it. */
export const PROMPT =
  "Triage the new support tickets in public.tickets (review is null). Read them first. Then triage them one at a time: one execute_sql call per ticket, each a single UPDATE that sets category (Billing, Bug, Account or Feature request), priority (Urgent, High, Normal or Low), reply (a one-sentence draft reply to the customer), review = 'Needs review' and updated_by = 'agent'."

const env = Object.fromEntries(readFileSync(join(APP, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))

async function rest(path, init = {}) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.VITE_SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

/** Every ticket back to new: no triage, priority Normal, last changed by Ben. */
export const resetTickets = () =>
  rest('tickets?id=not.is.null', { method: 'PATCH', body: JSON.stringify({ category: null, priority: 'Normal', reply: null, review: null, assignee: null, updated_by: 'u2' }) })

/** Claude Code, headless, with only the Supabase SQL tool. Resolves with its timed stream. */
function runAgent(t0) {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is not set (run with node --env-file=.env)')
  // The prompt goes in on stdin: through a shell, arguments are joined without quoting.
  const args = ['-p', '--mcp-config', 'mcp.json', '--strict-mcp-config', '--allowedTools', 'mcp__supabase__execute_sql', '--output-format', 'stream-json', '--verbose']
  const child = spawn('claude', args, { cwd: HERE, shell: true, windowsHide: true, env: { ...process.env, MCP_TIMEOUT: '180000' } })
  child.stdin.end(PROMPT)
  const events = []
  let buf = ''
  child.stdout.on('data', (d) => {
    buf += d
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('{')) continue
      let m
      try { m = JSON.parse(line) } catch { continue }
      const t = (Date.now() - t0) / 1000
      if (m.type === 'assistant') {
        for (const c of m.message?.content ?? []) {
          if (c.type === 'text' && c.text.trim()) events.push({ t, kind: 'say', text: c.text.trim() })
          if (c.type === 'tool_use') events.push({ t, kind: 'sql', tool: c.name, text: String(c.input?.query ?? JSON.stringify(c.input)).trim() })
        }
      } else if (m.type === 'user') {
        for (const c of m.message?.content ?? []) if (c.type === 'tool_result') events.push({ t, kind: 'ok', text: c.is_error ? 'error' : 'ok' })
      } else if (m.type === 'result') events.push({ t, kind: 'done', text: m.subtype === 'success' ? 'done' : String(m.subtype) })
    }
  })
  let err = ''
  child.stderr.on('data', (d) => (err += d))
  const done = new Promise((res, rej) => child.on('exit', (code) => (code === 0 ? res(events) : rej(new Error(`claude exited ${code}: ${err.slice(-400)}`)))))
  return { done, child }
}

export async function record(browser, frames) {
  const dir = join(tmpdir(), 'svgrid-agent-base')
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  await resetTickets()

  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${BASE}/?agent`, { waitUntil: 'domcontentloaded' })
  const rows = page.locator('.sv-grid-row:has([data-svgrid-row])')
  await rows.first().waitFor({ timeout: 90_000 })
  await page.locator('[data-svgrid-enterprise-upgrade] button', { hasText: '×' }).click({ timeout: 6000 }).catch(() => {})
  // The Realtime channel joins a few seconds after the page loads.
  await page.waitForTimeout(6000)

  // ---- The agent, in real time -------------------------------------------------
  const agentFrames = []
  let n = 0
  const snap = async (t0) => {
    const file = join(dir, `a${String(n++).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 86 })
    agentFrames.push({ t: (Date.now() - t0) / 1000, src: pathToFileURL(file).href })
  }
  const t0 = Date.now()
  await snap(t0)
  const agent = runAgent(t0)
  let running = true
  agent.done.finally(() => (running = false)).catch(() => {})
  while (running) await snap(t0)
  const events = await agent.done
  const settleUntil = Date.now() + 3000
  while (Date.now() < settleUntil) await snap(t0)
  const tickets = await rest('tickets?select=id,subject,category,priority,review,updated_by&order=id')
  const bad = tickets.filter((x) => x.review !== 'Needs review' || x.updated_by !== 'agent' || !x.category)
  if (bad.length) throw new Error(`agent: ${bad.length} tickets not triaged by the agent (${bad.map((x) => x.id).join(', ')})`)
  const chip = await page.locator('.sv-fvb-changed').innerText().catch(() => '')
  if (!/changed by Triage agent/.test(chip)) throw new Error(`agent: the base did not mark the changes ("${chip}")`)

  // ---- The review, frame by frame ------------------------------------------------
  // The ticket to open: the first the agent moved off Normal, so its activity
  // reads "Normal -> X". The correction sets the next priority down.
  const target = tickets.find((x) => x.priority !== 'Normal') ?? tickets[0]
  const ORDER = ['Urgent', 'High', 'Normal', 'Low']
  const below = ORDER[ORDER.indexOf(target.priority) + 1]
  const newPriority = below && below !== target.priority ? below : 'Normal'
  await page.evaluate((svg) => {
    const d = document.createElement('div')
    d.id = '__cursor'
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))'
    d.innerHTML = svg
    document.body.appendChild(d)
  }, CURSOR)
  const row = () => rows.filter({ hasText: target.subject }).first()
  const field = (label) => page.locator('.sv-frv-field').filter({ has: page.locator('.sv-frv-label span', { hasText: new RegExp(`^${label}$`) }) }).first()
  const R = frames.review, C = frames.correct, A = frames.approve
  const steps = [
    { f: 14, aim: () => row().locator('[data-col-id="subject"]') },
    { f: 32, aim: () => row().locator('.sv-frh-expand'), act: async (p) => { await page.mouse.click(p.x, p.y); await page.locator('.sv-modal').waitFor() } },
    { f: R + 16, aim: () => field('Priority').locator('.sv-frv-box'), act: async (p) => { await page.mouse.click(p.x, p.y); await page.locator('[role="option"]').first().waitFor() } },
    { f: R + 38, aim: () => page.getByRole('option', { name: newPriority, exact: true }).first(), act: async (p) => page.mouse.click(p.x, p.y) },
    { f: R + C + 6, aim: () => page.getByRole('button', { name: 'Close', exact: true }).last(), act: async (p) => { await page.mouse.click(p.x, p.y); await page.locator('.sv-modal').waitFor({ state: 'detached' }) } },
    { f: R + C + 26, aim: () => page.locator('.sv-fvb-view').first(), act: async (p) => page.mouse.click(p.x, p.y) },
    { f: R + C + 44, aim: () => page.locator('.sv-fviews-pick', { hasText: 'Needs review' }).first(), act: async (p) => page.mouse.click(p.x, p.y) },
    { f: R + C + Math.round(A * 0.55), aim: () => rows.first().getByRole('button', { name: 'Approve', exact: true }), act: async (p) => page.mouse.click(p.x, p.y) },
    { f: R + C + Math.round(A * 0.78), aim: () => rows.first().getByRole('button', { name: 'Approve', exact: true }), act: async (p) => page.mouse.click(p.x, p.y) },
  ]
  let cur = { x: W - 140, y: H - 80 }
  const put = async (p) => {
    await page.evaluate(({ x, y }) => { document.getElementById('__cursor').style.transform = `translate(${x - 4}px, ${y - 3}px)` }, p)
    await page.mouse.move(p.x, p.y)
  }
  await put(cur)
  const center = async (loc) => {
    const b = await loc.boundingBox()
    if (!b) throw new Error('a target is not on screen')
    return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
  }
  const MOVE = 12
  const moves = new Map()
  const reviewFrames = []
  const total = R + C + A
  for (let f = 0; f < total; f++) {
    for (const s of steps) {
      if (s.aim && f >= s.f - MOVE && f <= s.f) {
        if (f === s.f - MOVE) {
          try {
            moves.set(s, { from: cur, to: await center(await s.aim()) })
          } catch (e) {
            await page.screenshot({ path: join(dir, 'fail.png') })
            throw new Error(`review step at frame ${s.f}: ${e.message.split(/\r?\n/)[0]} (see ${join(dir, 'fail.png')})`)
          }
        }
        const m = moves.get(s)
        const k = (f - (s.f - MOVE)) / MOVE
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        cur = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e }
        await put(cur)
      }
      if (f === s.f && s.act) {
        await s.act(moves.get(s)?.to)
        await page.waitForTimeout(250)
      }
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `r${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 })
    reviewFrames.push(pathToFileURL(file).href)
  }
  await page.waitForTimeout(1500)
  const after = await rest('tickets?select=id,priority,review,updated_by&order=id')
  const edited = after.find((x) => x.id === target.id)
  if (edited?.priority !== newPriority || edited?.updated_by !== 'u1') throw new Error(`review: the correction did not reach the database (${JSON.stringify(edited)})`)
  const approved = after.filter((x) => x.review === 'Approved').length
  if (approved !== 2) throw new Error(`review: ${approved} tickets approved, expected 2`)
  if (errors.length) throw new Error(`page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return {
    agent: { frames: agentFrames, events, duration: agentFrames.at(-1).t },
    review: reviewFrames,
    info: { target: target.subject, from: target.priority, to: newPriority, tickets },
  }
}
