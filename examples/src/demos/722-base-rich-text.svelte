<script lang="ts">
  /**
   * 722. SvGrid Base: rich text fields
   * -----------------------------------
   * A release-notes table where two fields hold formatted text.
   *
   * Engineering notes is a rich text field with the full toolbar: headings,
   * lists, quotes, code blocks, links, undo and redo. Customer note uses the
   * standard toolbar: bold, italic, underline, strikethrough, lists and
   * links. Double-click a cell (or select it and type) to open the editor
   * over it. Ctrl+B, Ctrl+I and Ctrl+U format the selection, Ctrl+K adds a
   * link, Ctrl+Enter saves and Escape cancels.
   *
   * The value is HTML, sanitized when it is saved and again before it is
   * drawn. The views read the words, not the tags: "Mentions migration"
   * filters the engineering notes for the word, and Note length is a
   * formula, LEN({Customer note}), that counts letters.
   *
   * The All changes view uses the Tall row height, so each note shows as
   * lines; at Short height it runs on one line. Expand a row to read all of
   * it, or use the Write a note form, which edits with the same toolbar.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, enableBase, type BaseTable } from '@svgrid/enterprise/base'
  import { usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const STATUS = [
    { value: 'Draft', color: '#94a3b8' },
    { value: 'In review', color: '#fcb400' },
    { value: 'Published', color: '#20c933' },
  ]
  const RELEASES = [
    { value: 'v3.2', color: '#2d7ff9' },
    { value: 'v3.3', color: '#8b46ff' },
  ]

  // [change, release, status, owner, engineering notes, customer note]
  const NOTES: Array<[string, string, string, string, string, string]> = [
    [
      'Faster CSV import',
      'v3.2', 'Published', 'u3',
      '<h3>What changed</h3><p>The parser streams the file in chunks instead of reading it whole.</p><ul><li>Memory stays flat on a 200 MB file</li><li>Progress updates every 5,000 rows</li></ul><p>Flag: <code>import.streaming</code>, on by default.</p>',
      '<p>Large CSV files now import <strong>about 4 times faster</strong>, with a progress bar while they load.</p>',
    ],
    [
      'Saved filters per user',
      'v3.2', 'Published', 'u1',
      '<p>Filters are stored with the view owner. A view shared with the team keeps its own filter.</p><blockquote>Old personal filters need the one-time migration script before upgrading.</blockquote><ol><li>Run <code>migrate-filters</code></li><li>Check the report it prints</li></ol>',
      '<p>Your filters stay yours: a teammate opening the same view <em>no longer sees them</em>.</p>',
    ],
    [
      'Dark mode for charts',
      'v3.3', 'In review', 'u5',
      '<p>Chart colors read the <code>--sg-*</code> tokens now. Two palettes changed for contrast:</p><ul><li>Categorical: steps 3 and 7</li><li>Sequential: the lightest step</li></ul><p>Screenshots in the <a href="https://example.com/design/charts-dark">design review</a>.</p>',
      '<p>Charts follow your theme, including <strong>dark mode</strong>.</p>',
    ],
    [
      'Postgres 17 support',
      'v3.3', 'In review', 'u4',
      '<h3>Upgrade path</h3><p>The schema migration adds two indexes; it takes under a minute on a million rows.</p><pre>ALTER TABLE records ADD COLUMN search tsvector;</pre><p>Tested against 15, 16 and 17.</p>',
      '<p>Works with <strong>Postgres 17</strong>. Upgrading runs one short migration.</p><ul><li>No downtime</li><li>Rollback script included</li></ul>',
    ],
    [
      'Keyboard shortcuts panel',
      'v3.3', 'Draft', 'u2',
      '<p>Press <code>?</code> anywhere to open it. Lists every shortcut, grouped by area.</p><ul><li>Searchable</li><li>Shows the Mac keys on a Mac</li></ul>',
      '<p>Press <strong>?</strong> to see every keyboard shortcut.</p>',
    ],
    [
      'Retire the v1 REST API',
      'v3.3', 'Draft', 'u6',
      '<p><strong>Breaking.</strong> v1 endpoints return 410 from 1 March.</p><ul><li>Email the 14 accounts still calling v1</li><li>Link the <a href="https://example.com/docs/api-migration">migration guide</a> in the banner</li></ul>',
      '<p>The v1 API stops on <strong>1 March</strong>. The <a href="https://example.com/docs/api-migration">migration guide</a> covers every endpoint.</p>',
    ],
  ]
  const data = NOTES.map(([change, release, status, owner, notes, customer], i) => ({ id: `n${i + 1}`, change, release, status, owner, notes, customer }))

  let tables = $state.raw<BaseTable[]>([
    {
      id: 'release-notes',
      name: 'Release notes',
      primaryField: 'change',
      data,
      columns: [
        { field: 'change', header: 'Change', width: 210, fieldType: 'text' },
        { field: 'release', header: 'Release', width: 116, fieldType: 'singleSelect', fieldProps: { options: RELEASES } },
        { field: 'status', header: 'Status', width: 120, fieldType: 'singleSelect', fieldProps: { options: STATUS } },
        { field: 'notes', header: 'Engineering notes', width: 320, fieldType: 'richText', fieldProps: { toolbar: 'full' } },
        { field: 'customer', header: 'Customer note', width: 280, fieldType: 'richText' },
        { field: 'length', header: 'Note length', width: 120, fieldType: 'formula', fieldProps: { formula: 'LEN({Customer note})', result: 'number', precision: 0 } },
        { field: 'owner', header: 'Owner', width: 160, fieldType: 'user' },
      ],
      views: [
        { id: 'all', name: 'All changes', type: 'grid', rowHeight: 88, state: { sorting: [{ id: 'release', desc: false }] } },
        {
          id: 'migration',
          name: 'Mentions migration',
          type: 'grid',
          rowHeight: 88,
          state: {
            advancedFilter: { kind: 'fieldFilter', conjunction: 'and', conditions: [{ column: 'notes', kind: 'text', op: 'contains', value: 'migration' }] },
          },
        },
        { id: 'board', name: 'By status', type: 'kanban', stackBy: 'status' },
        {
          id: 'write',
          name: 'Write a note',
          type: 'form',
          formFields: ['change', 'release', 'owner', 'customer'],
          formDescription: 'One change per note. The customer note is what goes on the release page.',
        },
      ],
      props: { rowAdder: { label: 'Add change' } },
    },
  ])
</script>

<section class="base-demo">
  <p class="base-demo-tip">
    Double-click a note to edit it with the toolbar: select a word and press <kbd>Ctrl+B</kbd>, or <kbd>Ctrl+K</kbd> for a link,
    then <kbd>Ctrl+Enter</kbd> to save. Note length counts the letters of the customer note, not its tags.
  </p>
  <SvBase
    bind:tables
    editable
    sortable
    showRowNumbers
    expandRows
    rowNumberWidth={64}
    showRowSelection={false}
    containerHeight="100%"
    columnAdder
    fieldMenu
  />
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .base-demo-tip { margin: 0; font-size: 13px; line-height: 1.5; color: var(--sg-muted, #64748b); }
  .base-demo-tip kbd {
    padding: 1px 5px; font: inherit; font-size: 12px; border-radius: 4px;
    border: 1px solid var(--sg-border, #e2e8f0); background: color-mix(in srgb, var(--sg-fg, #0f172a) 7%, transparent); color: var(--sg-fg, #0f172a);
  }
</style>
