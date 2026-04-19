import "@testing-library/jest-dom/vitest";

import { afterAll, afterEach, beforeAll } from "vitest";

import { server } from "./mocks/server";

// MSW lifecycle shared by every Vitest run. `onUnhandledRequest: 'warn'`
// keeps unrelated fetch calls (e.g. next/font CDN) from turning into
// hard failures while still making the noise visible during triage.
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
