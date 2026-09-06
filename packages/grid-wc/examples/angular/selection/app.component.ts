// Row checkboxes, with the selected rows handed back so you can act on them.
import { Component, computed, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns, type Person } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <div style="font:13px system-ui;color:#64748b">{{ summary() }}</div>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          [showRowSelection]="true"
          (rowselectionchange)="selected.set($any($event).rows)"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly selected = signal<Person[]>([])
  readonly total = computed(() => this.selected().reduce((sum, r) => sum + r.amount, 0))

  summary(): string {
    const n = this.selected().length
    if (n === 0) return 'Tick some rows to total them'
    const money = this.total().toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    })
    return `${n} selected · ${money}`
  }
}
