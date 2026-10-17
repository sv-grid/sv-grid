<script lang="ts" module>
  /**
   * Contact with support hours block - a support request form (SvTextInput,
   * SvTextArea, a priority SvSegmented and a submit SvButton) beside a hours
   * panel: the weekly hours table with today highlighted, an SvBadge that
   * reads "Open now" or "Opens at 9:00" from the viewer's clock, and the
   * expected response time per channel. Changing the priority changes the
   * promised times in the panel and in the confirmation toast.
   * Pure UI-kit, --sg-* themed.
   *
   * Headless: createSupportRequest() below owns the hours, the open-now
   * status, the response times per priority and the ticket form with no
   * markup. The component under it is one styled render of that core; import
   * createSupportRequest from this file (or `npx @svgrid/ui add contact-hours
   * --headless` for the core alone) to draw your own.
   */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

  type Priority = 'low' | 'normal' | 'urgent'
  /** [open, close] in minutes after local midnight; null = closed. Index 0 = Sunday. */
  type WeekHours = ([number, number] | null)[]
  type ResponseTime = { channel: string; times: Record<Priority, string> }
  type TicketValues = { name: string; email: string; subject: string; message: string; priority: Priority }
  type TicketErrors = Partial<Record<'name' | 'email' | 'subject' | 'message', string>>
  type SupportRequestOptions = {
    hours?: WeekHours
    response?: ResponseTime[]
    /** Called with valid values; throw (or reject) to keep the subject and message. */
    onSubmit?: (values: TicketValues) => Promise<unknown> | void
    onInvalid?: (errors: TicketErrors) => void
    now?: () => Date
  }

  const DEFAULT_HOURS: WeekHours = [null, [480, 1200], [480, 1200], [480, 1200], [480, 1200], [480, 1080], [600, 960]]
  const DEFAULT_RESPONSE: ResponseTime[] = [
    { channel: 'Email', times: { low: '2 business days', normal: '8 business hours', urgent: '2 hours' } },
    { channel: 'Live chat', times: { low: '1 hour', normal: '15 minutes', urgent: '5 minutes' } },
    { channel: 'Phone', times: { low: 'Not offered', normal: 'Not offered', urgent: 'Answered live' } },
  ]
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const hhmm = (m: number) => `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`

  export function createSupportRequest(opts: SupportRequestOptions = {}) {
    const hours = opts.hours ?? DEFAULT_HOURS
    const response = opts.response ?? DEFAULT_RESPONSE
    const clock = opts.now ?? (() => new Date())
    let now = $state(clock())
    let name = $state('')
    let email = $state('')
    let subject = $state('')
    let message = $state('')
    let priority = $state<Priority>('normal')
    let errors = $state<TicketErrors>({})
    let busy = $state(false)

    const status = $derived.by(() => {
      const day = now.getDay()
      const mins = now.getHours() * 60 + now.getMinutes()
      const today = hours[day]
      if (today && mins >= today[0] && mins < today[1]) return { open: true, text: `Open now, until ${hhmm(today[1])}` }
      if (today && mins < today[0]) return { open: false, text: `Opens at ${hhmm(today[0])}` }
      for (let i = 1; i <= 7; i++) {
        const h = hours[(day + i) % 7]
        if (h) return { open: false, text: `Opens ${i === 1 ? 'tomorrow' : DAY_NAMES[(day + i) % 7]} at ${hhmm(h[0])}` }
      }
      return { open: false, text: 'Closed' }
    })
    // Monday first, as a table reads.
    const week = $derived([1, 2, 3, 4, 5, 6, 0].map((d) => {
      const h = hours[d]
      return { day: DAY_NAMES[d]!, today: d === now.getDay(), text: h ? `${hhmm(h[0])} - ${hhmm(h[1])}` : 'Closed' }
    }))
    const promised = $derived(response.map((r) => ({ channel: r.channel, time: r.times[priority], offered: r.times[priority] !== 'Not offered' })))

    function validate(): boolean {
      errors = {
        name: name.trim() ? undefined : 'Enter your name.',
        email: EMAIL_RE.test(email.trim()) ? undefined : 'Enter a valid email.',
        subject: subject.trim() ? undefined : 'Add a short subject.',
        message: message.trim().length >= 20 ? undefined : 'Describe the problem in at least 20 characters.',
      }
      return !Object.values(errors).some(Boolean)
    }

    async function submit(ev?: Event) {
      ev?.preventDefault()
      if (busy) return
      if (!validate()) { opts.onInvalid?.(errors); return }
      busy = true
      try {
        await opts.onSubmit?.({ name: name.trim(), email: email.trim(), subject: subject.trim(), message: message.trim(), priority })
        subject = ''; message = ''
      } catch {
        // Keep the ticket text for a retry.
      } finally {
        busy = false
      }
    }

    /** Re-read the clock each minute. Returns the cleanup; call it on unmount. */
    function start(): () => void {
      const t = setInterval(() => (now = clock()), 60_000)
      return () => clearInterval(t)
    }

    return {
      get status() { return status },
      get week() { return week },
      get promised() { return promised },
      get name() { return name },
      set name(v: string) { name = v; errors.name = undefined },
      get email() { return email },
      set email(v: string) { email = v; errors.email = undefined },
      get subject() { return subject },
      set subject(v: string) { subject = v; errors.subject = undefined },
      get message() { return message },
      set message(v: string) { message = v; errors.message = undefined },
      get priority() { return priority },
      set priority(v: Priority) { priority = v },
      get errors() { return errors },
      get busy() { return busy },
      validate,
      submit,
      start,
      /** Spread on your <form>. */
      formProps: () => ({ novalidate: true, onsubmit: submit }),
      /** Spread on a priority radio <input> when you render your own. */
      priorityProps: (p: Priority) => ({
        type: 'radio' as const,
        name: 'priority',
        value: p,
        checked: priority === p,
        onchange: () => (priority = p),
      }),
    }
  }

  export type { Priority, WeekHours, ResponseTime, TicketValues, TicketErrors, SupportRequestOptions };
  export { DEFAULT_HOURS, DEFAULT_RESPONSE, hhmm };
