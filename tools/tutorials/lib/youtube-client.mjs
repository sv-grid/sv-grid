/**
 * Minimal YouTube Data API v3 client: OAuth2 refresh, resumable video upload,
 * captions, thumbnail, playlist. Bare `fetch`, no googleapis (the repo keeps
 * its automation at zero runtime deps; tools/twitter/x-client.mjs is the X
 * equivalent).
 *
 * Auth. A Desktop-type OAuth client (Google Cloud console -> APIs & Services
 * -> Credentials) plus a refresh token obtained once with `youtube.mjs --auth`.
 * Scopes: youtube.upload (videos.insert) and youtube.force-ssl (captions,
 * thumbnails, playlists).
 *
 * Env: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
 *
 * Quota (default 10,000 units/day): videos.insert 1600, captions.insert 400,
 * thumbnails.set 50, playlistItems.insert 50, channels.list 1.
 */
import crypto from 'node:crypto'
import http from 'node:http'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const API = 'https://www.googleapis.com/youtube/v3'
const UPLOAD = 'https://www.googleapis.com/upload/youtube/v3'
export const SCOPES = ['https://www.googleapis.com/auth/youtube.upload', 'https://www.googleapis.com/auth/youtube.force-ssl']

export const QUOTA = { videosInsert: 1600, captionsInsert: 400, thumbnailsSet: 50, playlistItemsInsert: 50, channelsList: 1 }

export function credentials(env = process.env) {
  return { clientId: env.YT_CLIENT_ID, clientSecret: env.YT_CLIENT_SECRET, refreshToken: env.YT_REFRESH_TOKEN }
}

export function hasCredentials(env = process.env) {
  const c = credentials(env)
  return Boolean(c.clientId && c.clientSecret && c.refreshToken)
}

async function tokenRequest(form) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form).toString(),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`token endpoint ${res.status}: ${json.error_description ?? json.error ?? 'unknown error'}`)
  return json
}

/**
 * One-time interactive consent on a loopback redirect. Prints the URL to
 * open, waits for Google to redirect back to 127.0.0.1, exchanges the code
 * and returns the refresh token. Nothing is written to disk.
 */
export async function authorizeInteractive({ clientId, clientSecret }, log = console.log) {
  if (!clientId || !clientSecret) throw new Error('YT_CLIENT_ID and YT_CLIENT_SECRET are required for --auth')
  const state = crypto.randomBytes(12).toString('hex')
  const { code, redirect } = await new Promise((resolve, reject) => {
    let redirect = ''
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, 'http://127.0.0.1')
      if (url.pathname !== '/') {
        res.writeHead(404).end()
        return
      }
      const err = url.searchParams.get('error')
      const got = url.searchParams.get('code')
      const st = url.searchParams.get('state')
      res.writeHead(200, { 'content-type': 'text/html' })
      if (err || !got || st !== state) {
        res.end('<p>Authorization failed. You can close this tab.</p>')
        server.close()
        reject(new Error(err ?? 'no code in the redirect'))
        return
      }
      res.end('<p>Authorized. You can close this tab and go back to the terminal.</p>')
      server.close()
      resolve({ code: got, redirect })
    })
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      redirect = `http://127.0.0.1:${server.address().port}/`
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirect,
        response_type: 'code',
        scope: SCOPES.join(' '),
        access_type: 'offline',
        prompt: 'consent',
        state,
      })
      log(`\nOpen this URL in a browser signed in to the channel's Google account:\n\n${AUTH_URL}?${params}\n`)
      log(`waiting for the redirect on ${redirect} ...`)
    })
  })
  // The token exchange must repeat the exact redirect URI the consent used.
  const json = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirect,
    grant_type: 'authorization_code',
  })
  if (!json.refresh_token) throw new Error('no refresh_token in the response (revoke the app at myaccount.google.com/permissions and run --auth again)')
  return json.refresh_token
}

