# A base in your language

Every word a base shows comes from one table of messages: the tab bar, the
view bar and its panels, the record view and its activity, forms, the field
editor and the field types, menus, notices, color and icon names, and what the
grid and the calendar draw inside a base. English is the default. Hand over the words you have, and a key you leave out stays
English.

> SvGrid Base is part of the **Suite edition** of `@svgrid/enterprise`. Without a key it runs with a watermark.

```ts
import { setBaseMessages } from '@svgrid/enterprise/base'

setBaseMessages({
  'shell.addTable': 'Tabelle hinzufügen',
  'shell.trash': 'Papierkorb',
  'viewbar.filter': 'Filtern',
  'viewbar.sort': 'Sortieren',
  'viewbar.hideFields': 'Felder ausblenden',
  'record.activity': 'Aktivität',
  'record.comment': 'Kommentieren',
  'fields.typeText': 'Einzeiliger Text',
})
```

Or per base, as a prop. `<sv-base>` takes the same object as its `messages`
property:

```svelte
<SvBase bind:tables messages={de} editable />
```

The words are page-wide, as the people of `setFieldUsers` are: the last base
to set them wins, and an unmount puts English back. A change shows at once,
in every open panel and menu.

## The keys

`BASE_MESSAGES` lists every key with its English text, so a translator can
start from it:

```ts
import { BASE_MESSAGES } from '@svgrid/enterprise/base'

const english = Object.entries(BASE_MESSAGES) // [['shell.addTable', 'Add table'], ...]
```

A key is `area.camelCase`: `shell` for the tab bar, the trash, import and the
notices; `viewbar` for the view bar, its panels and the list, inbox, chart
and dashboard views, with `viewbar.calendar.*` for a calendar's own buttons;
`grid` for what the grid draws itself: its column menu, filter panel, find bar
and the names a screen reader reads; `record` for the record view, forms, comments and the
cell editors; `fields` for the field editor, the field types and the field
menu; `extras` for automations; `palette` for color and icon names.

## Placeholders and counts

A placeholder is a name in braces, filled in where the message is used. Keep
it in your translation, anywhere in the sentence:

```ts
setBaseMessages({ 'record.minutesAgo.other': 'vor {count} Minuten' })
```

A count has two keys, `.one` and `.other`:

```ts
setBaseMessages({
  'viewbar.records.one': '{count} Datensatz',
  'viewbar.records.other': '{count} Datensätze',
})
```

A language with more forms names them (`.few`, `.many`) and passes the rule
that picks one:

```ts
const pl = new Intl.PluralRules('pl')
setBaseMessages(
  {
    'viewbar.records.one': '{count} rekord',
    'viewbar.records.few': '{count} rekordy',
    'viewbar.records.many': '{count} rekordów',
  },
  { plural: (n) => pl.select(n) },
)
```

## What is not translated

- **Your data.** Table, field, view and option names are what your app
  stored, in whatever language it stored them. A new view's default name
  ("Grid view") is stored data too.
- **Formula functions** (`SUM`, `IF`) and rollup aggregations: they are the
  formula language.
- **Symbols**: `=`, `≠`, `<`, `1 → 9`, keyboard names such as `Ctrl+Enter`.
- **Messages for developers** in the console.
- **A chart view's hidden data table and its name**: the table a screen reader
  gets under a chart keeps "Category" and "bar chart" in English for now.

Dates and numbers follow the field's own format settings and the browser's
locale.

## Next

- [Permissions](./permissions.md): what each person may do.
- [People, comments and files](./collaboration.md): who is signed in.
- [`<sv-base>`](../web-components/sv-base.md): the same base in any framework.