</script>

<script lang="ts">
  import { SvTextInput, SvTextArea, SvSegmented, SvButton, SvBadge, SvToaster, toast } from '@svgrid/grid'

  let ticket = 4820
  const support = createSupportRequest({
    onInvalid: () => toast.warning('Check the highlighted fields'),
    // Replace with your request; resolve with the ticket id your API returns.
    onSubmit: (v) => {
      const promise = DEFAULT_RESPONSE[0]!.times[v.priority]
      return toast.promise(new Promise<number>((res) => setTimeout(() => res(++ticket), 1000)), {
        loading: 'Opening a ticket...',
        success: (id) => `Ticket #${id} opened. Expect an email reply within ${promise}.`,
        error: 'Could not open the ticket.',
      })
    },
  })
  $effect(() => support.start())

  const priorities = [{ value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }]
  const setPriority = (v: string | number) => (support.priority = v === 'low' || v === 'urgent' ? v : 'normal')
</script>

<main class="sv-contact-hours">
  <form class="sv-contact-hours-form" {...support.formProps()}>
    <h1>Contact support</h1>
    <p class="sv-contact-hours-lead">Lumen support answers in your language, from teams in three regions.</p>
    <div class="sv-contact-hours-two">
      <SvTextInput label="Name" name="name" autocomplete="name" block required bind:value={support.name}
        error={support.errors.name} invalid={!!support.errors.name} />
      <SvTextInput label="Email" name="email" type="email" autocomplete="email" block required bind:value={support.email}
        error={support.errors.email} invalid={!!support.errors.email} />
    </div>
    <SvSegmented label="Priority" name="priority" block value={support.priority} onChange={setPriority} options={priorities}
      hint={support.priority === 'urgent' ? 'Urgent: production is down or data is at risk.' : 'Use Urgent only when work is blocked.'} />
    <SvTextInput label="Subject" name="subject" placeholder="Bookings page shows no slots" block required bind:value={support.subject}
      error={support.errors.subject} invalid={!!support.errors.subject} />
    <SvTextArea label="What happened?" name="message" rows={5} maxlength={2000} showCount block required bind:value={support.message}
      error={support.errors.message} invalid={!!support.errors.message} />
    <SvButton type="submit" variant="primary" block loading={support.busy}>Open ticket</SvButton>
  </form>

  <aside class="sv-contact-hours-panel" aria-labelledby="sv-contact-hours-title">
    <div class="sv-contact-hours-status">
      <h2 id="sv-contact-hours-title">Support hours</h2>
      <SvBadge variant={support.status.open ? 'success' : 'neutral'} dot>{support.status.text}</SvBadge>
    </div>
    <table class="sv-contact-hours-week">
      <caption>Times are in your local timezone.</caption>
      <tbody>
        {#each support.week as w (w.day)}
          <tr class:sv-contact-hours-today={w.today}>
            <th scope="row">{w.day}</th>
            <td>{w.text}</td>
          </tr>
        {/each}
      </tbody>
    </table>

    <h3>Response times, {support.priority} priority</h3>
    <dl class="sv-contact-hours-resp">
      {#each support.promised as r (r.channel)}
        <div>
          <dt>{r.channel}</dt>
          <dd class:sv-contact-hours-off={!r.offered}>{r.time}</dd>
        </div>
      {/each}
    </dl>
  </aside>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-contact-hours {
    width: 100%; box-sizing: border-box; min-height: 560px; padding: 40px 32px;
    display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 32px; align-items: start;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .sv-contact-hours-form { display: flex; flex-direction: column; gap: 16px; }
  .sv-contact-hours-form h1 { margin: 0; font-size: 26px; font-weight: 700; letter-spacing: -.02em; }
  .sv-contact-hours-lead { margin: -8px 0 4px; font-size: 14px; color: var(--sg-muted, #64748b); }
  .sv-contact-hours-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .sv-contact-hours-two > :global(*) { min-width: 0; }

  .sv-contact-hours-panel {
    padding: 22px; box-sizing: border-box; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 3%, var(--sg-bg, #fff));
  }
  .sv-contact-hours-status { display: flex; align-items: center; justify-content: space-between; gap: 8px 12px; flex-wrap: wrap; margin-bottom: 14px; }
  .sv-contact-hours-panel h2 { margin: 0; font-size: 17px; font-weight: 650; }
  .sv-contact-hours-panel h3 { margin: 22px 0 10px; font-size: 13px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .sv-contact-hours-week { width: 100%; border-collapse: collapse; font-size: 13.5px; }
  .sv-contact-hours-week caption { caption-side: bottom; text-align: left; padding-top: 8px; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-contact-hours-week th, .sv-contact-hours-week td { padding: 7px 10px; border-bottom: 1px solid var(--sg-border, #e2e8f0); }
  .sv-contact-hours-week th { text-align: left; font-weight: 500; }
  .sv-contact-hours-week td { text-align: right; font-variant-numeric: tabular-nums; color: var(--sg-muted, #64748b); }
  .sv-contact-hours-week tr.sv-contact-hours-today th,
  .sv-contact-hours-week tr.sv-contact-hours-today td { font-weight: 650; color: var(--sg-fg, #0f172a); background: color-mix(in srgb, var(--sg-fg, #0f172a) 6%, transparent); }
  .sv-contact-hours-resp { margin: 0; display: flex; flex-direction: column; gap: 8px; }
  .sv-contact-hours-resp div {
    display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; font-size: 13.5px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 8px);
  }
  .sv-contact-hours-resp dt { font-weight: 500; }
  .sv-contact-hours-resp dd { margin: 0; font-weight: 600; text-align: right; }
  .sv-contact-hours-resp dd.sv-contact-hours-off { font-weight: 400; color: var(--sg-muted, #64748b); }

  @media (max-width: 860px) {
    .sv-contact-hours { grid-template-columns: minmax(0, 1fr); padding: 28px 16px; gap: 24px; }
    .sv-contact-hours-form h1 { font-size: 23px; }
    .sv-contact-hours-two { grid-template-columns: 1fr; }
    .sv-contact-hours-panel { padding: 18px 16px; }
  }
</style>
