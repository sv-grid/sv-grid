# Sign-in & registration blocks

Screens for getting a user into your app: sign in with a password, a provider
or a magic link, create an account, prove it is them with a one-time code, and
reset a forgotten password. Each block is one `.svelte` file built from
`SvTextInput`, `SvPasswordInput`, `SvOtpInput`, `SvButton` and `SvCard`, themed
from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/auth"></div>

See them first with `npx @svgrid/ui try blocks/auth`. No project needed.

## Login

A two-column page: a brand panel on the left, the sign-in card on the right with
provider buttons, email and password (with reveal), remember-me and a
forgot-password link. Below 720 px the brand panel is hidden and the card fills
the screen.

<div data-docs-demo="420-block-login" data-height="560"></div>

`npx @svgrid/ui add login`

## Sign-up

A centered account-creation card: first and last name side by side, work email,
a password with the live strength meter, a plan switch and a terms checkbox.

<div data-docs-demo="421-block-signup" data-height="600"></div>

`npx @svgrid/ui add signup`

## Two-factor code

The second step of a sign-in: a six-digit `SvOtpInput` that advances on each
digit and verifies on the last one, with a resend timer. Enter `000000` to see
the error state.

<div data-docs-demo="422-block-otp" data-height="520"></div>

`npx @svgrid/ui add otp`

## Sign-in with providers

SSO first: Google, GitHub and Microsoft buttons, and a Single sign-on (SAML)
button that opens a company-domain field. Below the divider, a passwordless form
emails a sign-in link and switches the card to a "Check your inbox" state with
the address, a 30-second resend cooldown and a link to use a different email.

<div data-docs-demo="526-block-auth-providers" data-height="600"></div>

`npx @svgrid/ui add auth-providers`

## Forgot password

Two states in one card. The request state takes an email, validates it and
shows the button's loading state while it sends. The confirmation names the
address, offers a resend after a 60-second cooldown and a link to try another
email; "Back to sign-in" sits in the footer of both.

<div data-docs-demo="527-block-auth-forgot-password" data-height="520"></div>

`npx @svgrid/ui add auth-forgot-password`

## Connecting your auth

Each block's core takes its requests as options, so wiring a real backend
leaves the markup alone. Find the `create...()` call in the block's instance
script and replace the demo's timer. In the login block that is
`createLogin({ onSubmit })`. It gets `{ email, password, remember }` once both
fields validate, the submit button shows its loading state until the promise
settles, and a throw keeps the form as it was and goes to `onError`:

```ts
const login = createLogin({
  onSubmit: async (values) => {
    const r = await fetch('/api/login', { method: 'POST', body: JSON.stringify(values) })
    if (!r.ok) throw new Error('Wrong email or password')
    location.assign('/app')
  },
  onError: (e) => toast.error(e instanceof Error ? e.message : 'Sign-in failed'),
})
```

In SvelteKit you can use a form action instead: give the `<form>` a
`method="POST"` and drop the `{...login.formProps()}` spread, which calls
`preventDefault`. The email and password fields already have a `name`; give any
other input one too. An input with a `name` submits its value through a hidden
field, so `+page.server.ts` reads it from `request.formData()` like a plain
input.

The other blocks work the same way:

- **Sign-up**: `createSignup({ onSubmit })` gets `{ first, last, email,
  password, plan, agree }`. Until there is an email, a password of 8 or more
  characters and a ticked terms box, submit calls `onIncomplete` instead.
- **Two-factor code**: `createOtp({ onVerify })` gets the code. Return `false`
  or throw to reject it (`onRejected`); anything else moves the card to its
  verified state (`onVerified`). `onResend` sends a new code, and the core runs
  the 30-second cooldown.
- **Sign-in with providers**: `createProviderSignIn({ onProvider, onSso,
  onSendLink })`. `onProvider` gets `{ id, name, mark }`, so redirect to your
  OAuth start route for `id` there. `onSso` gets the lowercased company domain.
  `onSendLink` posts the magic-link email; when it resolves the card flips to
  "Check your inbox".
- **Forgot password**: `createForgotPassword({ onRequest })` handles the first
  send and, unless you pass `onResend`, the resend button. A throw calls
  `onError(error, 'request' | 'resend')`. In the demo both go through the
  `requestReset(addr)` stand-in at the top of the script, so replacing that one
  function wires both:

```ts
const requestReset = async (addr: string) => {
  const r = await fetch('/api/password-reset', { method: 'POST', body: JSON.stringify({ email: addr }) })
  if (!r.ok) throw new Error('Reset failed')
}
```

## Headless

Every block here is a styled render of the core in its `<script module>`. To
draw your own markup, take the core alone with `npx @svgrid/ui add
auth-forgot-password --headless` (it writes `auth-forgot-password.svelte.ts`)
and spread its prop-getters on plain elements:

```svelte
<script lang="ts">
  import { createForgotPassword } from './auth-forgot-password.svelte.js'

  const forgot = createForgotPassword({
    onRequest: async (email) => {
      const r = await fetch('/api/password-reset', { method: 'POST', body: JSON.stringify({ email }) })
      if (!r.ok) throw new Error('Reset failed')
    },
  })
</script>

{#if forgot.sentTo}
  <p>Check {forgot.sentTo} for a reset link.</p>
  <button {...forgot.resendProps()}>{forgot.cooldown ? `Resend in ${forgot.cooldown}s` : 'Resend'}</button>
{:else}
  <form {...forgot.formProps()}>
    <label>Email <input {...forgot.fieldProps()} /></label>
    {#if forgot.error}<p role="alert">{forgot.error}</p>{/if}
    <button disabled={forgot.busy}>Send reset link</button>
  </form>
{/if}
```

## See also

- [UI blocks overview](./index.md)
- [SvPasswordInput](../ui-components/sv-password-input.md)
- [SvOtpInput](../ui-components/sv-otp-input.md)
