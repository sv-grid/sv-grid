---
"@svgrid/enterprise": minor
---

`<sv-sheet>`: the spreadsheet shell as a custom element, from
`@svgrid/enterprise/wc`, for a page or a host with no Svelte in its build.
Its props, events, types, React and Vue wrappers
(`@svgrid/enterprise/wc/react`, `@svgrid/enterprise/wc/vue`) and docs
tables are generated from the component's own props. Every callback is
an event (`action` is cancelable and takes the action over on
`preventDefault()`), `ready` parks the api and the document on the
element, and the component's methods (`getState`, `setState`, `act`,
`open`, `toXlsx`, `print` and the rest) are on it too.
