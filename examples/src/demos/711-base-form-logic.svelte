<script lang="ts">
  /**
   * 711. SvGrid Base: form logic
   * ----------------------------
   * A support request form whose fields follow the answers, and links that
   * open it filled in.
   *
   * Conditional fields (`conditions` on SvBaseForm, `formConditions` on a
   * form view), each a view bar filter over the other answers:
   *  - Company size shows when Account type is Business;
   *  - App version shows for a Bug, Invoice number for Billing, and "Tell us
   *    more" for Other;
   *  - "What is blocked?" shows when "Blocking my work" is checked.
   * A hidden field is not required and is not sent: pick Bug, type a
   * version, switch to Billing and submit; the record has no version.
   *
   * Prefilled links: each button builds a link with `formPrefillLink` and
   * hands it to the form as `prefill`, the way a page passes
   * `?prefill_<Field name>=value` from its URL. `hide_<Field name>=true`
   * keeps a filled field out of sight and still sends it. Sent requests land
   * in the table on the right.
   */
  import { SvBase, SvBaseForm, enableBase, formPrefillLink, type FieldFilter } from '@svgrid/enterprise/base'

  enableBase()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const TYPES = [{ value: 'Personal', color: '#94a3b8' }, { value: 'Business', color: '#2d7ff9' }]
  const SIZES = [{ value: '1-10' }, { value: '11-50' }, { value: '51-200' }, { value: '200+' }]
  const TOPICS = [
    { value: 'Bug', color: '#f82b60' },
    { value: 'Billing', color: '#fcb400' },
    { value: 'Feature request', color: '#20c933' },
    { value: 'Other', color: '#8b46ff' },
  ]
  const STATUS = [{ value: 'New', color: '#18bfff' }, { value: 'Open', color: '#fcb400' }, { value: 'Closed', color: '#94a3b8' }]

  const columns = [
    { field: 'name', header: 'Name', width: 160, fieldType: 'text' },
    { field: 'email', header: 'Email', width: 200, fieldType: 'email' },
    { field: 'account', header: 'Account type', width: 130, fieldType: 'singleSelect', fieldProps: { options: TYPES } },
    { field: 'size', header: 'Company size', width: 130, fieldType: 'singleSelect', fieldProps: { options: SIZES } },
    { field: 'topic', header: 'Topic', width: 140, fieldType: 'singleSelect', fieldProps: { options: TOPICS } },
    { field: 'version', header: 'App version', width: 120, fieldType: 'text', description: 'Settings > About shows it.' },
    { field: 'invoice', header: 'Invoice number', width: 140, fieldType: 'text' },
    { field: 'other', header: 'Tell us more', width: 220, fieldType: 'longText' },
    { field: 'blocking', header: 'Blocking my work', width: 140, fieldType: 'checkbox' },
    { field: 'impact', header: 'What is blocked?', width: 220, fieldType: 'longText' },
    { field: 'message', header: 'Message', width: 280, fieldType: 'longText' },
    // The team's fields. The form leaves them out.
    { field: 'status', header: 'Status', width: 110, fieldType: 'singleSelect', fieldProps: { options: STATUS, default: 'New' } },
    { field: 'received', header: 'Received', width: 130, fieldType: 'date', fieldProps: { dateFormat: 'friendly', defaultToday: true } },
  ]

  const data = [
    { id: 'r1', name: 'Lena Fischer', email: 'lena@northwind.example', account: 'Business', size: '51-200', topic: 'Billing', invoice: 'INV-20418', message: 'We were charged twice in October.', status: 'Open', received: day(-3) },
    { id: 'r2', name: 'Tom Reyes', email: 'tom.reyes@example.com', account: 'Personal', topic: 'Bug', version: '4.2.0', blocking: true, impact: 'Exports to PDF', message: 'The export button spins forever.', status: 'New', received: day(-1) },
    { id: 'r3', name: 'Priya Nair', email: 'priya@lumen.example', account: 'Business', size: '11-50', topic: 'Feature request', message: 'A dark theme for the mobile app, please.', status: 'Closed', received: day(-6) },
  ]

  const is = (column: string, value: string): FieldFilter => ({ kind: 'fieldFilter', conjunction: 'and', conditions: [{ column, kind: 'select', op: 'is', value }] })
  const conditions: Record<string, FieldFilter> = {
    size: is('account', 'Business'),
    version: is('topic', 'Bug'),
    invoice: is('topic', 'Billing'),
    other: is('topic', 'Other'),
    impact: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'blocking', kind: 'checkbox', op: 'is', value: true }] },
  }
  const FIELDS = ['name', 'email', 'account', 'size', 'topic', 'version', 'invoice', 'other', 'blocking', 'impact', 'message']

  // Where the form would live; the links below open it.
  const PAGE = 'https://support.example.com/request'
  const EXAMPLES: Array<{ id: string; label: string; values: Record<string, unknown>; hide?: string[] }> = [
    { id: 'blank', label: 'Blank form', values: {} },
    { id: 'billing', label: 'From the billing page', values: { topic: 'Billing', account: 'Business' }, hide: ['topic'] },
    { id: 'crash', label: 'From the crash dialog', values: { topic: 'Bug', version: '4.2.1', blocking: true }, hide: ['topic', 'version'] },
    { id: 'partner', label: 'From a partner email', values: { name: 'Sam Okoro', email: 'sam@brightline.example', account: 'Business', size: '51-200', topic: 'Other' } },
  ]

  let chosen = $state('blank')
  let api = $state.raw<any>(null)
  let copied = $state(false)

  const example = $derived(EXAMPLES.find((e) => e.id === chosen) ?? EXAMPLES[0]!)
  const link = $derived(formPrefillLink(PAGE, example.values, columns, { hide: example.hide }))

  const rowId = (r: { id: string }) => r.id
  function ready(a: unknown) {
    api = a
  }
  function choose(id: string) {
    chosen = id
    copied = false
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      copied = true
    } catch {
      copied = false
    }
  }
