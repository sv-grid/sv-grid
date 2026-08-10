# SvComboBox

An editable combobox: type to filter a portalled option list and pick a value.
Unlike an autocomplete, the value must come from the list - unmatched text reverts
on blur. Filtering is local by default, or hand it a `loadOptions` for remote search.

`SvComboBox` is the searchable single-select. It is controlled through `value` +
`onChange`, groups options by their `group` heading, and keeps the panel visible
outside any scroll container. Pass `loadOptions` and it turns into a debounced,
race-safe server search (local filtering switches off and the returned list is
shown as-is), with `loading` and empty-state text you can localize via `messages`.

Related: [SvDropDownList](sv-drop-down-list.md) · [SvAutoComplete](sv-auto-complete.md) · [Selection overview](selection.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvComboBox` starter into your app:

<div data-docs-add="add combo-box"></div>

Prefer to see it first? `npx @svgrid/ui try combo-box` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvComboBox` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvComboBox } from '@svgrid/grid'
```

## Example

<div data-docs-demo="313-combobox" data-height="420" data-code></div>

```svelte
<script lang="ts">
  import { SvComboBox, type ListOption } from '@svgrid/grid'
  const options: ListOption[] = [
    { value: 'us', label: 'United States' },
    { value: 'gb', label: 'United Kingdom' },
    { value: 'de', label: 'Germany' },
  ]
  let value = $state<string | null>(null)
</script>

<SvComboBox label="Country" {options} {value} onChange={(v) => (value = v)} required />
```

## Props

| Prop          | Type                                            | Default    | Description                                                         |
| ------------- | ----------------------------------------------- | ---------- | ------------------------------------------------------------------ |
| `options`     | `ReadonlyArray<ListOption>`                     | `[]`       | The options. A `group` heading buckets them into sections.         |
| `value`       | `string \| number \| null`                      | `null`     | The selected value.                                                |
| `onChange`    | `(value: string \| number \| null) => void`     | -          | Fires with the newly picked value (or `null` when cleared).        |
| `placeholder` | `string`                                        | `'Select…'`| Input placeholder when empty.                                      |
| `autoOpen`    | `boolean`                                        | `false`    | Focus the input on mount.                                          |
| `clearable`   | `boolean`                                        | `false`    | Show a clear (x) button when a value is selected.                  |
| `resizable`   | `boolean`                                        | `false`    | Add a bottom drag grip so the user can resize the open panel's height (hidden on an upward flip). See [Resizable dropdowns](#resizable-panel). |
| `readonly`    | `boolean`                                        | `false`    | Value shown; input not editable and the panel will not open.       |
| `item`        | `Snippet<[ListOption]>`                          | -          | Custom render for each option.                                     |
| `header` / `footer` | `Snippet`                                  | -          | Content pinned above / below the option list.                      |
| `noData`      | `Snippet`                                        | -          | Shown when the (non-loading) list is empty.                        |
| `loadOptions` | `(query: string) => Promise<ListOption[]>`      | -          | Remote, debounced search. Disables local filtering.                |
| `minLength`   | `number`                                         | `1`        | Min chars before a remote search fires.                            |
| `debounce`    | `number`                                         | `250`      | Debounce (ms) before a remote search fires.                        |
| `messages`    | `Partial<ComboMessages>`                        | -          | Override built-in strings (`noResults` / `loading` / `typeMore`).  |
| `size`        | `sm \| md \| lg`                                | `md`       | Control height and font size.                                      |
| `disabled`    | `boolean`                                        | `false`    | Blocks interaction.                                                |
| `label`       | `string`                                         | -          | Visible field label, wired to the control.                         |
| `hint`        | `string`                                         | -          | Helper text under the control.                                     |
| `error`       | `string`                                         | -          | Error message; announced and styled when set.                      |
| `required`    | `boolean`                                        | `false`    | Marks the field required.                                          |
| `invalid`     | `boolean`                                        | `false`    | Applies the invalid state.                                         |
| `name`        | `string`                                         | -          | Emits a hidden input carrying the value for form posts.            |
| `dir`         | `ltr \| rtl \| auto`                            | `auto`     | Text direction.                                                   |
| `ariaLabel`   | `string`                                         | -          | Accessible name when there is no visible `label`.                  |
| `id`          | `string`                                         | -          | Root id; label/hint/error ids derive from it.                      |

Options use the shared [ListOption](sv-list-box.md#listoption) shape. `ComboMessages`
is `{ noResults: string; loading: string; typeMore: string }`.

## Examples

### Remote (server) search

Give `loadOptions` an async function and `SvComboBox` debounces the query, keeps
only the latest response, and shows a loading state - no local filtering:

```svelte
<SvComboBox label="User" minLength={2}
  loadOptions={async (q) => (await fetch(`/api/users?q=${q}`)).json()}
  onChange={(v) => (userId = v)} />
```

### Localized strings

Override the empty-state and loading text through `messages`:

```svelte
<SvComboBox {options}
  messages={{ noResults: 'Keine Treffer', loading: 'Laden…', typeMore: 'Tippen zum Suchen' }} />
```

### Grouped options

Set a `group` on options and the filtered panel keeps its section headings.

### Dependent remote search

Close `loadOptions` over another field so the query is scoped by an earlier pick -
here cities are searched within the chosen country:

```svelte
<script lang="ts">
  import { SvComboBox, type ListOption } from '@svgrid/grid'
  let countryId = $state<string | null>(null)
  let cityId = $state<string | number | null>(null)
  const loadCities = async (q: string): Promise<ListOption[]> =>
    (await fetch(`/api/cities?country=${countryId}&q=${q}`)).json()
</script>

<SvComboBox label="City" minLength={2} disabled={!countryId}
  loadOptions={loadCities} value={cityId} onChange={(v) => (cityId = v)} />
```

Because `loadOptions` re-reads `countryId` on each call, switching the country
just scopes the next search - and the combobox keeps only the latest response, so
an in-flight request for the old country can never win.

### Resizable panel

Set `resizable` and the open panel grows a bottom drag grip ("····"); drag it to
grow or shrink the list, and the chosen height sticks for the session. The grip
hides automatically when the panel flips upward (there is no room to grow below).
The same prop works on [SvDropDownList](sv-drop-down-list.md) and
[SvAutoComplete](sv-auto-complete.md).

```svelte
<SvComboBox resizable {options} label="Timezone" />
```

<div data-docs-demo="411-resizable-dropdowns" data-height="440"></div>

## Accessibility

- The input carries `role="combobox"` with `aria-expanded` / `aria-controls`; the
  panel is a `role="listbox"` with a roving active option.
- Type to filter, `ArrowUp` / `ArrowDown` to move, `Enter` to pick, `Escape` to
  dismiss; unmatched text reverts on blur so the value stays valid.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvDropDownList](sv-drop-down-list.md) - pick from a list without typing.
- [SvAutoComplete](sv-auto-complete.md) - free text with suggestions (any value allowed).
