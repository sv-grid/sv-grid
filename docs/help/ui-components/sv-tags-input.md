# SvTagsInput

An editable token / chips input - type to add, click x or `Backspace` to remove.

`SvTagsInput` edits a `string[]` as a row of removable chips: type and press
`Enter` or comma to add a tag, `Backspace` on an empty draft removes the last,
and each chip has an x button. It can reject duplicates and cap the count. It is
the styled renderer over the headless `createTagsInput` core, so add / remove and
keyboard handling live in one place. Its label / hint / error chrome comes from
[SvField](sv-field.md).

Related: [SvTextInput](sv-text-input.md) · [SvColorInput](sv-color-input.md) · [Inputs overview](inputs.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvTagsInput` starter into your app:

<div data-docs-add="add tags-input"></div>

Prefer to see it first? `npx @svgrid/ui try tags-input` opens it in a throwaway sandbox - no project needed.

Or install the package and import it directly. `SvTagsInput` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

The examples on this page import from `@svgrid/grid`:

```svelte {preamble}
<script lang="ts">
  import { SvTagsInput } from '@svgrid/grid'

  // The bound value behind each example below.
  let recipients = $state<string[]>([])
  let labels = $state<string[]>([])
</script>
```

```ts
import { SvTagsInput } from '@svgrid/grid'
```

## Example

<div data-docs-demo="316-tags-input" data-height="420" data-code></div>

```svelte {runnable}
<script lang="ts">
  import { SvTagsInput } from '@svgrid/grid'
  let skills = $state(['Svelte', 'TypeScript'])
</script>

<SvTagsInput label="Skills" bind:value={skills} placeholder="Add a skill…" />
```

## Props

`SvTagsInput` extends the shared `SvEditorProps` (`disabled`, `required`,
`invalid`, `error`, `label`, `hint`, `dir`, `name`, `id`, `ariaLabel`) and adds:

| Prop          | Type                          | Default    | Description                                    |
| ------------- | ----------------------------- | ---------- | ---------------------------------------------- |
| `value`       | `string[]`                    | `[]`       | The tags. Bindable with `bind:value`.          |
| `onChange`    | `(tags: string[]) => void`    | -          | Fires whenever the tag set changes.            |
| `placeholder` | `string`                      | `Add tag…` | Shown only while there are no tags.            |
| `unique`      | `boolean`                     | `true`     | Reject duplicate tags.                         |
| `max`         | `number`                      | `Infinity` | Maximum number of tags.                        |
| `messages`    | `Partial<TagsMessages>`       | -          | Override the add / remove aria-labels.         |

`TagsMessages` is `{ add; remove }`.

## Examples

### Cap and de-duplicate

Combine `max` with the default `unique` to keep a bounded, clean set - useful for
recipients or a small skill list:

```svelte {runnable}
<SvTagsInput label="To" bind:value={recipients} max={5} />
```

### React to changes

Use `onChange` to persist or validate as tags come and go:

```svelte
<SvTagsInput bind:value={labels} onChange={(t) => save(t)} />
```

### Required set with a minimum count

Since the value is a `string[]`, validation is just its `length`. Combine
`required` with a `$derived` floor and cap the total with `max`:

```svelte {runnable}
<script lang="ts">
  import { SvTagsInput } from '@svgrid/grid'
  let topics = $state<string[]>([])
  const tooFew = $derived(topics.length > 0 && topics.length < 3)
</script>

<SvTagsInput
  label="Interests"
  required
  max={8}
  bind:value={topics}
  placeholder="Add an interest…"
  invalid={topics.length === 0 || tooFew}
  error={topics.length === 0
    ? 'Add at least one interest'
    : tooFew ? 'Pick at least three' : undefined}
  hint="Up to 8 tags"
/>
```

Tip: `unique` is on by default, so duplicate entries are silently rejected -
`value` only ever holds distinct tags, which keeps the `length` checks honest.

## Accessibility

- The root exposes list semantics via the core's `rootProps`; each remove button
  carries a `remove` `aria-label` from `messages`.
- The draft `<input>` takes an `add` `aria-label`, and `label` / `hint` / `error`
  are wired via [SvField](sv-field.md); `required` and `invalid` add the matching
  ARIA.
- A `name` emits a hidden input with the tags joined by commas, so plain form
  posts carry the value.

## More examples

### Tags input - headless

createTagsInput drives SvTagsInput and a custom chip-cloud render, both editing one string array.

<div data-docs-demo="264-headless-tagsinput" data-height="420"></div>

## Sizes

Every control takes the same three sizes, so a dense toolbar and a roomy form can share components.

```svelte {runnable}
<script lang="ts">
  import { SvTagsInput } from '@svgrid/grid'

  let skills = $state<string[]>([])
</script>

<SvTagsInput bind:value={skills} size="sm" />
<SvTagsInput bind:value={skills} size="md" />
<SvTagsInput bind:value={skills} size="lg" />
```


## In a form

The shared field props behave the same on every editor: `label` names it, `hint` explains it, and `error` plus `invalid` mark it - which is why a validated form does not need per-component handling.

```svelte {runnable}
<script lang="ts">
  import { SvTagsInput } from '@svgrid/grid'

  let skills = $state<string[]>([])
</script>

<SvTagsInput
  bind:value={skills}
  label="Label"
  hint="A short hint"
  required
/>

<SvTagsInput
  bind:value={skills}
  label="Label"
  error="Something is wrong"
  invalid
/>
```

## See also

- [Inputs overview](inputs.md) - the whole input family at a glance.
- [SvTextInput](sv-text-input.md) - the base single-line field.
- [SvColorInput](sv-color-input.md) - a popover-based value editor.
