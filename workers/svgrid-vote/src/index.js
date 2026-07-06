// SvGrid community-demo voting API (Cloudflare Worker).
//
// Lets a visitor upvote a community demo IN PLACE (from the playground) by
// reacting 👍 to the demo's GitHub Discussion under their own account, without
// the site ever handling their GitHub token.
//
// Why a worker at all: the site is static (GitHub Pages) and GitHub's OAuth
// token exchange needs the client SECRET, which must stay server-side. This
// worker performs the OAuth dance and then acts as a thin authenticated proxy
// for the reaction mutation.
//
// SECURITY MODEL (the site's playground evals arbitrary code on the same
// origin, so this matters):
//   - The GitHub access token lives ONLY inside an encrypted, httpOnly session
//     cookie. It is never sent to the browser / JS, so playground code cannot
//     read or exfiltrate it. No account takeover is possible via the client.
//   - The token is granted `public_repo` scope (the minimum that lets a user
//     react to a public-repo discussion). Because it is server-side only, the
//     client can never use it for anything but the /react endpoint below.
//   - /react only ever toggles a THUMBS_UP on a discussion in the configured
//     REPO, so the blast radius of any abuse is "a demo's star count".
//   - A CSRF token (double-submit) blocks classic cross-site forgery from other
//     origins. NOTE: it cannot stop same-origin playground code that calls /me
//     to read the CSRF - but since the token stays server-side and reactions are
//     low-value + community demos are PR-reviewed, that residual risk is minor.
//
// Endpoints (all CORS-enabled for ALLOWED_ORIGIN, credentials included):
//   GET  /auth/login?return_to=<url>   -> redirect to GitHub authorize
//   GET  /auth/callback?code=&state=   -> exchange, set session, redirect back
//   GET  /me                           -> { authenticated, login, avatar, csrf }
//   POST /react  {discussion, on}      -> { count, viewerReacted }  (needs X-CSRF)
//   POST /logout                       -> clear session

const SESSION_COOKIE = 'sgv_session'
const STATE_COOKIE = 'sgv_oauth'
const SESSION_TTL = 30 * 24 * 60 * 60 // 30 days (seconds)
const STATE_TTL = 600 // 10 minutes

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || ''
    const cors = corsHeaders(origin, env)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })

    try {
      if (url.pathname === '/auth/login') return authLogin(request, env, url)
      if (url.pathname === '/auth/callback') return authCallback(request, env, url)
      if (url.pathname === '/me') return me(request, env, cors)
      if (url.pathname === '/state') return state(request, env, url, cors)
      if (url.pathname === '/react' && request.method === 'POST') return react(request, env, cors)
      if (url.pathname === '/logout' && request.method === 'POST') return logout(env, cors)
      return json({ error: 'not found' }, 404, cors)
    } catch (err) {
      return json({ error: String(err && err.message ? err.message : err) }, 500, cors)
    }
  },
}

// ---- CORS -----------------------------------------------------------------
function allowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || '').split(',').map((s) => s.trim()).filter(Boolean)
}
function corsHeaders(origin, env) {
  const allow = allowedOrigins(env)
  const ok = allow.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : allow[0] || '',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-CSRF',
    Vary: 'Origin',
  }
}

// ---- OAuth ----------------------------------------------------------------
async function authLogin(request, env, url) {
  const returnTo = url.searchParams.get('return_to') || firstOrigin(env)
  if (!isAllowedReturn(returnTo, env)) return new Response('bad return_to', { status: 400 })
  const state = randomHex(16)
  const stateCookie = await encrypt(env, JSON.stringify({ s: state, r: returnTo }))
  const authorize = new URL('https://github.com/login/oauth/authorize')
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID)
  authorize.searchParams.set('redirect_uri', `${env.SELF_ORIGIN}/auth/callback`)
  authorize.searchParams.set('scope', 'public_repo')
  authorize.searchParams.set('state', state)
  authorize.searchParams.set('allow_signup', 'true')
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': cookie(STATE_COOKIE, stateCookie, env, STATE_TTL),
    },
  })
}

