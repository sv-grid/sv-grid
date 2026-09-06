// Client-side paging. `pageSize` is the INITIAL page size, read once at mount -
// change pages through the footer or the grid api, not by reassigning it.
import { Component } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px">
      <sv-grid
        [data]="people"
        [columns]="columns"
        [sortable]="true"
        [filterable]="true"
        [pageable]="true"
        [pageSize]="25"
        [pageSizeOptions]="[10, 25, 50, 100]"
        paginationPosition="bottom"
      ></sv-grid>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
}
