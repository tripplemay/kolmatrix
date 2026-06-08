import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * BL-080-F003 · illustration fallback 守门 (server-only — uses node:fs).
 *
 * The landing components ship AI illustrations from
 * public/landing/illustrations/, but the batch tolerates a partial set
 * (spec §2.3 不变量 #1: missing illustrations degrade to the BL-078 real
 * screenshots). These helpers resolve the asset at render time on the
 * server so a not-yet-delivered PNG never produces a broken <img>.
 */

const PUBLIC_DIR = join(process.cwd(), "public");

function toAbsolute(publicPath: string): string {
  return join(PUBLIC_DIR, publicPath.replace(/^\/+/, ""));
}

/** True when the given /public-relative path exists on disk. */
export function landingAssetExists(publicPath: string): boolean {
  return existsSync(toAbsolute(publicPath));
}

/**
 * Returns `illustration` when its PNG exists under public/, otherwise the
 * `fallback` screenshot path. Lets a component prefer the illustration
 * while staying renderable if the asset is missing.
 */
export function resolveLandingAsset(illustration: string, fallback: string): string {
  return landingAssetExists(illustration) ? illustration : fallback;
}