</script>

<section class="flogic">
  <div class="flogic-form">
    {#if api}
      <SvBaseForm
        {api}
        fields={FIELDS}
        required={['name', 'email', 'topic', 'size', 'version', 'invoice', 'other']}
        {conditions}
        prefill={link}
        title="Contact support"
        description="We answer within one working day."
        submitLabel="Send request"
      />
    {/if}
  </div>

  <div class="flogic-side">
    <div class="flogic-links">
      <div class="flogic-picks" role="group" aria-label="Open the form from a link">
        {#each EXAMPLES as e (e.id)}
          <button type="button" class="flogic-pick" class:is-on={e.id === chosen} aria-pressed={e.id === chosen} onclick={() => choose(e.id)}>{e.label}</button>
        {/each}
      </div>
      <div class="flogic-link">
        <code>{link}</code>
        <button type="button" class="flogic-copy" onclick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
      </div>
    </div>

    <div class="flogic-table">
      <SvBase
        {data}
        {columns}
        primaryField="name"
        getRowId={rowId}
        editable
        sortable
        showRowNumbers
        expandRows
        rowHeight={36}
        containerHeight="100%"
        onApiReady={ready}
      />
    </div>
  </div>
</section>

<style>
  .flogic {
    display: grid; grid-template-columns: minmax(320px, 440px) minmax(0, 1fr); gap: 12px;
    flex: 1; min-height: 600px; height: 100%; color: var(--sg-fg, #0f172a); font-family: var(--sg-font, inherit);
  }
  .flogic-form {
    min-height: 0; overflow: hidden;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
  }
  .flogic-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 0; }
  .flogic-links {
    display: flex; flex-direction: column; gap: 10px; padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff));
  }
  .flogic-picks { display: flex; flex-wrap: wrap; gap: 6px; }
  .flogic-pick, .flogic-copy {
    height: 30px; padding: 0 12px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; font-size: 13px; cursor: pointer;
  }
  .flogic-pick.is-on { border-color: var(--sg-accent, #2563eb); color: var(--sg-accent, #2563eb); font-weight: 600; }
  .flogic-link { display: flex; align-items: flex-start; gap: 8px; }
  .flogic-link code {
    flex: 1; min-width: 0; padding: 6px 8px; overflow-wrap: anywhere;
    border-radius: var(--sg-radius, 6px); background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0);
    font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; color: var(--sg-muted, #64748b);
  }
  .flogic-copy { flex: 0 0 auto; background: var(--sg-accent, #2563eb); border-color: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff); font-weight: 600; }
  .flogic-table { flex: 1 1 auto; min-height: 320px; display: flex; flex-direction: column; }
  @media (max-width: 860px) {
    .flogic { grid-template-columns: minmax(0, 1fr); height: auto; }
    .flogic-form { height: 640px; }
    .flogic-table { height: 420px; flex: 0 0 auto; }
  }
</style>
