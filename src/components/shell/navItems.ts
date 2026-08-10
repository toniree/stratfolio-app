import { BookOpen, House, LayoutList, LineChart, Newspaper, NotebookPen, Sparkles, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  mobileLabel?: string
  mobileIcon?: LucideIcon
  /** Shown in the mobile bottom bar rather than behind "More". */
  primary: boolean
  /** Shown in the desktop left rail. */
  rail: boolean
}

/**
 * Rail order follows the mockup: Portfolio, Positions, Theses, News,
 * Planner, Activity. Profile lives on the top-bar avatar rather than the rail.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/app/portfolio', label: 'Portfolio', icon: LineChart, mobileLabel: 'Home', mobileIcon: House, primary: true, rail: true },
  { to: '/app/positions', label: 'Positions', icon: LayoutList, mobileLabel: 'Positions', primary: true, rail: true },
  { to: '/app/thesis', label: 'Theses', icon: Sparkles, primary: false, rail: true },
  { to: '/app/news', label: 'News', icon: Newspaper, primary: true, rail: true },
  { to: '/app/plan', label: 'Planner', icon: NotebookPen, primary: true, rail: true },
  { to: '/app/activity', label: 'Activity', icon: BookOpen, primary: false, rail: true },
  { to: '/app/profile', label: 'Profile', icon: User, primary: false, rail: false },
]
