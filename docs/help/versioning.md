# Doc versioning

How sv-grid documentation tracks multiple shipping major versions.

## Today (single-version mode)

While v1 is the only major in support, the docs at
[svgrid.com](https://svgrid.com) describe v1. The
[`versions.json`](/versions.json) manifest at the docs root says so
explicitly so external tools (LLM crawlers, custom search indexes,
the [MCP server](./mcp-server.md)) can ground themselves on which
version they're reading.

```json
{
  "versions": [
    { "id": "latest", "label": "v1 (current)", "tag": "1.x", "default": true, "docsPath": "/" }
  ]
}
```

## When v2 ships

The day v2.0.0 publishes:

1. **Snapshot v1.** Copy `docs/` → `docs/v1/` in the same PR that
   publishes v2.
2. **Update the manifest.**
   ```json
   {
     "versions": [
       { "id": "latest", "label": "v2 (current)", "tag": "2.x", "default": true, "docsPath": "/" },
       { "id": "v1",     "label": "v1 (LTS)",    "tag": "1.x", "supportUntil": "2027-06-01", "docsPath": "/v1/" }
     ]
   }
   ```
3. **Add a version switcher** to the docs sidebar. Reads
   `/versions.json`; renders a dropdown that swaps the URL prefix.
4. **Add a banner** to every page under `/v1/` linking to the
   matching `/` page in v2 (when one exists) + the migration guide.
5. **Update `llms.txt` + `docs.json`** to default to v2 but list v1
   under a separate section so models grounded against v1 can still
   resolve URLs.

## Long-term support window

Per [api-stability](./api-stability.md):

- The **current major** is fully supported (features + fixes +
  security patches)
- The **previous major** receives **security patches for 12 months**
  after the next-major ships
- Older majors are unsupported

Enterprise Enterprise customers may extend LTS - see
[Enterprise support](../enterprise/support.md).

## Why we don't ship every version separately

Most teams pin to a specific minor and read the docs that match. A
URL like `/v1.6.3/help/pivot.md` would just be extra surface to
maintain - and old text we can't easily fix.

The promise: every shipping major has its own URL prefix and stays
reachable for the LTS window. We don't archive per-minor.

## See also

- [API stability](./api-stability.md) - the semver + deprecation policy
- [Changelog](../changelog.md) - Keep-a-Changelog format with one section per release
- [`versions.json`](/versions.json) - the machine-readable manifest agents and crawlers consume
