# AI Smart Paste

Drop any shape of contact / lead / row data into a text area - CSV,
TSV, JSON, vCard, Markdown table, an email signature block, or a
single line of prose - and the parser maps it into typed rows your
grid can insert or merge.

![Any shape of pasted data is mapped by a parser into typed rows the grid can insert or merge.](/docs-media/grid-smart-paste.svg)

This is the demo your sales / customer-success / RevOps users want.
Their day already has them pasting from Salesforce, Slack, Excel,
business cards, and signature blocks; the parser absorbs the chaos
and the grid renders the cleaned result.

<div data-docs-demo="75-ai-smart-paste" data-height="640"></div>

## What the parser handles

Six input formats are detected automatically, tried in this order:

| Format            | Example trigger                                                | Notes                                              |
|-------------------|----------------------------------------------------------------|----------------------------------------------------|
| **vCard**         | `BEGIN:VCARD`                                                  | RFC 6350. iOS / macOS / Google Contacts export.    |
| **Markdown table**| Lines starting/ending with `|`, with a `---` separator         | GitHub, Slack threads, docs.                       |
| **JSON**          | Input starts with `[` or `{`                                   | Any field names; multi-language matched.           |
| **CSV / TSV / PSV**| Consistent tab / comma / semicolon / pipe delimiter           | Multi-language headers (`Nom`, `Téléphone` etc).   |
| **Signature blocks**| Multi-line blocks separated by blank lines containing an email| `Name <email>` form, "Role, Company" lines.      |
| **Free-form prose**| Anything else, one line per record                            | Extracts by signal (email regex, phone regex).     |

On top of detection, every parsed row goes through three
**normalization** passes before the preview panel renders it:

1. **Email typo correction** - common domain typos (`gmial.com`,
   `gmail.con`, `gosling.con`) are auto-fixed and surfaced as an info
   note on the row.
2. **Phone normalization** - any phone is rewritten to a consistent
   `+CC AAA BBB CCCC` shape (US, UK, DE, FR, JP recognized; 10-digit
   bare numbers assumed North American).
3. **Name cleaning** - titles (`Dr.`, `Prof.`, `Mr.`) and suffixes
   (`Jr.`, `III`, `PhD`) are stripped; `"Last, First"` is rewritten
   to `"First Last"`.

Duplicate detection runs last: rows with the same normalized email
collapse into one, with missing fields merged from the duplicate.

## Complete drop-in example

A minimal contact list with the Smart Paste panel above the grid.
Paste any of the formats below into the textarea and click
**Parse with AI**.

```svelte
<script lang="ts">
  import {
    SvGrid,
    tableFeatures,
    rowSortingFeature,
    rowSelectionFeature,
    type ColumnDef,
    type SvGridApi,
  } from '@svgrid/grid'

  type Contact = {
    id: string
    fullName: string
    email: string
    company: string
    role: string
    phone: string
  }

  let rows = $state<Contact[]>([
    { id: 'c1', fullName: 'Ada Lovelace',   email: 'ada@analytic.engine', company: 'Analytic Engine',  role: 'Founder',    phone: '+44 20 1234 5678' },
    { id: 'c2', fullName: 'Linus Torvalds', email: 'linus@kernel.org',    company: 'Linux Foundation', role: 'Maintainer', phone: '+1 503 555 0101' },
  ])

  const features = tableFeatures({ rowSortingFeature, rowSelectionFeature })
  let api = $state<SvGridApi<typeof features, Contact> | null>(null)

  let pasteText = $state('')
  let parsed = $state<Contact[]>([])

  // The real parser is bundled in demo 75. This stub does just CSV +
  // semicolon detection; swap with `assistant(text)` from the demo to
  // get the full feature set.
  async function parse(text: string): Promise<Contact[]> {
    const delim = text.includes('\t') ? '\t'
                : text.includes(';')  ? ';'
                : ','
    return text.trim().split('\n').map((line, i) => {
      const cells = line.split(delim).map((c) => c.trim())
      return {
        id: `paste-${i}`,
        fullName: cells[0] ?? '',
        email:    cells[1] ?? '',
        company:  cells[2] ?? '',
        role:     cells[3] ?? '',
        phone:    cells[4] ?? '',
      }
    })
  }

  async function runParse() {
    parsed = await parse(pasteText)
  }

  function applyAll() {
    if (!api || parsed.length === 0) return
    api.addRows(parsed)
    parsed = []
    pasteText = ''
  }

  const columns: ColumnDef<typeof features, Contact>[] = [
    { field: 'fullName', header: 'Name',    editorType: 'text', width: 180 },
    { field: 'email',    header: 'Email',   editorType: 'text', width: 220 },
    { field: 'company',  header: 'Company', editorType: 'text', width: 180 },
    { field: 'role',     header: 'Role',    editorType: 'text', width: 160 },
    { field: 'phone',    header: 'Phone',   editorType: 'text', width: 160 },
  ]
</script>

<section style="display: flex; flex-direction: column; gap: 12px; height: 100%;">
  <textarea
    bind:value={pasteText}
    placeholder="Paste CSV / TSV / JSON / vCard / Markdown / signature blocks here…"
    rows="4"
    style="width: 100%; font-family: ui-monospace, Menlo, monospace; padding: 10px; border-radius: 8px; border: 1px solid #cbd5e1;"
  ></textarea>

  <div style="display: flex; gap: 8px;">
    <button onclick={runParse}>✨ Parse with AI</button>
    <button onclick={applyAll} disabled={parsed.length === 0}>
      Apply {parsed.length} row{parsed.length === 1 ? '' : 's'}
    </button>
  </div>

  {#if parsed.length > 0}
    <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 10px;">
      <strong>Preview:</strong>
      <ul>
        {#each parsed as p (p.id)}
          <li>{p.fullName} · {p.email} · {p.company}</li>
        {/each}
      </ul>
    </div>
  {/if}

  <div style="flex: 1; min-height: 0;">
    <SvGrid
      data={rows}
      columns={columns}
      features={features}
      containerHeight="100%"
      onApiReady={(next) => (api = next)}
    />
  </div>
</section>
```

