import type { FinancialDataProvider } from "../types";
import { MockProvider } from "./mock/mockProvider";
import { FmpProvider } from "./fmpProvider";

/**
 * Data-layer entry point. The rest of the app only ever talks to a
 * FinancialDataProvider through getProvider(); swap providers via env.
 *
 *   DATA_PROVIDER=mock (default) | fmp
 *   FINANCIAL_API_KEY=...   (server-side only; never shipped to the client)
 */
let provider: FinancialDataProvider | null = null;

export function getProvider(): FinancialDataProvider {
  if (!provider) {
    const kind = process.env.DATA_PROVIDER ?? "mock";
    provider =
      kind === "fmp"
        ? new FmpProvider(requireKey())
        : new MockProvider();
  }
  return provider;
}

function requireKey(): string {
  const key = process.env.FINANCIAL_API_KEY;
  if (!key) throw new Error("FINANCIAL_API_KEY is not set. Add it to .env.local (server-side only).");
  return key;
}

// ---------- Simple server-side TTL cache ----------
// Reduces financial-API usage. In production, back this with PostgreSQL
// (see db/schema.sql: api_cache table) or Redis; the interface is identical.

interface CacheEntry<T> {
  value: T;
  expires: number;
}
const store = new Map<string, CacheEntry<unknown>>();

export async function cached<T>(key: string, ttlSeconds: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  return value;
}
