// Grouping by one or two columns, with an aggregate in the group row.
// `groupBy` is an array, which Angular assigns as a property - replace it, do
// not mutate it, or the grid will not see the change.
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <div style="display:flex;gap:8px;font:13px system-ui">
        @for (choice of choices; track choice.join('+')) {
          <button
            style="padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer"
            [style.background]="groupBy().join() === choice.join() ? '#e2e8f0' : '#fff'"
            (click)="groupBy.set(choice)"
          >
            {{ choice.join(' + ') || 'No grouping' }}
          </button>
        }
      </div>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="withTotals"
          [sortable]="true"
          [filterable]="true"
          [groupable]="true"
          [groupBy]="groupBy()"
          [groupFooters]="true"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly choices: string[][] = [['team'], ['country'], ['team', 'country'], []]
  readonly groupBy = signal<string[]>(['team'])
  readonly withTotals = columns.map((c) => (c.id === 'amount' ? { ...c, summary: 'sum' } : c))
}
