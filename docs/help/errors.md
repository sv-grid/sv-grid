# Error reference

Every `Error` thrown by `@svgrid/grid` or `@svgrid/enterprise` with the
exact message text, the trigger condition, and the fix. If a runtime
message you see isn't on this list, it's coming from your own code or
a peer dependency.

## How to read this page

Each entry has four pieces:

1. **Message** - the exact text after `Error:`. Searchable.
2. **Class / type** - the thrown object's `.name`.
3. **When** - what action triggered it.
4. **Fix** - the smallest change that resolves it.

Error classes are part of the [API stability](./api-stability.md)
contract: the `.name` and message structure are Stable; we may reword
the trailing detail at the patch level if the diagnostic improves.

## @svgrid/grid

### `Error: SvGrid: cannot mount inside a non-element parent`

- **Class:** `Error`
- **When:** You passed something other than an `Element` to
  `mount(SvGrid, { target })`. Common cause: passing a Svelte
  component reference instead of a DOM node.
- **Fix:** Use `bind:this={el}` on a real `<div>` and pass `el` as the
  target.

### `Error: Column "<id>" has no field, fieldFn, or cell renderer`

- **Class:** `Error`
- **When:** A `ColumnDef` was registered with neither a `field`, an
  `fieldFn`, nor a `cell` template. The grid has no way to produce
  a value for that column.
- **Fix:** Add one of the three. For computed display-only columns,
  `fieldFn: (row) => /* ... */` is usually right.

### `Error: Duplicate column id "<id>"`

- **Class:** `Error`
- **When:** Two `ColumnDef` entries resolve to the same id - either
  because they share a `field` and neither has an explicit `id`, or
  because their explicit `id` collides.
- **Fix:** Give each column an explicit unique `id`.

### `Error: Sort comparator failed: <reason>`

- **Class:** `Error`
- **When:** A custom `sortingFn` returned `NaN` or threw.
- **Fix:** Make the comparator total (always returns a number) and
  null-safe.

### `RuneError: state_referenced_locally`

- **Class:** Svelte runtime
- **When:** Initialising one `$state` from another `$state` in the
  same script - not specifically a SvGrid error, but the most common
  one users hit when seeding the grid's data.
- **Fix:** Add `// svelte-ignore state_referenced_locally` above the
  line, or restructure so the initial value isn't read from another
  `$state`.

### `each_key_duplicate`

- **Class:** Svelte runtime
- **When:** Two `ColumnDef` entries share the same key in the grid's
  internal keyed-`{#each}` over columns. Most often when you have two
  columns both pointing at the same `field` (e.g. one computed
  "Total" column that uses `field: 'qty'` to satisfy the type but
  duplicates an existing data column).
- **Fix:** Give the computed column an explicit `id` and drop its
  `field`.

## @svgrid/enterprise - License

### `Error: @svgrid/enterprise: setLicenseKey() requires a non-empty string`

- **Class:** `Error`
- **When:** `setLicenseKey('')` or `setLicenseKey(null)`.
- **Fix:** Pass a valid `SVENTERPRISE-...` string.

### `Error: @svgrid/enterprise: invalid license key format (expected "SVENTERPRISE-..." prefix).`

- **Class:** `Error`
- **When:** A key that doesn't start with `SVENTERPRISE-` was set; the first
  Enterprise call throws.
- **Fix:** Use the key issued by jQWidgets. The free Community grid is
  the right choice if you don't have a key.

### `Error: @svgrid/enterprise: this license key has been revoked. Contact sales@jqwidgets.com for a replacement.`

- **Class:** `Error`
- **When:** A key matching an entry in the package's revoked-keys list.
- **Fix:** Contact `sales@jqwidgets.com` for a replacement.

## @svgrid/enterprise - Export

### `Error: @svgrid/enterprise: export requires a browser environment`

- **Class:** `Error`
- **When:** `exportGrid` / `api.exportData` was called during SSR.
- **Fix:** Guard with `if (typeof window === 'undefined') return` or
  defer to `onMount`.

### `Error: @svgrid/enterprise: failed to load Smart.Utilities.DataExporter`

- **Class:** `Error`
- **When:** The Smart exporter shim couldn't initialise. Usually a
  bundler config issue blocking dynamic `import()` of a vendored
  asset.
- **Fix:** Confirm the package is installed cleanly and your bundler
  permits dynamic imports.

### `Error: @svgrid/enterprise: xlsx export requires the "jszip" peer dependency. Install it with: pnpm add jszip`

- **Class:** `Error`
- **When:** First xlsx export when `jszip` isn't installed.
- **Fix:** `pnpm add jszip` (or `npm` / `yarn`).

### `Error: @svgrid/enterprise: pdf export requires the "pdfmake" peer dependency. Install it with: pnpm add pdfmake`

- **Class:** `Error`
- **When:** First pdf export when `pdfmake` isn't installed.
- **Fix:** `pnpm add pdfmake`.

## @svgrid/enterprise - Import

### `Error: @svgrid/enterprise: importData requires a browser environment`

