// @ts-ignore - Svelte type definitions are not properly recognized
import { mount } from 'svelte'
import App from './App.svelte'
import { setLicenseKey, dismissUnlicensedNudge } from '@svgrid/enterprise'

// svgrid.com is the vendor's own site, so the enterprise "license key required"
// watermark + console nudge must NOT appear here. Suppress them globally at
// startup (a dev convenience for our own domain, not a customer-facing bypass -
// the public @svgrid/enterprise package still shows the nudge to unlicensed use).
setLicenseKey('SVENTERPRISE-DEV-LOCAL')
dismissUnlicensedNudge()

// Prerendered pages ship crawlable HTML inside #root. Clear it before the SPA
// mounts so the interactive app replaces the static content cleanly.
const root = document.getElementById('root')!
root.innerHTML = ''

const app = mount(App, {
  target: root,
})

export default app
