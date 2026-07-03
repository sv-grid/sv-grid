# Text formatting

The `format` field on a column produces locale-aware formatted strings
without you writing a renderer.
<div data-docs-demo="13-finances" data-height="540"></div>

## Number

```ts
{ field: 'count', header: 'Count',
  format: { type: 'number', options: { maximumFractionDigits: 0 } } }
```

`options` is `Intl.NumberFormatOptions`. Combine with `locales` for
non-default locales:

```ts
{ field: 'count', header: 'Anzahl',
  format: { type: 'number', locales: 'de-DE', options: { maximumFractionDigits: 0 } } }
```

## Currency

```ts
{ field: 'salary', header: 'Salary',
  format: { type: 'currency', currency: 'USD' } }
```

`currency` is an ISO 4217 code; if omitted, USD is used.

## Percent

```ts
// values are fractions (0.42 → 42%)
{ field: 'utilization', header: 'Util',
  format: { type: 'percent' } }

// values are 0–100 (42 → 42%)
{ field: 'progress', header: 'Progress',
  format: { type: 'percent', valueIsPercentPoints: true } }
```

## Date / datetime

```ts
{ field: 'joinedAt', header: 'Joined',
  format: { type: 'date', pattern: 'y-m-d' } }

{ field: 'updatedAt', header: 'Updated',
  format: { type: 'datetime', pattern: 'medium' } }
```

Built-in patterns:

| pattern | shorthand for |
| ------- | ------------- |
| `'d'`   | short numeric date |
| `'D'`   | long date |
| `'y-m-d'` | year-month-day |
| `'short'` \| `'medium'` \| `'long'` | `dateStyle` / `timeStyle` presets |

Combine `pattern` with `options` to override individual fields.

## Custom formatter

For anything `format` cannot express, use `formatter`:

```ts
{
  field: 'temperature',
  header: 'Temp',
  formatter: ({ value }) => `${Number(value).toFixed(1)}°C`,
}
```

`formatter` runs **after** the accessor and **before** the cell renderer.
Its return value is what gets displayed and copied to the clipboard.

## Order of precedence

When a column has both, the resolution order is:

1. `field` / `fieldFn` produces the value
2. If `cell` is set, it renders - `format` / `formatter` are ignored
3. Otherwise `formatter` runs if set
4. Otherwise `format` runs if set
5. Otherwise the value is rendered as `String(value)`

## See also

- [Cell components](./cell-components.md) - when `format` is not enough.
- [`cell-formatting.ts`](../../../packages/grid/src/cell-formatting.ts)
