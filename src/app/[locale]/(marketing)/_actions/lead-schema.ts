import { z } from "zod";

/**
 * BL-115-F001 — trial-request lead intake (3 visible fields + ad-funnel
 * attribution). Lives in its own module (not the `"use server"` action file)
 * so the Zod schema + type can be imported by the client form without
 * crossing the server-action boundary.
 */
const emptyToUndefined = (v: string | undefined) => (v && v.length > 0 ? v : undefined);

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform(emptyToUndefined);

export const LeadSchema = z.object({
  // Visible fields (姓名 / 公司邮箱 / 所属游戏工作室).
  name: z.string().trim().min(1).max(128),
  email: z.string().trim().email().max(320),
  studio: z.string().trim().min(1).max(160),
  // UTM attribution + context — captured client-side, all optional.
  utmSource: optionalText(128),
  utmMedium: optionalText(128),
  utmCampaign: optionalText(128),
  utmTerm: optionalText(128),
  utmContent: optionalText(128),
  referrer: optionalText(2000),
  landingPath: optionalText(512),
});

export type LeadInput = z.infer<typeof LeadSchema>;
