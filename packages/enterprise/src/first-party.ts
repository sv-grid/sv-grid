// svgrid.com runs every Enterprise demo without a license key and without the
// watermark. It cannot carry the key: the site is public JavaScript, and the
// one license key in a public bundle is the key for everyone. So the nudges
// (watermark, upgrade card, console notice) stand down on the site's own
// hostnames instead. Any other host needs the key.
const FIRST_PARTY_HOSTS = new Set(['svgrid.com', 'www.svgrid.com'])

/** True on svgrid.com itself. False on the server and everywhere else. */
export function isFirstPartySite(): boolean {
  const host = (globalThis as { location?: { hostname?: string } }).location?.hostname
  return typeof host === 'string' && FIRST_PARTY_HOSTS.has(host.toLowerCase())
}
