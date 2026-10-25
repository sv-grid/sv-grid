// The worker script an app writes for `pdf.worker`, served by the website's
// dev server for tests/e2e/pdf-worker.spec.ts.
import { servePdfWorker } from '../../../packages/enterprise/src/pdf-worker'

servePdfWorker()
