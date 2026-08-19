<script lang="ts">
  /**
   * SvForm rich field types - a schema-driven form that now reaches the whole
   * input suite: phone, country, mask, combobox, radio, slider, tags, datetime
   * and file, plus per-field `help` text, a `readonly` field and column `span`.
   */
  import { SvForm, SvToaster, toast, type FormField } from '@svgrid/grid'

  const roles = [
    { value: 'admin', label: 'Administrator' },
    { value: 'editor', label: 'Editor' },
    { value: 'viewer', label: 'Viewer' },
  ]
  const plans = [
    { value: 'free', label: 'Free' },
    { value: 'pro', label: 'Pro' },
    { value: 'business', label: 'Business' },
    { value: 'enterprise', label: 'Enterprise' },
  ]

  const fields: FormField[] = [
    { name: 'name', label: 'Full name', required: true, span: 2 },
    { name: 'accountId', label: 'Account ID', type: 'text', readonly: true, help: 'Assigned automatically - cannot be changed.' },
    { name: 'phone', label: 'Phone', type: 'phone' },
    { name: 'country', label: 'Country', type: 'country' },
    { name: 'ssn', label: 'Tax ID', type: 'mask', mask: '###-##-####', placeholder: '000-00-0000', help: 'US format; the raw digits are stored.' },
    { name: 'role', label: 'Role', type: 'radio', options: roles, required: true },
    { name: 'plan', label: 'Plan', type: 'combobox', options: plans, placeholder: 'Choose a plan', required: true },
    { name: 'seats', label: 'Seats', type: 'slider', min: 1, max: 100, step: 1, help: 'Drag to set the seat count.' },
    { name: 'tags', label: 'Tags', type: 'tags', placeholder: 'Add a tag', span: 2 },
    { name: 'starts', label: 'Start date', type: 'datetime', span: 2 },
    { name: 'avatar', label: 'Avatar', type: 'file', accept: 'image/*', span: 2 },
    { name: 'notes', label: 'Notes', type: 'textarea', span: 2 },
  ]

  const initial = { accountId: 'ACC-4821', seats: 10, role: 'editor' }

  // Awaited (not returned) so the handler stays `Promise<void>` - SvForm keeps the
  // Submit button in its loading state until the toast promise settles.
  async function onSubmit(values: Record<string, unknown>) {
    await toast.promise(new Promise((res) => setTimeout(res, 900)), {
      loading: 'Creating account...', success: `Account created for ${values.name}`, error: 'Failed',
    })
  }
</script>

<div class="wrap">
  <h2>New account</h2>
  <p class="muted">Rich field types on a single SvForm schema.</p>
  <SvForm {fields} {initial} columns={2} submitLabel="Create account" errorSummary {onSubmit} />
</div>

<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 22px; max-width: 640px; }
  h2 { margin: 0; font-size: 19px; font-weight: 700; }
  .muted { margin: 3px 0 16px; color: var(--sg-muted, #64748b); font-size: 13px; }
</style>
