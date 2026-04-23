/**
 * BM2-F004 · Campaign create/edit form schema.
 *
 * Shared between:
 *   - the "use server" Server Action runtime validation
 *   - the "use client" form component's field registry / error map
 *   - the POST /api/campaigns JSON adapter
 *
 * F005 will reuse the same schema for inline-edit (`updateCampaignSchema`)
 * by `.partial()`-ing this base. F006 reuses field constants (not the
 * validator directly).
 *
 * Validation stays at the app layer (zod) — the DB column `status` is a
 * free-text String for consistency with Kol.relationshipStatus and the
 * same `campaign_status_filter` enum defined in status.ts.
 */
import { z } from "zod";

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

// `<input type="date">` returns empty string when cleared. Treat '' as
// undefined so zod's nullable optional path doesn't fail on missing
// pickers. Valid ISO-8601 date string is everything that `new Date(s)`
// can parse without returning Invalid Date.
const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))
  .refine(
    (v) => !v || !Number.isNaN(new Date(v).getTime()),
    { message: "dateInvalid" }
  )
  .transform((v) => (v ? new Date(v) : undefined));

// productId is a cuid (per BM1 Product model) — we validate it's a
// non-empty string; Prisma's FK constraint catches unknown ids at
// insert time with a descriptive error.
const productIdSchema = z
  .string()
  .trim()
  .min(1, "productIdRequired")
  .max(64);

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CAMPAIGN_MARKETS = [
  "global",
  "us",
  "eu",
  "jp",
  "kr",
  "sea",
  "cn",
  "latam",
] as const;
export type CampaignMarket = (typeof CAMPAIGN_MARKETS)[number];

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, "nameRequired").max(80),
  productId: productIdSchema,
  budgetAmount: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined))
    .refine(
      (v) => !v || /^\d+(\.\d{1,2})?$/.test(v),
      { message: "budgetInvalid" }
    )
    .refine(
      (v) => !v || Number(v) <= 99_999_999.99,
      { message: "budgetOverflow" }
    )
    .transform((v) => (v ? Number(v) : undefined)),
  startDate: optionalDate,
  endDate: optionalDate,
  game: trimmedOptional(80),
  markets: z
    .array(z.enum(CAMPAIGN_MARKETS))
    .optional()
    .transform((v) => v ?? []),
  kpiTarget: trimmedOptional(2000),
  ownerUserId: z
    .string()
    .regex(UUID_RE, { message: "ownerInvalid" }),
});

// Enforce endDate >= startDate when both present. Separate .superRefine
// so the individual field errors above still surface first.
export const createCampaignSchemaWithDateOrder = createCampaignSchema
  .superRefine((data, ctx) => {
    if (
      data.startDate &&
      data.endDate &&
      data.endDate.getTime() < data.startDate.getTime()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endBeforeStart",
        path: ["endDate"],
      });
    }
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

export type CreateCampaignFormErrors = Partial<
  Record<
    | "name"
    | "productId"
    | "budgetAmount"
    | "startDate"
    | "endDate"
    | "game"
    | "markets"
    | "kpiTarget"
    | "form",
    string
  >
>;

export interface CreateCampaignState {
  ok: boolean;
  id?: string;
  errors?: CreateCampaignFormErrors;
}
