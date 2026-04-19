/**
 * Tenant factory.
 *
 * Field semantics:
 *   - id         UUID (optional on create; Postgres gen_random_uuid() defaults)
 *   - name       Display name for the company / workspace.
 *   - slug       URL-safe identifier, globally UNIQUE. Defaults wire in a
 *                counter + timestamp + random suffix so parallel tests
 *                never collide.
 *   - plan       Billing plan — "free" | "pro" | "enterprise".
 */
import { faker } from "@faker-js/faker";

import { uniqueSlug } from "./_counter";

export type TenantFixture = {
  id?: string;
  name: string;
  slug: string;
  plan: string;
};

export function makeTenant(overrides: Partial<TenantFixture> = {}): TenantFixture {
  return {
    name: faker.company.name(),
    slug: uniqueSlug("tenant"),
    plan: "free",
    ...overrides,
  };
}
