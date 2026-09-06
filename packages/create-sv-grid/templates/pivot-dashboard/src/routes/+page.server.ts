import type { PageServerLoad } from './$types'
import { loadFacts } from '$lib/facts'

/**
 * The fact table is built on the server and sent with the page.
 *
 * A pivot over a warehouse query belongs on the server: the browser should get
 * facts, not a database connection. Swap `loadFacts` for your query and the
 * rest of the dashboard is unchanged.
 */
export const load: PageServerLoad = () => ({ facts: loadFacts() })
