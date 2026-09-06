// Inline editing, written back into a signal.
//
// `cellvaluechange` fires once per committed edit; swap the local update for
// your own save call.
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns, type Person } from '../data'

type CellEdit = { rowIndex: number; columnId: string; newValue: unknown }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <p style="margin:0;font:13px system-ui;color:#64748b">
        Double-click a Name or Amount cell. Last edits: {{ log().slice(-3).join(' · ') || 'none yet' }}
      </p>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="rows()"
          [columns]="editableColumns"
          [sortable]="true"
          [filterable]="true"
          [editable]="true"
          (cellvaluechange)="onEdit($any($event))"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly rows = signal<Person[]>([...people])
  readonly log = signal<string[]>([])
  readonly editableColumns = columns.map((c) =>
    c.id === 'name' || c.id === 'amount' ? { ...c, editable: true } : c,
  )

  onEdit(e: CellEdit): void {
    this.rows.update((rows) =>
      rows.map((row, i) => (i === e.rowIndex ? ({ ...row, [e.columnId]: e.newValue } as Person) : row)),
    )
    this.log.update((l) => [...l, `${e.columnId} = ${String(e.newValue)}`])
  }
}
