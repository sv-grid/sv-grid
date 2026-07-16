import type { EntitySchema } from '../../schema.js'
import { screen, project, dashScreen, type SampleApp } from './shared.js'

const drivers: EntitySchema = {
  name: 'drivers',
  label: 'Driver',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'phone', type: 'text' },
    { field: 'license', type: 'enum', options: [
      { value: 'a', label: 'Class A', color: '#6366f1' },
      { value: 'b', label: 'Class B', color: '#10b981' },
      { value: 'c', label: 'Class C', color: '#f59e0b' },
    ] },
  ],
}

const vehicles: EntitySchema = {
  name: 'vehicles',
  label: 'Vehicle',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'name', type: 'text', required: true },
    { field: 'type', type: 'enum', options: [
      { value: 'van', label: 'Van', color: '#6366f1' },
      { value: 'truck', label: 'Truck', color: '#10b981' },
      { value: 'car', label: 'Car', color: '#f59e0b' },
      { value: 'bike', label: 'Bike', color: '#0ea5e9' },
    ] },
    { field: 'status', type: 'enum', options: [
      { value: 'available', label: 'Available', color: '#10b981' },
      { value: 'on_trip', label: 'On trip', color: '#0ea5e9' },
      { value: 'maintenance', label: 'Maintenance', color: '#ef4444' },
    ] },
    { field: 'plate', type: 'text', label: 'Plate' },
  ],
}

const trips: EntitySchema = {
  name: 'trips',
  label: 'Trip',
  idField: 'id',
  fields: [
    { field: 'id', type: 'text', primaryKey: true, readonly: true },
    { field: 'vehicleId', type: 'relation', label: 'Vehicle', relation: { entity: 'vehicles', foreignKey: 'vehicleId', labelField: 'name' } },
    { field: 'driverId', type: 'relation', label: 'Driver', relation: { entity: 'drivers', foreignKey: 'driverId', labelField: 'name' } },
    { field: 'status', type: 'enum', options: [
      { value: 'planned', label: 'Planned', color: '#94a3b8' },
      { value: 'ongoing', label: 'Ongoing', color: '#0ea5e9' },
      { value: 'done', label: 'Done', color: '#10b981' },
      { value: 'cancelled', label: 'Cancelled', color: '#ef4444' },
    ] },
    { field: 'distanceKm', type: 'number', label: 'Distance (km)' },
    { field: 'cost', type: 'number', label: 'Cost ($)' },
    { field: 'date', type: 'date', label: 'Date' },
  ],
}

const seed = {
  drivers: [
    { id: 'dr1', name: 'Miguel Santos', phone: '+1 (415) 555-0201', license: 'a' },
    { id: 'dr2', name: 'Aisha Khan', phone: '+1 (312) 555-0202', license: 'b' },
    { id: 'dr3', name: 'Tom Becker', phone: '+1 (206) 555-0203', license: 'a' },
    { id: 'dr4', name: 'Lena Novak', phone: '+1 (720) 555-0204', license: 'c' },
    { id: 'dr5', name: 'Raj Mehta', phone: '+1 (646) 555-0205', license: 'b' },
    { id: 'dr6', name: 'Sofia Rossi', phone: '+1 (305) 555-0206', license: 'c' },
  ],
  vehicles: [
    { id: 've1', name: 'Sprinter 1', type: 'van', status: 'available', plate: 'FLT-1201' },
    { id: 've2', name: 'Hauler 2', type: 'truck', status: 'on_trip', plate: 'FLT-1202' },
    { id: 've3', name: 'Sedan 3', type: 'car', status: 'available', plate: 'FLT-1203' },
    { id: 've4', name: 'Courier 4', type: 'bike', status: 'maintenance', plate: 'FLT-1204' },
    { id: 've5', name: 'Hauler 5', type: 'truck', status: 'on_trip', plate: 'FLT-1205' },
    { id: 've6', name: 'Sprinter 6', type: 'van', status: 'available', plate: 'FLT-1206' },
  ],
  trips: [
    { id: 'tp1', vehicleId: 've1', driverId: 'dr1', status: 'done', distanceKm: 120, cost: 180, date: '2026-07-08' },
    { id: 'tp2', vehicleId: 've2', driverId: 'dr2', status: 'ongoing', distanceKm: 340, cost: 520, date: '2026-07-12' },
    { id: 'tp3', vehicleId: 've3', driverId: 'dr3', status: 'planned', distanceKm: 60, cost: 90, date: '2026-07-15' },
    { id: 'tp4', vehicleId: 've4', driverId: 'dr4', status: 'cancelled', distanceKm: 15, cost: 25, date: '2026-07-09' },
    { id: 'tp5', vehicleId: 've5', driverId: 'dr5', status: 'ongoing', distanceKm: 410, cost: 640, date: '2026-07-13' },
    { id: 'tp6', vehicleId: 've1', driverId: 'dr6', status: 'done', distanceKm: 95, cost: 140, date: '2026-07-11' },
    { id: 'tp7', vehicleId: 've2', driverId: 'dr1', status: 'done', distanceKm: 275, cost: 430, date: '2026-07-10' },
  ],
}

export const fleet: SampleApp = {
  id: 'fleet',
  name: 'Fleet',
  description: 'Vehicles, drivers and trips - utilization and cost dashboards.',
  emoji: '\u{1F69A}',
  accent: '#0284c7',
  build: () =>
    project({
      title: 'Fleetly',
      brand: 'Fleetly',
      accent: '#0284c7',
      footer: '',
      entities: [drivers, vehicles, trips],
      seed,
      screens: [
        dashScreen(trips, { id: 'overview', title: 'Overview', order: 0 }, [
          { kpi: 'Trips', reduce: 'count' },
          { kpi: 'Total cost', measure: 'cost', reduce: 'sum' },
          { kpi: 'Avg cost', measure: 'cost', reduce: 'avg' },
          { chart: 'status', measure: 'cost', reduce: 'sum', type: 'bar', span: 2 },
          { kpi: 'Costliest trip', measure: 'cost', reduce: 'max', span: 1 },
          { chart: 'status', reduce: 'count', type: 'pie', span: 1 },
          { grid: true, span: 3 },
        ]),
        screen(vehicles, 'master-detail', { id: 'vehicles', title: 'Vehicles', order: 1, child: trips, foreignKey: 'vehicleId' }),
        screen(trips, 'crud', { id: 'trips', title: 'Trips', order: 2 }),
        screen(drivers, 'crud', { id: 'drivers', title: 'Drivers', order: 3 }),
      ],
    }),
}
