# Banner blocks

Messages that sit on top of or inside a page: an announcement bar, inline
status banners, cookie consent and a failed-payment warning. Each block is one
`.svelte` file built from
`SvAlert`, `SvButton`, `SvBadge`, `SvModal`, `SvSwitchButton` and
`SvMaskedInput`, themed from the `--sg-*` tokens. Every block draws a mock page
around its banner and has a control to show the banner again after you
dismiss it.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/banners"></div>

See them first with `npx @svgrid/ui try blocks/banners`. No project needed.

## Announcement bar

A slim bar above the app header: a New badge, one line of news, a link to the
changelog and a dismiss button. The bar uses `--sg-fg` as its background, so it
stays neutral in light and dark themes. Dismissing shows a toast with Undo.
Below 640 px the badge is hidden and the message wraps left-aligned.

<div data-docs-demo="581-block-banners-announcement" data-height="520"></div>

`npx @svgrid/ui add banners-announcement`

## Inline info banners

Four `SvAlert` banners inside a settings page: failed webhooks (danger),
an expiring API key (warning), a finished export (success) and a note about
refresh timing (info). All four have a dismiss button. Retry now and Rotate key
show a loading state and then clear their banner; Show hidden banners brings
everything back.

<div data-docs-demo="583-block-banners-info" data-height="800"></div>

`npx @svgrid/ui add banners-info`

## Cookie consent

A consent bar along the bottom of a site with Accept all, Reject non-essential
and Customize. Customize opens an `SvModal` with one `SvSwitchButton` per
category; Necessary is on and disabled. After a choice the bar becomes one line
listing the allowed categories, with a Change settings link that reopens the
modal from the saved choice.

<div data-docs-demo="585-block-banners-cookie-consent" data-height="620"></div>

`npx @svgrid/ui add banners-cookie-consent`

## Billing warning

A failed-payment banner across the top of the app: the declined invoice, a
badge with the days left before the workspace goes read-only, and Update
payment method. The modal holds a name field and three `SvMaskedInput`s: card
number (16 digits plus a Luhn checksum), expiry (a real month, not in the past)
and CVC. Errors show after the first save; a valid card shows the loading
state and turns the banner into a "Payment received" state. Try
`4242 4242 4242 4242`.

<div data-docs-demo="586-block-banners-billing-warning" data-height="540"></div>

`npx @svgrid/ui add banners-billing-warning`

## Remembering a dismissed banner

Each block's core keeps visibility in memory, so a dismissed banner comes back
on the next page load. To remember it per user, store a key made of the banner
id and a version. Bump the version when the message changes and everyone sees
the new one once.

Read storage in `onMount`, not at the top of `<script>`: during server
rendering there is no `localStorage`, and in private windows the accessor can
throw. Create the announcement core hidden (`open: false`) so a dismissed bar
does not flash in after hydration, then show it if the key is not set:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { toast } from '@svgrid/grid'
  import { createAnnouncement } from './banners-announcement.svelte.js'

  const KEY = 'banner:exports-weekend:v1'
  const remember = (dismissed: boolean) => {
    try {
      if (dismissed) localStorage.setItem(KEY, 'dismissed')
      else localStorage.removeItem(KEY)
    } catch { /* storage blocked: hide for this visit only */ }
  }

  const bar = createAnnouncement({
    open: false,
    onDismiss: (undo) => {
      remember(true)
      toast('Announcement dismissed', { action: { label: 'Undo', onClick: () => { remember(false); undo() } } })
    },
  })

  onMount(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(KEY) === 'dismissed' } catch { /* show it */ }
    if (!dismissed) bar.show()
  })
</script>
```

For the billing warning, do not store anything in the browser: the banner
should show while the server says the invoice is unpaid. Load the invoice in
`+layout.server.ts` and start the core from it:
`createBillingWarning({ invoice: data.invoice, status: data.invoice ? 'failed' : 'hidden' })`.
Its `onSave` option is where your payment provider's tokenize call and the
invoice retry go; throw from it to keep the form open.

### Storing cookie consent on the server

Consent belongs in a cookie the server can read, so it can leave analytics
scripts out of the HTML before the page renders. Start the core from that
cookie with `createCookieConsent({ saved: data.consent })`: `null` shows the
bar, a saved choice shows the summary line. Then wrap the settings in a form
that posts to a SvelteKit action. `SvSwitchButton` takes a `name` and submits
`"true"` or `"false"` through a hidden input:

```svelte
<form method="POST" action="?/consent">
  <SvSwitchButton name="analytics" ariaLabel="Analytics cookies" checked={consent.draft.analytics} onChange={(v) => consent.setDraft('analytics', v)} />
  <SvButton type="submit" variant="primary">Save settings</SvButton>
</form>
```

```ts
// +page.server.ts
import type { Actions, PageServerLoad } from './$types'

const CATEGORIES = ['preferences', 'analytics', 'marketing'] as const

export const load: PageServerLoad = ({ cookies }) => {
  const raw = cookies.get('consent')
  return { consent: raw ? JSON.parse(raw) : null }
}

export const actions: Actions = {
  consent: async ({ request, cookies }) => {
    const form = await request.formData()
    const consent = { necessary: true, ...Object.fromEntries(CATEGORIES.map((c) => [c, form.get(c) === 'true'])) }
    cookies.set('consent', JSON.stringify(consent), { path: '/', maxAge: 60 * 60 * 24 * 180, sameSite: 'lax', httpOnly: false })
  },
}
```

`httpOnly: false` lets client code read the choice too, for example to load an
analytics script only when `consent.analytics` is true. For Accept all and
Reject non-essential, which do not post the form, write the same cookie from
the core's `onDecide(consent, how)` callback.

## Headless

The banners' state lives in the `<script module>` of each file:
`createAnnouncement()`, `createInfoBanners()`, `createCookieConsent()` and
`createBillingWarning()` own visibility, dismiss and undo, consent, and the
card form with its
validation. The styled markup is one render of that core. Take the cookie
consent core alone with `npx @svgrid/ui add banners-cookie-consent --headless`
and draw your own bar:

```svelte
<script lang="ts">
  import { createCookieConsent } from './banners-cookie-consent.svelte.js'

  const consent = createCookieConsent({
    onDecide: (choice) => { document.cookie = `consent=${JSON.stringify(choice)}; path=/; max-age=15552000; samesite=lax` },
  })
</script>

{#if consent.saved}
  <p>Cookies allowed: {consent.summary} <button onclick={consent.customize}>Change</button></p>
{:else}
  <div role="region" aria-label="Cookie consent">
    <button onclick={consent.rejectAll}>Reject non-essential</button>
    <button onclick={consent.acceptAll}>Accept all</button>
    <button onclick={consent.customize}>Customize</button>
  </div>
{/if}

{#if consent.settingsOpen}
  {#each consent.categories as c (c.id)}
    <label><input {...consent.switchProps(c.id)} /> {c.name}</label>
  {/each}
  <button onclick={consent.save}>Save settings</button>
{/if}
```

## See also

- [UI blocks overview](./index.md)
- [SvAlert](../ui-components/sv-alert.md)
- [SvSwitchButton](../ui-components/sv-switch-button.md)
