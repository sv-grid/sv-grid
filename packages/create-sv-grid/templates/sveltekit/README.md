# SvGrid + SvelteKit sample

A grid whose rows are loaded on the server, sorted from the URL, edited through
a form action, and gated behind a cookie session with roles - the things that
are different about running a grid in SvelteKit rather than a plain Vite SPA.

```bash
npm install
npm run dev     # http://localhost:5173/people
```

## What to try

1. **Click the `Year` header.** The URL becomes `?sort=year&dir=asc`. Copy that
   link into a new tab - it opens already sorted, because the server did it.
2. **Double-click a name, change it, press Enter, then reload.** The edit went
   through the form action in `+page.server.ts` and survived.
3. **Switch the theme** with the picker in the header. All 20 built-in presets,
   light and dark, applied live.
4. **`curl localhost:5173/people`.** The rows are in the HTML, not injected by
   JS afterwards. That is what a crawler sees.
5. **Sign in as each user.** `admin@example.com` can edit names;
   `viewer@example.com` cannot, and the column is not editable for them.
   The password is `password` for both.
6. **Try to bypass the gate.** Sign in as the viewer, then post the action by
   hand. It comes back 403, because the check is on the server and hiding the
   button was only cosmetic:

   ```bash
   curl -i -X POST 'localhost:5173/people?/rename' -F id=1 -F name=Nope
   ```

## Where things are

| File | Does |
| --- | --- |
| `src/lib/people.ts` | Stands in for your database. Swap for real queries. |
| `src/routes/people/+page.server.ts` | `load` sorts from the query string; the `rename` action takes the edit. |
| `src/routes/people/+page.svelte` | The grid. `externalSort` because the server owns the ordering. |
| `src/lib/server/auth.ts` | Password hashing (PBKDF2 via Web Crypto), sessions, roles. Swap the arrays for your database. |
| `src/hooks.server.ts` | Resolves the session once per request and gates routes from one list. |
| `src/routes/login/+page.server.ts` | Login action. Rejects open redirects; one message for every failure. |
| `src/routes/logout/+server.ts` | POST-only sign out. Drops the session server-side, not just the cookie. |
| `src/lib/theme.svelte.ts` | Runtime theme switching via `resolveThemeTokens`. |
| `src/app.css` | Imports one preset so the first paint is themed before JS runs. |

## Auth

The scaffold is the real shape, with the storage stubbed:

- Passwords are hashed with PBKDF2-HMAC-SHA256 through Web Crypto, so the same
  code runs on Node and on the edge runtimes `adapter-auto` may pick.
- The session cookie is `httpOnly` (an XSS bug cannot read it) and
  `SameSite=Lax` (a cross-site POST cannot ride it).
- Sign out drops the session server-side, so a copied id stops working.
- Route gating lives in one list in `hooks.server.ts`, so adding a protected
  route is an entry rather than a check you have to remember.

The users and sessions are in-memory, like `src/lib/people.ts`. Move both to
your database before this goes anywhere real - in particular, an in-memory
session map does not survive a restart or a second instance.

## Themes

Pick a starting theme when you scaffold:

```bash
npm create @svgrid@latest my-app -- --template sveltekit --theme dracula --dark
```

Or change it at runtime with the header picker. The picker writes the preset's
`--sg-*` custom properties onto `<html>`; nothing rebuilds.

Full guide: https://svgrid.com/docs/getting-started/sveltekit/
