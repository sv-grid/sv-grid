/**
 * Entry point for /scale-lab.html: the same lab as gallery demo 503, alone on
 * a page, with the active tab kept in the URL hash so a tab can be linked.
 *
 * Dev server only: vite.config.js builds index.html alone, so this page never
 * ships with the gallery build or the website.
 */
import '../gallery-license'
import { mount } from 'svelte'
import Lab from './Lab.svelte'

mount(Lab, { target: document.getElementById('root')!, props: { syncHash: true } })
