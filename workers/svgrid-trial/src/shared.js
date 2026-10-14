// Helpers shared by the trial and the founding-customer endpoints.

export const MAX_PER_HOUR = 5

export const EMAIL = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/

export function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, 'content-type': 'application/json' } })
}

export const clip = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

/** An http(s) URL, or '' when the value is empty or not one. */
export function httpUrl(v, n = 500) {
  const s = clip(v, n)
  if (!s) return ''
  try {
    const u = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''
  } catch {
    return ''
  }
}

export async function readJson(request) {
  try {
    return await request.json()
  } catch {
    return null
  }
}

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * The hourly limit per address, shared by every form. The IP is kept only as
 * a salted hash. Returns the statement that records this request, to run in
 * the same batch as the write it guards, or null when the address is over.
 */
export async function rateLimit(request, env, now) {
  const ip = request.headers.get('cf-connecting-ip') ?? ''
  const ipHash = await sha256(`${env.IP_SALT ?? 'svgrid-trial'}:${ip}`)
  const hourAgo = new Date(now.getTime() - 3_600_000).toISOString()
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM trial_requests WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, hourAgo)
    .first()
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) return null
  return env.DB.prepare('INSERT INTO trial_requests (created_at, ip_hash) VALUES (?, ?)').bind(now.toISOString(), ipHash)
}

/** Post a line to NOTIFY_WEBHOOK (Slack / Teams `text`, Discord `content`), after the response. */
export function notify(env, ctx, text) {
  if (!env.NOTIFY_WEBHOOK) return
  ctx.waitUntil(
    fetch(env.NOTIFY_WEBHOOK, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, content: text }),
    }).catch(() => {}),
  )
}

/** Constant-time comparison, so the token cannot be guessed by timing. */
function sameToken(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length || !a) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export function isAdmin(request, env) {
  const auth = request.headers.get('authorization') ?? ''
  return sameToken(auth.startsWith('Bearer ') ? auth.slice(7) : '', env.ADMIN_TOKEN)
}

const csvCell = (v) => {
  const s = v == null ? '' : String(v)
  // A leading = + - @ would run as a formula when the file opens in a spreadsheet.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function csv(rows, cols) {
  return [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n'
}

/** Every row of `table` as a CSV download, for the admin token only. */
export async function exportCsv(request, env, sql, cols, filename) {
  if (!isAdmin(request, env)) return new Response('unauthorized', { status: 401 })
  const { results } = await env.DB.prepare(sql).all()
  return new Response(csv(results ?? [], cols), {
    headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"` },
  })
}
