# svgrid-vote - in-place community-demo voting

> **STATUS: SHELVED / not deployed (by decision).** Per-demo voting only pays off
> once the community gallery has real volume (~15-20 demos with organic PRs).
> Until then the playground's Upvote control links out to the GitHub discussion,
> which is enough. This worker is complete and ready - do **not** stand it up (no
> `VITE_VOTE_API`, no OAuth app) until the gallery has grown. Revisit then.

A tiny Cloudflare Worker that lets a visitor upvote a community demo **from the
playground** by reacting 👍 to the demo's GitHub Discussion under their own
account - without the site ever touching their GitHub token.

The site is static (GitHub Pages), and GitHub's OAuth token exchange needs the
client **secret**, which must stay server-side. This worker does the OAuth dance
and then acts as a thin authenticated proxy for the reaction. **The access token
lives only in an encrypted, httpOnly cookie - it is never exposed to browser JS**
(important, because the playground evals arbitrary code on the same origin).

If the site is built WITHOUT `VITE_VOTE_API` set, the playground silently falls
back to the old behaviour: the Upvote button just links out to the GitHub
discussion. So this worker is a pure enhancement - nothing breaks without it.

## One-time setup

### 1. Register a GitHub OAuth App
<https://github.com/settings/developers> -> **New OAuth App**
- **Application name:** SvGrid demo voting
- **Homepage URL:** `https://svgrid.com`
- **Authorization callback URL:** `https://vote.svgrid.com/auth/callback`
  (must match `SELF_ORIGIN` + `/auth/callback` below)

Copy the **Client ID** and generate a **Client secret**. The `public_repo` scope
is requested at login - the minimum that lets a user react to a public-repo
discussion.

### 2. Configure the worker
Edit [`wrangler.toml`](./wrangler.toml):
- `GITHUB_CLIENT_ID` - from step 1
- `SELF_ORIGIN` - where this worker is served (recommend a **svgrid.com
  subdomain**, e.g. `https://vote.svgrid.com`, so the session cookie is
  first-party to the site and not blocked by Safari/Chrome)
- `COOKIE_DOMAIN` - `svgrid.com` when on a subdomain (else leave empty for
  cross-site `SameSite=None` cookies)
- `ALLOWED_ORIGIN` - `https://svgrid.com` (+ your dev origin while developing)

Set the secrets (never commit these):
```
cd workers/svgrid-vote
npx wrangler secret put GITHUB_CLIENT_SECRET   # from step 1
npx wrangler secret put SESSION_SECRET         # any long random string, e.g. `openssl rand -hex 32`
```

### 3. Deploy + route on your subdomain
```
npx wrangler deploy
```
Then in the Cloudflare dashboard (zone must be on Cloudflare) add a route
`vote.svgrid.com/*` -> this worker, or uncomment the `[[routes]]` block in
`wrangler.toml`. A `workers.dev` URL also works, but then the cookie is
third-party (`SameSite=None`) and may be blocked in Safari - a subdomain is
strongly preferred.

### 4. Point the site at it
Build the website with the API base set:
```
VITE_VOTE_API=https://vote.svgrid.com pnpm --filter svgrid-website build
```
(Add `VITE_VOTE_API` to the `Build website` step's `env:` in
`.github/workflows/deploy-website.yml`.) On the next deploy the playground's
Upvote control becomes a live toggle: click -> sign in with GitHub the first time
-> the 👍 registers and the count updates in place.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/auth/login?return_to=` | Redirect to GitHub authorize |
| GET | `/auth/callback?code=&state=` | Exchange code, set session, redirect back |
| GET | `/me` | `{ authenticated, login, avatar, csrf }` |
| POST | `/react` `{discussion, on}` | Toggle 👍 (needs `X-CSRF` header) -> `{ count, viewerReacted }` |
| POST | `/logout` | Clear session |

## Security notes
- Token is server-side only (encrypted httpOnly cookie) -> no account takeover
  even though the playground runs untrusted code.
- `/react` only toggles a 👍 on a discussion in `REPO`, so worst-case abuse is a
  demo's star count.
- A CSRF token blocks cross-site forgery. It cannot stop same-origin playground
  code that reads the CSRF via `/me`, but since the token stays server-side and
  reactions are low-value + community demos are PR-reviewed, that residual risk
  is minor and bounded.

## Porting to Vercel / Netlify
The logic is platform-agnostic (WebCrypto + fetch). To port, map each endpoint to
a function and translate cookie/redirect handling; the client only needs the base
URL in `VITE_VOTE_API`.
