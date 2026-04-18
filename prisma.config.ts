import "dotenv/config";

import { defineConfig, env } from "prisma/config";

type Env = {
  DATABASE_ADMIN_URL: string;
};

// Prisma CLI (migrate / seed / studio) always connects as the superuser
// so it can create schema, apply DDL, and insert bootstrap rows without
// RLS getting in the way. The application runtime uses DATABASE_URL (a
// non-superuser role — see F004 migration).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env<Env>("DATABASE_ADMIN_URL"),
  },
});
