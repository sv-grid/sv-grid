// Excel export from an Angular host.
//
// `@svgrid/enterprise/export` is plain JavaScript - no Svelte in your build -
// so it works under the Angular CLI. The same is true of `/import`, `/print`,
// `/pivot` and `/license`. The Kanban and scheduler views are the exception:
// they are Svelte components, so they need a Svelte-aware bundler, which the
// Angular CLI is not.
//
// The api appears on the component once `apiready` has fired. It is typed
// `unknown` there because the wrapper does not depend on the grid's types, so
// the enterprise call needs a cast.
import { Component, ViewChild } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { exportGrid } from '@svgrid/enterprise/export'
import { people, columns } from '../data'

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px">
      <button type="button" [disabled]="!ready || busy" (click)="exportXlsx()">
        {{ busy ? 'Building…' : 'Export to Excel' }}
      </button>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          (apiready)="ready = true"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  ready = false
  busy = false

  @ViewChild(SvGridComponent) grid?: SvGridComponent

  async exportXlsx(): Promise<void> {
    const api = this.grid?.api
    if (!api) return
    this.busy = true
    try {
      await exportGrid(api as Parameters<typeof exportGrid>[0], {
        format: 'xlsx',
        filename: 'people',
      })
    } finally {
      this.busy = false
    }
  }
}
