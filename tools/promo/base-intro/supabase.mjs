/**
 * The Supabase segments of "Meet SvGrid Base", filmed on a real Supabase
 * project with tutorials-out/app/base-supa (Base from the workspace source,
 * the project's URL and key in its .env).
 *
 * bind: press "Build the app"; baseFromSupabase reads the schema and the base
 *       appears, then a look at its tabs. Fails unless tables were read.
 * sync: two windows, each its own Supabase client. A stock figure is changed
 *       on the left and must arrive on the right through Realtime; the old
 *       value is written back afterwards.
 */
import { mkdirSync, readFileSync, rmSync } from 'node:fs'
import { execFileSync, spawn } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const APP = resolve(HERE, '..', '..', '..', 'tutorials-out', 'app', 'base-supa')
const BASE = 'http://localhost:4402'
const W = 1280, H = 720
const CURSOR = '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M3 2 L3 20 L8 15.5 L11.5 22.5 L14.8 21 L11.3 14 L18 14 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg>'

const env = Object.fromEntries(readFileSync(join(APP, '.env'), 'utf8').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]))

// A production build, not the dev server: other work editing the Base source
// hot-reloads a dev page mid-take and puts it back on "Build the app".
async function up() {
  try { if ((await fetch(BASE)).ok) return null } catch { /* start it */ }
  execFileSync('npm', ['run', 'build'], { cwd: APP, stdio: 'ignore', shell: true })
  const child = spawn('npm', ['run', 'preview'], { cwd: APP, stdio: 'ignore', shell: true, windowsHide: true })
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(BASE)).ok) return child } catch { /* not yet */ }
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error('the base-supa app did not start')
}

/** The REST row, read or written straight to the project (outside the video). */
async function rest(path, init = {}) {
  const res = await fetch(`${env.VITE_SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: env.VITE_SUPABASE_KEY, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(init.headers ?? {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${path}: ${res.status} ${await res.text()}`)
  return res.json()
}

