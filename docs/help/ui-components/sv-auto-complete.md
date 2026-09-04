# SvAutoComplete

A free-text input with a live-filtered suggestion list. Unlike [SvComboBox](sv-combo-box.md),
it accepts any value - the suggestions are just shortcuts - and it emits the raw
text string.

`SvAutoComplete` is the "search box with hints" control: the user can type
anything, and matching suggestions drop down as they go. It is controlled through
`value` + `onChange` (both strings), the popover portals out of any scroll
container, and `minChars` gates when the list appears. Suggestions can be plain
strings or `{ value, label }` objects, so the shown label and the inserted value
can differ.

Related: [SvComboBox](sv-combo-box.md) · [SvTagsInput](selection.md) · [Selection overview](selection.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvAutoComplete` starter into your app:

<div data-docs-add="add auto-complete"></div>

Prefer to see it first? `npx @svgrid/ui try auto-complete` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvAutoComplete` ships free in
`@svgrid/grid` (dependency-free):

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvAutoComplete } from '@svgrid/grid'
```

## Example

<div data-docs-demo="315-autocomplete" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvAutoComplete } from '@svgrid/grid'
  const cities = ['Amsterdam', 'Berlin', 'Copenhagen', 'Dublin']
  let value = $state('')
</script>

<SvAutoComplete label="City" suggestions={cities}
  {value} onChange={(v) => (value = v)} placeholder="Search a city" />
```

## Props

| Prop          | Type                                    | Default | Description                                                        |
| ------------- | --------------------------------------- | ------- | ------------------------------------------------------------------ |
| `value`       | `string`                                | `''`    | The current text value.                                            |
| `onChange`    | `(value: string) => void`               | -       | Fires with the text on every edit or suggestion pick.              |
| `suggestions` | `ReadonlyArray<string \| ListOption>`   | `[]`    | Suggestion shortcuts - strings or `{ value, label }`.              |
| `minChars`    | `number`                                | `1`     | Chars typed before suggestions appear.                             |
| `placeholder` | `string`                                | -       | Input placeholder.                                                 |
| `resizable`   | `boolean`                               | `false` | Add a bottom drag grip so the user can resize the open suggestion panel (hidden on an upward flip). |
| `size`        | `sm \| md \| lg`                        | `md`    | Control height and font size.                                      |
| `disabled`    | `boolean`                               | `false` | Blocks interaction.                                                |
| `label`       | `string`                                | -       | Visible field label, wired to the control.                         |
| `hint`        | `string`                                | -       | Helper text under the control.                                    |
| `error`       | `string`                                | -       | Error message; announced and styled when set.                     |
| `required`    | `boolean`                               | `false` | Marks the field required.                                         |
| `invalid`     | `boolean`                               | `false` | Applies the invalid state.                                        |
| `name`        | `string`                                | -       | Emits a hidden input carrying the text for form posts.            |
| `dir`         | `ltr \| rtl \| auto`                    | `auto`  | Text direction.                                                   |
| `ariaLabel`   | `string`                                | -       | Accessible name when there is no visible `label`.                 |
| `id`          | `string`                                | -       | Root id; label/hint/error ids derive from it.                     |

Object suggestions use the shared [ListOption](sv-list-box.md#listoption) shape;
the `label` is shown and the `value` is inserted.

## Examples

### Distinct label and inserted value

Use `{ value, label }` suggestions when the visible hint differs from the text you
want in the field:

```svelte
<SvAutoComplete label="Command"
  suggestions={[{ value: 'is:open ', label: 'is:open - unresolved' }]}
  {value} onChange={(v) => (value = v)} />
```

### Gate the list until it is useful

Raise `minChars` so suggestions only appear once the query narrows things down:

```svelte
<SvAutoComplete suggestions={tags} minChars={2} />
```

### Free text is always valid

Because any typed value is accepted, bind the string straight into your model - no
"must match an option" check. Reach for [SvComboBox](sv-combo-box.md) when you need
to constrain the value to the list.

### Suggestions from your own data

The control just takes a `suggestions` array, so build it reactively from any
source - recent searches, a fetched list, deduped history - while the user can
still type anything:

```svelte {runnable}
<script lang="ts">
  import { SvAutoComplete } from '@svgrid/grid'
  let value = $state('')
  const history = ['invoices', 'inventory', 'insights']
  // Narrow the history to what has been typed so far.
  const suggestions = $derived(
    value ? history.filter((h) => h.startsWith(value.toLowerCase())) : history,
  )
</script>

<SvAutoComplete label="Search" {suggestions}
  {value} onChange={(v) => (value = v)} placeholder="Search…" />
```

> Tip: `onChange` fires the raw text on every keystroke, so debounce any expensive
> side effect (a fetch, a route change) you drive from it rather than running it
> inline.

### Resizable panel

Set `resizable` to give the open suggestion panel a bottom drag grip; drag it to
grow or shrink the list, and the height sticks for the session. The grip hides on
an upward flip. The same prop is on [SvComboBox](sv-combo-box.md) and
[SvDropDownList](sv-drop-down-list.md).

```svelte
<SvAutoComplete resizable {suggestions} label="City" />
```

<div data-docs-demo="411-resizable-dropdowns" data-height="440"></div>

## Accessibility

- The input is a `role="combobox"` with `aria-expanded`; the suggestion panel is a
  `role="listbox"` with a roving active option.
- Type to filter, `ArrowUp` / `ArrowDown` to move, `Enter` to accept the active
  suggestion, `Escape` to dismiss - typed text is kept either way.
- `label`, `hint`, and `error` are wired via `aria-describedby`; pass `ariaLabel`
  when there is no visible label.

## More examples

### Autocomplete - headless

createAutocomplete drives SvAutoComplete and a custom suggestion-list render over one text value.

<div data-docs-demo="263-headless-autocomplete" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvAutoComplete } from '@svgrid/grid'

  let autoComplete = $state('')
</script>

<SvAutoComplete bind:value={autoComplete} size="sm" />
<SvAutoComplete bind:value={autoComplete} size="md" />
<SvAutoComplete bind:value={autoComplete} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvAutoComplete } from '@svgrid/grid'

  let autoComplete = $state('')
</script>

<SvAutoComplete
  bind:value={autoComplete}
  label="Label"
  hint="A short hint"
  required
/>

<SvAutoComplete
  bind:value={autoComplete}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Selection overview](selection.md) - the whole picker family at a glance.
- [SvComboBox](sv-combo-box.md) - the same UI, but the value must come from the list.
- [SvTagsInput](selection.md) - multiple free-text tokens instead of one value.
