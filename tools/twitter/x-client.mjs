// Minimal, zero-dependency X (Twitter) API client for SvGrid automation.
//
// Posts a tweet with an optional image using the maintainer's own developer
// app, exactly like tools/generate-blog-post.mjs talks to the Anthropic API
// with a bare `fetch` and no SDK. Two endpoints are used:
//
//   1. POST https://upload.twitter.com/1.1/media/upload.json  (v1.1, multipart)
//      -> uploads the PNG, returns a media_id_string.
//   2. POST https://api.twitter.com/2/tweets                  (v2, JSON)
//      -> creates the tweet, attaching the media id.
//
// Both require OAuth 1.0a user-context auth (posting on behalf of the account),
// which is implemented here with node:crypto - no external oauth library.
//
// Credentials come from four env vars (see tools/twitter/README.md):
//   X_API_KEY            - app consumer key ("API Key")
//   X_API_SECRET         - app consumer secret ("API Key Secret")
//   X_ACCESS_TOKEN       - the svgrid account's access token
//   X_ACCESS_TOKEN_SECRET - the account's access token secret
//                          (X_ACCESS_SECRET is also accepted as an alias)
//
// Signature note: OAuth 1.0a only folds request PARAMETERS into the signature
// base string for query strings and application/x-www-form-urlencoded bodies.
// A JSON body (v2 tweets) and a multipart body (v1.1 media) are NOT signed, so
// the base string here is just the oauth_* params. That is standard and is why
// the media upload uses multipart rather than a form-encoded `media_data`.
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

// Build the `Authorization: OAuth ...` header for a request. `params` holds any
// query-string parameters (none, for our two calls); the body is never signed
// because it is JSON or multipart, not form-urlencoded.
function authHeader(method, url, params = {}) {
  const oauth = {
    oauth_consumer_key: CREDS.key,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: CREDS.token,
    oauth_version: '1.0',
  }

  const allParams = { ...params, ...oauth }
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${enc(k)}=${enc(allParams[k])}`)
    .join('&')

  const base = [method.toUpperCase(), enc(url), enc(paramString)].join('&')
  const signingKey = `${enc(CREDS.secret)}&${enc(CREDS.tokenSecret)}`
  oauth.oauth_signature = crypto
    .createHmac('sha1', signingKey)
    .update(base)
    .digest('base64')

  const header = Object.keys(oauth)
    .sort()
    .map((k) => `${enc(k)}="${enc(oauth[k])}"`)
    .join(', ')
  return `OAuth ${header}`
}

// Verify the credentials without posting: GET /2/users/me returns the account
// the keys authenticate as. Use this before the first live tweet to confirm the
// keys belong to @svgrid (not a personal account) and carry write scope.
export async function verifyCredentials() {
  const url = 'https://api.twitter.com/2/users/me'
  const res = await fetch(url, {
    headers: { Authorization: authHeader('GET', url) },
  })
  if (!res.ok) {
    throw new Error(`Verify failed ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.data // { id, name, username }
}

// Upload a PNG buffer via the v1.1 media endpoint. Returns the media id string.
export async function uploadMedia(pngBuffer) {
  const url = 'https://upload.twitter.com/1.1/media/upload.json'
  const boundary = '----svgrid' + crypto.randomBytes(12).toString('hex')

  const head = Buffer.from(
    `--${boundary}\r\n` +
      'Content-Disposition: form-data; name="media"; filename="card.png"\r\n' +
      'Content-Type: image/png\r\n\r\n',
  )
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`)
  const body = Buffer.concat([head, pngBuffer, tail])

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader('POST', url),
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  })
  if (!res.ok) {
    throw new Error(`Media upload failed ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data.media_id_string
}

// Create a tweet. `text` is the tweet body. Options:
//   mediaId   - attach an image already uploaded via uploadMedia()
//   replyToId - make this a reply to an existing tweet (used to put the link in
//               a first reply so the main tweet avoids the per-link API charge
//               and X's link-in-body reach penalty).
// Returns the created tweet id.
export async function postTweet(text, { mediaId, replyToId } = {}) {
  const url = 'https://api.twitter.com/2/tweets'
  const payload = { text }
  if (mediaId) payload.media = { media_ids: [mediaId] }
  if (replyToId) payload.reply = { in_reply_to_tweet_id: replyToId }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: authHeader('POST', url),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Tweet failed ${res.status}: ${await res.text()}`)
  }
  const data = await res.json()
  return data?.data?.id
}
