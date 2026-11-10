---
seoTitle: Table Database Web Component Built in Svelte: sv-base | SvGrid
---

# `<sv-base>`: SvGrid Base as a custom element

[SvGrid Base](../base/start.md), tables with typed fields, linked records,
views, forms and automations, as one custom element for a page or a host with
no Svelte in its build: React, Vue, Angular, or a plain `<script>` tag. It is
part of `@svgrid/enterprise` (Suite edition): without a key it runs and shows
the pack's watermark and notice, as every entry does.

The element wraps `<SvBase>` and calls `enableBase()` itself.

## Loading it

```html
<script type="module" src="https://cdn.jsdelivr.net/npm/@svgrid/enterprise/dist/wc/sv-base-element.js"></script>

<sv-base id="base" height="480" editable sortable show-row-numbers column-adder field-menu></sv-base>
<script type="module">
  const base = document.getElementById('base')
  base.users = [{ id: 'u1', name: 'Ana Ruiz' }, { id: 'u2', name: 'Ben Okafor' }]
  base.currentUser = base.users[0]
  base.tables = [
    {
      id: 'tasks', name: 'Tasks', primaryField: 'title',
      columns: [
        { field: 'title', header: 'Task', fieldType: 'text' },
        { field: 'owner', header: 'Owner', fieldType: 'user' },
        { field: 'due', header: 'Due', fieldType: 'date' },
      ],
      data: [{ id: 't1', title: 'Draft the launch post', owner: 'u1', due: '2026-11-04' }],
    },
  ]
  base.addEventListener('tableschange', (e) => save(e.detail))   // the whole list, after every change
</script>
```

From npm, `import '@svgrid/enterprise/wc/base'` registers the element. The
tables take the same shape as `<SvBase tables>`: see
[the field types](../fields.md) and [linked records](../base/linked-records.md).

Registering is guarded: a page that loads the file twice (the CDN copy beside
an npm build, or one file under two URLs) keeps the first definition instead
of throwing on the second.

## The license key

```html
<sv-base license-key="YOUR-LICENSE-KEY"></sv-base>
```

The file carries its own copy of the pack, so `setLicenseKey()` imported from
`@svgrid/enterprise/license` sets the key of a different copy and the element
keeps its watermark. Pass the key to the element instead. The attribute is read
before the first render, so the watermark never shows; a key assigned later as
a property (`base.licenseKey = key`) takes the watermark and the notice down.

## Attributes vs properties