/** A client bound to one set of credentials; the access token is cached per run. */
export function createClient(creds = credentials()) {
  let access = null
  let expiresAt = 0

  async function token() {
    if (access && Date.now() < expiresAt - 60_000) return access
    if (!creds.refreshToken) throw new Error('YT_REFRESH_TOKEN is not set (run `youtube.mjs --auth` once)')
    const json = await tokenRequest({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    })
    access = json.access_token
    expiresAt = Date.now() + (json.expires_in ?? 3600) * 1000
    return access
  }

  async function call(method, url, { body, headers = {}, raw = false } = {}) {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${await token()}`, ...headers },
      body,
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`${method} ${url.replace(/\?.*$/, '')} -> ${res.status}: ${text.slice(0, 400)}`)
    }
    return raw ? res : res.json()
  }

  return {
    /** The channel the token belongs to. */
    async myChannel() {
      const json = await call('GET', `${API}/channels?part=snippet,statistics&mine=true`)
      const c = json.items?.[0]
      if (!c) throw new Error('no channel on this account')
      return { id: c.id, title: c.snippet.title, subscribers: c.statistics?.subscriberCount, videos: c.statistics?.videoCount }
    },

    /**
     * Resumable upload: open a session with the metadata, PUT the bytes, and
     * on a network failure ask the session where it stopped and send the rest.
     * @param {Buffer} bytes
     * @param {{ title: string, description: string, tags: string[], categoryId?: string, privacyStatus?: string }} meta
     */
    async uploadVideo(bytes, meta, { onProgress = () => {} } = {}) {
      const body = {
        snippet: {
          title: meta.title,
          description: meta.description,
          tags: meta.tags,
          categoryId: meta.categoryId ?? '28',
          defaultLanguage: 'en',
          defaultAudioLanguage: 'en',
        },
        status: {
          privacyStatus: meta.privacyStatus ?? 'unlisted',
          selfDeclaredMadeForKids: false,
          embeddable: true,
          license: 'youtube',
        },
      }
      const open = await call('POST', `${UPLOAD}/videos?uploadType=resumable&part=snippet,status`, {
        raw: true,
        headers: {
          'content-type': 'application/json; charset=UTF-8',
          'x-upload-content-length': String(bytes.length),
          'x-upload-content-type': 'video/mp4',
        },
        body: JSON.stringify(body),
      })
      const session = open.headers.get('location')
      if (!session) throw new Error('no resumable session URI in the response')

      let offset = 0
      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const res = await fetch(session, {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${await token()}`,
              'content-type': 'video/mp4',
              'content-length': String(bytes.length - offset),
              ...(offset ? { 'content-range': `bytes ${offset}-${bytes.length - 1}/${bytes.length}` } : {}),
            },
            body: offset ? bytes.subarray(offset) : bytes,
          })
          if (res.ok) {
            const json = await res.json()
            onProgress(bytes.length, bytes.length)
            return json.id
          }
          if (res.status !== 308 && res.status < 500) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 400)}`)
        } catch (err) {
          if (attempt === 4) throw err
        }
        // Ask the session how much it has.
        const probe = await fetch(session, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${await token()}`, 'content-range': `bytes */${bytes.length}` },
        })
        if (probe.ok) return (await probe.json()).id
        const range = probe.headers.get('range')
        offset = range ? Number(range.split('-')[1]) + 1 : 0
        onProgress(offset, bytes.length)
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)))
      }
      throw new Error('upload did not complete')
    },

    /** Upload an SRT as the video's English captions (multipart/related). */
    async insertCaption(videoId, srt, { name = 'English', language = 'en' } = {}) {
      const boundary = 'svgrid' + crypto.randomBytes(12).toString('hex')
      const meta = JSON.stringify({ snippet: { videoId, language, name, isDraft: false } })
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`),
        Buffer.from(`--${boundary}\r\ncontent-type: application/octet-stream\r\n\r\n`),
        Buffer.isBuffer(srt) ? srt : Buffer.from(srt, 'utf-8'),
        Buffer.from(`\r\n--${boundary}--\r\n`),
      ])
      const json = await call('POST', `${UPLOAD}/captions?uploadType=multipart&part=snippet`, {
        headers: { 'content-type': `multipart/related; boundary=${boundary}` },
        body,
      })
      return json.id
    },

    /** Custom thumbnail (JPEG/PNG, needs a phone-verified channel). */
    async setThumbnail(videoId, jpeg) {
      const json = await call('POST', `${UPLOAD}/thumbnails/set?videoId=${encodeURIComponent(videoId)}&uploadType=media`, {
        headers: { 'content-type': 'image/jpeg' },
        body: jpeg,
      })
      return json.items?.[0]?.default?.url ?? null
    },

    async addToPlaylist(playlistId, videoId) {
      const json = await call('POST', `${API}/playlistItems?part=snippet`, {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ snippet: { playlistId, resourceId: { kind: 'youtube#video', videoId } } }),
      })
      return json.id
    },

    /** Status of one video (processing state + privacy), for a post-upload check. */
    async videoStatus(videoId) {
      const json = await call('GET', `${API}/videos?part=status,processingDetails&id=${encodeURIComponent(videoId)}`)
      const v = json.items?.[0]
      return v ? { privacy: v.status?.privacyStatus, uploadStatus: v.status?.uploadStatus, processing: v.processingDetails?.processingStatus } : null
    },
  }
}
