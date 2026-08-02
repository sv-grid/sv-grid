<script lang="ts">
  /**
   * SvForm as a multi-step WIZARD: group fields into titled `FormSection`s and set
   * `stepper` - each section becomes a validated step with Back / Next (Next is
   * gated on that step's validation) and a Submit on the final step. Drop the
   * `stepper` prop and the same schema renders as stacked fieldsets instead.
   */
  import { SvForm, rules } from '@svgrid/grid'
  import type { FormEntry } from '@svgrid/grid'

  const schema: FormEntry[] = [
    { section: 'Account', description: 'How you sign in.', fields: [
      { name: 'email', label: 'Work email', type: 'email', required: true, full: true, rules: [rules.email()] },
      { name: 'password', label: 'Password', type: 'password', required: true,
        rules: [rules.minLength(8), rules.pattern(/\d/, { message: 'Include a number' })] },
      { name: 'confirm', label: 'Confirm', type: 'password', required: true,
        rules: [rules.compare('password', '===', { message: 'Passwords do not match' })] },
    ] },
    { section: 'Profile', description: 'Tell us about you.', columns: 2, fields: [
      { name: 'firstName', label: 'First name', required: true },
      { name: 'lastName', label: 'Last name', required: true },
      { name: 'role', label: 'Role', type: 'select', required: true, full: true, options: [
        { value: 'dev', label: 'Developer' }, { value: 'design', label: 'Designer' }, { value: 'pm', label: 'Product manager' },
      ] },
      { name: 'bio', label: 'Short bio', type: 'textarea', full: true },
    ] },
    { section: 'Preferences', fields: [
      { name: 'newsletter', label: 'Send me product updates', type: 'switch' },
      { name: 'experience', label: 'Rate your Svelte experience', type: 'rating', full: true },
    ] },
  ]

  let result = $state<string>('')
  async function finish(values: Record<string, unknown>) {
    await new Promise((r) => setTimeout(r, 800))
    result = JSON.stringify(values, null, 2)
  }
</script>

<div class="wrap">
  <header>
    <h2>Wizard form</h2>
    <p>
      Sections become validated steps. Next only advances when the current step is
      valid; the last step submits (async, with a loading button). The same schema
      without <code>stepper</code> renders as stacked sections.
    </p>
  </header>

  <div class="card">
    <SvForm
      fields={schema}
      stepper
      columns={2}
      submitLabel="Create account"
      initial={{ role: 'dev', experience: 3 }}
      onSubmit={finish}
    />
  </div>

  {#if result}
    <pre class="result">{result}</pre>
  {/if}
</div>

<style>
  .wrap { padding: 20px; max-width: 640px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .card { padding: 20px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
  .result { margin: 0; padding: 14px; background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; font-size: 12px; overflow: auto; }
</style>
