# Contact blocks

Contact sections for a marketing site or an app's help page: a plain contact
form, cards per team, and a support form with opening hours. Each block is one
`.svelte` file built from `SvTextInput`, `SvTextArea`, `SvDropDownList`,
`SvSegmented`, `SvModal` and `SvButton`, themed from the `--sg-*` tokens.

## Installation

Add the whole group, or one block by its name (shown under each demo):

<div data-docs-add="add blocks/contact"></div>

See them first with `npx @svgrid/ui try blocks/contact`. No project needed.

## Centered contact form

A heading and one line over a form: name, email, a topic dropdown, a message
with a 1000-character counter and a required privacy checkbox. Send it empty to
see every field error; a valid send shows the button's loading state, then
replaces the form with a confirmation that names the reply address. The form
carries a hidden `website` honeypot field for the server to check.

<div data-docs-demo="610-block-contact-centered" data-height="720"></div>

`npx @svgrid/ui add contact-centered`

## Contact cards

Sales, Support, Press and Partnerships cards, each with an icon, one line, an
email link and a button. Book a demo opens an `SvModal` with name, work email and
team size; a sent request closes the dialog and marks the Sales card. Four cards
across, two below 980 px, one below 560 px.

<div data-docs-demo="612-block-contact-cards" data-height="560"></div>

`npx @svgrid/ui add contact-cards`

## Contact with support hours

A ticket form with a Low / Normal / Urgent priority next to a hours panel: the
week's hours with today highlighted, an "Open now" or "Opens at 8:00" badge
from the viewer's clock, and the reply time per channel. Changing the priority
changes the promised times, and the confirmation toast quotes the email time.

<div data-docs-demo="614-block-contact-hours" data-height="660"></div>

`npx @svgrid/ui add contact-hours`

## Handling the form in SvelteKit

Send contact mail from the server. A mail provider key in the browser is a key
anyone can use to send mail as you, and a client-side send skips your
validation. The pattern below posts the centered form to a form action, checks
every field again on the server, drops bots that fill the honeypot, and calls
the mail provider from server code.

Each block keeps its state in a core exported from its `<script module>`:
`createContactForm()`, `createContactChannels()` and `createSupportRequest()`.
They take your data and callbacks as options and fall back to the sample data.

The mail call lives in a server-only module, so its key never reaches the
browser bundle. This one is a stand-in for your provider's send endpoint:

```ts
// src/lib/server/mail.ts
import { env } from '$env/dynamic/private'

export async function sendMail(msg: { to: string; replyTo: string; subject: string; text: string }) {
  const res = await fetch('https://api.mail-provider.example/v1/send', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.MAIL_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: 'contact@northwind.io', ...msg }),
  })
  if (!res.ok) throw new Error(`Mail provider returned ${res.status}`)
}
```

The action reads the same names the block gives its fields. `SvTextInput`,
`SvTextArea` and `SvDropDownList` each render a hidden `<input>` with their
value when `name` is set, and `SvCheckBox` sends `true` when ticked:

```ts
// src/routes/contact/+page.server.ts
import { fail } from '@sveltejs/kit'
import type { Actions } from './$types'
import { sendMail } from '$lib/server/mail'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const TOPICS = new Set(['sales', 'support', 'billing', 'other'])

export const actions: Actions = {
  contact: async ({ request }) => {
    const data = await request.formData()
    // Honeypot: people never see this field. Answer as if it worked so the bot moves on.
    if (String(data.get('website') ?? '') !== '') return { sent: true }

    const name = String(data.get('name') ?? '').trim()
    const email = String(data.get('email') ?? '').trim()
    const topic = String(data.get('topic') ?? '')
    const message = String(data.get('message') ?? '').trim()

    const errors: Record<string, string> = {}
    if (!name || name.length > 100) errors.name = 'Tell us your name.'
    if (!EMAIL_RE.test(email)) errors.email = 'Enter a valid email, like name@company.com.'
    if (!TOPICS.has(topic)) errors.topic = 'Pick a topic so the right team reads it.'
    if (message.length < 20 || message.length > 1000) errors.message = 'Write between 20 and 1000 characters.'
    if (data.get('privacy') !== 'true') errors.privacy = 'Accept the privacy policy to send.'
    if (Object.keys(errors).length) return fail(400, { errors })

    try {
      await sendMail({ to: `${topic}@northwind.io`, replyTo: email, subject: `[${topic}] ${name}`, text: message })
    } catch {
      return fail(502, { errors: { message: 'We could not send that. Try again in a minute.' } })
    }
    return { sent: true }
  },
}
```

In the block's instance script, replace the `onSubmit` stand-in with a post to
the action. A failure result puts the server's messages under the fields
through `setErrors()`; the thrown error keeps the form and its values:

```svelte
<script lang="ts">
  import { deserialize } from '$app/forms'

  let formEl!: HTMLFormElement
  const contact = createContactForm({
    onSubmit: async () => {
      const res = await fetch('?/contact', {
        method: 'POST',
        headers: { accept: 'application/json' },
        body: new FormData(formEl),
      })
      const result = deserialize(await res.text())
      if (result.type === 'failure') contact.setErrors((result.data?.errors ?? {}) as ContactErrors)
      if (result.type !== 'success') throw new Error('Message not sent')
    },
  })
</script>

<form bind:this={formEl} {...contact.formProps()}>...</form>
```

The other forms follow the same shape: `onSubmit` in the support-hours block,
`onBook` for the demo dialog in the cards block. Each
throws to keep what the user typed. Add a rate limit per IP address in the
action as well; a honeypot stops simple bots, not a person pasting into the
form.

## See also

- [UI blocks overview](./index.md)
- [SvTextArea](../ui-components/sv-text-area.md)
- [SvModal](../ui-components/sv-modal.md)
