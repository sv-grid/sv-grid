# SvFileUpload

A drag-and-drop file field with click-to-browse fallback, accept / size / count
validation, and a selected-files list.

`SvFileUpload` is a themed dropzone: drop files onto it or click to open the
native picker, and it validates each against `accept`, `maxSize`, and `maxFiles`,
firing `onReject` for the ones it turns away. It is part of the editor kit, so it
carries the shared contract - `label`, `hint`, `error`, `required`, `dir` / RTL,
and localizable `messages` - through [SvField](sv-field.md). It is controlled via
`files` and `onChange`.

Related: [SvForm](sv-form.md) · [SvField](sv-field.md) · [Layout & composite overview](layout.md)

## Installation

Add it with the CLI - this drops a ready-to-edit `SvFileUpload` starter into your app:

<div data-docs-add="add file-upload"></div>

Or install the package and import it directly. `SvFileUpload` ships free in
`@svgrid/grid` and is **part of the grid's editor kit** - the same control SvGrid mounts when you edit a matching cell:

<div data-docs-install="@svgrid/grid"></div>

```ts
import { SvFileUpload } from '@svgrid/grid'
```

## Example

<div data-docs-demo="287-file-upload" data-height="440" data-code></div>

```svelte
<script lang="ts">
  import { SvFileUpload, type FileRejection } from '@svgrid/grid'
  let files = $state<File[]>([])
</script>

<SvFileUpload
  {files}
  label="Attachments"
  accept="image/*,.pdf"
  multiple
  maxSize={5 * 1024 * 1024}
  onChange={(f) => (files = f)}
  onReject={(r: FileRejection[]) => console.warn(r)}
/>
```

## Props

| Prop        | Type                                    | Default | Description                                                       |
| ----------- | --------------------------------------- | ------- | ---------------------------------------------------------------- |
| `files`     | `File[]`                                | `[]`    | Selected files (bindable). Controlled via `onChange`.            |
| `onChange`  | `(files: File[]) => void`               | -       | Fired when the selection changes (add or remove).                |
| `onReject`  | `(rejections: FileRejection[]) => void` | -       | Fired with files rejected by `accept` / `maxSize` / `maxFiles`.  |
| `accept`    | `string`                                | -       | Accepted types (an `<input accept>` string, e.g. `image/*,.pdf`).|
| `multiple`  | `boolean`                               | `false` | Allow selecting more than one file.                              |
| `maxSize`   | `number`                                | -       | Max size per file, in bytes.                                     |
| `maxFiles`  | `number`                                | -       | Maximum number of files.                                         |
| `messages`  | `Partial<FileMessages>`                 | -       | Override the prompt / browse / remove / accepted-types strings.  |

Plus the shared editor-contract props: `disabled`, `readonly`, `required`,
`invalid`, `error`, `label`, `hint`, `dir`, `id`, `ariaLabel`.

### FileRejection

```ts
type FileRejectReason = 'type' | 'size' | 'count'
type FileRejection = { file: File; reason: FileRejectReason }

// messages overrides (all optional):
type FileMessages = { prompt: string; browse: string; remove: string; hintTypes: string }
```

## Examples

### Validate and report rejections

Set the constraints and surface why a file was turned away using the `reason`:

```svelte
<SvFileUpload {files} accept=".csv" maxFiles={3} maxSize={2_000_000}
  onChange={(f) => (files = f)}
  onReject={(r) => (msg = r.map((x) => `${x.file.name}: ${x.reason}`).join(', '))} />
```

### Field validation

Because it uses the editor contract, wire it into a form like any input - set
`required`, `invalid`, and an `error` string and they render through the shared
field chrome:

```svelte
<SvFileUpload {files} label="Resume" required invalid={!files.length}
  error={!files.length ? 'A file is required' : undefined}
  onChange={(f) => (files = f)} />
```

### Localized strings

Override any of the prompt / browse / remove / accepted-types labels via
`messages` for non-English UIs:

```svelte
<SvFileUpload {files} messages={{ prompt: 'Fichiers ici ou', browse: 'parcourir' }} />
```

### Image gallery with rejection feedback

Accept several images, cap the count and size, and turn the `reason` on each
rejection into readable copy:

```svelte
<script lang="ts">
  import { SvFileUpload, type FileRejection } from '@svgrid/grid'
  let files = $state<File[]>([])
  let notice = $state('')
  const reasons: Record<FileRejection['reason'], string> = {
    type: 'not an image', size: 'over 4 MB', count: 'too many files',
  }
</script>

<SvFileUpload
  {files}
  label="Gallery images"
  hint="Up to 6 images, 4 MB each"
  accept="image/*"
  multiple
  maxFiles={6}
  maxSize={4 * 1024 * 1024}
  onChange={(f) => (files = f)}
  onReject={(r: FileRejection[]) =>
    (notice = r.map((x) => `${x.file.name}: ${reasons[x.reason]}`).join(', '))}
/>
{#if notice}<p>{notice}</p>{/if}
```

**Tip:** `reason` is one of `'type' | 'size' | 'count'`, so map it to your own copy
per rule rather than showing a generic "rejected" message.

## Accessibility

- The dropzone is keyboard-operable: focus it and press `Enter` / `Space` to open
  the native file picker.
- The hidden `<input type="file">` remains the real control, so file selection
  uses the platform dialog and its assistive-tech support.
- Label, hint, and error come from [SvField](sv-field.md), so a set `error` is
  announced and the required marker shows on the label.

## See also

- [SvForm](sv-form.md) - compose file uploads with other fields in a schema-driven form.
- [SvField](sv-field.md) - the shared label / hint / error wrapper it builds on.
- [Layout overview](layout.md) - the whole layout family at a glance.
