/**
 * User factory.
 *
 * Field semantics:
 *   - tenantId       FK → tenant.id. Callers MUST override this with a
 *                    real tenant id for DB inserts; the default is a
 *                    random UUID so pure-type tests still compile.
 *   - email          UNIQUE across all tenants. Defaults to a uniquely
 *                    suffixed address to dodge parallel collisions.
 *   - hashedPassword bcrypt hash of "password123" computed once per
 *                    process (cost 4 → fast for tests, NEVER use in
 *                    production). Real login flows in the seed use
 *                    "KOLMatrix@2026!" at cost 10.
 *   - name           Display name; random full name.
 *   - role           "admin" | "marketer" (default). Matches the values
 *                    used by the credentials provider.
 *   - locale         One of the next-intl locales. Default "en".
 *
 * Example:
 *   const row = await adminPrisma.user.create({
 *     data: makeUser({ tenantId: tenant.id, email: "mark@acme.test" }),
 *   });
 */
import { faker } from "@faker-js/faker";
import bcrypt from "bcrypt";

const DEFAULT_PASSWORD_HASH = bcrypt.hashSync("password123", 4);

export type UserFixture = {
  id?: string;
  tenantId: string;
  email: string;
  hashedPassword: string;
  name: string;
  role: string;
  locale: string;
};

export function makeUser(overrides: Partial<UserFixture> = {}): UserFixture {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  return {
    tenantId: faker.string.uuid(),
    email: faker.internet
      .email({ firstName, lastName, provider: `t${Date.now()}.test` })
      .toLowerCase(),
    hashedPassword: DEFAULT_PASSWORD_HASH,
    name: `${firstName} ${lastName}`,
    role: "marketer",
    locale: "en",
    ...overrides,
  };
}
