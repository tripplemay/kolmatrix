import { z } from "zod";

import { CAMPAIGNS_OPTIONS, ROLE_OPTIONS } from "./form-options";

// Lives in its own module (not actions.ts) because actions.ts carries
// a file-level `"use server"` directive — under that directive every
// export must be an async function (Next.js 16 enforces this in dev
// and at build). Co-locating the zod schema with the form-options
// constants it depends on keeps the shape contract close to its
// validators without crossing the server-action boundary.
export const AccessRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(64),
  lastName: z.string().trim().min(1).max(64),
  email: z.string().trim().email().max(320),
  company: z.string().trim().min(1).max(128),
  role: z.enum(ROLE_OPTIONS),
  campaignsPerQuarter: z.enum(CAMPAIGNS_OPTIONS),
  games: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
  wantsDemo: z
    .union([z.literal("on"), z.literal("true"), z.literal("false"), z.undefined()])
    .optional()
    .transform((v) => v === "on" || v === "true"),
});

export type AccessRequest = z.infer<typeof AccessRequestSchema>;
