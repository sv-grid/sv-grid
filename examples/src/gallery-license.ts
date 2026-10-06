// The gallery's license key, set once at startup the way a customer app sets
// its own in main.ts. Demo sources never call setLicenseKey: a copied demo, a
// StackBlitz export or an MCP answer then shows the normal evaluation
// watermark instead of carrying a key that silences it. Imported first by
// every entry that mounts demos (src/main.ts, src/stage/main.ts). The bare
// package import matters: vite.config.js aliases it to the same src module
// the demos import, so this key and their license checks share one state.
import { setLicenseKey } from '@svgrid/enterprise'

setLicenseKey('SVENTERPRISE-DEV-LOCAL')
