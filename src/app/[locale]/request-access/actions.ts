"use server";

import { z } from "zod";

import { prisma } from "@/lib/db";
import {
  sendAccessRequestNotification,
  type AccessRequestNotificationPayload,
} from "@/lib/email/access-request";

import { CAMPAIGNS_OPTIONS, ROLE_OPTIONS } from "./form-options";

const AccessRequestSchema = z.object({
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
});

export type SubmitAccessRequestState = {
  ok: boolean;
  error?: "invalid_input" | "tos_required" | "generic";
  fieldErrors?: Record<string, string>;
};

const SILENT_DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function submitAccessRequest(
  _prev: SubmitAccessRequestState,
  formData: FormData
): Promise<SubmitAccessRequestState> {
  const raw = Object.fromEntries(formData);

  // Surface the ToS-unchecked path as its own error code so the UI can
  // point the user at the one field that blocks submission, rather than
  // bundling it into the generic "check highlighted fields" message.
  const tosRaw = raw.tosAccepted;
  if (tosRaw !== "on" && tosRaw !== "true") {
    return { ok: false, error: "tos_required" };
  }

  const parsed = AccessRequestSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".");
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, error: "invalid_input", fieldErrors };
  }
  const data = parsed.data;

  try {
    // 24h silent dedupe: always return ok:true to avoid leaking whether a
    // given email is already in the queue (enumeration-resistance).
    const existing = await prisma.accessRequest.findUnique({ where: { email: data.email } });
    if (existing && Date.now() - existing.createdAt.getTime() < SILENT_DEDUPE_WINDOW_MS) {
      return { ok: true };
    }

    const record = await prisma.accessRequest.upsert({
      where: { email: data.email },
      create: {
        ...data,
        status: "pending",
      },
      update: {
        ...data,
        status: "pending",
      },
    });

    const payload: AccessRequestNotificationPayload = {
      id: record.id,
      email: record.email,
      firstName: record.firstName,
      lastName: record.lastName,
      company: record.company,
      role: record.role,
      campaignsPerQuarter: record.campaignsPerQuarter,
      games: record.games,
      createdAt: record.createdAt,
    };
    await sendAccessRequestNotification(payload);

    return { ok: true };
  } catch (err) {
    console.error("[access-request] submit failed:", err);
    return { ok: false, error: "generic" };
  }
}
