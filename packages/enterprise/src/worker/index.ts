/**
 * `@svgrid/enterprise/worker` - what runs INSIDE the worker behind
 * `createWorkerDataSource`. Import it from your worker file and nowhere else:
 * it has no Svelte and no DOM in its import graph, so the worker bundle stays
 * the in-memory source and little more.
 *
 * The main-thread half, `createWorkerDataSource`, is on the package root and
 * on `@svgrid/enterprise/server`.
 */
export {
  serveWorkerDataSource,
  type ServeWorkerDataSourceOptions,
  type WorkerScopeLike,
} from './serve'
export { inferSchemaFromRows, type InferSchemaOptions } from './infer-schema'
export { createColumnarDataSource, type ColumnarDataSource } from './columnar'
