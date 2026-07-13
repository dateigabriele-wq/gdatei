/** Shared market-cap bucketing so every provider (mock, live) agrees. */
export function capBucketUsd(mcapUsd: number): "large" | "mid" | "small" {
  if (mcapUsd >= 10_000_000_000) return "large";
  if (mcapUsd >= 2_000_000_000) return "mid";
  return "small";
}
