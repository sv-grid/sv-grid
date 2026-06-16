<script lang="ts">
  /**
   * 84. Built-in editor types - select / rich-select / textarea + cellEditor slot
   * ----------------------------------------------------------------------------
   * The grid ships seven built-in editor types out of the box; this
   * demo shows the three new ones (select, rich-select, textarea)
   * alongside a custom slot for cases none of the built-ins fit.
   *
   *   - `editorType: 'select'`       native <select> dropdown
   *   - `editorType: 'rich-select'`  combobox with typeahead search
   *   - `editorType: 'textarea'`     multi-line editor (Enter for newline)
   *   - `cellEditor: snippet`        BYO editor that gets value + commit + cancel
   *
   * Double-click any cell to enter edit mode. Tab / Esc / blur all
   * commit. The "Body" column uses a textarea so a long description
   * gets its own multi-line editor instead of cramping into one line.
   * The "Severity" column uses a custom slider as a `cellEditor`
   * snippet - shows how to wire a fully custom in-cell control.
   */
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    columnFilteringFeature,
    type ColumnDef,
    type EditorContext,
  } from 'sv-grid-core'

  type Issue = {
    id: string
    title: string
    project: 'Web' | 'Mobile' | 'API' | 'Infra'
    priority: 'low' | 'medium' | 'high' | 'urgent'
    body: string
    severity: number      // 0-100, edited via custom slider
    assignee: string
  }

  let rows = $state<Issue[]>([
    { id: 'BUG-1001', title: 'Login button not working on Safari', project: 'Web',    priority: 'high',   severity: 78, assignee: 'Ada Lovelace',
      body: 'Repro on Safari 17.4 macOS 14:\n1. Open /login\n2. Enter creds\n3. Click "Sign in"\nExpected: redirect to /dashboard.\nActual: button greys for ~600ms then nothing happens; network shows no request.' },
    { id: 'BUG-1002', title: 'Push notifications silent after iOS upgrade', project: 'Mobile', priority: 'urgent', severity: 92, assignee: 'Linus Torvalds',
      body: 'Affects users on iOS 18+. APNS payload arrives but the OS silences the sound. Probably the new "Time Sensitive" entitlement; needs Info.plist update + push to TestFlight.' },
    { id: 'BUG-1003', title: 'API rate limit returns 200', project: 'API',    priority: 'medium', severity: 45, assignee: 'Grace Hopper',
      body: 'When the consumer exceeds 100 rps, the proxy keeps proxying instead of returning 429. The upstream service IS rejecting but we forward 200 with an empty body.' },
    { id: 'BUG-1004', title: 'Terraform plan diff on healthy infra', project: 'Infra',  priority: 'low',    severity: 25, assignee: 'Donald Knuth',
      body: 'On main, `terraform plan` shows a diff on the load balancer\'s tags every run. Cosmetic only - apply is a no-op - but spams the PR with churn.' },
    { id: 'BUG-1005', title: 'Search returns stale results after edit', project: 'Web',    priority: 'high',   severity: 70, assignee: 'Margaret Hamilton',
      body: 'Edit a record, search for it by the new title - you get the old version for ~10s until the search index catches up. Either lower the index refresh interval or invalidate on write.' },
    { id: 'BUG-1006', title: 'Mobile keyboard covers input on focus',  project: 'Mobile', priority: 'medium', severity: 50, assignee: 'Tim Berners-Lee',
      body: 'On both iOS Safari and Android Chrome, focusing the bottom-most form field scrolls the viewport such that the keyboard covers half the field. Need a `scroll-margin-bottom` pass on all editable inputs.' },
  ])

  const features = tableFeatures({ rowSortingFeature, columnFilteringFeature })

  const PROJECTS = ['Web', 'Mobile', 'API', 'Infra']
  const PRIORITIES = [
    { value: 'low',     label: 'Low' },
    { value: 'medium',  label: 'Medium' },
    { value: 'high',    label: 'High' },
    { value: 'urgent',  label: 'Urgent' },
  ]
  const ASSIGNEES = [
    'Ada Lovelace', 'Linus Torvalds', 'Grace Hopper', 'Donald Knuth',
    'Margaret Hamilton', 'Tim Berners-Lee', 'Anders Hejlsberg',
    'Bjarne Stroustrup', 'Brendan Eich', 'Yukihiro Matsumoto',
    'Rasmus Lerdorf', 'Guido van Rossum', 'James Gosling', 'Brian Kernighan',
  ]

  const columns: ColumnDef<typeof features, Issue>[] = [
    { field: 'id',       header: 'ID',       editable: false, width: 110 },
    { field: 'title',    header: 'Title',    editorType: 'text', width: 280 },
    // editorType: 'select' - native <select>, smallest possible UI.
    { field: 'project',  header: 'Project',  editorType: 'select',
      editorOptions: PROJECTS, width: 120 },
    // editorType: 'list' - same as the existing demos, popover-based.
    { field: 'priority', header: 'Priority', editorType: 'list',
      editorOptions: PRIORITIES, width: 130 },
    // editorType: 'rich-select' - searchable combobox; great for >10 options.
    { field: 'assignee', header: 'Assignee', editorType: 'rich-select',
      editorOptions: ASSIGNEES, width: 200 },
    // editorType: 'textarea' - multi-line editor expands the cell while editing.
    { field: 'body',     header: 'Body (multi-line)', editorType: 'textarea', width: 360 },
    // cellEditor: custom snippet - here, a slider for the severity score.
    { field: 'severity', header: 'Severity (slider)', editorType: 'number', width: 200,
      cellEditor: SeverityEditor },
  ]
