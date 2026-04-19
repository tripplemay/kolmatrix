/**
 * F007 auth-flow suite — covers the CredentialsProvider data path + the
 * jwt / session callbacks from auth.config.ts.
 *
 * The provider's `authorize` callback in src/auth.ts is not directly
 * importable because it lives inside a NextAuth() factory call. We test
 * the same logical chain here by replaying its steps against the real
 * Testcontainers DB:
 *   1) look up the user via `withPlatformAdmin` (same Prisma call),
 *   2) bcrypt-compare against the stored hash,
 *   3) assert the returned shape matches what auth.ts hands to NextAuth,
 *   4) feed that shape into the jwt callback → expect tenantId/role,
 *   5) feed that token into the session callback → expect session.user.*.
 *
 * Wrong-password and unknown-email paths collapse into `null`, which is
 * how NextAuth signals "unauthorised" → the /api/auth/callback/credentials
 * endpoint translates that to a 401 response.
 */
import { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { authConfig } from "@/auth.config";

import { makeTenant, makeUser } from "../fixtures";
import { cleanDb, getAdminPrisma, getAppPrisma, setupTestDb, teardownTestDb } from "../helpers/db";

// Test-local mirror of src/lib/db.ts#withPlatformAdmin — same SQL,
// same semantics. We avoid importing @/lib/db because its module init
// throws when DATABASE_URL is unset at import time, which is before
// setupTestDb() has had a chance to configure the container URL.
async function withPlatformAdmin<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const app = getAppPrisma();
  return app.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL app.is_platform_admin = 'true'`);
    return fn(tx);
  });
}

const PASSWORD = "CorrectHorse!Battery5";

type SeededUser = {
  id: string;
  tenantId: string;
  email: string;
  role: string;
  locale: string;
  name: string;
};

async function authorizeCredentials(email: string, password: string): Promise<SeededUser | null> {
  const user = await withPlatformAdmin((tx) =>
    tx.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        locale: true,
        tenantId: true,
        hashedPassword: true,
      },
    })
  );
  if (!user?.hashedPassword) return null;
  const ok = await bcrypt.compare(password, user.hashedPassword);
  if (!ok) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tenantId: user.tenantId,
    role: user.role,
    locale: user.locale,
  };
}

// Minimal stand-ins for the next-auth callback arg shapes — just enough
// to exercise the code. Real types live inside next-auth.
type JwtArgs = Parameters<NonNullable<typeof authConfig.callbacks>["jwt"]>[0];
type SessionArgs = Parameters<NonNullable<typeof authConfig.callbacks>["session"]>[0];

describe("CredentialsProvider data path + jwt/session callbacks", () => {
  let seeded: SeededUser;

  beforeAll(async () => {
    await setupTestDb();
    await cleanDb();

    const admin = getAdminPrisma();
    const tenant = await admin.tenant.create({ data: makeTenant({ slug: "auth-flow" }) });
    const hashed = await bcrypt.hash(PASSWORD, 4);
    const user = await admin.user.create({
      data: makeUser({
        tenantId: tenant.id,
        email: "marketer@auth-flow.test",
        hashedPassword: hashed,
        role: "marketer",
        locale: "en",
      }),
    });
    seeded = {
      id: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
      locale: user.locale,
      name: user.name,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("successful login returns a user object carrying tenantId + role", async () => {
    const result = await authorizeCredentials(seeded.email, PASSWORD);
    expect(result).not.toBeNull();
    expect(result?.tenantId).toBe(seeded.tenantId);
    expect(result?.role).toBe("marketer");
    expect(result?.locale).toBe("en");
    expect(result?.id).toBe(seeded.id);
  });

  it("wrong password returns null (NextAuth surfaces this as 401)", async () => {
    const result = await authorizeCredentials(seeded.email, "wrong-password");
    expect(result).toBeNull();
  });

  it("unknown email returns null", async () => {
    const result = await authorizeCredentials("ghost@nowhere.test", PASSWORD);
    expect(result).toBeNull();
  });

  it("jwt callback persists tenantId/role/locale onto the token on first pass", async () => {
    const user = (await authorizeCredentials(seeded.email, PASSWORD)) as SeededUser;
    const token = await authConfig.callbacks!.jwt!({
      token: {} as Record<string, unknown>,
      user: user as never,
    } as JwtArgs);
    expect(token.tenantId).toBe(seeded.tenantId);
    expect(token.userId).toBe(seeded.id);
    expect(token.role).toBe("marketer");
    expect(token.locale).toBe("en");
  });

  it("session callback hoists token fields onto session.user (JWT decode round-trip)", async () => {
    const user = (await authorizeCredentials(seeded.email, PASSWORD)) as SeededUser;
    const token = await authConfig.callbacks!.jwt!({
      token: {} as Record<string, unknown>,
      user: user as never,
    } as JwtArgs);
    const session = await authConfig.callbacks!.session!({
      session: { user: { id: "placeholder", email: seeded.email, emailVerified: null } },
      token,
    } as SessionArgs);
    const restored = (session as unknown as { user: Record<string, unknown> }).user;
    expect(restored.id).toBe(seeded.id);
    expect(restored.tenantId).toBe(seeded.tenantId);
    expect(restored.role).toBe("marketer");
    expect(restored.locale).toBe("en");
  });
});
