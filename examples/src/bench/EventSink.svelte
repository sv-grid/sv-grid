<!--
  One delegated click handler and nothing else. run.ts mounts it after a grid
  is destroyed and clicks it: Svelte keeps the last event it delegated
  (`last_propagated_event` in svelte/src/internal/client/dom/elements/events.js),
  and that event's target holds the destroyed grid's DOM until another
  delegated event replaces it. In an app the user's next click does that;
  on the bench page there is no other Svelte root, so this one does.
-->
<button type="button" onclick={() => {}}>sink</button>
