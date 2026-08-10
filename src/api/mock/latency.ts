/** Simulated network latency so loading states are exercised realistically. */
export function latency(ms: number): Promise<void> {
  const jitter = ms * 0.35 * Math.random()
  return new Promise((resolve) => setTimeout(resolve, ms * 0.65 + jitter))
}
