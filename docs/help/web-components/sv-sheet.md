# `<sv-sheet>`: the spreadsheet as a custom element

The spreadsheet shell of `@svgrid/enterprise`, ribbon and formula engine
included, as one custom element for a page or a host with no Svelte in its
build: React, Vue, Angular, or a plain `<script>` tag. It is part of the
paid pack and runs unlicensed with the pack's watermark, as every entry
does.

**The reference below is generated** from `<SvSheet>`'s own `Props` type by
`packages/enterprise/scripts/generate-sheet-surface.mjs`, the same way the
[`<sv-grid>`](sv-grid.md) and [`<sv-chart>`](sv-chart.md) references are,
and the package's tests fail if it drifts.

## Loading it

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@svgrid/enterprise/dist/wc/sv-sheet-element.js"></script>

<sv-sheet id="sheet" height="480" rows="30" columns="10"></sv-sheet>
<script type="module">
  const sheet = document.getElementById('sheet')
  sheet.data = [{ name: 'Budget', cells: [['Item', 'Amount'], ['Rent', '1200'], ['Total', '=SUM(B2:B2)']] }]
  sheet.addEventListener('ready', () => console.log(sheet.getState()))
  sheet.addEventListener('change', (e) => console.log(e.detail))       // the reasons, once per tick
  sheet.addEventListener('action', (e) => {
    if (e.detail.action === 'file-save-xlsx') { e.preventDefault(); upload(sheet.toXlsx()) }
  })
</script>
```

From npm, `import '@svgrid/enterprise/wc'` registers the element. The React
and Vue wrappers are `@svgrid/enterprise/wc/react` and
`@svgrid/enterprise/wc/vue`; Angular uses the element directly with
`CUSTOM_ELEMENTS_SCHEMA`, the way the [Angular page](angular.md) shows for
`<sv-grid>` before its wrapper existed.

Save As and Open need `jszip`, an optional peer the element loads on demand.
A page that uses them names it in an import map:

```html
<script type="importmap">{ "imports": { "jszip": "https://cdn.jsdelivr.net/npm/jszip@3/+esm" } }</script>
```

## Attributes vs properties

The [same rule as the grid element](sv-grid.md#attributes-vs-properties):
primitives are attributes, arrays, objects and functions are properties.
`data`, `workbook`, `document`, `formats`, `columnWidths`, `extras` and
`localization` are properties; `height` takes a number or `"100%"`, so it
keeps a string attribute.

A document built with `createSheetDocument` from `@svgrid/enterprise` is
assigned as `sheet.document`; `ready` hands the api and the document back
and parks both on the element (`sheet.api`, `sheet.document`), so a listener
bound after the mount still reaches them.

**Content assigned after the element is on the page is taken up.** A custom
element is upgraded the moment its definition loads, which on a plain page
is before the script that sets its properties runs, so `sheet.data = [...]`
in the quick start above arrives after the shell has already mounted on an
empty sheet. The element remounts on it. That happens only while nothing has
been done to the sheet: once a cell has been written, a later `data`,
`workbook` or `document` is ignored rather than throwing the work away,
which is what a React render passing a fresh array does on every parent
update. To load content over a sheet that has been edited, call
`setState(state)` or `newWorkbook()`.

## Events and methods

Every callback of the component is an event with the callback's argument
as `detail`. `action` is the one whose answer matters: a listener that calls
`event.preventDefault()` has taken the action over, and the shell's own
dialog stays closed, which is what returning `true` from `onAction` does.

The component's methods are on the element: `getState()`, `setState(state)`,
`refresh()`, `act(action)`, `open(file)`, `toXlsx()`, `toCsv()`,
`newWorkbook()`, `print()` and `printHtml()`.

```js
sheet.act('sort-asc')
const state = sheet.getState()
localStorage.setItem('budget', JSON.stringify(state))
```

## React and Vue

```tsx {nocheck}
import { useRef } from 'react'
import { SvSheet, type SvSheetHandle } from '@svgrid/enterprise/wc/react'

const ref = useRef<SvSheetHandle>(null)

