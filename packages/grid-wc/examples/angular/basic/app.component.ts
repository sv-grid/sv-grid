// The smallest useful grid. `SvGridComponent`'s selector IS <sv-grid>, so the
// tag is the same one you would write in plain HTML and no
// CUSTOM_ELEMENTS_SCHEMA is needed.
import { Component } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px">
      <sv-grid [data]="people" [columns]="columns" [sortable]="true" [filterable]="true"></sv-grid>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
}
