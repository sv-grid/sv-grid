// Minimal, zero-dependency X (Twitter) API client for SvGrid automation.
//
// Posts a tweet with an optional image using the maintainer's own developer app
// (bare `fetch`, no SDK, like tools/generate-blog-post.mjs talks to Anthropic).
// Endpoints:
//   1. POST https://upload.twitter.com/1.1/media/upload.json  (v1.1, multipart)
//   2. POST https://api.twitter.com/2/tweets                  (v2, JSON)
//   3. GET  https://api.twitter.com/2/users/me                (verify creds)
//
// All require OAuth 1.0a user-context auth, implemented here with node:crypto.
// OAuth 1.0a only folds request PARAMETERS into the signature for query strings
// and x-www-form-urlencoded bodies; JSON and multipart bodies are not signed, so
// the base string here is just the oauth_* params (standard, and why media
// upload uses multipart rather than a form-encoded media_data field).
//
// Credentials (env; see tools/twitter/README.md):
//   X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET
//   (X_ACCESS_SECRET is accepted as an alias for X_ACCESS_TOKEN_SECRET.)
import crypto from 'node:crypto'

const CREDS = {
  key: process.env.X_API_KEY,
  secret: process.env.X_API_SECRET,
  token: process.env.X_ACCESS_TOKEN,
  tokenSecret: process.env.X_ACCESS_TOKEN_SECRET || process.env.X_ACCESS_SECRET,
}

export function hasCredentials() {
  return Boolean(CREDS.key && CREDS.secret && CREDS.token && CREDS.tokenSecret)
}

// RFC 3986 percent-encoding (stricter than encodeURIComponent).
function enc(v) {
  return encodeURIComponent(v).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )
}

function authHeader(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: CREDS.key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: CREDS.token,
    oauth_version: '1.0',
  }
  const all = { ...params, ...oauth }
  const paramString = Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&')
  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&')
  const signingKey = `${enc(CREDS.secret)}&${enc(CREDS.tokenSecret)}`
  oauth.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64')
  return 'OAuth ' + Object.keys(oauth).sort().map((k) => `${enc(k)}="${enc(oauth[k])}"`).join(', ')
}

// Verify credentials without posting; returns { id, name, username }.
export async function verifyCredentials() {
  const url = 'https://api.twitter.com/2/users/me'
  const res = await fetch(url, { headers: { Authorization: authHeader('GET', url) } })
  if (!res.ok) throw new Error(`Verify failed ${res.status}: ${await res.text()}`)
  return (await res.json()).data
}

// Upload an image buffer via the v1.1 media endpoint. Returns media_id_string.
// `mime` should match the buffer (image/png or image/jpeg).
export async function uploadMedia(buffer, mime = 'image/png') {
  const url = 'https://upload.twitter.com/1.1/media/upload.json'
  const boundary = '----svgrid' + crypto.randomBytes(12).toString('hex')
  const ext = mime === 'image/jpeg' ? 'jpg' : 'png'
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media"; filename="card.${ext}"\r\n` +
      `Content-Type: ${mime}\r\n\r\n`,
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([head, buffer, tail])
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url), 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  })
  if (!res.ok) throw new Error(`Media upload failed ${res.status}: ${await res.text()}`)
  return (await res.json()).media_id_string
}

// Create a tweet. Options: mediaId (attach image), replyToId (make it a reply,
// used to put the link in a first reply so the main tweet avoids the per-link
// charge and X's link-in-body reach penalty). Returns the created tweet id.
export async function postTweet(text, { mediaId, replyToId } = {}) {
  const url = 'https://api.twitter.com/2/tweets'
  const payload = { text }
  if (mediaId) payload.media = { media_ids: [mediaId] }
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: authHeader('POST', url), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Tweet failed ${res.status}: ${await res.text()}`)
  return (await res.json())?.data?.id
}
