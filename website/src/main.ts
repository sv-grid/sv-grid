// @ts-ignore - Svelte type definitions are not properly recognized
import { mount } from 'svelte'
import App from './App.svelte'

// Prerendered pages ship crawlable HTML inside #root. Clear it before the SPA
// mounts so the interactive app replaces the static content cleanly.
const root = document.getElementById('root')!
root.innerHTML = ''

const app = mount(App, {
  target: root,
})

export default app
