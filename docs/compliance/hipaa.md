# HIPAA posture

sv-grid is **HIPAA-neutral**: the library does not transmit, store,
or process PHI on its own. If your app is HIPAA-compliant before
adding sv-grid, adding sv-grid does not break that compliance.

This page documents the four configuration choices that matter for
healthcare deployments.

> **Live example:** [demo 41 (Healthcare EMR - inpatient board)](https://svgrid.com/demos/41-healthcare-emr/)
> shows a role-based ICU census - the same patterns this page describes.

## 1. Disable persistent saved-views

The default `<SvGrid>` writes nothing to disk. Saved views (an opt-in
feature) writes view layouts to localStorage. If you don't want PHI
to ever land in localStorage, the simplest answer is: don't use
saved views, OR make sure the view payload contains no PHI.

```ts
// Save the LAYOUT but never the filter VALUES (which could leak PHI
// like 'Patient: Jane Doe').
const view = {
  widths:  api.getColumnWidths(),
  pinning: api.getColumnPinning(),
  // intentionally do NOT save api.getFilters()
}
localStorage.setItem('view', JSON.stringify(view))
```

## 2. Disable clipboard copy/paste for PHI columns

The grid's copy/paste serialises selected cells to the OS clipboard
as TSV. Clipboards are not under your app's control - browsers,
extensions, OS-level sync (e.g. Apple Universal Clipboard) all read
from them.

The simplest mitigation: drop the cell-selection feature, which
removes the keyboard surface that triggers copy:

```svelte
<SvGrid {data} {columns} features={features}
  enableCellSelection={false}
  selectionMode="row" />
```

For finer control, intercept the `onActiveCellChange` callback and
block the column you don't want copyable - see [accessibility](../help/accessibility.md#keyboard-map)
for the keyboard map.

## 3. Disable AI helpers for PHI rows (or route to a HIPAA-BAA provider)

The [AI assistant](../help/ai.md) helpers (`aiFilter`, `aiSmartFill`,
`aiSummarize`, `aiClassify`) send row data to whatever model provider
you registered via `setAIProvider(...)`. For PHI:

- Use a model hosted on a HIPAA-eligible service (AWS Bedrock with
  Anthropic / Cohere / Mistral; Azure OpenAI with a signed BAA;
  Google Vertex AI with a signed BAA).
- OR redact PHI fields BEFORE calling the helper.

Example redaction in the provider adapter:

```ts
import { setAIProvider, type AIProvider } from '@svgrid/grid'

const redactingProvider: AIProvider = async ({ prompt, ...rest }) => {
  const safe = prompt.replace(/MRN-?\d{8}/g, '<<MRN>>').replace(/SSN[:\s-]*\d{3}-?\d{2}-?\d{4}/g, '<<SSN>>')
  return fetch('/api/ai', { ... body: JSON.stringify({ prompt: safe, ...rest }) }).then((r) => r.text())
}

setAIProvider(redactingProvider)
```

The library hands the prompt to the provider VERBATIM - any
redaction happens in the wrapper you author, where it's auditable.

## 4. Audit every cell edit

Most HIPAA reviewers care more about the audit trail than the
display surface. The grid's `onCellValueChange` fires on every
committed edit with `{ rowIndex, columnId, oldValue, newValue, row }`.
Pipe it to your audit pipeline:

```svelte
<SvGrid {data} {columns} features={features}
  onCellValueChange={async (e) => {
    await fetch('/api/audit', {
      method: 'POST',
      body: JSON.stringify({
        actor:    currentUser.id,
        action:   'cell-edit',
        resource: `patient/${e.row.id}/${e.columnId}`,
        before:   e.oldValue,
        after:    e.newValue,
        ts:       new Date().toISOString(),
      }),
    })
  }}
/>
```

See [audit log integration](./audit-log.md) for the full pattern,
including a CryptoSign-the-row trick that makes the audit log
tamper-evident.

## What the library does NOT do

- It does not transmit row data anywhere on its own.
- It does not store row data on disk.
- It does not phone home with telemetry.
- It does not log to the console at runtime in production builds.

You can confirm with DevTools: `<SvGrid>` produces zero network
requests of its own.

## Browser-level mitigations to know about

These are general HIPAA-in-the-browser concerns; the grid doesn't
make them worse, but you should be aware:

- **Browser auto-fill**: disable on PHI fields with `autocomplete="off"`.
- **Browser screenshot APIs** (`getDisplayMedia`): browsers ask the
  user; your app can't fully block. Combine with `Cache-Control:
  no-store` on your origin so screenshots don't end up in browser
  history thumbnails.
- **Browser back-forward cache** caches the DOM. Use `Cache-Control:
  no-store` and `Pragma: no-cache` on PHI pages.

## See also

- [SOC 2 posture](./soc2.md)
- [GDPR + data residency](./gdpr.md)
- [Audit log integration](./audit-log.md)
- [Security & supply chain](../help/security.md)
- [Demo 41 - Healthcare EMR](https://svgrid.com/demos/41-healthcare-emr/) - role-based cell editing in practice
