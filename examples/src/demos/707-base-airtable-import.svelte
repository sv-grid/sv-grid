<script lang="ts">
  /**
   * 707. SvGrid Base: open an Airtable base
   * ---------------------------------------
   * The JSON in the panel is what Airtable's Web API returns for a small
   * launch-planning base: the schema (GET /v0/meta/bases/{baseId}/tables)
   * and the records of its two tables. "Open as a base" passes it to
   * `baseFromAirtable` and opens the result in `<SvBase>`.
   *
   * Launches and Tasks link both ways. Selects keep their colors, the
   * collaborators become the page's people (matched by email here, with the
   * `userId` option), Hours is a rollup over the tasks, Launch owner a
   * lookup, and the formulas read `{fldXXX}` references that the import turns
   * into field names. Age reads CREATED_TIME(), which becomes the
   * table's Created field. Status changed reads LAST_MODIFIED_TIME({Status}):
   * the import adds a Last modified time field that watches Status, empty
   * until a status changes, since the API does not say when one last did.
   *
   * Pitch, an AI text field, becomes a Base AI field with the same prompt
   * ({Name} in place of the field id); its generated values come over as
   * they are, and new ones need the AI provider the app sets. The report
   * lists that, the field the import added, a list view, and the settings the
   * schema does not include, such as the field a board stacks by. Edit the
   * JSON (rename a field, change a formula, add a choice) and open it again.
   */
  import { SvToaster } from '@svgrid/grid'
  import { SvBase, baseFromAirtable, enableBase, setFieldUsers, type AirtableImport, type BaseTable } from '@svgrid/enterprise/base'
  import { PEOPLE, usePeople } from '../shared/base-people'

  enableBase()
  usePeople()

  const day = (offset: number) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const stamp = (offset: number) => `${day(offset)}T09:30:00.000Z`

  // Collaborators as the API returns them.
  const ana = { id: 'usrA1b2C3d4E5f6G7', email: 'ana@example.com', name: 'Ana Ruiz' }
  const ben = { id: 'usrB2c3D4e5F6g7H8', email: 'ben@example.com', name: 'Ben Okafor' }
  const cleo = { id: 'usrC3d4E5f6G7h8I9', email: 'cleo@example.com', name: 'Cleo Park' }
  const dev = { id: 'usrD4e5F6g7H8i9J0', email: 'dev@example.com', name: 'Dev Shah' }

  const schema = {
    tables: [
      {
        id: 'tblLaunches',
        name: 'Launches',
        primaryFieldId: 'fldLaunchName',
        fields: [
          { id: 'fldLaunchName', name: 'Launch', type: 'singleLineText' },
          {
            id: 'fldLaunchStage', name: 'Stage', type: 'singleSelect',
            options: { choices: [{ id: 'selPlan', name: 'Planning', color: 'blueLight2' }, { id: 'selBuild', name: 'Building', color: 'yellowLight2' }, { id: 'selShip', name: 'Shipped', color: 'greenLight2' }] },
          },
          { id: 'fldLaunchOwner', name: 'Owner', type: 'singleCollaborator', options: {} },
          { id: 'fldLaunchDate', name: 'Launch date', type: 'date', options: { dateFormat: { name: 'friendly', format: 'LL' } } },
          { id: 'fldLaunchTasks', name: 'Tasks', type: 'multipleRecordLinks', options: { linkedTableId: 'tblTasks', inverseLinkFieldId: 'fldTaskLaunch', prefersSingleRecordLink: false, isReversed: false } },
          { id: 'fldLaunchHours', name: 'Hours', type: 'rollup', options: { recordLinkFieldId: 'fldLaunchTasks', fieldIdInLinkedTable: 'fldTaskHours', isValid: true, result: { type: 'number', options: { precision: 1 } } } },
          { id: 'fldLaunchCount', name: 'Task count', type: 'count', options: { recordLinkFieldId: 'fldLaunchTasks', isValid: true } },
          {
            id: 'fldLaunchLeft', name: 'Days left', type: 'formula',
            options: { formula: 'IF({fldLaunchStage} = "Shipped", BLANK(), DATETIME_DIFF({fldLaunchDate}, TODAY(), "days"))', isValid: true, referencedFieldIds: ['fldLaunchStage', 'fldLaunchDate'], result: { type: 'number', options: { precision: 0 } } },
          },
          {
            id: 'fldLaunchAge', name: 'Age', type: 'formula',
            options: { formula: 'DATETIME_DIFF(TODAY(), CREATED_TIME(), "days") & " days"', isValid: true, referencedFieldIds: [], result: { type: 'singleLineText' } },
          },
          { id: 'fldLaunchPitch', name: 'Pitch', type: 'aiText', options: { prompt: ['Write a one-line pitch for ', { field: { fieldId: 'fldLaunchName' } }], referencedFieldIds: ['fldLaunchName'] } },
          { id: 'fldLaunchCreated', name: 'Created', type: 'createdTime', options: { result: { type: 'dateTime', options: { dateFormat: { name: 'friendly' }, timeFormat: { name: '24hour' }, timeZone: 'client' } } } },
        ],
        views: [
          { id: 'viwLaunchGrid', name: 'All launches', type: 'grid' },
          { id: 'viwLaunchBoard', name: 'By stage', type: 'kanban' },
          { id: 'viwLaunchCal', name: 'Launch calendar', type: 'calendar' },
          { id: 'viwLaunchList', name: 'Phone list', type: 'list' },
        ],
      },
      {
        id: 'tblTasks',
        name: 'Tasks',
        primaryFieldId: 'fldTaskName',
        fields: [
          { id: 'fldTaskName', name: 'Task', type: 'singleLineText' },
          { id: 'fldTaskLaunch', name: 'Launch', type: 'multipleRecordLinks', options: { linkedTableId: 'tblLaunches', inverseLinkFieldId: 'fldLaunchTasks', prefersSingleRecordLink: true, isReversed: false } },
          {
            id: 'fldTaskStatus', name: 'Status', type: 'singleSelect',
            options: { choices: [{ id: 'selTodo', name: 'To do', color: 'grayLight2' }, { id: 'selDoing', name: 'Doing', color: 'cyanLight2' }, { id: 'selDone', name: 'Done', color: 'greenBright' }] },
          },
          { id: 'fldTaskPeople', name: 'Assignees', type: 'multipleCollaborators', options: {} },
          { id: 'fldTaskHours', name: 'Hours', type: 'number', options: { precision: 1 } },
          { id: 'fldTaskDue', name: 'Due', type: 'date', options: { dateFormat: { name: 'iso', format: 'YYYY-MM-DD' } } },
          { id: 'fldTaskPriority', name: 'Priority', type: 'rating', options: { max: 3, icon: 'flag', color: 'redBright' } },
          { id: 'fldTaskOwner', name: 'Launch owner', type: 'multipleLookupValues', options: { recordLinkFieldId: 'fldTaskLaunch', fieldIdInLinkedTable: 'fldLaunchOwner', isValid: true, result: { type: 'singleCollaborator' } } },
          {
            id: 'fldTaskLate', name: 'Late', type: 'formula',
            options: { formula: 'IF(AND({fldTaskStatus} != "Done", IS_BEFORE({fldTaskDue}, TODAY())), "Late", "")', isValid: true, referencedFieldIds: ['fldTaskStatus', 'fldTaskDue'], result: { type: 'singleLineText' } },
          },
          {
            id: 'fldTaskMoved', name: 'Status changed', type: 'formula',
            options: { formula: 'DATETIME_FORMAT(LAST_MODIFIED_TIME({fldTaskStatus}), "MMM D")', isValid: true, referencedFieldIds: ['fldTaskStatus'], result: { type: 'singleLineText' } },
          },
        ],
        views: [
          { id: 'viwTaskGrid', name: 'All tasks', type: 'grid' },
          { id: 'viwTaskBoard', name: 'Board', type: 'kanban' },
          { id: 'viwTaskTimeline', name: 'Due dates', type: 'timeline' },
          { id: 'viwTaskForm', name: 'Request a task', type: 'form' },
        ],
      },
    ],
  }

  // [id, launch, stage, owner, launch date, created (days ago)]
  const LAUNCHES: Array<[string, string, string, typeof ana, number, number]> = [
    ['recL1', 'Mobile app 2.0', 'Building', ana, 12, 40],
    ['recL2', 'Usage-based pricing', 'Planning', ben, 34, 18],
    ['recL3', 'EU data region', 'Shipped', cleo, -6, 75],
    ['recL4', 'Partner portal', 'Building', dev, 21, 26],
  ]
  // [id, task, launch, status, assignees, hours, due (days from today), priority]
  const TASKS: Array<[string, string, string, string, Array<typeof ana>, number, number, number]> = [
    ['recT1', 'Offline sync', 'recL1', 'Doing', [ana, dev], 32, 4, 3],
    ['recT2', 'App store screenshots', 'recL1', 'To do', [cleo], 6, 9, 1],
    ['recT3', 'Push notification opt-in', 'recL1', 'Done', [dev], 10, -3, 2],
    ['recT4', 'Metering service', 'recL2', 'Doing', [ben], 40, 14, 3],
    ['recT5', 'Pricing page copy', 'recL2', 'To do', [cleo, ben], 8, 20, 2],
    ['recT6', 'Frankfurt cluster', 'recL3', 'Done', [cleo], 50, -12, 3],
    ['recT7', 'DPA update', 'recL3', 'Done', [ana], 4, -9, 1],
    ['recT8', 'Partner sign-up flow', 'recL4', 'Doing', [dev, ana], 18, -1, 3],
    ['recT9', 'Revenue share report', 'recL4', 'To do', [ben], 12, 15, 2],
  ]
  const records = {
    tblLaunches: {
      records: LAUNCHES.map(([id, name, stage, owner, date, created]) => ({
        id,
        createdTime: stamp(-created),
        fields: {
          Launch: name,
          Stage: stage,
          Owner: owner,
          'Launch date': day(date),
          Tasks: TASKS.filter((t) => t[2] === id).map((t) => t[0]),
          Hours: TASKS.filter((t) => t[2] === id).reduce((s, t) => s + t[5], 0),
          'Task count': TASKS.filter((t) => t[2] === id).length,
          Pitch: { state: 'generated', value: `${name}, ready when you are.`, isStale: false },
          Created: stamp(-created),
        },
      })),
    },
    tblTasks: {
      records: TASKS.map(([id, task, launch, status, people, hours, due, priority]) => ({
        id,
        createdTime: stamp(-30),
        fields: { Task: task, Launch: [launch], Status: status, Assignees: people, Hours: hours, Due: day(due), Priority: priority },
      })),
    },
  }

  let json = $state(JSON.stringify({ schema, records }, null, 2))
  let parseError = $state('')
  let result = $state.raw<AirtableImport | null>(null)
  let tables = $state.raw<BaseTable[]>([])
  // A new import opens a new base.
  let opened = $state(0)
  let showJson = $state(true)

  const byEmail = new Map(PEOPLE.map((p) => [p.email, p.id]))

  function open() {
    let input: { schema?: unknown; records?: unknown }
    try {
      input = JSON.parse(json)
    } catch (e) {
      parseError = e instanceof Error ? e.message : 'Not valid JSON'
      return
    }
    parseError = ''
    const r = baseFromAirtable(input.schema as Parameters<typeof baseFromAirtable>[0], (input.records ?? {}) as Parameters<typeof baseFromAirtable>[1], {
      // The page's people, by email; anyone else keeps the Airtable id.
      userId: (c) => (c.email ? byEmail.get(c.email) : undefined) ?? c.id,
    })
    // The people user fields choose from are page-wide: add the new ones, keep the rest.
    const extra = r.users.filter((u) => !PEOPLE.some((p) => p.id === u.id))
    if (extra.length) setFieldUsers([...PEOPLE, ...extra])
    result = r
    tables = r.tables
    opened += 1
  }

  const recordCount = $derived(result ? result.tables.reduce((s, t) => s + t.data.length, 0) : 0)
  const KIND_LABEL: Record<string, string> = { field: 'Field type', formula: 'Formula', view: 'View', link: 'Link', setting: 'Setting' }

  open()
