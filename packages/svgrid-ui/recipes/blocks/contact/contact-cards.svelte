<script lang="ts" module>
  /**
   * Contact cards block - four ways to reach the company (Sales, Support,
   * Press, Partnerships). Each card has an inline-SVG icon, one line, an email
   * link and an action SvButton. "Book a demo" opens an SvModal with a short
   * form (SvTextInput, SvDropDownList) that validates, shows the loading state
   * and marks the Sales card with an SvBadge once sent; the other actions
   * confirm through a toast. Pure UI-kit, --sg-* themed.
   *
   * Headless: createContactChannels() below owns the channel list, the demo
   * dialog's open state, its form, validation and booking flow with no markup.
   * The component under it is one styled render of that core; import
   * createContactChannels from this file (or `npx @svgrid/ui add contact-cards
   * --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  type ContactChannel = {
    id: string
    title: string
    line: string
    email: string
    action: string
    /** SVG path data for a 24x24 stroke icon. */
    icon: string
    /** True for the channel whose action opens the booking dialog. */
    books?: boolean
  }
  type BookingValues = { name: string; email: string; size: string }
  type BookingErrors = Partial<Record<keyof BookingValues, string>>
  type ContactChannelsOptions = {
    channels?: ContactChannel[]
    teamSizes?: { value: string; label: string }[]
    /** Called for every channel action except the booking one. */
    onAction?: (channel: ContactChannel) => void
    /** Called with a valid booking; throw (or reject) to keep the dialog open. */
    onBook?: (values: BookingValues) => Promise<void> | void
  }

  const DEFAULT_CHANNELS: ContactChannel[] = [
    { id: 'sales', title: 'Sales', line: 'Pricing, volume licences and a walkthrough with your own data.', email: 'sales@acme.io', action: 'Book a demo', icon: 'M4 19V9m6 10V5m6 14v-7m4 7H3', books: true },
    { id: 'support', title: 'Support', line: 'Something broken or confusing in your workspace? Median first reply: 2 hours.', email: 'support@acme.io', action: 'Start a chat', icon: 'M4 5h16v11H9l-5 4z' },
    { id: 'press', title: 'Press', line: 'Interviews, product news and logos for publication.', email: 'press@acme.io', action: 'Get the press kit', icon: 'M5 4h11l3 3v13H5zM8 10h8M8 14h8M8 18h5' },
    { id: 'partners', title: 'Partnerships', line: 'Resellers, agencies and data-source integrations.', email: 'partners@acme.io', action: 'Apply as a partner', icon: 'M8 12l3 3 5-5M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0' },
  ]
  const DEFAULT_TEAM_SIZES = [
    { value: '1-10', label: '1-10 people' },
    { value: '11-50', label: '11-50 people' },
    { value: '51-250', label: '51-250 people' },
    { value: '250+', label: 'More than 250' },
  ]

  export function createContactChannels(opts: ContactChannelsOptions = {}) {
    const channels = opts.channels ?? DEFAULT_CHANNELS
    const teamSizes = opts.teamSizes ?? DEFAULT_TEAM_SIZES
    let open = $state(false)
    let name = $state('')
    let email = $state('')
    let size = $state<string | null>(null)
    let errors = $state<BookingErrors>({})
    let busy = $state(false)
    let booked = $state('')

    function act(c: ContactChannel) {
      if (c.books) { errors = {}; open = true }
      else opts.onAction?.(c)
    }

    function validate(): boolean {
      errors = {
        name: name.trim() ? undefined : 'Enter your name.',
        email: EMAIL_RE.test(email.trim()) ? undefined : 'Enter a work email.',
        size: size == null ? 'Pick your team size.' : undefined,
      }
      return !errors.name && !errors.email && !errors.size
    }

    async function book(ev?: Event) {
      ev?.preventDefault()
      if (busy || !validate()) return
      busy = true
      const values: BookingValues = { name: name.trim(), email: email.trim(), size: size! }
      try {
        await opts.onBook?.(values)
        booked = values.email; open = false
        name = ''; email = ''; size = null
      } catch {
        // Leave the dialog open with the values for a retry.
      } finally {
        busy = false
      }
    }

    return {
      channels,
      teamSizes,
      get open() { return open },
      set open(v: boolean) { open = v },
      get name() { return name },
      set name(v: string) { name = v; errors.name = undefined },
      get email() { return email },
      set email(v: string) { email = v; errors.email = undefined },
      get size() { return size },
      set size(v: string | null) { size = v; errors.size = undefined },
      get errors() { return errors },
      get busy() { return busy },
      /** Email of the last successful booking; empty until one succeeds. */
      get booked() { return booked },
      act,
      book,
      close: () => { if (!busy) open = false },
      /** Spread on a channel's action <button>. */
      actionProps: (c: ContactChannel) => ({
        type: 'button' as const,
        onclick: () => act(c),
        'aria-haspopup': c.books ? ('dialog' as const) : undefined,
      }),
      /** Spread on the booking <form>. */
      formProps: () => ({ novalidate: true, onsubmit: book }),
    }
  }

  export type { ContactChannel, BookingValues, BookingErrors, ContactChannelsOptions };
  export { DEFAULT_CHANNELS, DEFAULT_TEAM_SIZES };