async function authCallback(request, env, url) {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const raw = readCookie(request, STATE_COOKIE)
  if (!code || !state || !raw) return new Response('missing oauth params', { status: 400 })
  let saved
  try {
    saved = JSON.parse(await decrypt(env, raw))
  } catch {
    return new Response('bad state', { status: 400 })
  }
  if (saved.s !== state) return new Response('state mismatch', { status: 400 })
  if (!isAllowedReturn(saved.r, env)) return new Response('bad return_to', { status: 400 })

  // Exchange the code for a user access token (needs the client secret).
  const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${env.SELF_ORIGIN}/auth/callback`,
    }),
  })
  const tokenJson = await tokenRes.json()
  const token = tokenJson.access_token
  if (!token) return new Response('token exchange failed', { status: 400 })

  const user = await ghRest('https://api.github.com/user', token)
  const session = {
    t: token,
    l: user.login,
    a: user.avatar_url,
    c: randomHex(16),
    e: Math.floor(Date.now() / 1000) + SESSION_TTL,
  }
  const sealed = await encrypt(env, JSON.stringify(session))
  const headers = new Headers({ Location: saved.r })
  headers.append('Set-Cookie', cookie(SESSION_COOKIE, sealed, env, SESSION_TTL))
  headers.append('Set-Cookie', cookie(STATE_COOKIE, '', env, 0)) // clear
  return new Response(null, { status: 302, headers })
}

async function me(request, env, cors) {
  const session = await readSession(request, env)
  if (!session) return json({ authenticated: false }, 200, cors)
  return json({ authenticated: true, login: session.l, avatar: session.a, csrf: session.c }, 200, cors)
}

function logout(env, cors) {
  return json({ ok: true }, 200, { ...cors, 'Set-Cookie': cookie(SESSION_COOKIE, '', env, 0) })
}

// ---- Reactions ------------------------------------------------------------
// Read-only: the signed-in user's current 👍 state + count for a discussion, so
// the UI can render the filled/unfilled star without toggling anything.
async function state(request, env, url, cors) {
  const session = await readSession(request, env)
  if (!session) return json({ authenticated: false }, 200, cors)
  const number = Number(url.searchParams.get('discussion'))
  if (!Number.isInteger(number) || number <= 0) return json({ error: 'bad discussion' }, 400, cors)
  const [owner, name] = (env.REPO || '').split('/')
  const info = await readDiscussion(session.t, owner, name, number)
  if (!info) return json({ error: 'discussion not found' }, 404, cors)
  return json({ authenticated: true, count: info.count, viewerReacted: info.viewerReacted }, 200, cors)
}

async function react(request, env, cors) {
  const session = await readSession(request, env)
  if (!session) return json({ error: 'not authenticated' }, 401, cors)
  if (request.headers.get('X-CSRF') !== session.c) return json({ error: 'bad csrf' }, 403, cors)

  const body = await request.json().catch(() => ({}))
  const number = Number(body.discussion)
  const on = !!body.on
  if (!Number.isInteger(number) || number <= 0) return json({ error: 'bad discussion' }, 400, cors)

  const [owner, name] = (env.REPO || '').split('/')
  const info = await readDiscussion(session.t, owner, name, number)
  if (!info || !info.id) return json({ error: 'discussion not found' }, 404, cors)

  // Only toggle if the desired state differs from the current one (idempotent).
  if (on && !info.viewerReacted) await mutateReaction(session.t, info.id, true)
  else if (!on && info.viewerReacted) await mutateReaction(session.t, info.id, false)

  const fresh = await readDiscussion(session.t, owner, name, number)
  return json({ count: fresh.count, viewerReacted: fresh.viewerReacted }, 200, cors)
}

async function readDiscussion(token, owner, name, number) {
  const data = await ghGraphql(
    token,
    `query($owner:String!,$name:String!,$num:Int!){
       repository(owner:$owner,name:$name){
         discussion(number:$num){
           id
           reactionGroups{ content viewerHasReacted reactors{ totalCount } }
         }
       }
     }`,
    { owner, name, num: number },
  )
  const d = data?.repository?.discussion
  if (!d) return null
  const g = (d.reactionGroups || []).find((x) => x.content === 'THUMBS_UP')
  return {
    id: d.id,
    viewerReacted: !!(g && g.viewerHasReacted),
    count: g && g.reactors ? g.reactors.totalCount : 0,
  }
}

async function mutateReaction(token, subjectId, add) {
  const op = add ? 'addReaction' : 'removeReaction'
  await ghGraphql(
    token,
    `mutation($id:ID!){ ${op}(input:{subjectId:$id, content:THUMBS_UP}){ clientMutationId } }`,
    { id: subjectId },
  )
}

// ---- GitHub helpers -------------------------------------------------------
async function ghRest(url, token) {
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'svgrid-vote',
    },
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  return res.json()
}
async function ghGraphql(token, query, variables) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'svgrid-vote',
    },
    body: JSON.stringify({ query, variables }),
  })
  const jsonRes = await res.json()
  if (jsonRes.errors) throw new Error(`GraphQL: ${JSON.stringify(jsonRes.errors)}`)
  return jsonRes.data
}

// ---- Session / cookies ----------------------------------------------------
async function readSession(request, env) {
  const raw = readCookie(request, SESSION_COOKIE)
  if (!raw) return null
  try {
    const s = JSON.parse(await decrypt(env, raw))
    if (!s.t || (s.e && s.e < Math.floor(Date.now() / 1000))) return null
    return s
  } catch {
    return null
  }
}
function cookie(nameKey, value, env, maxAge) {
  const parts = [`${nameKey}=${value}`, 'Path=/', 'HttpOnly', 'Secure']
  const sameSite = env.COOKIE_DOMAIN ? 'Lax' : 'None'
  parts.push(`SameSite=${sameSite}`)
  if (env.COOKIE_DOMAIN) parts.push(`Domain=${env.COOKIE_DOMAIN}`)
  parts.push(`Max-Age=${maxAge}`)
  return parts.join('; ')
}
function readCookie(request, nameKey) {
  const header = request.headers.get('Cookie') || ''
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === nameKey) return v.join('=')
  }
  return null
}

// ---- utils ----------------------------------------------------------------
function firstOrigin(env) {
  return allowedOrigins(env)[0] || ''
}
function isAllowedReturn(returnTo, env) {
  try {
    const u = new URL(returnTo)
    return allowedOrigins(env).some((o) => {
      try { return new URL(o).origin === u.origin } catch { return false }
    })
  } catch {
    return false
  }
}
function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  })
}
function randomHex(bytes) {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('')
}

// AES-GCM encrypt/decrypt for cookie payloads. Key = SHA-256(SESSION_SECRET).
async function aesKey(env) {
  const material = new TextEncoder().encode(env.SESSION_SECRET || '')
  const hash = await crypto.subtle.digest('SHA-256', material)
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}
async function encrypt(env, plaintext) {
  const key = await aesKey(env)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  const buf = new Uint8Array(iv.length + ct.byteLength)
  buf.set(iv, 0)
  buf.set(new Uint8Array(ct), iv.length)
  return b64urlEncode(buf)
}
async function decrypt(env, token) {
  const key = await aesKey(env)
  const buf = b64urlDecode(token)
  const iv = buf.slice(0, 12)
  const ct = buf.slice(12)
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
  return new TextDecoder().decode(pt)
}
function b64urlEncode(bytes) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64urlDecode(str) {
  const s = str.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(s + '==='.slice((s.length + 3) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
