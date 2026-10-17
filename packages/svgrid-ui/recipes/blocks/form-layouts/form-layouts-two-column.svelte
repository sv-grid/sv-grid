<script lang="ts" module>
  /**
   * Two-column form block - a settings page split into Profile, Address and
   * Notifications sections. Each section has its title and explanation on the
   * left and its own form on the right (SvTextInput, SvTextArea,
   * SvDropDownList, SvCheckBox, SvRadioGroup) with a separate Save SvButton,
   * so saving one section never submits another. Below 760 px the columns
   * stack. Pure UI-kit, --sg-* themed.
   *
   * Headless: createAccountSettings() below owns the three sections' values,
   * per-section validation and save flow with no markup. The component under
   * it is one styled render of that core; import createAccountSettings from
   * this file (or `npx @svgrid/ui add form-layouts-two-column --headless` for
   * the core alone) to draw your own.
   */
  const SECTION_IDS = ['profile', 'address', 'notifications'] as const
  export type AccountSection = (typeof SECTION_IDS)[number]
  export type AccountProfile = { name: string; email: string; bio: string }
  export type AccountAddress = { country: string | number; street: string; city: string; postal: string }
  export type AccountNotify = { comments: boolean; mentions: boolean; digest: boolean; push: string | number }
  export type AccountSave =
    | { title: string; section: 'profile'; values: AccountProfile }
    | { title: string; section: 'address'; values: AccountAddress }
    | { title: string; section: 'notifications'; values: AccountNotify }
  export type AccountSettingsOptions = {
    profile?: AccountProfile
    address?: AccountAddress
    notify?: AccountNotify
    countries?: { value: string; label: string }[]
    pushModes?: { value: string; label: string }[]
    /** Called with one section's valid values; throw (or reject) to keep them unsaved. */
    onSave?: (save: AccountSave) => Promise<void> | void
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  const TITLES: Record<AccountSection, string> = { profile: 'Profile', address: 'Address', notifications: 'Notification preferences' }
  const SAMPLE_COUNTRIES = [
    { value: 'US', label: 'United States' }, { value: 'CA', label: 'Canada' },
    { value: 'GB', label: 'United Kingdom' }, { value: 'DE', label: 'Germany' },
    { value: 'NL', label: 'Netherlands' }, { value: 'AU', label: 'Australia' },
  ]
  const SAMPLE_PUSH = [
    { value: 'all', label: 'Everything' },
    { value: 'mentions', label: 'Mentions and direct messages' },
    { value: 'none', label: 'Nothing' },
  ]

  export function createAccountSettings(opts: AccountSettingsOptions = {}) {
    // Each section is its own form; saving one validates and sends only that one.
    const profile = $state<AccountProfile>({ ...(opts.profile ?? { name: 'Ada Lovelace', email: 'ada@lumen.dev', bio: 'Platform lead. Owns billing and the data pipeline.' }) })
    const address = $state<AccountAddress>({ ...(opts.address ?? { country: 'GB', street: '12 St James Square', city: 'London', postal: 'SW1Y 4JH' }) })
    const notify = $state<AccountNotify>({ ...(opts.notify ?? { comments: true, mentions: true, digest: false, push: 'mentions' }) })
    let errors = $state<Record<string, string>>({})
    let savedEmail = $state(profile.email)
    let busy = $state<AccountSection | null>(null)

    function check(section: AccountSection): boolean {
      const e: Record<string, string> = {}
      if (section === 'profile') {
        if (!profile.name.trim()) e.name = 'Enter your name.'
        if (!EMAIL_RE.test(profile.email.trim())) e.email = 'Enter a valid email, like name@company.com.'
      }
      if (section === 'address') {
        if (!address.street.trim()) e.street = 'Enter a street address.'
        if (!address.city.trim()) e.city = 'Enter a city.'
        if (!address.postal.trim()) e.postal = 'Enter a postal code.'
      }
      errors = e
      return Object.keys(e).length === 0
    }

    function payload(section: AccountSection): AccountSave {
      const title = TITLES[section]
      if (section === 'profile') return { section, title, values: $state.snapshot(profile) }
      if (section === 'address') return { section, title, values: $state.snapshot(address) }
      return { section, title, values: $state.snapshot(notify) }
    }

    async function save(section: AccountSection, ev?: Event) {
      ev?.preventDefault()
      if (busy || !check(section)) return
      busy = section
      try {
        await opts.onSave?.(payload(section))
        if (section === 'profile') savedEmail = profile.email.trim()
      } catch {
        // Values stay as typed; the user can save again.
      } finally {
        busy = null
      }
    }

    return {
      profile, address, notify,
      countries: opts.countries ?? SAMPLE_COUNTRIES,
      pushModes: opts.pushModes ?? SAMPLE_PUSH,
      titles: TITLES,
      get errors() { return errors },
      /** The email notifications go to: the last saved one, not the one being typed. */
      get savedEmail() { return savedEmail },
      get busy() { return busy },
      check, save,
      clear: (key: string) => { delete errors[key] },
      /** Spread on the <form> of one section. */
      formProps: (section: AccountSection) => ({ novalidate: true, onsubmit: (e: Event) => save(section, e) }),
    }
  }
</script>

<script lang="ts">
  import {
    SvTextInput, SvTextArea, SvDropDownList, SvCheckBox, SvRadioGroup, SvButton,
    SvToaster, toast,
  } from '@svgrid/grid'

  const settings = createAccountSettings({
    // Replace with your request per section; a thrown error keeps the values unsaved.
    onSave: ({ title }) =>
      toast.promise(new Promise<void>((res) => setTimeout(res, 800)), {
        loading: `Saving ${title.toLowerCase()}...`,
        success: `${title} saved`,
        error: 'Could not save. Try again.',
      }),
  })
</script>

<main class="sv-twocol">
  <h2>Account settings</h2>

  <section class="sv-twocol-row">
    <div class="sv-twocol-intro">
      <h3>Profile</h3>
      <p>Your name and bio appear on comments and in the member list. The email is where invoices and alerts go.</p>
    </div>
    <form class="sv-twocol-panel" {...settings.formProps('profile')}>
      <div class="sv-twocol-two">
        <SvTextInput label="Full name" name="name" bind:value={settings.profile.name} block required
          error={settings.errors.name} invalid={!!settings.errors.name} onChange={() => settings.clear('name')} />
        <SvTextInput label="Email" name="email" type="email" bind:value={settings.profile.email} block required
          error={settings.errors.email} invalid={!!settings.errors.email} onChange={() => settings.clear('email')} />
      </div>
      <SvTextArea label="Bio" name="bio" bind:value={settings.profile.bio} rows={3} maxlength={160} showCount block />
      <div class="sv-twocol-bar"><SvButton type="submit" loading={settings.busy === 'profile'}>Save profile</SvButton></div>
    </form>
  </section>

  <section class="sv-twocol-row">
    <div class="sv-twocol-intro">
      <h3>Address</h3>
      <p>Printed on invoices. Changing the country can change the tax we charge from the next invoice on.</p>
    </div>
    <form class="sv-twocol-panel" {...settings.formProps('address')}>
      <SvDropDownList label="Country" name="country" options={settings.countries} value={settings.address.country} block
        onChange={(v) => (settings.address.country = v)} />
      <SvTextInput label="Street address" name="street" bind:value={settings.address.street} block required
        error={settings.errors.street} invalid={!!settings.errors.street} onChange={() => settings.clear('street')} />
      <div class="sv-twocol-two">
        <SvTextInput label="City" name="city" bind:value={settings.address.city} block required
          error={settings.errors.city} invalid={!!settings.errors.city} onChange={() => settings.clear('city')} />
        <SvTextInput label="Postal code" name="postal" bind:value={settings.address.postal} block required
          error={settings.errors.postal} invalid={!!settings.errors.postal} onChange={() => settings.clear('postal')} />
      </div>
      <div class="sv-twocol-bar"><SvButton type="submit" loading={settings.busy === 'address'}>Save address</SvButton></div>
    </form>
  </section>

  <section class="sv-twocol-row">
    <div class="sv-twocol-intro">
      <h3>Notifications</h3>
      <p>Email goes to {settings.savedEmail}. Push goes to the Lumen app on your phone.</p>
    </div>
    <form class="sv-twocol-panel" {...settings.formProps('notifications')}>
      <fieldset>
        <legend>Email me about</legend>
        <SvCheckBox name="comments" checked={settings.notify.comments} onChange={(v) => (settings.notify.comments = v)}>Comments on my tasks</SvCheckBox>
        <SvCheckBox name="mentions" checked={settings.notify.mentions} onChange={(v) => (settings.notify.mentions = v)}>Mentions of me</SvCheckBox>
        <SvCheckBox name="digest" checked={settings.notify.digest} onChange={(v) => (settings.notify.digest = v)}>A weekly digest on Monday</SvCheckBox>
      </fieldset>
      <SvRadioGroup label="Push notifications" name="push" options={settings.pushModes} value={settings.notify.push}
        onChange={(v) => (settings.notify.push = v)} />
      <div class="sv-twocol-bar"><SvButton type="submit" loading={settings.busy === 'notifications'}>Save preferences</SvButton></div>
    </form>
  </section>
</main>

<SvToaster position="bottom-right" />

<style>
  .sv-twocol {
    flex: none; width: 100%;
    min-height: 560px; padding: 32px; box-sizing: border-box; max-width: 980px; margin: 0 auto;
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a);
  }
  h2 { font-weight: 700; margin: 0 0 8px; font-size: 22px; letter-spacing: -.01em; }
  .sv-twocol-row {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); gap: 32px;
    padding: 28px 0; border-bottom: 1px solid var(--sg-border, #e2e8f0);
  }
  .sv-twocol-row:last-child { border-bottom: 0; }
  .sv-twocol-intro h3 { font-weight: 600; margin: 0 0 6px; font-size: 15px; }
  .sv-twocol-intro p { margin: 0; font-size: 13px; line-height: 1.55; color: var(--sg-muted, #64748b); max-width: 34ch; }
  .sv-twocol-panel {
    display: flex; flex-direction: column; gap: 16px; padding: 20px;
    background: var(--sg-bg-subtle, #f8fafc);
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 12px);
  }
  .sv-twocol-two { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  fieldset { display: flex; flex-direction: column; gap: 8px; margin: 0; padding: 0; border: 0; min-width: 0; }
  legend { padding: 0; margin-bottom: 8px; font-size: 12.5px; font-weight: 550; }
  .sv-twocol-bar { display: flex; justify-content: flex-end; padding-top: 14px; border-top: 1px solid var(--sg-border, #e2e8f0); }

  @media (max-width: 760px) {
    .sv-twocol { padding: 20px 14px; }
    .sv-twocol-row { grid-template-columns: minmax(0, 1fr); gap: 14px; padding: 22px 0; }
    .sv-twocol-panel { padding: 16px; }
    .sv-twocol-two { grid-template-columns: minmax(0, 1fr); }
    .sv-twocol-bar { flex-wrap: wrap; }
  }
</style>