- **Class:** `Error`
- **When:** `importData` was called during SSR.
- **Fix:** Guard with `if (typeof window === 'undefined') return`.

### `Error: @svgrid/enterprise: xlsx import requires the "jszip" peer dependency. Install it with: pnpm add jszip`

- **Class:** `Error`
- **When:** First xlsx import when `jszip` isn't installed.
- **Fix:** `pnpm add jszip`.

### `Error: @svgrid/enterprise: xlsx import expects a File or Blob, not a string. Use format: "csv" or "tsv" for inline text.`

- **Class:** `Error`
- **When:** Passing a string with `format: 'xlsx'`.
- **Fix:** Either give the helper a `File` / `Blob` of the xlsx data
  or switch the format to `csv` / `tsv` for inline text.

### `Error: @svgrid/enterprise: could not locate sheet1.xml in the .xlsx archive`

- **Class:** `Error`
- **When:** The uploaded `.xlsx` is malformed or non-standard (e.g. a
  workbook saved by an exotic tool that places the first sheet
  somewhere other than `xl/worksheets/sheet1.xml`).
- **Fix:** Open the file in Excel or LibreOffice and re-save. If the
  file is correct and the grid still fails, please file an issue with
  a redacted sample.

### `Error: @svgrid/enterprise: JSON import expects a top-level array`

- **Class:** `Error`
- **When:** The JSON parses to an object (or any non-array) instead of
  an array of records.
- **Fix:** Wrap the data in `[]` or write a wrapper that extracts the
  array from the response.

## @svgrid/enterprise - AI

### `NoProviderError: @svgrid/grid ai: no AI provider registered. Call setAIProvider(fn) with an adapter that talks to OpenAI / Anthropic / your proxy.`

- **Class:** `NoProviderError` (extends `Error`)
- **When:** Any `api.ai.*` call before `setAIProvider(fn)` ran.
- **Fix:** Wire your adapter at app boot. For demos, use
  `setAIProvider(mockAIProvider)`.

### `BadJsonError: @svgrid/grid ai: provider returned non-JSON for a json-format request. First 200 chars: <prefix>`

- **Class:** `BadJsonError` (extends `Error`)
- **When:** A helper asked the provider for JSON and got prose back.
  The first 200 characters of the response are included so you can
  see what the model actually returned.
- **Fix:** Make sure your provider passes `responseFormat: 'json'` to
  the model, or instruct the model in your system prompt to return
  JSON only. The package strips a single markdown code fence
  automatically before parsing; multiple fences or surrounding prose
  trip this error.

### `Error: @svgrid/grid ai: aiSmartFill requires at least one example.`

- **Class:** `Error`
- **When:** `aiSmartFill({ examples: [] })`.
- **Fix:** Pass at least one worked example. Two or more locks the
  pattern more reliably.

## How to report a missing entry

If you hit a thrown message that isn't on this page:

1. Copy the exact message text and class name.
2. File an issue with `[error reference]` in the title.
3. We treat this list as **canonical** - every new error added in a
   release lands here in the same PR.

## Try it

`error` replaces the grid body with a message; `emptyMessage` covers the
no-rows case, which is a different state and deserves different words.

```svelte {runnable}
<SvGrid data={[]} {columns} emptyMessage="No people match this filter." />

<SvGrid data={[]} {columns} error="Could not reach the server. Retry in a moment." />
```

## See also

- [API stability](./api-stability.md) - the contract around these
  classes and messages.
- [Testing and quality](./testing-and-quality.md) - the test suite
  that produces every error here as part of its expected-throw
  assertions.


The examples on this page run against these rows:

```svelte {preamble}
<script lang="ts">
  import { SvGrid, type GridColumns } from '@svgrid/grid'

  type Person = {
    id: number
    name: string
    department: string
    city: string
    age: number
    salary: number
  }

  const people: Person[] = [
    { id: 1, name: 'Ada Lovelace',   department: 'Engineering', city: 'London',   age: 36, salary: 142000 },
    { id: 2, name: 'Grace Hopper',   department: 'Engineering', city: 'New York', age: 45, salary: 168000 },
    { id: 3, name: 'Linus Torvalds', department: 'Platform',    city: 'Portland', age: 54, salary: 155000 },
    { id: 4, name: 'Radia Perlman',  department: 'Networking',  city: 'Seattle',  age: 49, salary: 161000 },
    { id: 5, name: 'Barbara Liskov', department: 'Platform',    city: 'Boston',   age: 52, salary: 172000 },
  ]

  let rows = $state<Person[]>(people)
  const data = people

  const columns: GridColumns<Person> = [
    { field: 'name',       header: 'Name',       width: 200 },
    { field: 'department', header: 'Department', width: 150 },
    { field: 'city',       header: 'City',       width: 140 },
    { field: 'age',        header: 'Age',        width: 90 },
    { field: 'salary',     header: 'Salary',     width: 130, format: { type: 'currency', currency: 'USD' } },
  ]
</script>
```
