<script lang="ts" module>
  /**
   * Centered contact form block - a heading and one line of copy over a short
   * contact form: name and email (SvTextInput), a topic (SvDropDownList), the
   * message (SvTextArea with a character counter) and a required privacy
   * SvCheckBox. Send validates every field, shows the SvButton loading state,
   * then swaps the form for a sent confirmation. Pure UI-kit, --sg-* themed.
   *
   * Headless: createContactForm() below owns the fields, validation, submit
   * flow and sent state with no markup. The component under it is one styled
   * render of that core; import createContactForm from this file (or `npx
   * @svgrid/ui add contact-centered --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  type ContactTopic = { value: string; label: string }
  type ContactValues = { name: string; email: string; topic: string; message: string; privacy: boolean }
  type ContactField = keyof ContactValues
  type ContactErrors = Partial<Record<ContactField, string>>
  type ContactFormOptions = {
    topics?: ContactTopic[]
    /** Minimum message length. Default 20. */
    minMessage?: number
    /** Called with valid values; throw (or reject) to keep the form open. */
    onSubmit?: (values: ContactValues) => Promise<void> | void
    /** Called when a submit fails validation. */
    onInvalid?: (errors: ContactErrors) => void
  }

  const DEFAULT_TOPICS: ContactTopic[] = [
    { value: 'sales', label: 'Pricing and plans' },
    { value: 'support', label: 'Help with my workspace' },
    { value: 'billing', label: 'Billing and invoices' },
    { value: 'other', label: 'Something else' },
  ]

  export function createContactForm(opts: ContactFormOptions = {}) {
    const topics = opts.topics ?? DEFAULT_TOPICS
    const minMessage = opts.minMessage ?? 20
    let name = $state('')
    let email = $state('')
    let topic = $state<string | null>(null)
    let message = $state('')
    let privacy = $state(false)
    let errors = $state<ContactErrors>({})
    let busy = $state(false)
    let sentTo = $state('')

    function validate(): boolean {
      const e: ContactErrors = {}
      if (!name.trim()) e.name = 'Tell us your name.'
      if (!EMAIL_RE.test(email.trim())) e.email = 'Enter a valid email, like name@company.com.'
      if (topic == null) e.topic = 'Pick a topic so the right team reads it.'
      if (message.trim().length < minMessage) e.message = `Write at least ${minMessage} characters.`
      if (!privacy) e.privacy = 'Accept the privacy policy to send.'
      errors = e
      return Object.keys(e).length === 0
    }

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (busy) return
      if (!validate()) { opts.onInvalid?.(errors); return }
      busy = true
      const values: ContactValues = { name: name.trim(), email: email.trim(), topic: topic!, message: message.trim(), privacy }
      try {
        await opts.onSubmit?.(values)
        sentTo = values.email
      } catch {
        // Keep the form and its values so the user can retry.
      } finally {
        busy = false
      }
    }

    function reset() {
      name = ''; email = ''; topic = null; message = ''; privacy = false; errors = {}; sentTo = ''
    }

    const text = { name: () => name, email: () => email, message: () => message }

    return {
      topics,
      get name() { return name },
      set name(v: string) { name = v; errors.name = undefined },
      get email() { return email },
      set email(v: string) { email = v; errors.email = undefined },
      get topic() { return topic },
      set topic(v: string | null) { topic = v; errors.topic = undefined },
      get message() { return message },
      set message(v: string) { message = v; errors.message = undefined },
      get privacy() { return privacy },
      set privacy(v: boolean) { privacy = v; errors.privacy = undefined },
      get errors() { return errors },
      get busy() { return busy },
      /** The address the last message was sent from; empty until a send succeeds. */
      get sentTo() { return sentTo },
      validate,
      /** Show field errors returned by the server (e.g. from fail(400, { errors })). */
      setErrors: (e: ContactErrors) => { errors = e },
      submit,
      reset,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on a plain <input>/<textarea> when you render your own fields. */
      fieldProps: (field: 'name' | 'email' | 'message') => ({
        name: field,
        value: text[field](),
        oninput: (e: Event) => {
          const v = (e.currentTarget as HTMLInputElement).value
          if (field === 'name') name = v; else if (field === 'email') email = v; else message = v
          errors[field] = undefined
        },
        'aria-invalid': errors[field] ? ('true' as const) : undefined,
      }),
    }
  }

  export type { ContactTopic, ContactValues, ContactField, ContactErrors, ContactFormOptions };
  export { DEFAULT_TOPICS };
</script>

