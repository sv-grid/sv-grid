# The same nine apps, in Svelte

These are not a fourth framework to document. They exist so the React, Vue and
Angular pages can show a **running** grid above each code block.

A doc page that only shows code asks the reader to take it on faith. Pairing
each listing with an existing gallery demo would have been quicker, but the
gallery demos are different apps - different data, different columns, different
features - so "here is what that code renders" would have been false. These
mirror their recipe exactly.

They render through `GridBody.svelte`, which is the component `<sv-grid>` and
`<sv-grid-shadow>` render, so this is not an approximation of the element: it is
the element's own body with a Svelte host instead of a custom-element host.
Everything a wrapper does - property assignment, event listening - shows up here
as ordinary props and the `emit` callback.

`data.ts` is a copy of the one beside the other three frameworks, kept identical
by `tools/framework-examples.test.ts`.
