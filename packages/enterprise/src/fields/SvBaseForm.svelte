<script lang="ts">
  /**
   * SvBaseForm - a form that adds a record to the table: a title, a line
   * under it, then each field with its name and the editor its cell uses
   * (the select panel, the number box, the date picker, the file dialog).
   * The fields start with the defaults a new record gets. Submit checks
   * required fields, email / URL / phone formats and each column's
   * `validate`, adds the row the way "+ Add row" does (field defaults, the
   * next autonumber, `onRowAdd`), then offers to fill in another. A select
   * offers only the field's options: a form never adds one.
   */
  import { untrack } from 'svelte'
  import { parseEditorValue, type CellEditorType } from '@svgrid/grid'
  import { fieldColumns, gridOf, primaryIdOf, type FieldColumn } from './grid-access'
  import { newRowValues } from './field-ops'
  import { linkHref } from './links'
  import FieldInput from './FieldInput.svelte'
  import FieldIcon from './viewbar/FieldIcon.svelte'

  let {
    api,
    fields,
    required = [],
    title = 'New record',
    description = '',
    submitLabel = 'Submit',
    defaults,
    onSubmit,
  }: {
    /** The grid's api. */
    api: any
    /** The fields asked for, by column id, in order. Default: every field a person can fill in. */
    fields?: ReadonlyArray<string>
    /** Fields that must be filled in before Submit. */
    required?: ReadonlyArray<string>
    title?: string
    description?: string
    submitLabel?: string
    /** Values each record from this form starts with, under the row adder's `defaults` (`<SvBase>` gives an id). */
    defaults?: () => Record<string, unknown>
    /**
     * After the row was added. Return a Promise to wait on it: the button is
     * busy until it settles, and a rejection takes the row back out of the
     * grid, keeps what was typed and shows the error's message.
     */
    onSubmit?: (row: Record<string, unknown>) => void | Promise<unknown>
  } = $props()

  // Computed by the table, never typed in.
  const COMPUTED = new Set(['formula', 'lookup', 'rollup', 'count', 'autoNumber', 'createdTime', 'lastModifiedTime', 'createdBy', 'lastModifiedBy', 'button'])
  const ctrl = $derived(api ? gridOf(api) : undefined)
  const columns = $derived.by<FieldColumn[]>(() => {
    if (!ctrl) return []
    const all = fieldColumns(ctrl).filter((c) => !COMPUTED.has(c.fieldType ?? '') && c.def.editable !== false && !c.def.fieldFn)
    if (!fields) {
      // The primary field first, as the record's name.
      const p = primaryIdOf(ctrl)
      return [...all.filter((c) => c.id === p), ...all.filter((c) => c.id !== p)]
    }
    return fields.map((id) => all.find((c) => c.id === id)).filter((c): c is FieldColumn => !!c)
  })

  /** What an empty field says it wants. */
  function placeholderFor(c: FieldColumn): string {
    const t = c.fieldType ?? ''
    if (t === 'singleSelect' || t === 'multiSelect' || t === 'user') return 'Choose'
    if (t === 'date') return 'Pick a date'
    if (t === 'attachment') return 'Add files'
    if (t === 'link') return 'Link records'
    return 'Type here'
  }

  let draft = $state<Record<string, unknown>>({})
  let editing = $state<string | null>(null)
  // Column id -> what is wrong with its value, shown under the field.
  let errors = $state<Record<string, string>>({})
  let sent = $state(false)
  let busy = $state(false)
  let failure = $state('')
  // The values the record starts with (row adder defaults, the form's own),
  // read once per record so an id made there is the record's id.
  let seed: Record<string, unknown> | null = null
  // Field -> the default it was filled with.
  let prefilled: Record<string, unknown> = {}

  const isBlank = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

  /** A fresh record: the defaults it would get, shown in the fields asked for. */
  function prefill() {
    if (!ctrl) return
    const cfg = ctrl.props.rowAdder
    const fromAdder = cfg && typeof cfg === 'object' && typeof cfg.defaults === 'function' ? cfg.defaults() : {}
    seed = { ...(defaults?.() ?? {}), ...fromAdder }
    const start = newRowValues(ctrl, seed)
    const next: Record<string, unknown> = {}
    for (const c of columns) {
      const v = start[c.field]
      if (v !== undefined && !isBlank(v)) next[c.field] = Array.isArray(v) ? v.slice() : v
    }
    prefilled = { ...next }
    draft = next
  }
  // Once the grid is there; a remount (another form view) starts again.
  $effect.pre(() => {
    if (ctrl && !seed) untrack(prefill)
  })
  /** A date picked for a column that keeps dates as text keeps it as 'YYYY-MM-DD'. */
  function stored(c: FieldColumn, v: unknown): unknown {
    if (v instanceof Date && c.def.cellDataType === 'dateString') {
      const p = (n: number) => String(n).padStart(2, '0')
      return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`
    }
    return v
  }
  /**
   * The editor's value as the grid would store it from a cell edit: coerced
   * for the editor type, then through the column's valueParser, so a custom
   * field type parses the same in a form.
   */
  function parsed(c: FieldColumn, raw: unknown): unknown {
    const def = c.def as Record<string, any>
    const value = parseEditorValue(String(def.editorType ?? 'text') as CellEditorType, stored(c, raw), {
      multiple: def.editorMultiple === true,
      dateOnly: def.cellDataType === 'dateString',
    })
    const parser = def.valueParser as ((p: Record<string, unknown>) => unknown) | undefined
    return parser ? parser({ newValue: value, oldValue: draft[c.field], rawInput: raw, data: draft, columnId: c.id }) : value
  }
  function set(c: FieldColumn, v: unknown) {
    draft = { ...draft, [c.field]: parsed(c, v) }
    if (errors[c.id]) {
      const rest = { ...errors }
      delete rest[c.id]
      errors = rest
    }
  }
  const FORMATS: Record<string, { kind: 'email' | 'url' | 'phone'; message: string }> = {
    email: { kind: 'email', message: 'Not a valid email address' },
    url: { kind: 'url', message: 'Not a valid web address' },
    phone: { kind: 'phone', message: 'Not a valid phone number' },
  }
  /** What is wrong with a field's value, or '' when nothing is. */
  function problem(c: FieldColumn, v: unknown): string {
    const blank = isBlank(v)
    if (blank && required.includes(c.id)) return `${c.header} is required`
    // The format its cell links by: mailto, https, tel.
    const format = FORMATS[c.fieldType ?? '']
    if (!blank && format && !linkHref(format.kind, v)) return format.message
    // The column's own rule, as the grid runs it on a cell.
    const validate = c.def.validate as ((p: Record<string, unknown>) => unknown) | undefined
    if (typeof validate === 'function') {
      const verdict = validate({ value: v, row: draft, rowIndex: -1, column: { id: c.id, columnDef: c.def } })
      if (verdict === false) return `${c.header} is not valid`
      if (typeof verdict === 'string' && verdict) return verdict
    }
    return ''
  }
  function editBeside(c: FieldColumn, dir: 1 | -1) {
    const at = columns.findIndex((x) => x.id === c.id)
    const next = columns[at + dir]
    editing = next && next.def.editorType !== 'checkbox' ? next.id : null
  }
  /**
   * What the form sends: what the fields show. A field left empty is left
   * out, so it gets no value; one whose default was cleared stays empty.
   */
  function given(): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [field, v] of Object.entries(draft)) {
      if (!isBlank(v) || field in prefilled) out[field] = v
    }
    return out
  }
  async function submit(e: SubmitEvent) {
    e.preventDefault()
    if (!ctrl || busy) return
    editing = null
    failure = ''
    const found: Record<string, string> = {}
    for (const c of columns) {
      const why = problem(c, draft[c.field])
      if (why) found[c.id] = why
    }
    errors = found
    if (Object.keys(found).length) return
    if (!seed) prefill()
    // Field defaults, the next autonumber, the created time; then what the fields show.
    const row: Record<string, unknown> = newRowValues(ctrl, { ...seed, ...given() })
    api.addRow(row, 'bottom')
    ctrl.props.onRowAdd?.({ row })
    let result: unknown
    try {
      result = onSubmit?.(row)
    } catch (err) {
      return fail(row, err)
    }
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      busy = true
      try {
        await result
      } catch (err) {
        return fail(row, err)
      } finally {
        busy = false
      }
    }
    sent = true
  }
  /** onSubmit failed: the row comes out of the grid again, the fields keep their values. */
  function fail(row: Record<string, unknown>, err: unknown) {
    const at = ctrl ? ctrl.internalData.indexOf(row) : -1
    if (at >= 0) api.removeRows([at])
    failure = err instanceof Error && err.message ? err.message : 'The record could not be sent. Try again.'
  }
  function again() {
    seed = null
    errors = {}
    failure = ''
    prefill()
    sent = false
  }
</script>

{#if ctrl}
  <div class="sv-fform-wrap">
    {#if sent}
      <div class="sv-fform sv-fform-done" role="status">
        <h2 class="sv-fform-title">Thank you</h2>
        <p class="sv-fform-desc">The record was added.</p>
        <button type="button" class="sv-fform-submit" onclick={again}>Submit another</button>
      </div>
    {:else}
      <form class="sv-fform" onsubmit={submit} novalidate>
        <h2 class="sv-fform-title">{title}</h2>
        {#if description}<p class="sv-fform-desc">{description}</p>{/if}
        {#each columns as c (c.id)}
          {@const v = draft[c.field]}
          <div class="sv-fform-field" class:is-missing={!!errors[c.id]}>
            <div class="sv-fform-label">
              <FieldIcon column={c} />
              <span>{c.header}</span>
              {#if required.includes(c.id)}<span class="sv-fform-req" aria-label="required">*</span>{/if}
            </div>
            <FieldInput
              {ctrl}
              column={{ id: c.id, columnDef: c.def }}
              value={v}
              row={{ id: '', original: draft }}
              label={c.header}
              editable
              editing={editing === c.id}
              placeholder={placeholderFor(c)}
              onStart={() => (editing = c.id)}
              onStop={() => (editing = null)}
              onCommit={(next) => set(c, next)}
              onTab={(dir) => editBeside(c, dir)}
              addOptions={false}
            />
            {#if errors[c.id]}<p class="sv-fform-error">{errors[c.id]}</p>{/if}
            {#if c.def.description}<p class="sv-fform-hint">{String(c.def.description)}</p>{/if}
          </div>
        {/each}
        {#if failure}<p class="sv-fform-error sv-fform-failure" role="alert">{failure}</p>{/if}
        <button type="submit" class="sv-fform-submit" disabled={busy} aria-busy={busy}>{submitLabel}</button>
      </form>
    {/if}
  </div>
{/if}

<style>
  .sv-fform-wrap {
    height: 100%; overflow: auto; box-sizing: border-box; padding: 24px 16px;
    background: color-mix(in srgb, var(--sg-fg, #0f172a) 4%, var(--sg-bg, #fff));
    font-family: var(--sg-font, inherit); color: var(--sg-fg, #0f172a);
  }
  .sv-fform {
    max-width: 640px; margin: 0 auto; padding: 24px 28px; display: flex; flex-direction: column; gap: 18px;
    background: var(--sg-bg, #fff); border: 1px solid var(--sg-border, #e2e8f0); border-radius: 12px;
  }
  .sv-fform-title { margin: 0; font-size: 22px; }
  .sv-fform-desc { margin: -10px 0 0; color: var(--sg-muted, #64748b); }
  .sv-fform-field { display: flex; flex-direction: column; gap: 6px; }
  .sv-fform-label { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; }
  .sv-fform-req { color: var(--sg-danger, #dc2626); }
  .sv-fform-field.is-missing :global(.sv-frv-box) { border-color: var(--sg-danger, #dc2626); }
  .sv-fform-error { margin: 0; font-size: 12px; color: var(--sg-danger, #dc2626); }
  .sv-fform-hint { margin: 0; font-size: 12px; color: var(--sg-muted, #64748b); }
  .sv-fform-submit {
    align-self: flex-start; border: 0; border-radius: 8px; padding: 8px 18px; font: inherit; font-weight: 600; cursor: pointer;
    background: var(--sg-accent, #2563eb); color: var(--sg-accent-fg, #fff);
  }
  .sv-fform-submit:disabled { opacity: 0.6; cursor: progress; }
  .sv-fform-failure { font-size: 13px; }
  .sv-fform-done { align-items: flex-start; }
</style>
