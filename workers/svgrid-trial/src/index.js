// svgrid-trial: records who started an SvGrid Enterprise trial.
//
// The site is static (GitHub Pages), so the trial dialog posts here. One row
// per email in D1: name, company, where on the site the trial started, the
// country Cloudflare reports, and the day the 30 days of email support end.
// A repeat download from the same email updates the row and keeps the first
// support date. The download itself is a plain file on svgrid.com; this worker
// only records the request and answers with the support date.
//
//   POST /trial        { name, email, company?, source?, website? }  ->  { ok, supportUntil }
//   GET  /trials.csv   Authorization: Bearer <ADMIN_TOKEN>             ->  every row, as CSV
//   GET  /health                                                       ->  ok
//
// `website` is a honeypot: a person never sees the field, a form-filling bot
// fills it, and its request is answered as a success and stored nowhere.

const SUPPORT_DAYS = 30
const MAX_PER_HOUR = 5

const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/
const SOURCE = /^[a-z0-9:_-]{1,60}$/

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const cors = corsHeaders(request, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (url.pathname === '/health') return new Response('ok', { headers: cors })
    if (url.pathname === '/trial' && request.method === 'POST') return handleTrial(request, env, ctx, cors)
    if (url.pathname === '/trials.csv' && request.method === 'GET') return handleExport(request, env)
    return json({ ok: false, error: 'not found' }, 404, cors)
  },

  // Daily (crons in wrangler.toml): drop people 12 months after their last
  // download, as the privacy policy says, and rate-limit rows after a day.
  async scheduled(_event, env) {
    await purge(env, new Date())
  },
}

const RETAIN_DAYS = 365

export async function purge(env, now) {
  const cutoff = new Date(now.getTime() - RETAIN_DAYS * 86_400_000).toISOString()
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString()
  await env.DB.batch([
    env.DB.prepare('DELETE FROM trials WHERE last_download_at < ?').bind(cutoff),
    env.DB.prepare('DELETE FROM trial_requests WHERE created_at < ?').bind(dayAgo),
  ])
}

/** CORS for the site's own origins only (ALLOWED_ORIGIN, comma-separated). */
export function corsHeaders(request, env) {
  const origin = request.headers.get('origin') ?? ''
  const allowed = String(env.ALLOWED_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean)
  const headers = { 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type', vary: 'origin' }
  if (allowed.includes(origin)) headers['access-control-allow-origin'] = origin
  return headers
}

function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } })
}

const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

/** Validate the posted form; returns the clean fields or an error message. */
export function parseTrial(body) {
  if (!body || typeof body !== 'object') return { error: 'bad request' }
  const name = clip(body.name, 120)
  const email = clip(body.email, 254).toLowerCase()
  const company = clip(body.company, 160)
  const rawSource = clip(body.source, 60).toLowerCase()
  if (!name) return { error: 'name is required' }
  if (!EMAIL.test(email)) return { error: 'a valid email is required' }
  return { name, email, company, source: SOURCE.test(rawSource) ? rawSource : 'unknown', honeypot: clip(body.website, 200) !== '' }
}

/** The last day of support, as YYYY-MM-DD. */
export function supportUntil(from, days = SUPPORT_DAYS) {
  return new Date(from.getTime() + days * 86_400_000).toISOString().slice(0, 10)
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function handleTrial(request, env, ctx, cors) {
  let body
  try {
    body = await request.json()
  } catch {
    return json({ ok: false, error: 'bad request' }, 400, cors)
  }
  const form = parseTrial(body)
  if (form.error) return json({ ok: false, error: form.error }, 400, cors)

  const now = new Date()
  const until = supportUntil(now)
  // A bot that filled the hidden field gets the same answer as a person.
  if (form.honeypot) return json({ ok: true, supportUntil: until }, 200, cors)

  // The IP is kept only as a salted hash, for the hourly limit.
  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const ipHash = await sha256(`${env.IP_SALT ?? 'svgrid-trial'}:${ip}`)
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString()
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM trial_requests WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, hourAgo)
    .first()
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) return json({ ok: false, error: 'too many requests, try again later' }, 429, cors)

  const country = request.cf?.country ?? ''
  const userAgent = clip(request.headers.get('user-agent') ?? '', 300)
  const stamp = now.toISOString()
  await env.DB.batch([
    env.DB.prepare('INSERT INTO trial_requests (created_at, ip_hash) VALUES (?, ?)').bind(stamp, ipHash),
    env.DB.prepare(
      `INSERT INTO trials (email, name, company, source, country, user_agent, created_at, last_download_at, downloads, support_until)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(email) DO UPDATE SET
         name = excluded.name,
         company = CASE WHEN excluded.company <> '' THEN excluded.company ELSE trials.company END,
         last_download_at = excluded.last_download_at,
         downloads = trials.downloads + 1`,
    ).bind(form.email, form.name, form.company, form.source, country, userAgent, stamp, stamp, until),
  ])
  const row = await env.DB.prepare('SELECT support_until, downloads FROM trials WHERE email = ?').bind(form.email).first()

  if (env.NOTIFY_WEBHOOK && row?.downloads === 1) {
    const who = `${form.name} <${form.email}>${form.company ? ` (${form.company})` : ''}`
    const text = `New SvGrid trial: ${who}, from ${form.source}${country ? `, ${country}` : ''}. Support until ${row.support_until}.`
    ctx.waitUntil(
      fetch(env.NOTIFY_WEBHOOK, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // `text` for Slack and Teams-style hooks, `content` for Discord.
        body: JSON.stringify({ text, content: text }),
      }).catch(() => {}),
    )
  }
  return json({ ok: true, supportUntil: row?.support_until ?? until }, 200, cors)
}

/** Constant-time comparison, so the token cannot be guessed by timing. */
function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  // A leading = + - @ would run as a formula when the file opens in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCsv(rows) {
  const cols = ['created_at', 'name', 'email', 'company', 'source', 'country', 'downloads', 'last_download_at', 'support_until']
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n'
}

async function handleExport(request, env) {
  const auth = request.headers.get('authorization') ?? ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!sameToken(token, env.ADMIN_TOKEN)) return new Response('unauthorized', { status: 401 })
  const { results } = await env.DB.prepare('SELECT * FROM trials ORDER BY created_at DESC').all()
  return new Response(toCsv(results ?? []), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="svgrid-trials.csv"' },
  })
}
