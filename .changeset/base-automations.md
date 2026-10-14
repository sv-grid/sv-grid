---
"@svgrid/enterprise": minor
"@svgrid/grid": patch
---

SvGrid Base: automations. A table's `automations` do things on their own,
edited under "Automations" in the view bar.

- Triggers: a record is created, a record changes (any field, or the fields
  you pick), a record starts matching a condition, a form is sent, a button
  field is pressed, or a scheduled time (cron).
- An optional condition, written with the view bar's filter.
- Actions, in order: update the record, create a record in any table and
  link it back, show a notice with `{Field name}` tokens, color the record
  while it matches, call a webhook (the record as JSON, or a body you write;
  secrets as `{secret:NAME}`), send an email, or run an action the app adds
  with `registerAutomationAction`.
- Values are written as the field shows them: an option's name, a person's
  name, `today+7`, `100%`, a linked record's name or `{record}`.
- Every run is listed with what each action did. What an action changes can
  set off other automations, up to four deep; past that the run stops, so
  automations cannot loop.
- By default an automation runs in the page of the person who made the
  change, and a change it makes goes to the table's source like an edit.
  Changes that arrive from other people do not run it again.
- `runOn: 'server'` and `createAutomationServer`: automations that run in
  your server for every change to the database, whoever made it. It hears
  changes through the `audit` hook of `createKitHandlers`, a database
  webhook (`recordChanged` with both sides) or by reading a table again, and
  `tick()` runs the scheduled ones. It writes through the same `baseSource`s,
  reads secrets, sends email with the `sendEmail` you give it, and ignores
  the echo of its own writes. `<SvBase serverRuns>` shows its runs in the
  dialog.
- A Button field runs the automation set on it (`fieldButtons`, handed to
  the grid by `<SvBase>`).
- `BaseSource.toPage(row)`: a database row in the base's shape.

Alerts and the expression language, for any grid:

- The `ext` predicate node and `registerPredicateKind`: a condition another
  module evaluates. A type nobody registered matches nothing. The grid's
  `GridPredicateExpr` mirror has the node too.
- `baseCondition(filter)`: SvGrid Base's filter as an alert rule's condition.
- `<SvGridAlerts token onRulesChange>`, the engine's `token` option, and
  `setAlertConditionEditor` to swap the rule editor's condition editor.