<SvSheet ref={ref} data={sheets} height={480}
  onAction={(detail, e) => { if (detail.action === 'file-print') { e.preventDefault(); printMyWay() } }}
  onChange={(reasons) => save(ref.current?.element?.getState())} />
```

```vue {nocheck}
<script setup>
import { SvSheet } from '@svgrid/enterprise/wc/vue'
</script>

<SvSheet :data="sheets" :height="480" @change="save" @ready="({ api }) => (grid = api)" />
```

The React wrapper assigns object props as properties (React 18 and earlier
stringify them onto attributes) and binds the handlers once; the Vue wrapper
forwards every prop with the `.prop` modifier. Both expose the element, with
its methods, through the ref.

<!-- BEGIN generated reference - packages/enterprise/scripts/generate-sheet-surface.mjs -->

### Attributes (11)

Primitives, so they work in plain HTML as well as through a property.

| Attribute | Property | Type |
| --- | --- | --- |
| `rows` | `rows` | `number` |
| `columns` | `columns` | `number` |
| `height` | `height` | `number \| '100%'` |
| `column-width` | `columnWidth` | `number` |
| `row-height` | `rowHeight` | `number` |
| `look` | `look` | `'excel' \| 'theme'` |
| `comment-author` | `commentAuthor` | `string` |
| `show-ribbon` | `showRibbon` | `boolean` |
| `show-formula-bar` | `showFormulaBar` | `boolean` |
| `show-tabs` | `showTabs` | `boolean` |
| `show-status-bar` | `showStatusBar` | `boolean` |

### Properties only (8)

Arrays, objects and functions. An HTML attribute is a string, so these can
only be assigned in script: `el.document = doc`.

| Property | Type |
| --- | --- |
| `document` | `SheetDocument` |
| `workbook` | `Workbook` |
| `data` | `ReadonlyArray<SheetData>` |
| `columnWidths` | `Readonly<Record<string, number>>` |
| `formats` | `Readonly<Record<string, CellFormatEntry>>` |
| `extras` | `ReadonlyArray<'insert-table' \| 'insert-chart'>` |
| `localization` | `SheetLocalization` |
| `presence` | `ReadonlyArray<SheetPresence>` |

### Events (4)

`detail` is the callback's argument, or an object keyed by the parameter names
when it takes more than one. `action` is cancelable: `event.preventDefault()`
takes the action over, as returning `true` from `onAction` does.

| Event | From | `detail` |
| --- | --- | --- |
| `action` | `onAction` | `{ action, cmd }` |
| `ready` | `onReady` | `{ api, document }` |
| `change` | `onChange` | `reasons` |
| `presence` | `onPresence` | `me` |

### Methods (12)

The component's own, on the element once `ready` has fired.

| Method | What it does |
| --- | --- |
| `getState(): SheetState` | The document as plain JSON. |
| `setState(state: SheetState): void` | Put a saved document back. |
| `refresh(): void` | Repaint after a write the shell could not see. |
| `act(action: RibbonActionId): void` | Run a ribbon action as if its button had been clicked. |
| `open(file: Blob & { name?: string }): Promise<void>` | Replace the document with an .xlsx, .ods or .csv file. |
| `toXlsx(): Promise<Blob>` | The document as an .xlsx Blob. |
| `toOds(): Promise<Blob>` | The document as an .ods Blob, which LibreOffice Calc opens. |
| `toXls(): Blob` | The document as an .xls Blob, which Excel 97-2003 opens. |
| `toCsv(): string` | The active sheet as CSV. |
| `newWorkbook(): void` | Start over with one empty sheet. |
| `print(): void` | The active sheet in the print dialog. |
| `printHtml(): string` | The page File > Print would open. |

<!-- END generated reference -->

## What it does not carry

Svelte snippets cannot cross the custom-element boundary, and `<SvSheet>`
has none in its props, so nothing is left out. What the element cannot do
is what the component cannot: see [the shell page](../cells/spreadsheet-shell.md#what-it-does-not-do).

## See also

- [The spreadsheet shell](../cells/spreadsheet-shell.md), the component
  behind the element: its ribbon, dialogs, document and files.
- [Enterprise features from the element](enterprise.md), for the export,
  import, print and pivot entries that work beside `<sv-grid>`.