<script lang="ts">
  import {
    SvTextInput, SvTextArea, SvDropDownList, SvCheckBox, SvButton, SvToaster, toast,
  } from '@svgrid/grid'

  const contact = createContactForm({
    onInvalid: () => toast.warning('Check the highlighted fields'),
    // Replace with your request (or a SvelteKit form action); a throw keeps the form.
    onSubmit: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 1100)), {
        loading: 'Sending your message...',
        success: 'Message sent',
        error: 'Could not send. Try again in a minute.',
      }),
  })
</script>

<main class="sv-contact-centered">
  <div class="sv-contact-centered-inner">
    <header class="sv-contact-centered-head">
      <h1>Contact Northwind</h1>
      <p>Questions about plans, your workspace or an invoice. We reply within one business day.</p>
    </header>

    {#if contact.sentTo}
      <section class="sv-contact-centered-panel sv-contact-centered-sent" aria-live="polite">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7.5 12.5l3 3 6-6.5" /></svg>
        <h2>Thanks, we have your message</h2>
        <p>A copy is on its way to <strong>{contact.sentTo}</strong>. Reply to that email to add details.</p>
        <SvButton variant="outline" onclick={contact.reset}>Send another message</SvButton>
      </section>
    {:else}
      <form class="sv-contact-centered-panel sv-contact-centered-form" {...contact.formProps()}>
        <div class="sv-contact-centered-two">
          <SvTextInput label="Name" name="name" autocomplete="name" placeholder="Ada Lovelace" block required
            bind:value={contact.name} error={contact.errors.name} invalid={!!contact.errors.name} />
          <SvTextInput label="Email" name="email" type="email" autocomplete="email" placeholder="name@company.com" block required
            bind:value={contact.email} error={contact.errors.email} invalid={!!contact.errors.email} />
        </div>
        <SvDropDownList label="Topic" name="topic" placeholder="Choose a topic" options={contact.topics} value={contact.topic} block required
          error={contact.errors.topic} invalid={!!contact.errors.topic} onChange={(v) => (contact.topic = String(v))} />
        <SvTextArea label="Message" name="message" rows={5} maxlength={1000} showCount block required
          placeholder="What can we help with?" bind:value={contact.message}
          error={contact.errors.message} invalid={!!contact.errors.message} />
        <SvCheckBox name="privacy" checked={contact.privacy} required error={contact.errors.privacy} invalid={!!contact.errors.privacy}
          onChange={(v) => (contact.privacy = v)}>
          I agree that Northwind stores this message to answer it, as described in the privacy policy.
        </SvCheckBox>
        <!-- Honeypot: hidden from people and screen readers; bots that fill it get dropped server-side. -->
        <div class="sv-contact-centered-hp" aria-hidden="true">
          <label for="sv-contact-centered-website">Website</label>
          <input id="sv-contact-centered-website" name="website" type="text" tabindex="-1" autocomplete="off" />
        </div>
        <SvButton type="submit" variant="primary" block loading={contact.busy}>Send message</SvButton>
      </form>
    {/if}
  </div>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-contact-centered {
    width: 100%; box-sizing: border-box; min-height: 560px;
    display: flex; justify-content: center; padding: 48px 24px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-contact-centered-inner { width: 100%; max-width: 560px; display: flex; flex-direction: column; gap: 24px; }
  .sv-contact-centered-head { text-align: center; }
  .sv-contact-centered-head h1 { margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
  .sv-contact-centered-head p { margin: 0 auto; max-width: 46ch; font-size: 14.5px; line-height: 1.55; color: var(--sg-muted, #64748b); }
  .sv-contact-centered-panel {
    position: relative; box-sizing: border-box; padding: 28px; background: var(--sg-bg, #fff);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-contact-centered-form { display: flex; flex-direction: column; gap: 16px; }
  .sv-contact-centered-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .sv-contact-centered-two > :global(*) { min-width: 0; }
  .sv-contact-centered-hp { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
  .sv-contact-centered-sent { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 40px 28px; }
  .sv-contact-centered-sent svg { display: block; width: 44px; height: 44px; margin-bottom: 4px; }
  .sv-contact-centered-sent circle { fill: color-mix(in srgb, var(--sg-success, #16a34a) 16%, transparent); }
  .sv-contact-centered-sent path { fill: none; stroke: var(--sg-success, #16a34a); stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .sv-contact-centered-sent h2 { margin: 0; font-size: 19px; font-weight: 650; }
  .sv-contact-centered-sent p { margin: 0 0 8px; font-size: 14px; line-height: 1.5; color: var(--sg-muted, #64748b); overflow-wrap: anywhere; }

  @media (max-width: 560px) {
    .sv-contact-centered { padding: 28px 16px; }
    .sv-contact-centered-head h1 { font-size: 23px; }
    .sv-contact-centered-panel { padding: 20px 16px; }
    .sv-contact-centered-two { grid-template-columns: 1fr; }
  }
</style>
