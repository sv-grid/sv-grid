---
'@svgrid/enterprise': minor
---

Base automations can send a text message: "Send a text message (SMS or
Viber)" to phone numbers or a phone field, the text naming fields. It runs on
the server: `createAutomationServer` takes `sendText`, which gets
`{ to, text, channel }` for your SMS or Viber provider.
