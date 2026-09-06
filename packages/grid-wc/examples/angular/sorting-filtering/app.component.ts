// A filter row under the headers, multi-column sort, and the current sort read
// back into a signal so it can drive your own UI.
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

type Sort = { id: string; desc: boolean }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <p style="margin:0;font:13px system-ui;color:#64748b">Sorted by: {{ summary() }}</p>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          [showFilterRow]="true"
          (sortingchange)="sorting.set($any($event))"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly sorting = signal<Sort[]>([])

  summary(): string {
    const s = this.sorting()
    if (s.length === 0) return 'nothing yet - click a header, then shift-click a second one'
    return s.map((x) => `${x.id} ${x.desc ? 'desc' : 'asc'}`).join(', ')
  }
}
