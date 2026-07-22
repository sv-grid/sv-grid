/**
 * The sample-app gallery: ready-made, polished `StudioProject`s a user loads to
 * see a beautiful working multi-entity app in a couple of clicks, then tweaks or
 * rebinds to their own backend. Each is plain data (entities + screens + curated
 * seed + theme), so it round-trips and generates like any hand-built project.
 */
import type { SampleApp } from './shared.js'
import { crm } from './crm.js'
import { ecommerce } from './ecommerce.js'
import { projectTracker } from './projects.js'
import { support } from './support.js'
import { subscriptions } from './subscriptions.js'
import { invoicing } from './invoicing.js'
import { inventory } from './inventory.js'
import { ats } from './ats.js'
import { hr } from './hr.js'
import { clinic } from './clinic.js'
import { school } from './school.js'
import { events } from './events.js'
import { restaurant } from './restaurant.js'
import { realEstate } from './realestate.js'
import { fleet } from './fleet.js'
import { gym } from './gym.js'
import { library } from './library.js'
import { insurance } from './insurance.js'

export type { SampleApp } from './shared.js'
export { liveDataSamples, getLiveDataSample } from './live-data.js'

/** All shipped sample apps, in gallery order. */
export const sampleApps: SampleApp[] = [
  crm,
  ecommerce,
  subscriptions,
  invoicing,
  inventory,
  support,
  ats,
  hr,
  projectTracker,
  clinic,
  school,
  events,
  restaurant,
  realEstate,
  fleet,
  gym,
  library,
  insurance,
]

/** Look up a sample app by id (the `--template` value). */
export function getSampleApp(id: string): SampleApp | undefined {
  return sampleApps.find((s) => s.id === id)
}
