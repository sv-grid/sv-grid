# `@svgrid/grid` · `scheduler-ical.ts`

Auto-generated. Source: `packages\grid\src\scheduler-ical.ts`.

### `type ICalEvent`

One VEVENT: the fields SvGrid reads from and writes to an iCalendar feed.

```ts
export type ICalEvent = {
  uid?: string
  title: string
  description?: string
  location?: string
  start: Date
  end: Date
  allDay?: boolean
  status?: 'confirmed' | 'tentative' | 'cancelled'
  rrule?: RecurrenceRule | null
}
```

### `function ruleToRRule`

A {@link RecurrenceRule} -> an iCal `RRULE` value (without the `RRULE:` name).

```ts
export function ruleToRRule(rule: RecurrenceRule): string
```

### `function rruleToRule`

An iCal `RRULE` value -> a {@link RecurrenceRule}.

```ts
export function rruleToRule(value: string): RecurrenceRule | null
```

### `function toICS`

Serialize events to an iCalendar string. `stamp` sets DTSTAMP (default epoch).

```ts
export function toICS(events: ReadonlyArray<ICalEvent>, opts: { prodId?: string; stamp?: Date } = {}): string
```

### `function fromICS`

Parse an iCalendar string into events (unfolds lines, reads VEVENT blocks).

```ts
export function fromICS(text: string): ICalEvent[]
```