The [same rule as the grid element](sv-grid.md#attributes-vs-properties):
primitives are attributes, arrays and objects are properties.

| Attribute | Property | Type |
| --- | --- | --- |
| `height` | `height` | pixels (`480`) or a CSS length (`100%`). Default 560. |
| `container-height` | `containerHeight` | the same as `height`, under `<SvBase>`'s name |
| `active-table` | `activeTable` | the id of the table shown first |
| `active-view` | `activeView` | the id of the view shown first (one table) |
| `primary-field` | `primaryField` | the field that names a record (one table) |
| `editable` | `editable` | `boolean` |
| `sortable` | `sortable` | `boolean` |
| `show-row-numbers` | `showRowNumbers` | `boolean` |
| `column-adder` | `columnAdder` | `boolean`: the "+" that adds a field |
| `field-menu` | `fieldMenu` | `boolean`: the header menu that edits, hides and deletes a field |
| `expand-rows` | `expandRows` | `boolean`: the button on each row that opens the record |
| `row-height` | `rowHeight` | `number` |
| `license-key` | `licenseKey` | `string` |
| `read-only` | `readOnly` | `boolean`: look, do not touch (a share link) |
| `permissions` | `permissions` | JSON: what the signed-in person may do, as [`<SvBase permissions>`](../base/permissions.md) |

| Property only | Type |
| --- | --- |
| `tables` | `BaseTable[]`: several tables, shown as tabs |
| `data`, `columns`, `views` | one table, without tabs |
| `viewTypes` | the view types the view bar offers |
| `users` | the people user fields choose from (`setFieldUsers`) |
| `messages` | the words the base shows, in your language ([A base in your language](../base/languages.md)) |
| `currentUser` | who is signed in: what "created by" and "last modified by" write (`setCurrentUser`) |
| `options` | any other `<SvBase>` or `<SvGrid>` prop, passed through as is |

A boolean attribute is on when present, whatever its value: `editable="false"`
is editable. Remove the attribute, or set the property to `false`.

```html
<sv-base id="crm" editable expand-rows permissions='{"canDelete": false, "fields": {"deals.cost": "hidden"}}'></sv-base>
<script type="module">
  const base = document.getElementById('crm')
  base.addEventListener('mention', (e) => notify(e.detail.mentioned, e.detail.comment))
</script>
```

`users` and `currentUser` are one list for the page, as they are in a Svelte
app: two elements that set different lists share the last one set.

## Events

| Event | `detail` |
| --- | --- |
| `tableschange` | the whole `tables` list, after an edit, a record added or deleted, a field, a view, an automation or a table changed |
| `viewschange` | the views of the one table (without `tables`; with it, a view change is a `tableschange`) |
| `remotechange` | changes made in the database by someone else, for tables with a realtime `source` |
| `ready` | `{ api }`, when the shown table's grid mounts. It fires again when another tab is opened. |
| `cellchange` | `{ table, row, columnId, value, oldValue }`, after a cell of the shown table changed |
| `recordadd` | `{ table, row }`, after a record was added to the shown table |
| `recordsdelete` | `{ table, ids, rows }`, after records of the shown table were deleted (they are in the trash) |
| `trashchange` | the whole trash, to store, after something was deleted, restored or emptied |
| `mention` | `{ comment, mentioned, rowId, tableId, record }`, when a comment mentions people: send the notifications |

`ready` parks the api on the element (`base.api`) and `tableschange` parks the
list (`base.tables`), so code that runs later reads them without having caught
the event.

**Assigning `tables` loads it.** The element is upgraded the moment its file
loads, which on a plain page is before the script that sets its properties, so
the first `base.tables = [...]` arrives after an empty mount and is shown in its
place. A later assignment of a new list replaces what is on screen, edits
included, which is what reloading from a server wants. Handing back the list
`tableschange` gave you, or `base.tables` itself, is not a reload.

With `data` and `columns` instead of `tables`, the grid writes edits into the
row objects of `data` and no `tableschange` fires; use `tables` with one table
when the app needs to hear about every edit.

## React and Vue

Both wrappers register the element on import and hand every prop over as a DOM
property, so `tables` arrives as the array it is, also in React 18, which
would otherwise write it to an attribute as a string. Events become `onX`
callbacks in React and `@x` listeners in Vue.

```tsx
import { useRef } from 'react'
import { SvBase, type SvBaseHandle } from '@svgrid/enterprise/wc/base/react'

export function Projects({ tables, save }) {
  const base = useRef<SvBaseHandle>(null)
  return (
    <SvBase ref={base} tables={tables} editable height={560}
      onTableschange={(next) => save(next)} />
  )
}
```

```vue
<script setup>
import { SvBase } from '@svgrid/enterprise/wc/base/vue'
defineProps(['tables'])
const emit = defineEmits(['save'])
</script>

<template>
  <SvBase :tables="tables" editable :height="560" @tableschange="(next) => emit('save', next)" />
</template>
```

The ref's `element` is the `<sv-base>` itself, and `element.api` is the shown
grid's api.

## Styling

`<sv-base>` renders in the light DOM, like `<sv-grid>` and `<sv-sheet>`, so the
`--sg-*` theme tokens set on the page or on the element reach it, and its dialogs, menus and toasts portal to `document.body`. The element
draws the toaster that automation notices and save errors show in; with several
`<sv-base>` elements on a page, only the first one draws it.

## What it does not carry

Svelte snippets cannot cross the custom-element boundary, so `<SvBase>` props
that take one (a custom cell, a custom header) are not reachable. Custom field
types registered with `registerFieldType` are registered in the element's own
copy of the pack, which the page cannot import, so only the built-in field
types are available.

## See also

- [Demo 714](https://svgrid.com/demos/714-base-web-component/), the element
  driven from plain DOM code with an event log.
- [SvGrid Base](../base/start.md), the component behind the element.
- [`<sv-sheet>`](sv-sheet.md), the spreadsheet as an element.
