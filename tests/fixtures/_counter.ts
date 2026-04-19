/**
 * Shared monotonic counter — factories pair it with Date.now() + a random
 * suffix to guarantee unique slugs / emails / handles across parallel
 * tests within one process. Not exported from the fixtures barrel to keep
 * the factory API surface small.
 */
import { faker } from "@faker-js/faker";

let counter = 0;

export function uniqueSlug(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now()}-${counter}-${faker.string.alphanumeric(6).toLowerCase()}`;
}
