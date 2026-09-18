<script lang="ts">
  /**
   * Excel's Convert Text to Columns Wizard, the delimited page: pick the
   * delimiter (guessed from the column first), see the split in a preview,
   * Finish writes the fields into the columns to the right of the source
   * inside one batch, so the whole split is one Ctrl+Z.
   */
  import { useSheetText } from './sheet-text'
  import { untrack } from 'svelte'
  import { SvModal } from '@svgrid/grid'
  import type { GridCommandContext } from '@svgrid/grid/shortcuts'
  import type { Workbook } from './sheet/workbook'
  import { textToColumns, guessDelimiter } from './sheet/transforms'
  import { colToLetters } from './sheet/address'

  type Props = {
    open?: boolean
    workbook: Workbook
    cmd: () => GridCommandContext | null
    /** Called after the split, so the shell repaints and refocuses. */
    onDone: (message: string) => void
    onClose?: () => void
  }

  let { open = $bindable(false), workbook, cmd, onDone, onClose }: Props = $props()
  const t = useSheetText()

  const DELIMITERS = [
    { id: 'tab', label: 'textToColumns.tab', sep: '\t' },
    { id: 'semicolon', label: 'textToColumns.semicolon', sep: ';' },
    { id: 'comma', label: 'textToColumns.comma', sep: ',' },
    { id: 'space', label: 'textToColumns.space', sep: ' ' },
    { id: 'other', label: 'textToColumns.other', sep: '' },
  ] as const
  type DelimiterId = (typeof DELIMITERS)[number]['id']

  let delimiter = $state<DelimiterId>('comma')
  let other = $state('|')
  let collapse = $state(false)
  let trim = $state(true)
  let column = $state<{ index: number; top: number; texts: string[] }>({ index: 0, top: 0, texts: [] })

  const separator = $derived(
    delimiter === 'other' ? other : DELIMITERS.find((d) => d.id === delimiter)!.sep,
  )
  const preview = $derived.by(() =>
    textToColumns(column.texts.slice(0, 6), {
      delimiters: separator ? [separator] : [','],
      collapse,
      trim,
    }),
  )

  /**
   * The column under the selection, from the selection's first row (a
   * whole-column selection starts at the top) down to the last used row.
   */
  $effect(() => {
    if (!open) return
    untrack(prepare)
  })

  function prepare() {
    const c = cmd()
    const range = c?.ranges[c.ranges.length - 1]
    const left = range ? range[1] : (c?.activeCell?.colIndex ?? 0)
    const top = range ? range[0] : (c?.activeCell?.rowIndex ?? 0)
    const bottom = Math.max(workbook.rowCount(workbook.active) - 1, top)
    const texts = Array.from({ length: bottom - top + 1 }, (_, i) => workbook.getRaw(workbook.active, top + i, left))
    column = { index: left, top, texts }
    const guess = guessDelimiter(texts.filter((t) => t !== ''))
    const known = DELIMITERS.find((d) => d.sep === guess && d.id !== 'other')
    if (known) delimiter = known.id
    else if (guess) { delimiter = 'other'; other = guess }
  }

  function finish() {
    const c = cmd()
    if (!c) return
    const { rows, width } = textToColumns(column.texts, {
      delimiters: separator ? [separator] : [','],
      collapse,
      trim,
    })
    c.batch(() => {
      rows.forEach((fields, r) => {
        for (let i = 0; i < width; i += 1) {
          c.setCellValue(column.top + r, column.index + i, fields[i] ?? '')
        }
      })
    })
    open = false
    c.setSelection(column.top, column.index)
    c.extendSelection(column.top + rows.length - 1, column.index + width - 1)
    onDone(t('textToColumns.done', { rows: rows.length, columns: width }))
    onClose?.()
  }

  function close() {
    open = false
    onClose?.()
  }
</script>

<SvModal bind:open onClose={onClose} title={t('textToColumns.title')} size="md">
  <div class="sv-sheet-dialog" role="group" aria-label={t('textToColumns.group')}>
    <p class="lead">{t('textToColumns.lead')}</p>
    <fieldset class="group">
      <legend>{t('textToColumns.delimiters')}</legend>
      {#each DELIMITERS as d (d.id)}
        <label class="check">
          <input type="radio" name="sheet-delimiter" value={d.id} bind:group={delimiter} />
          {t(d.label)}
          {#if d.id === 'other'}
            <input class="other" type="text" maxlength="1" bind:value={other} aria-label={t('textToColumns.otherDelimiter')} />
          {/if}
        </label>
      {/each}
    </fieldset>
    <div class="checks">
      <label class="check"><input type="checkbox" bind:checked={collapse} /> {t('textToColumns.collapse')}</label>
      <label class="check"><input type="checkbox" bind:checked={trim} /> {t('textToColumns.trim')}</label>
    </div>
    <div class="preview" aria-label={t('textToColumns.preview')}>
      <table>
        <tbody>
          {#each preview.rows as fields, i (i)}
            <tr>{#each fields as field, j (j)}<td>{field}</td>{/each}</tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="status">
      {t('textToColumns.status', { rows: column.texts.length, from: colToLetters(column.index), count: preview.width, unit: t(preview.width === 1 ? 'textToColumns.column' : 'textToColumns.columns') })}
    </p>
  </div>
  {#snippet footer()}
    <div class="sv-sheet-dialog-buttons">
      <button type="button" class="btn primary" onclick={finish} disabled={column.texts.length === 0}>{t('textToColumns.finish')}</button>
      <button type="button" class="btn" onclick={close}>{t('cancel')}</button>
    </div>
  {/snippet}
</SvModal>

<style>
  .lead { margin: 0; }
  .group {
    display: flex;
    flex-wrap: wrap;
    gap: 6px 16px;
    margin: 0;
    padding: 6px 10px 8px;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
  }
  .group legend { padding: 0 4px; font-weight: 600; }
  .other { width: 32px !important; height: 22px !important; padding: 0 4px !important; text-align: center; }
  .preview {
    max-height: 150px;
    overflow: auto;
    border: 1px solid var(--sg-border, #d1d1d1);
    border-radius: var(--sg-radius, 3px);
    background: var(--sg-bg, #fff);
  }
  .preview table { border-collapse: collapse; font-size: 12px; }
  .preview td {
    padding: 3px 8px;
    border-right: 1px solid var(--sg-border, #e5e5e5);
    border-bottom: 1px solid var(--sg-border, #e5e5e5);
    white-space: nowrap;
  }
</style>