For the full parser (vCard, Markdown table, signature blocks,
multi-language headers, typo correction, phone normalization,
de-duplication), read the [`assistant()` implementation in demo 75](../../examples/src/demos/75-ai-smart-paste.svelte)
and copy it verbatim - the parser is 350 lines of pure TypeScript with
no library dependencies.

## Try these input formats

Each one runs through the parser and produces 2-3 rows in the
preview panel.

### vCard

```text
BEGIN:VCARD
VERSION:3.0
FN:Brendan Eich
ORG:Brave Software
TITLE:CEO
EMAIL;TYPE=WORK:brendan@brave.com
TEL;TYPE=CELL:+1 415 555 0188
END:VCARD
BEGIN:VCARD
VERSION:3.0
FN:Anders Hejlsberg
ORG:Microsoft
TITLE:Technical Fellow
EMAIL;TYPE=WORK:anders.h@microsoft.com
TEL;TYPE=WORK:+1 425 555 0177
END:VCARD
```

### Markdown table with multi-language headers

```text
| Name | Email | Company | Rol | Téléphone |
|---|---|---|---|---|
| Grace Hopper | grace@nps.mil | US Navy | Rear Admiral | +1 202 555 0133 |
| Ken Thompson | ken@bell-labs.com | Bell Labs | Researcher | +1 908 555 0124 |
```

### Email signature blocks

```text
Donald E. Knuth <knuth@cs.stanford.edu>
Professor Emeritus, Stanford University
Phone: (650) 555-0111

Barbara Liskov <liskov@csail.mit.edu>
Institute Professor at MIT CSAIL
Cell: +1.617.555.0142
```

### Messy real-world paste

Title prefixes, "Last, First" inversion, email typo, and varied phone
formats - the parser cleans every field:

```text
Dr. Margaret Rhodes; margaret@gmial.com; Rhodes Capital LLC; Managing Partner; (212) 555-0188
Wirth, Niklaus; niklaus.wirth@inf.ethz.ch; ETH Zurich; Professor Emeritus; +41 44 555 0166
"James Gosling" <james@gosling.con>; Amazon Web Services; Distinguished Engineer; 1-415-555-0177
```

After parsing:
- `Dr. Margaret Rhodes` → `Margaret Rhodes`
- `Wirth, Niklaus` → `Niklaus Wirth`
- `gmial.com` → `gmail.com` (logged as `Fixed domain typo → gmail.com`)
- `gosling.con` → `gosling.com` (same)
- `(212) 555-0188` → `+1 212 555 0188`
- `1-415-555-0177` → `+1 415 555 0177`

## Swapping in a real LLM

The bundled `assistant()` is fully deterministic and runs in the
browser. To route through a real model instead - GPT, Claude,
Gemini, Llama on your infra - replace the `assistant()` body with:

```ts
async function assistant(text: string): Promise<{ rows: ParsedRow[]; log: string[] }> {
  const res = await fetch('/api/smart-paste', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Parser failed: ${res.status}`)
  return res.json() as Promise<{ rows: ParsedRow[]; log: string[] }>
}
```

On the server side, the model receives the raw paste and a schema for
`ParsedRow`, and returns the same shape. Useful when you need:

- Domain-specific extraction (medical, legal, financial)
- A model with knowledge of your CRM's record shapes
- Audit logging of every paste for compliance

The bundled parser stays the deterministic fallback - call it client-side
when the network call fails or for the 90% of cases that don't need a
model.

## See also

- [Demo 75 - AI Smart Paste](../../examples/src/demos/75-ai-smart-paste.svelte) - the full parser, 5 sample tiles, preview panel, per-row insert/update/skip control, commit through `api.setCellValue`
- [AI assistant - Enterprise](./ai.md) - the `api.ai.filter`, `api.ai.smartFill`, `api.ai.summarize`, `api.ai.classify` helpers
- [Import](./import.md) - file picker for xlsx / csv / tsv / json
