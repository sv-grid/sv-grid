---
'@svgrid/enterprise': minor
---

Base: replies to comments and resolved threads. A comment store with `replies: true` gets Reply under each comment (`replyTo`, always the thread's first comment); one with `resolve` gets Resolve, which folds a thread to one line with who resolved it, Show and Reopen. `commentThreads()` gives a record's threads; without a store both are kept in the page.
