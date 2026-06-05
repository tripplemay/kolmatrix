/**
 * BL-083-F005 · Outreach composer email-provenance helpers.
 *
 * Covers the pure logic behind the composer's business-email priority
 * (per features.json F005 acceptance):
 *   - send defaults to the fork-unlocked emails[0] over the legacy email
 *   - bio-regex-only KOLs are detected so the UI can warn before sending
 */
import { readFileSync } from "fs";
import { resolve } from "path";

import { describe, expect, it } from "vitest";

import {
  coerceComposerEmails,
  isBioRegexOnly,
  pickPrimaryEmail,
} from "../composer-email-utils";

describe("BL-083-F005 coerceComposerEmails", () => {
  it("keeps non-empty strings, trimmed; drops blanks + non-strings", () => {
    expect(
      coerceComposerEmails([" a@b.com ", "", "  ", 7, null, "c@d.com"]),
    ).toEqual(["a@b.com", "c@d.com"]);
  });

  it("returns [] for null / non-array", () => {
    expect(coerceComposerEmails(null)).toEqual([]);
    expect(coerceComposerEmails("a@b.com")).toEqual([]);
  });
});

describe("BL-083-F005 pickPrimaryEmail — send default address", () => {
  it("defaults to the first fork-unlocked business email", () => {
    expect(pickPrimaryEmail(["biz@unlock.com", "second@x.com"], "legacy@old.com")).toBe(
      "biz@unlock.com",
    );
  });

  it("falls back to the legacy single email when no unlocked emails", () => {
    expect(pickPrimaryEmail([], "legacy@old.com")).toBe("legacy@old.com");
  });

  it("returns null when the KOL has no address at all", () => {
    expect(pickPrimaryEmail([], null)).toBeNull();
    expect(pickPrimaryEmail([], "")).toBeNull();
  });
});

describe("BL-083-F005 isBioRegexOnly — composer warning trigger", () => {
  it("is true for a bio-regex address with no business unlock", () => {
    expect(
      isBioRegexOnly({
        email: "a@b.com",
        emails: [],
        emailSource: "bio-regex",
      }),
    ).toBe(true);
  });

  it("is false when the KOL has a fork-unlocked business email", () => {
    expect(
      isBioRegexOnly({
        email: "biz@unlock.com",
        emails: ["biz@unlock.com"],
        emailSource: "business-unlock",
      }),
    ).toBe(false);
  });

  it("is false for manual / no email", () => {
    expect(
      isBioRegexOnly({ email: "a@b.com", emails: [], emailSource: "manual" }),
    ).toBe(false);
    expect(
      isBioRegexOnly({ email: null, emails: [], emailSource: "bio-regex" }),
    ).toBe(false);
  });
});

describe("BL-083-F005 OutreachComposer — UI wiring guards", () => {
  const composer = readFileSync(
    resolve(
      __dirname,
      "../../../app/[locale]/(app)/reach/OutreachComposer.tsx",
    ),
    "utf8",
  );

  it("renders the business-unlock (green) + bio-regex (grey, tooltip) chips", () => {
    expect(composer).toMatch(/data-testid="outreach-email-source-business-unlock"/);
    expect(composer).toMatch(/data-testid="outreach-email-source-bio-regex"/);
    expect(composer).toMatch(/emerald/);
    expect(composer).toMatch(/title=\{labels\.bioRegexTooltip\}/);
  });

  it("renders the bio-only warning banner gated on isBioRegexOnly", () => {
    expect(composer).toMatch(/data-testid="outreach-bio-only-banner"/);
    expect(composer).toMatch(/selectableKols\.some\(isBioRegexOnly\)/);
    expect(composer).toMatch(/labels\.bioOnlyBanner/);
  });
});
