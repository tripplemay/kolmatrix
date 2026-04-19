/**
 * MSW service worker — used by Playwright E2E tests that need to stub
 * external calls from the actual browser (F008 marketer flow + F009
 * visual regression may enable this later).
 *
 * Enable from an E2E spec:
 *   import { worker } from '../mocks/browser';
 *   await worker.start({ onUnhandledRequest: 'warn' });
 *
 * Note: worker.start() must be called inside a browser context
 * (i.e. from a Playwright page evaluate block). Usage is opt-in per
 * spec so most E2E tests hit the real app stack end-to-end.
 */
import { setupWorker } from "msw/browser";

import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
