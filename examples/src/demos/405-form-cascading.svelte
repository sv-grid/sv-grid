<script lang="ts">
  /**
   * SvForm cascading (dependent) fields - a child list derives from the parent's
   * value via a function `options`, and `dependsOn` clears the child when the
   * parent changes so a stale selection never lingers. Country -> State -> City.
   */
  import { SvForm, SvToaster, toast, type FormField } from '@svgrid/grid'

  const countries = [
    { value: 'us', label: 'United States' },
    { value: 'ca', label: 'Canada' },
  ]
  const states: Record<string, { value: string; label: string }[]> = {
    us: [ { value: 'ca-s', label: 'California' }, { value: 'ny', label: 'New York' }, { value: 'tx', label: 'Texas' } ],
    ca: [ { value: 'on', label: 'Ontario' }, { value: 'bc', label: 'British Columbia' }, { value: 'qc', label: 'Quebec' } ],
  }
  const cities: Record<string, { value: string; label: string }[]> = {
    'ca-s': [ { value: 'la', label: 'Los Angeles' }, { value: 'sf', label: 'San Francisco' } ],
    ny: [ { value: 'nyc', label: 'New York City' }, { value: 'buf', label: 'Buffalo' } ],
    tx: [ { value: 'aus', label: 'Austin' }, { value: 'dal', label: 'Dallas' } ],
    on: [ { value: 'tor', label: 'Toronto' }, { value: 'ott', label: 'Ottawa' } ],
    bc: [ { value: 'van', label: 'Vancouver' }, { value: 'vic', label: 'Victoria' } ],
    qc: [ { value: 'mtl', label: 'Montreal' }, { value: 'qcc', label: 'Quebec City' } ],
  }

  const fields: FormField[] = [
    { name: 'country', label: 'Country', type: 'select', options: countries, required: true, placeholder: 'Pick a country' },
    { name: 'state', label: 'State / Province', type: 'select', dependsOn: 'country', required: true, placeholder: 'Pick a state',
      options: (v) => states[v.country] ?? [] },
    { name: 'city', label: 'City', type: 'select', dependsOn: 'state', required: true, placeholder: 'Pick a city',
      options: (v) => cities[v.state] ?? [] },
  ]

  function onSubmit(values: Record<string, unknown>) {
    toast.success(`Selected ${values.city} (${values.state}, ${values.country})`)
  }
</script>

<div class="wrap">
  <h2>Cascading location</h2>
  <p class="muted">Each list depends on the one above; changing a parent clears its children.</p>
  <SvForm {fields} columns={1} submitLabel="Save location" {onSubmit} />
</div>

<SvToaster position="bottom-right" />

<style>
  .wrap { padding: 22px; max-width: 420px; }
  h2 { margin: 0; font-size: 19px; font-weight: 700; }
  .muted { margin: 3px 0 16px; color: var(--sg-muted, #64748b); font-size: 13px; }
</style>