</script>

{#snippet SeverityEditor(ctx: EditorContext<Issue>)}
  {@const live = Number(ctx.value ?? 0)}
  <div class="severity-editor">
    <input
      type="range" min="0" max="100" step="1"
      value={live}
      oninput={(e) => {
        // Live preview while dragging - update() writes the draft but
        // keeps the editor open so the user can keep adjusting.
        ctx.update(Number((e.currentTarget as HTMLInputElement).value))
      }}
      onchange={(e) => {
        // Mouse release / keyboard final - commit() writes + closes.
        ctx.commit(Number((e.currentTarget as HTMLInputElement).value))
      }}
      onkeydown={(e) => {
        if (e.key === 'Escape') ctx.cancel()
        else if (e.key === 'Enter') ctx.commit()
      }}
    />
    <span class="severity-num">{live}</span>
  </div>
{/snippet}

<section class="flex flex-col flex-1 min-h-0 gap-3">
  <div class="info-strip shrink-0">
    <p>
      <strong>Double-click</strong> any cell to edit. The <em>Project</em> column uses
      <code>editorType: 'select'</code>, <em>Assignee</em> uses <code>'rich-select'</code> (try typing),
      <em>Body</em> uses <code>'textarea'</code> (Enter inserts a newline, Tab commits),
      and <em>Severity</em> uses a custom <code>cellEditor</code> slot.
    </p>
  </div>

  <div class="flex-1 min-h-0">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      filterMode="menu"
      selectionMode="cell"
      showPagination={false}
      enableInlineEditing={true}
      enableCellSelection={true}
      enableRowSummaries={false}
      rowHeight={44}
      containerHeight="100%"
      fitColumns={false}
    />
  </div>
</section>

<style>
  .info-strip {
    border: 1px solid var(--sg-border, #e2e8f0);
    background: linear-gradient(135deg, rgba(99,102,241,0.04), rgba(168,85,247,0.03));
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 13px;
    color: var(--sg-fg, #0f172a);
  }
  .info-strip code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
                     background: rgba(99,102,241,0.10); padding: 1px 5px; border-radius: 3px;
                     color: #4338ca; font-size: 12px; }

  .severity-editor {
    display: flex; align-items: center; gap: 8px;
    width: 100%; padding: 0 6px;
  }
  .severity-editor input[type="range"] { flex: 1; }
  .severity-num {
    font-variant-numeric: tabular-nums; font-weight: 700;
    min-width: 30px; text-align: right; color: var(--sg-fg, #0f172a);
  }
</style>
