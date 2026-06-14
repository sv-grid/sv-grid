---
title: A Svelte Data Grid in a Tauri Desktop App
description: Build a desktop data grid with SvGrid and Tauri - loading data from Rust commands or a local SQLite database, with virtualization for large local datasets.
date: 2026-06-13
category: Integration
tags: tauri, desktop, sqlite, integration, svelte data grid
author: SvGrid Team
---

Tauri lets you ship a Svelte app as a small, native desktop binary with a Rust backend. SvGrid is a strong choice for the data-heavy screens such apps usually need - and virtualization means even large local datasets stay smooth. Here is how they fit together.

## Data from a Rust command

Expose a Tauri command that returns rows and call it from Svelte with `invoke`:

```rust
// src-tauri/src/main.rs
#[tauri::command]
fn list_people() -> Vec<Person> { /* read from disk / DB */ }
```

```svelte
<script lang="ts">
  import { invoke } from '@tauri-apps/api/core'
  let rows = $state<Row[]>([])
  $effect(() => { invoke<Row[]>('list_people').then((r) => (rows = r)) })
</script>
<div style="height: 100%;"><SvGrid data={rows} columns={columns} features={features} /></div>
```

## Local SQLite

For real datasets, use `tauri-plugin-sql` (SQLite). Query with `LIMIT`/`OFFSET` and `ORDER BY` for server-style paging, even though "server" here is the local database:

```ts
import Database from '@tauri-apps/plugin-sql'
const db = await Database.load('sqlite:app.db')
const rows = await db.select('SELECT * FROM people ORDER BY name LIMIT 50 OFFSET ?', [page * 50])
```

Drive SvGrid in external mode against these queries exactly as you would a web backend - see [server-side data](server-side-data).

## Why SvGrid suits desktop

- **Virtualization** keeps the UI responsive on large local tables where a desktop user expects spreadsheet-like volumes.
- **Keyboard navigation** matches desktop expectations out of the box.
- **No license server.** The MIT core ships inside your binary with no runtime check.

## Offline and bundle

Everything runs locally, so the grid works offline. SvGrid's core is light, which keeps your Tauri bundle small - a Tauri selling point you do not want a heavy grid to undo.

## Frequently asked questions

### Can I use SvGrid in a Tauri desktop app?

Yes. Load data from a Tauri Rust command via `invoke`, or from a local SQLite database with `tauri-plugin-sql`, and bind it to SvGrid. Virtualization keeps large local datasets fast, and the MIT core ships inside your binary.

### How do I page a local SQLite table in a Tauri grid?

Query with `ORDER BY`, `LIMIT`, and `OFFSET` (plus a `COUNT(*)` for the total) and drive SvGrid in external mode - the same pattern as a web backend, but the database is local.
