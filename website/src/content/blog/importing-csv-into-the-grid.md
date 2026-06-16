---
title: Importing CSV into a Svelte Data Grid
description: Let users upload a CSV and load it into SvGrid - parsing the file, mapping columns, validating rows, and handling the messy real-world cases.
date: 2026-08-04
category: Data
tags: csv, import, data, recipe, svelte data grid
author: Boyko Markov
---

Letting users bring their own data via CSV upload is a staple of admin and data tools. With SvGrid you parse the file into objects and set them as the grid's `data`. Here is a practical, robust recipe - including the messy parts CSV always has.

## Read the file

Take a file from an `<input type="file">` and read its text:

```svelte
<input type="file" accept=".csv,text/csv" onchange={onFile} />

<script lang="ts">
  async function onFile(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const text = await file.text()
    rows = parseCsv(text)
  }
</script>
```

## Parsing: use a real parser for real CSV

A naive `split(',')` breaks on the first quoted comma. For trustworthy input a one-line split is fine; for user uploads, use a small, correct CSV parser (it handles quoted fields, embedded commas, and newlines inside quotes). The Enterprise pack includes import that handles XLSX and CSV with these edge cases; if you roll your own, do not split on commas blindly.

```ts
// header row -> objects
function toObjects(rows: string[][]): Row[] {
  const [header, ...body] = rows
  return body.map((cells) => Object.fromEntries(header.map((h, i) => [h, cells[i]])))
}
```

## Map columns

User CSVs rarely match your fields exactly. Offer a mapping step: show the file's headers and let the user map each to a grid column (or auto-map on exact name match). This turns "Full Name" into `name` without forcing users to edit their file.

## Validate before committing

Validate the parsed rows before loading them: coerce types (numbers, dates), flag rows that fail rules, and show a preview with errors highlighted. Let the user fix or skip bad rows rather than importing silently. Import is a great place to reuse your [editing validation](inline-editing-with-validation).

## Large files

For big CSVs, parse in a chunked/streaming fashion (or a Web Worker) so the UI stays responsive, and rely on SvGrid's virtualization to render the result - tens of thousands of imported rows scroll fine once loaded.

## Frequently asked questions

### How do I import a CSV file into SvGrid?

Read the uploaded file's text, parse it into objects (using a proper CSV parser for quoted fields), optionally map the file's headers to your columns, validate, and set the result as the grid's `data`. The Enterprise pack also provides built-in CSV/XLSX import.

### Why not just split on commas to parse CSV?

Because real CSV has quoted fields containing commas and newlines, which a naive `split(',')` mangles. Use a correct CSV parser for user-uploaded files, and reserve simple splitting for data you fully control.
