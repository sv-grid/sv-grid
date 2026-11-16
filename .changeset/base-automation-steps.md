---
'@svgrid/enterprise': minor
---

Base automations get the steps Airtable users rebuild their automations
with: "If a condition holds" (Then and Otherwise steps), "Find records and,
for each, do" (`{trigger.Field}` and `{found}` in its steps), "Send a Slack,
Teams or Google Chat message" (each app's own payload, only to its own
addresses), "Ask AI" (the runner's `ai` option; the answer into a field and
as `{ai}`) and "Run a script" (Airtable's `input`, `base` and `output` in a
sandboxed iframe, `runScript`). A new trigger, "When a webhook is received",
gives an automation an address of its own; `createAutomationServer` has
`webhookReceived(token, body)`, and the body's values are `{webhook.name}`.
A run hands values to its later steps. `<SvBaseAutomations>` takes
`webhookUrl` and `scriptsInPage`.
