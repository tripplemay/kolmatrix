/**
 * BM1-F003 · Product create/edit form schema.
 *
 * Shared between the Server Action (runtime validation) and the client
 * Modal (type inference + field name registry). Keep it framework-free so
 * this module can be imported from both the "use server" action file and
 * the "use client" modal without Next pulling in the wrong bundle.
 *
 * USP is intentionally required at the app layer (MVP PRD §13 Q5): the
 * AI asset generator collapses without a concrete selling point, and the
 * UI surfaces a cyan required-star on the label.
 */
import { z } from "zod";

export const PRODUCT_PLATFORMS = ["mobile", "pc", "console", "web3"] as const;
export type ProductPlatform = (typeof PRODUCT_PLATFORMS)[number];

const trimmedOptional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));

export const createProductSchema = z
  .object({
    name: z.string().trim().min(1, "nameRequired").max(200),
    category: z.string().trim().min(1, "categoryRequired").max(80),
    targetAudience: trimmedOptional(2000),
    uniqueSellingPoints: z.string().trim().min(1, "uspRequired").max(4000),
    downloadUrl: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .refine(
        (v) => !v || /^https?:\/\//i.test(v),
        { message: "downloadUrlInvalid" }
      )
      .refine(
        (v) => {
          if (!v) return true;
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        },
        { message: "downloadUrlInvalid" }
      ),
    launchDate: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined))
      .refine(
        (v) => !v || !Number.isNaN(Date.parse(v)),
        { message: "launchDateInvalid" }
      ),
    platforms: z.array(z.enum(PRODUCT_PLATFORMS)).default([]),
    generateImmediately: z.boolean().default(false),
  })
  .strict();

export type CreateProductInput = z.infer<typeof createProductSchema>;

export type CreateProductState = {
  ok: boolean;
  productId?: string;
  error?: "invalid_input" | "generic" | "unauthorized";
  fieldErrors?: Partial<Record<keyof CreateProductInput, string>>;
};
