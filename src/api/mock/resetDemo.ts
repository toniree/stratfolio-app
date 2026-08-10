/**
 * Clears every piece of persisted demo state and reloads.
 *
 * Mock state (added positions, submitted orders, user-authored planner ideas)
 * is persisted so a mid-demo refresh doesn't undo the user's actions — which
 * means there has to be an explicit way back to the pristine seeded demo.
 */
const KEYS = [
  'stratfolio.portfolio.v1',
  'stratfolio.planner.userIdeas.v1',
  'stratfolio.notification-preferences.v1',
  'stratfolio.thesis-decisions.v1',
  'stratfolio.disabled-plans.v1',
  'stratfolio.mobile-market-ticker.v1',
]

export function resetDemoData(): void {
  if (typeof localStorage === 'undefined') return
  for (const key of KEYS) localStorage.removeItem(key)
  window.location.href = '/app/portfolio'
}
