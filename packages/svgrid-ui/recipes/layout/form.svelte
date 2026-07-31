<script lang="ts">
  // SvForm - schema-driven form from a FormField[] with validation. Your copy, edit freely. Docs: https://www.svgrid.com/docs/help/ui-components/sv-form
  import { SvForm, type FormField } from '@svgrid/grid'

  const fields: FormField[] = [
    { name: 'name', label: 'Full name', required: true },
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'plan', label: 'Plan', type: 'select',
      options: [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }] },
    { name: 'agree', label: 'I accept the terms', type: 'checkbox' },
  ]
</script>

<SvForm {fields} columns={2} onSubmit={(values) => console.log(values)} />
