# Prompt: 93-password-protected-export

Source: `examples/src/demos/93-password-protected-export.svelte`
Live:   https://svgrid.com/demos/93-password-protected-export/

## What this demo proves

93. Password-protected export
-----------------------------
The export bar gates the download behind a passphrase. The user
picks a format + strength + passphrase; the demo:

  - Builds the export payload (CSV by default; xlsx / PDF stubs
    in this demo show the same flow).
  - Derives a key from the passphrase via PBKDF2 (100k iters).
  - Encrypts the payload with AES-GCM using `window.crypto.subtle`.
  - Packages `salt | iv | ciphertext` into a `.sgexport` Blob and
    triggers a download.

A built-in viewer below lets users decrypt the downloaded file in
place - the round-trip is fully client-side, no server.

Production path (@svgrid/enterprise): xlsx encryption uses the ECMA-376
Agile-Encryption profile (key spin + HMAC over the container).
This demo shows the UX + key-derivation pattern; the Pro pack
wires it to the real .xlsx container.

## Imports

```ts
```

## Registered features

```ts
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
})
```

## How to use this prompt

Drop this file into your LLM's context window when asking it to
generate code matching this pattern. The MCP server exposes the
same content via the `listDemos` tool. See
[LLM grounding](../../../docs/help/llm-grounding.md) for details.
