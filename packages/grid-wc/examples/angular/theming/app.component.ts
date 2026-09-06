// Theming through `--sg-*` custom properties. They are ordinary CSS custom
// properties, so they cascade from any ancestor - which is also why they reach
// into <sv-grid-shadow>.
import { Component, signal } from '@angular/core'
import { SvGridComponent } from '@svgrid/grid-wc/angular'
import { people, columns } from '../data'

const THEMES: Record<string, Record<string, string>> = {
  Light: {},
  Dark: {
    '--sg-bg': '#0b1220',
    '--sg-fg': '#e2e8f0',
    '--sg-border': '#1e293b',
    '--sg-header-bg': '#111a2e',
    '--sg-row-hover': '#111a2e',
  },
  Warm: {
    '--sg-bg': '#fffaf5',
    '--sg-fg': '#42302a',
    '--sg-border': '#f0dcc9',
    '--sg-header-bg': '#fdf1e4',
    '--sg-accent': '#c2410c',
  },
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [SvGridComponent],
  template: `
    <div
      style="height:100%;padding:16px;display:flex;flex-direction:column;gap:12px"
      [style]="tokens()"
    >
      <div style="display:flex;gap:8px">
        @for (name of themeNames; track name) {
          <button
            style="padding:4px 10px;border-radius:6px;border:1px solid #cbd5e1;cursor:pointer"
            [style.background]="theme() === name ? '#e2e8f0' : '#fff'"
            (click)="theme.set(name)"
          >
            {{ name }}
          </button>
        }
      </div>
      <div style="flex:1;min-height:0">
        <sv-grid
          [data]="people"
          [columns]="columns"
          [sortable]="true"
          [filterable]="true"
          [zebraRows]="true"
        ></sv-grid>
      </div>
    </div>
  `,
})
export class AppComponent {
  readonly people = people
  readonly columns = columns
  readonly themeNames = Object.keys(THEMES)
  readonly theme = signal('Light')

  tokens(): Record<string, string> {
    return THEMES[this.theme()] ?? {}
  }
}
