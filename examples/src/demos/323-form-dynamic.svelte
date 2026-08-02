<script lang="ts">
  /**
   * SvForm - a DYNAMIC form: fields appear/disable based on other values
   * (`visible` / `disabled` as `(values) => boolean`), an async `onSubmit` shows
   * a loading state, and a Reset button restores the initial values. Hidden
   * fields are skipped in validation and left out of the submitted payload.
   */
  import { SvForm, rules } from '@svgrid/grid'
  import type { FormField } from '@svgrid/grid'

  // Pretend server check: these usernames are "taken".
  const TAKEN = ['ada', 'grace', 'alan']
  async function usernameFree(v: string): Promise<string | null> {
    if (!v) return null
    await new Promise((r) => setTimeout(r, 600))
    return TAKEN.includes(v.trim().toLowerCase()) ? 'That username is taken' : null
  }

  const fields: FormField[] = [
    { name: 'username', label: 'Username', required: true, full: true,
      asyncValidate: usernameFree },
    { name: 'contact', label: 'Preferred contact', type: 'select', required: true, options: [
      { value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone' }, { value: 'none', label: 'Do not contact me' },
    ] },
    // Shown + required only for the matching contact method.
    { name: 'email', label: 'Email address', type: 'email', required: true, full: true,
      rules: [rules.email()], visible: (v) => v.contact === 'email' },
    { name: 'phone', label: 'Phone number', type: 'tel', required: true, full: true,
      visible: (v) => v.contact === 'phone' },
    { name: 'marketing', label: 'Send me product updates', type: 'switch' },
    // Appears only when marketing is on.
    { name: 'topics', label: 'Topics', type: 'select', full: true, visible: (v) => !!v.marketing, options: [
      { value: 'releases', label: 'Releases' }, { value: 'tips', label: 'Tips & tutorials' }, { value: 'events', label: 'Events' },
    ] },
    // Disabled when the user opted out of contact entirely.
    { name: 'notes', label: 'Anything else?', type: 'textarea', full: true,
      disabled: (v) => v.contact === 'none' },
  ]

  let result = $state<string>('')

  // Async submit: the button shows a loading state until this settles.
  async function save(values: Record<string, unknown>) {
    result = ''
    await new Promise((r) => setTimeout(r, 900))
    result = JSON.stringify(values, null, 2)
  }
</script>

<div class="wrap">
  <header>
    <h2>Dynamic form</h2>
    <p>
      Fields show, hide and disable from other values; <strong>Username</strong> runs an
      async "is it taken?" check (try <code>ada</code>); the submit button loads while an
      async save runs; Reset restores the start. Hidden fields skip validation and are
      left out of the payload - switch the contact method and watch the fields change.
    </p>
  </header>

  <div class="card">
    <SvForm
      {fields}
      columns={2}
      submitLabel="Save preferences"
      showReset
      initial={{ contact: 'email', marketing: false }}
      onSubmit={save}
    />
  </div>

  {#if result}
    <pre class="result">{result}</pre>
  {/if}
</div>

<style>
  .wrap { padding: 20px; max-width: 620px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .card { padding: 20px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
  .result { margin: 0; padding: 14px; background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; font-size: 12px; overflow: auto; }
</style>
