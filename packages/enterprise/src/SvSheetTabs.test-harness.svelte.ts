/**
 * Test-only harness for SvSheetTabs.
 *
 * `mount()` takes a plain props object, and a plain object's fields are not
 * reactive, so a test cannot change a prop after mounting and see the
 * component respond. This box holds the props in `$state` so it can - which is
 * what proves the strip follows an OUTSIDE workbook mutation (Ctrl+PageUp and
 * friends) rather than only its own button clicks.
 *
 * Runes only compile in `.svelte.ts`, hence the separate file. The `.test.`
 * segment keeps it out of the published tarball (tools/strip-dist-tests.mjs)
 * and out of vitest's `*.dom.test.ts` include.
 */
export function reactiveProps<T extends Record<string, unknown>>(initial: T) {
  const box = $state({ ...initial }) as T
  return {
    props: box,
    set(patch: Partial<T>) {
      Object.assign(box, patch)
    },
  }
}