</script>

<section class="base-demo">
  <div class="at-bar">
    <button type="button" class="at-open" onclick={open}>Open as a base</button>
    <button type="button" class="at-toggle" aria-expanded={showJson} onclick={() => (showJson = !showJson)}>
      {showJson ? 'Hide' : 'Show'} the Airtable JSON
    </button>
    {#if result}
      <span class="at-sum">
        {result.tables.length} tables, {recordCount} records, {result.users.length} people, {result.report.length} notes
      </span>
    {/if}
  </div>

  {#if showJson}
    <div class="at-panels">
      <label class="at-json">
        <span class="at-head">Schema and records, as the Web API returns them</span>
        <textarea bind:value={json} spellcheck="false" aria-invalid={parseError ? 'true' : undefined}></textarea>
        {#if parseError}<span class="at-error" role="alert">{parseError}</span>{/if}
      </label>
      <div class="at-report">
        <span class="at-head">What did not carry over as it was</span>
        {#if result && result.report.length}
          <ul>
            {#each result.report as item, i (i)}
              <li>
                <span class="at-kind at-kind-{item.kind}">{KIND_LABEL[item.kind]}</span>
                <b>{item.table} / {item.name}</b>
                <span class="at-msg">{item.message}</span>
              </li>
            {/each}
          </ul>
        {:else}
          <p class="at-none">Everything mapped.</p>
        {/if}
      </div>
    </div>
  {/if}

  <div class="at-base">
    {#key opened}
      <SvBase
        bind:tables
        editable
        sortable
        showRowNumbers
        expandRows
        rowNumberWidth={64}
        showRowSelection={false}
        rowHeight={40}
        containerHeight="100%"
        columnAdder
        fieldMenu
      />
    {/key}
  </div>
  <SvToaster />
</section>

<style>
  .base-demo { display: flex; flex-direction: column; flex: 1; min-height: 480px; height: 100%; gap: 10px; }
  .at-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; font-size: 13px; color: var(--sg-fg, #0f172a); }
  .at-open {
    height: 32px; padding: 0 14px; border: 0; border-radius: var(--sg-radius, 6px);
    background: var(--sg-accent, #2563eb); color: var(--sg-on-accent, #fff); font: inherit; font-weight: 600; cursor: pointer;
  }
  .at-toggle {
    height: 32px; padding: 0 12px; border: 1px solid var(--sg-border, #cbd5e1); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: inherit; cursor: pointer;
  }
  .at-sum { color: var(--sg-muted, #64748b); }
  .at-panels { flex: 0 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; height: 260px; }
  .at-json, .at-report {
    display: flex; flex-direction: column; gap: 6px; min-height: 0; padding: 10px 12px;
    border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius-lg, 10px);
    background: var(--sg-header-bg, var(--sg-bg, #fff)); color: var(--sg-fg, #0f172a);
  }
  .at-head { font-size: 12px; font-weight: 600; color: var(--sg-muted, #64748b); }
  .at-json textarea {
    flex: 1; min-height: 0; resize: none; padding: 8px; border: 1px solid var(--sg-border, #e2e8f0); border-radius: var(--sg-radius, 6px);
    background: var(--sg-bg, #fff); color: var(--sg-fg, #0f172a); font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  }
  .at-json textarea[aria-invalid='true'] { border-color: var(--sg-danger, #dc2626); }
  .at-error { font-size: 12px; color: var(--sg-danger, #dc2626); }
  .at-report ul { list-style: none; margin: 0; padding: 0; overflow: auto; font-size: 12.5px; }
  .at-report li { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 8px; padding: 6px 0; border-top: 1px solid var(--sg-border, #e2e8f0); }
  .at-report li:first-child { border-top: 0; }
  .at-msg { flex-basis: 100%; color: var(--sg-muted, #64748b); }
  .at-kind {
    padding: 1px 6px; border-radius: 999px; font-size: 11px; font-weight: 600;
    border: 1px solid var(--sg-border, #e2e8f0); color: var(--sg-muted, #64748b);
  }
  .at-kind-formula, .at-kind-field { border-color: var(--sg-danger, #dc2626); color: var(--sg-danger, #dc2626); }
  .at-none { margin: 0; color: var(--sg-muted, #64748b); }
  .at-base { flex: 1 1 auto; min-height: 380px; display: flex; flex-direction: column; }
  @media (max-width: 720px) {
    .at-panels { grid-template-columns: minmax(0, 1fr); height: auto; }
    .at-json textarea { height: 200px; flex: none; }
    .at-report ul { max-height: 220px; }
  }
</style>
