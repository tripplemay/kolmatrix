/**
 * BL-073-F006 · Unit tests for filterTouchesZeroCoverage + the shape
 * of the DataCoverage record. `getDataCoverage` itself hits Prisma so
 * it's exercised in the integration suite; the pure-function predicate
 * runs here because it carries the actual marketer-visible logic
 * (early-return = "you filtered on a NULL column").
 */
import { describe, expect, it } from "vitest";

import {
  filterTouchesZeroCoverage,
  type DataCoverage,
  type DiscoveryFilters,
} from "../filters";

const FULL_COVERAGE: DataCoverage = {
  regions: 4,
  languages: 3,
  platforms: 5,
  categories: 7,
  monetizationStatuses: 3,
  brandSafety: 1,
};

const ZERO_REGIONS: DataCoverage = { ...FULL_COVERAGE, regions: 0 };
const ZERO_LANGS: DataCoverage = { ...FULL_COVERAGE, languages: 0 };
const ALL_ZERO: DataCoverage = {
  regions: 0,
  languages: 0,
  platforms: 0,
  categories: 0,
  monetizationStatuses: 0,
  brandSafety: 0,
};

function baseFilters(): DiscoveryFilters {
  return {
    regions: [],
    categories: [],
    languages: [],
    platforms: [],
    monetizationStatuses: [],
    brandSafety: [],
    knownCollabs: [],
    tags: [],
    channelAge: [],
    uploadFrequency: [],
    relationshipStatuses: [],
    sort: "value",
  } as unknown as DiscoveryFilters;
}

describe("BL-073-F006 · filterTouchesZeroCoverage", () => {
  it("returns false when no filter is active (default empty state)", () => {
    expect(filterTouchesZeroCoverage(baseFilters(), FULL_COVERAGE)).toBe(false);
    expect(filterTouchesZeroCoverage(baseFilters(), ALL_ZERO)).toBe(false);
  });

  it("returns false when an active filter dim has positive coverage", () => {
    const f = baseFilters();
    f.regions = ["US", "JP"];
    expect(filterTouchesZeroCoverage(f, FULL_COVERAGE)).toBe(false);
  });

  it("returns true when filter targets a zero-coverage dim (regions)", () => {
    const f = baseFilters();
    f.regions = ["US"];
    expect(filterTouchesZeroCoverage(f, ZERO_REGIONS)).toBe(true);
  });

  it("returns true when filter targets languages with zero coverage (BL-073 prod case)", () => {
    const f = baseFilters();
    f.languages = ["en"];
    expect(filterTouchesZeroCoverage(f, ZERO_LANGS)).toBe(true);
  });

  it("does not flip on free-text search (search is not a coverage-gated dim)", () => {
    const f = baseFilters();
    f.search = "fortnite";
    expect(filterTouchesZeroCoverage(f, ALL_ZERO)).toBe(false);
  });

  it("returns true on any one zero-coverage dim regardless of other healthy dims", () => {
    const f = baseFilters();
    f.regions = ["US"];
    f.platforms = ["youtube"];
    // Only languages is zero; the active platforms+regions dims are fine,
    // so this case returns false.
    expect(filterTouchesZeroCoverage(f, ZERO_LANGS)).toBe(false);

    // Now flip platforms to zero; should fire.
    f.languages = [];
    expect(
      filterTouchesZeroCoverage(f, { ...FULL_COVERAGE, platforms: 0 }),
    ).toBe(true);
  });
});