export async function recordSupabase(browser, name, frameCount) {
  await up()
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  const dir = join(tmpdir(), 'svgrid-base-intro', `supa-${name}`)
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  let restore = null

  await page.goto(name === 'sync' ? `${BASE}/?split` : `${BASE}/`, { waitUntil: 'networkidle' })
  // The evaluation card, closed as a visitor would (in each window for the split).
  for (const f of page.frames()) await f.locator('[data-svgrid-enterprise-upgrade] button', { hasText: '×' }).click({ timeout: 4000 }).catch(() => {})
  await page.evaluate((svg) => {
    const d = document.createElement('div')
    d.id = '__cursor'
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))'
    d.innerHTML = svg
    document.body.appendChild(d)
  }, CURSOR)

  let steps = []
  let left, right, cellL, cellR, newValue
  if (name === 'bind') {
    steps = [
      { f: 20, aim: () => page.getByRole('button', { name: 'Build the app' }), act: async (p) => { await page.mouse.click(p.x, p.y); await page.getByText(/Read \d+ tables/).waitFor({ timeout: 30000 }) } },
      // The tables with no id columns: with a publishable key the schema is
      // read from sample rows, so a foreign key shows as a plain number.
      { f: Math.round(frameCount * 0.5), aim: () => page.getByRole('tab', { name: 'Categories' }), act: async (p) => page.mouse.click(p.x, p.y) },
      { f: Math.round(frameCount * 0.75), aim: () => page.getByRole('tab', { name: 'Customers' }), act: async (p) => page.mouse.click(p.x, p.y) },
    ]
  } else {
    left = page.frameLocator('iframe').nth(0)
    right = page.frameLocator('iframe').nth(1)
    await left.getByRole('tab', { name: 'Products' }).waitFor({ timeout: 30000 })
    await right.getByRole('tab', { name: 'Products' }).waitFor({ timeout: 30000 })
    await right.getByRole('tab', { name: 'Products' }).click()
    const [chai] = await rest('products?id=eq.1&select=id,units_in_stock')
    restore = chai.units_in_stock
    newValue = String(restore + 100)
    const row = (fl) => fl.getByRole('row').filter({ hasText: 'Chai' }).first()
    // Units in stock is the 4th field after the name: find its cell by header position.
    const stockCell = async (fl) => {
      const headers = await fl.getByRole('columnheader').allInnerTexts()
      const i = headers.findIndex((h) => /units in stock/i.test(h))
      if (i < 0) throw new Error(`sync: no Units in stock column (${headers.join(' | ')})`)
      return row(fl).getByRole('gridcell').nth(i - (headers.length - (await row(fl).getByRole('gridcell').count())))
    }
    steps = [
      { f: 14, aim: () => left.getByRole('tab', { name: 'Products' }), act: async (p) => page.mouse.click(p.x, p.y) },
      { f: 50, aim: async () => (cellL = await stockCell(left)), act: async (p) => page.mouse.dblclick(p.x, p.y) },
      { f: 62, act: () => page.keyboard.press('Control+a') },
      ...[...newValue].map((ch, i) => ({ f: 66 + i * 4, act: () => page.keyboard.type(ch) })),
      { f: 66 + newValue.length * 4 + 6, act: () => page.keyboard.press('Enter') },
      { f: 66 + newValue.length * 4 + 30, aim: async () => (cellR = await stockCell(right)), act: () => {} },
    ]
  }

  let cur = { x: W - 120, y: H - 90 }
  const put = (p) => page.evaluate(({ x, y }) => { document.getElementById('__cursor').style.transform = `translate(${x - 4}px, ${y - 3}px)` }, p)
  await put(cur)
  const center = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error(`${name}: a target is not on screen`); return { x: b.x + b.width / 2, y: b.y + b.height / 2 } }
  const MOVE = 12
  const moves = new Map()
  const frames = []
  let arrivedAt = -1
  for (let f = 0; f < frameCount; f++) {
    for (const s of steps) {
      if (s.aim && f >= s.f - MOVE && f <= s.f) {
        if (f === s.f - MOVE) moves.set(s, { from: cur, to: await center(await s.aim()) })
        const m = moves.get(s)
        const k = (f - (s.f - MOVE)) / MOVE
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
        cur = { x: m.from.x + (m.to.x - m.from.x) * e, y: m.from.y + (m.to.y - m.from.y) * e }
        await put(cur)
      }
      if (f === s.f && s.act) { await s.act(moves.get(s)?.to); await page.waitForTimeout(150) }
    }
    if (name === 'sync' && arrivedAt < 0 && f > 70) {
      const r = await right.getByRole('row').filter({ hasText: 'Chai' }).first().innerText().catch(() => '')
      if (r.includes(newValue)) arrivedAt = f
    }
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))
    const file = join(dir, `${String(f).padStart(5, '0')}.jpg`)
    await page.screenshot({ path: file, type: 'jpeg', quality: 88 })
    frames.push(pathToFileURL(file).href)
  }

  const info = {}
  if (name === 'bind') {
    info.read = (await page.getByText(/Read \d+ tables/).innerText()).trim()
    if (!/Read [1-9]\d* tables/.test(info.read)) throw new Error(`bind: ${info.read}`)
  } else {
    const [now] = await rest('products?id=eq.1&select=units_in_stock')
    info.saved = String(now.units_in_stock) === newValue
    info.arrivedAtFrame = arrivedAt
    // Put the database back as it was.
    await rest('products?id=eq.1', { method: 'PATCH', body: JSON.stringify({ units_in_stock: restore }) })
    if (!info.saved) throw new Error('sync: the edit did not reach the database (row-level security?)')
    if (arrivedAt < 0) throw new Error('sync: the other window never showed the change (Realtime publication?)')
  }
  if (errors.length) throw new Error(`${name}: page errors: ${errors.join(' | ')}`)
  await ctx.close()
  return { frames, info }
}
