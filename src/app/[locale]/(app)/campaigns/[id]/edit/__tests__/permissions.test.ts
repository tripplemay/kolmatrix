/**
 * BL-105-F001 · canEditCampaign owner/admin gate.
 */
import { describe, expect, it } from "vitest";

import { canEditCampaign } from "../permissions";

const OWNER = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

describe("canEditCampaign", () => {
  it("allows the campaign owner", () => {
    expect(canEditCampaign(OWNER, OWNER, "marketer")).toBe(true);
  });

  it("allows platform_admin and tenant_admin even when not the owner", () => {
    expect(canEditCampaign(OWNER, OTHER, "platform_admin")).toBe(true);
    expect(canEditCampaign(OWNER, OTHER, "tenant_admin")).toBe(true);
  });

  it("denies a non-owner marketer / client", () => {
    expect(canEditCampaign(OWNER, OTHER, "marketer")).toBe(false);
    expect(canEditCampaign(OWNER, OTHER, "client")).toBe(false);
  });

  it("denies when there is no user id", () => {
    expect(canEditCampaign(OWNER, null, "platform_admin")).toBe(false);
    expect(canEditCampaign(OWNER, undefined, "tenant_admin")).toBe(false);
  });
});
