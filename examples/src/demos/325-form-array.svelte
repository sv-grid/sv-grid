<script lang="ts">
  /**
   * SvForm FIELD ARRAY: a repeatable group. `type: 'array'` + `itemFields` renders
   * add/remove rows; each row's fields validate against that row (so within-row
   * rules work), and `required` / `minItems` gate the count. The value is an array
   * of item objects, included in the submitted payload.
   */
  import { SvForm, rules } from '@svgrid/grid'
  import type { FormEntry } from '@svgrid/grid'

  const schema: FormEntry[] = [
    { name: 'client', label: 'Bill to', required: true, full: true },
    { name: 'items', label: 'Line items', type: 'array', required: true, minItems: 1, addLabel: '+ Add line', itemFields: [
      { name: 'desc', label: 'Description', required: true },
      { name: 'qty', label: 'Qty', type: 'number', required: true, rules: [rules.min(1)] },
      { name: 'price', label: 'Unit price', type: 'number', required: true, rules: [rules.min(0)] },
    ] },
  ]

  let result = $state<string>('')
</script>

<div class="wrap">
  <header>
    <h2>Field array</h2>
    <p>
      A repeatable group: add and remove line items, each validated per row (try
      submitting with an empty description or qty 0). The value is an array of item
      objects - submit to see the payload.
    </p>
  </header>

  <div class="card">
    <SvForm
      fields={schema}
      submitLabel="Create invoice"
      initial={{ client: '', items: [{ desc: '', qty: 1, price: 0 }] }}
      onSubmit={(v) => { result = JSON.stringify(v, null, 2) }}
    />
  </div>

  {#if result}
    <pre class="result">{result}</pre>
  {/if}
</div>

<style>
  .wrap { padding: 20px; max-width: 680px; display: flex; flex-direction: column; gap: 16px; }
  header h2 { margin: 0 0 4px; font-size: 20px; font-weight: 700; }
  header p { margin: 0; color: var(--sg-muted, #64748b); font-size: 13.5px; line-height: 1.5; }
  .card { padding: 20px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px; }
  .result { margin: 0; padding: 14px; background: var(--sg-header-bg, #f8fafc); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 10px; font-size: 12px; overflow: auto; }
</style>
