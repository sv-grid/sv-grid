---
title: TypeScript Patterns for Data-Heavy Front-End Apps
description: Generics, discriminated unions, and type-safe column definitions - practical TypeScript techniques that keep large data-driven UIs maintainable.
date: 2026-05-15
category: Engineering
tags: typescript, generics, type safety, data grid, engineering
author: SvGrid Team
---

Data-heavy front ends - dashboards, admin panels, grids - live or die by their types. When a screen renders dozens of columns from a row shape that changes over time, strong types are the difference between a refactor that takes an afternoon and one that takes a week of runtime bug-hunting. Here are the TypeScript patterns we lean on, drawn from building a typed data grid.

## Generic over the row type

The single most useful pattern is parameterizing your components over the row shape. A column definition should know what row it reads from:

```ts
type ColumnDef<TMeta, TRow> = {
  field?: keyof TRow
  header: string
  accessorFn?: (row: TRow) => unknown
}

type Person = { id: string; firstName: string; age: number }

const columns: ColumnDef<{}, Person>[] = [
  { field: 'firstName', header: 'First name' }, // ok
  { field: 'nope',      header: 'Broken' },      // type error
]
```

Now a typo in a field name is a compile error, not a blank column at runtime. As your `Person` type evolves, the compiler walks you to every column that needs attention.

## `keyof` and accessor safety

Using `field?: keyof TRow` ties the column to real properties. For computed columns, an `accessorFn` keeps the row typed while letting you return anything:

```ts
{ id: 'fullName', header: 'Name', accessorFn: (r: Person) => `${r.firstName}` }
```

The accessor receives a fully typed row, so you get autocomplete and safety even for derived values.

## Discriminated unions for cell and event variants

When a value can take several shapes - a cell that is text, number, or a custom renderer; an edit event for different column types - reach for a discriminated union:

```ts
type CellChange =
  | { kind: 'text';   columnId: string; value: string }
  | { kind: 'number'; columnId: string; value: number }
  | { kind: 'date';   columnId: string; value: Date }

function handle(change: CellChange) {
  switch (change.kind) {
    case 'number': return clamp(change.value) // value is number here
    case 'text':   return change.value.trim() // value is string here
  }
}
```

The compiler narrows `value` per branch, so you never coerce the wrong type, and adding a new variant surfaces every switch that needs a case.

## `satisfies` for literal config

When you write a config array, `satisfies` checks it against a type without widening the literal, so you keep precise inference:

```ts
const columns = [
  { field: 'age', header: 'Age', align: 'right' },
] satisfies ColumnDef<{}, Person>[]
```

You get both: the array is validated, and TypeScript still knows the exact shape you wrote.

## Keep server and client types in sync

The biggest source of data-app bugs is a mismatch between what the API returns and what the UI expects. Generate types from your schema (OpenAPI, GraphQL, or a shared package) rather than hand-writing them twice. A single source of truth means a backend field rename becomes a compile error in the front end, exactly where you want it.

## Avoid `any` at the boundaries

It is tempting to type an API response as `any` and move on. Resist it. Parse and validate at the boundary - with a schema validator or a typed fetch wrapper - so that everything past that point is trustworthy. `any` does not remove risk; it just hides it until runtime.

## Frequently asked questions

### How do I make column definitions type-safe?

Parameterize the column type over your row type and use `field?: keyof TRow`, so a wrong field name is a compile error. Use `accessorFn` for computed columns to keep the row typed.

### When should I use a discriminated union in a data app?

Whenever a value or event has several shapes - different cell types or edit events. The union lets the compiler narrow the payload per case, eliminating wrong-type coercions and flagging unhandled variants.