</script>

<script lang="ts">
  import {
    SvButton, SvModal, SvTextInput, SvDropDownList, SvBadge, SvToaster, toast,
  } from '@svgrid/grid'

  const contact = createContactChannels({
    // Wire these to your chat widget, file download and partner form.
    onAction: (c) => {
      if (c.id === 'support') toast.info('Chat opened. Ana from support will join in about 2 minutes.')
      else if (c.id === 'press') toast('Downloading the press kit: logos, screenshots and fact sheet')
      else toast('Opening the partner application')
    },
    // Replace with your request; a throw keeps the dialog open.
    onBook: () =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 900)), {
        loading: 'Requesting a demo...',
        success: 'Demo requested. Pick a time from the email we just sent.',
        error: 'Could not send the request.',
      }),
  })
</script>

<main class="sv-contact-cards">
  <header class="sv-contact-cards-head">
    <h1>How can we help?</h1>
    <p>Pick the team that fits. Each inbox is read by people, not a ticket bot.</p>
  </header>

  <div class="sv-contact-cards-grid">
    {#each contact.channels as c (c.id)}
      <article class="sv-contact-cards-item">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d={c.icon} /></svg>
        <div class="sv-contact-cards-title">
          <h2>{c.title}</h2>
          {#if c.books && contact.booked}<SvBadge variant="success" size="sm">Demo requested</SvBadge>{/if}
        </div>
        <p>{c.line}</p>
        <a href="mailto:{c.email}">{c.email}</a>
        <div class="sv-contact-cards-cta">
          <SvButton variant={c.books ? 'primary' : 'outline'} block onclick={() => contact.act(c)}>{c.action}</SvButton>
        </div>
      </article>
    {/each}
  </div>
</main>

<SvModal bind:open={contact.open} title="Book a demo" size="sm">
  <form class="sv-contact-cards-form" {...contact.formProps()}>
    <p>A 30-minute call with a product specialist. We send times that suit your timezone.</p>
    <SvTextInput label="Name" name="name" autocomplete="name" block required bind:value={contact.name}
      error={contact.errors.name} invalid={!!contact.errors.name} />
    <SvTextInput label="Work email" name="email" type="email" autocomplete="email" block required bind:value={contact.email}
      error={contact.errors.email} invalid={!!contact.errors.email} />
    <SvDropDownList label="Team size" name="size" placeholder="Choose a size" options={contact.teamSizes} value={contact.size} block required
      error={contact.errors.size} invalid={!!contact.errors.size} onChange={(v) => (contact.size = String(v))} />
    <div class="sv-contact-cards-form-actions">
      <SvButton variant="ghost" onclick={contact.close} disabled={contact.busy}>Cancel</SvButton>
      <SvButton type="submit" variant="primary" loading={contact.busy}>Request demo</SvButton>
    </div>
  </form>
</SvModal>

<SvToaster position="bottom-right" />

<style>
  .sv-contact-cards {
    width: 100%; box-sizing: border-box; min-height: 520px; padding: 48px 32px;
    display: flex; flex-direction: column; gap: 28px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
    color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-contact-cards-head { text-align: center; }
  .sv-contact-cards-head h1 { margin: 0 0 8px; font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
  .sv-contact-cards-head p { margin: 0; font-size: 14.5px; color: var(--sg-muted, #64748b); }
  .sv-contact-cards-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; width: 100%; max-width: 1120px; margin: 0 auto; }
  .sv-contact-cards-item {
    display: flex; flex-direction: column; gap: 8px; padding: 22px; box-sizing: border-box;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-contact-cards-item svg {
    display: block; box-sizing: content-box; width: 22px; height: 22px; padding: 9px; margin-bottom: 6px; border-radius: var(--sg-radius, 8px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, var(--sg-bg, #fff));
    fill: none; stroke: var(--sg-fg, #0f172a); stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round;
  }
  .sv-contact-cards-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sv-contact-cards-title h2 { margin: 0; font-size: 16px; font-weight: 650; }
  .sv-contact-cards-item p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-contact-cards-item a { font-size: 13.5px; color: var(--sg-fg, #0f172a); overflow-wrap: anywhere; text-underline-offset: 3px; }
  .sv-contact-cards-cta { margin-top: auto; padding-top: 10px; }
  .sv-contact-cards-form { display: flex; flex-direction: column; gap: 14px; }
  .sv-contact-cards-form p { margin: 0; font-size: 13.5px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .sv-contact-cards-form-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 4px; }

  @media (max-width: 980px) {
    .sv-contact-cards-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 560px) {
    .sv-contact-cards { padding: 28px 16px; }
    .sv-contact-cards-head h1 { font-size: 23px; }
    .sv-contact-cards-grid { grid-template-columns: minmax(0, 1fr); }
  }
</style>
