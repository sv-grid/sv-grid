// Server-side data: the grid renders the page you hand it and tells you when
// the user wants a different one.
//
// `externalSort` and `externalPagination` stop it doing the work locally;
// `rowCount` is how it knows how many pages exist.
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns, type Person } from '../data'

const PAGE_SIZE = 25
type Sort = { id: string; desc: boolean }

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div style="height:100%;padding:16px">
      <sv-grid
        [data]="rows()"
        [columns]="columns"
        [loading]="loading()"
        [sortable]="true"
        [externalSort]="true"
        [externalPagination]="true"
        [pageable]="true"
        [pageSize]="pageSize"
        [rowCount]="total()"
        [pageIndex]="page()"
        (sortingchange)="onSort($any($event))"
        (paginationchange)="onPage($any($event).pageIndex)"
      ></sv-grid>
    </div>
  `,
})
export class AppComponent {
  readonly columns = columns
  readonly pageSize = PAGE_SIZE
  readonly rows = signal<Person[]>([])
  readonly total = signal(0)
  readonly loading = signal(true)
  readonly page = signal(0)
  private sort: Sort[] = []

  constructor() {
    void this.load()
  }

  onSort(sort: Sort[]): void {
    this.sort = sort
    this.page.set(0)
    void this.load()
  }

  onPage(pageIndex: number): void {
    this.page.set(pageIndex)
    void this.load()
  }

  private async load(): Promise<void> {
    this.loading.set(true)
    const res = await this.fetchPage()
    this.rows.set(res.rows)
    this.total.set(res.total)
    this.loading.set(false)
  }

  /** Pretend this is a network call. */
  private fetchPage(): Promise<{ rows: Person[]; total: number }> {
    const sorted = [...people].sort((a, b) => {
      for (const s of this.sort) {
        const av = a[s.id as keyof Person]
        const bv = b[s.id as keyof Person]
        if (av === bv) continue
        return (av > bv ? 1 : -1) * (s.desc ? -1 : 1)
      }
      return 0
    })
    const start = this.page() * PAGE_SIZE
    return new Promise((resolve) =>
      setTimeout(
        () => resolve({ rows: sorted.slice(start, start + PAGE_SIZE), total: sorted.length }),
        250,
      ),
    )
  }
}
