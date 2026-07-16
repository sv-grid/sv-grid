# Date & time

Three date/time controls built on a shared, framework-free date engine
(`date-core`, `date-format`, `date-selection`, `date-restrict`). They are the
rich-by-default editors for `date`, `datetime` and `time` grid columns, and work
standalone. Parity reference: the Smart UI calendar / date-time / time pickers.

## SvCalendar

A month / year / decade calendar with every selection mode.

```svelte
<script>
  import { SvCalendar } from '@svgrid/grid'
  let value = $state([new Date()])
</script>

<SvCalendar
  {value}
  selectionMode="range"
  firstDayOfWeek={1}
  weekNumbers
  footer
  onChange={(dates) => (value = dates)}
/>
```

Key props: `value` (Date | Date[] | string), `selectionMode`
(`one` `zeroOrOne` `many` `zeroOrMany` `oneOrMany` `oneExtended` `week` `range`),
`min` / `max`, `restrictedDates` (list or predicate), `importantDates`,
`firstDayOfWeek` (0-6), `weeks`, `weekNumbers`, `months` (multi-panel),
`displayMode` (`month` `year` `decade`), `hideDayNames`, `hideOtherMonthDays`,
`dayNameFormat` / `monthNameFormat`, `footer`, `locale`, `disabled`, `readonly`.
Emits `onChange(dates)` and `onNavigate(viewDate, displayMode)`.

Keyboard: arrows move by day, PageUp/Down by month (Shift = year), Home/End to
week ends, Enter/Space selects, the title button drills up the view.

## SvTimePicker

An analog clock-dial picker (12- or 24-hour).

```svelte
<SvTimePicker value={new Date()} format="12-hour" minuteInterval={5} footer
  onChange={(d) => (time = d)} />
```

Key props: `value` (Date | "HH:MM"), `format` (`12-hour` | `24-hour`),
`minuteInterval`, `autoSwitchToMinutes`, `footer` (Now), `selection`
(`hour` | `minute`), `disabled`, `readonly`. Drag the hand or click a number;
arrow keys nudge the active field. Emits `onChange(date)`.

## SvDateTimePicker

A formatted text input plus a portalled dropdown with DATE / TIME tabs
(composes `SvCalendar` + `SvTimePicker`).

```svelte
<SvDateTimePicker
  value={new Date()}
  formatString="yyyy-MM-dd HH:mm"
  dropDownDisplayMode="both"
  min={new Date(2020, 0, 1)}
  nullable
  spinButtons
  onChange={(d) => (value = d)}
/>
```

Key props: `value`, `formatString` (token engine: `d dd M MM MMM MMMM yy yyyy H HH
h hh mm ss fff tt`), `dropDownDisplayMode` (`both` | `calendar` | `time`),
`min` / `max`, `nullable`, `hourFormat`, `minuteInterval`, `spinButtons`,
`stepMinutes`, `firstDayOfWeek`, `weekNumbers`, `locale`, `disabled`, `readonly`.
Typed text is parsed on blur/Enter and reverts if it doesn't fit the mask; the
value is clamped to `min` / `max`. Emits `onChange`, plus `onCommit` / `onCancel`
for grid editing.
