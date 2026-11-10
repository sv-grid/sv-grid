/** Mounts base-every-field.svelte in place of the page: `show()` is called by the spec. */
import { mount } from 'svelte'
import '../../../examples/src/gallery-license'
import Fixture from './base-every-field.svelte'

export function show(props: { toaster?: boolean; grouped?: boolean } = {}): void {
  const target = document.createElement('div')
  document.body.replaceChildren(target)
  mount(Fixture, { target, props })
}
