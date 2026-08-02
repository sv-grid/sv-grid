<script lang="ts">
  /**
   * SvForm - a schema-driven signup form that wires the whole kit (text, email,
   * password, select, date, switch, rating) with required + cross-field custom
   * validation, in a responsive two-column grid. Copy-paste ready.
   */
  import { SvForm, rules } from '@svgrid/grid'
  import type { FormField } from '@svgrid/grid'

  // Declarative rules from the shared library - email / minLength / cross-field
  // compare - instead of hand-written closures.
  const fields: FormField[] = [
    { name: 'firstName', label: 'First name', required: true },
    { name: 'lastName', label: 'Last name', required: true },
    { name: 'email', label: 'Work email', type: 'email', required: true, full: true,
      rules: [rules.email()] },
    { name: 'password', label: 'Password', type: 'password', required: true,
      rules: [rules.minLength(8), rules.pattern(/\d/, { message: 'Include a number' })] },
    { name: 'confirm', label: 'Confirm password', type: 'password', required: true,
      rules: [rules.compare('password', '===', { message: 'Passwords do not match' })] },
    { name: 'role', label: 'Role', type: 'select', required: true, options: [
      { value: 'dev', label: 'Developer' }, { value: 'design', label: 'Designer' },
      { value: 'pm', label: 'Product manager' }, { value: 'other', label: 'Other' },
    ] },
    { name: 'startDate', label: 'Start date', type: 'date' },
    { name: 'newsletter', label: 'Send me product updates', type: 'switch' },
    { name: 'experience', label: 'Rate your Svelte experience', type: 'rating', full: true },
  ]

  let result = $state<string>('')
</script>

<div class="wrap">
  <header>
    <h2>Form</h2>
    <p>A schema-driven form: declare fields, get labels, the right control per type, required + custom (cross-field) validation and a gated submit.</p>
  </header>

  <div class="card">
    <SvForm {fields} columns={2} submitLabel="Create account"
      initial={{ role: 'dev', experience: 3 }}
      onSubmit={(v) => { result = JSON.stringify(v, null, 2) }} />
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
